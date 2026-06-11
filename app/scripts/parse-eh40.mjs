#!/usr/bin/env node
/**
 * Extract Table 1 of HSE EH40/2005 into JSON for the LabCAT app.
 *
 * USAGE
 *   npm run extract-eh40 -- /path/to/EH40.pdf
 *
 * OUTPUT
 *   Writes to src/data/eh40.json (overwriting). Adds attribution and version.
 *
 * NOTES
 *   - EH40 Table 1 columns are: Substance | CAS | TWA ppm | TWA mg/m³
 *     | STEL ppm | STEL mg/m³ | Comments.
 *   - PDFs of EH40 use multi-column rows. This parser groups text items into
 *     rows by Y position on each page and infers columns by X position.
 *   - It is heuristic — always spot-check the JSON before relying on the data
 *     for a real risk assessment.
 *   - EH40/2005 is published by HSE under Crown Copyright, OGL v3.0. Cite the
 *     official document and its version when reusing.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('Usage: npm run extract-eh40 -- /path/to/EH40.pdf');
  process.exit(1);
}

const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');

const bytes = await readFile(pdfPath);
const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;

const CAS_RE = /^\d{2,7}-\d{2}-\d$/;
const DASH_RE = /^[-–—]$/;

const entries = [];

const pushPart = (target, value) => {
  const clean = value.trim();
  if (clean) target.push(clean);
};

const cellText = (parts) => parts.join(' ').replace(/\s+/g, ' ').trim();

function normaliseValue(raw) {
  const value = raw.replace(',', '.').trim();
  if (!value || DASH_RE.test(value)) return null;
  return value;
}

function fmt(ppm, mg) {
  const p = normaliseValue(ppm);
  const m = normaliseValue(mg);
  const withUnit = (value, unit) => /[a-z]/i.test(value) ? value : `${value} ${unit}`;
  if (p && m) return `${withUnit(p, 'ppm')} (${withUnit(m, 'mg/m³')})`;
  if (p) return withUnit(p, 'ppm');
  if (m) return withUnit(m, 'mg/m³');
  return undefined;
}

function parseVisualRow(items, parent) {
  const cols = {
    name: [],
    cas: [],
    twaPpm: [],
    twaMg: [],
    stelPpm: [],
    stelMg: [],
    comments: [],
  };

  for (const { x, s } of items) {
    if (x < 176) pushPart(cols.name, s);
    else if (x < 235) pushPart(cols.cas, s);
    else if (x < 285) pushPart(cols.twaPpm, s);
    else if (x < 335) pushPart(cols.twaMg, s);
    else if (x < 385) pushPart(cols.stelPpm, s);
    else if (x < 435) pushPart(cols.stelMg, s);
    else pushPart(cols.comments, s);
  }

  const rawName = cellText(cols.name);
  const rawCas = cellText(cols.cas);
  const cas = CAS_RE.test(rawCas) ? rawCas : undefined;
  const casNote = rawCas && !cas && !DASH_RE.test(rawCas) ? rawCas : undefined;
  const hasLimit =
    cols.twaPpm.length > 0 ||
    cols.twaMg.length > 0 ||
    cols.stelPpm.length > 0 ||
    cols.stelMg.length > 0;

  if (!rawName && !hasLimit) return { entry: null, parent };

  if (!hasLimit && rawName) {
    const isContinuation = parent && /^(and|except|\(except|which|as\b|purpose\b|stibine\b|sulphide\b)/i.test(rawName);
    const name = isContinuation
      ? `${parent.name} ${rawName}`.replace(/\s+/g, ' ').trim()
      : rawName;
    return {
      entry: null,
      parent: {
        name,
        cas: cas ?? (isContinuation ? parent?.cas : undefined),
        casNote: casNote ?? (isContinuation ? parent?.casNote : undefined),
      },
    };
  }

  if (!hasLimit) return { entry: null, parent };

  const isChildFraction =
    parent &&
    !cas &&
    /^[-–—]?\s*(inhalable|respirable|total|dust|except|fume|vapou?r|mist|fibres?\b|\(as\b)/i.test(rawName);

  const name = isChildFraction
    ? `${parent.name}, ${rawName.replace(/^[-–—]?\s*/, '').replace(/^\((.*)\)$/, '$1')}`
    : rawName;

  if (!name) return { entry: null, parent };

  const twa = fmt(cellText(cols.twaPpm), cellText(cols.twaMg));
  const stel = fmt(cellText(cols.stelPpm), cellText(cols.stelMg));
  if (!twa && !stel) {
    return {
      entry: null,
      parent: rawName ? { name, cas, casNote } : parent,
    };
  }

  const notes = [
    casNote,
    cellText(cols.comments),
  ].filter(Boolean).join(', ').replace(/\s+/g, ' ').replace(/[-–—]+$/g, '').trim() || undefined;

  return {
    entry: {
      name,
      ...(cas || (isChildFraction && parent.cas) ? { cas: cas ?? parent.cas } : {}),
      twa,
      stel,
      notes,
    },
    parent: isChildFraction ? parent : { name, cas, casNote },
  };
}

for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
  // In the current EH40 PDF, Table 1 starts on PDF page 9 and ends on page 21.
  // Later pages contain supplementary text and alphabetical cross-references
  // laid out in similar columns, so parsing them as WEL rows creates false
  // entries.
  if (pageNum < 9 || pageNum > 21) continue;

  const page = await pdf.getPage(pageNum);
  const text = await page.getTextContent();

  // Group items by approximate y (row).
  const rows = new Map();
  for (const item of text.items) {
    const y = Math.round(item.transform[5]);
    const x = item.transform[4];
    const s = item.str.trim();
    if (!s) continue;
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push({ x, s });
  }

  // Order rows top-to-bottom, items left-to-right.
  const orderedRows = [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, items]) => items.sort((a, b) => a.x - b.x));

  let parent = null;
  for (const row of orderedRows) {
    const rowText = row.map((it) => it.s).join(' ');
    if (
      /^(EH40\/2005|Table 1|TABLE 1|Substance|Long-term|Short-term|Workplace exposure|ppm|mg\.m|Comments|The Carc|exhaustive\.|LIST OF)/i.test(rowText) ||
      /^\d+$/.test(rowText)
    ) continue;

    const parsed = parseVisualRow(row, parent);
    parent = parsed.parent;
    if (parsed.entry) entries.push(parsed.entry);
  }
}

// Deduplicate by name+CAS+limits. Do not dedupe by CAS alone because EH40 often
// has separate inhalable/respirable/fraction-specific limits for the same CAS.
const seen = new Set();
const deduped = entries.filter((e) => {
  const key = [e.name, e.cas ?? '', e.twa ?? '', e.stel ?? ''].join('|').toLowerCase();
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const output = {
  source: 'HSE EH40/2005 Workplace Exposure Limits',
  version: `Extracted ${new Date().toISOString().slice(0, 10)} from ${path.basename(pdfPath)}`,
  license:
    'Contains public sector information published by the Health and Safety Executive and licensed under the Open Government Licence v3.0.',
  notes:
    'Heuristically extracted from PDF Table 1. Spot-check entries before relying on values for risk assessment.',
  entries: deduped,
};

const outPath = path.resolve(__dirname, '..', 'src', 'data', 'eh40.json');
await writeFile(outPath, JSON.stringify(output, null, 2));

console.log(`Wrote ${deduped.length} entries → ${outPath}`);
if (deduped.length === 0) {
  console.warn('No entries extracted. The PDF layout may not match the parser heuristics — inspect a few rows and adjust scripts/parse-eh40.mjs.');
}
