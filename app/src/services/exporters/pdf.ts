import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage, RGB } from 'pdf-lib';
import { Assessment, riskRating, PersonsAtRisk, GhsPictogram } from '@/types/assessment';
import { exportFileName } from './_filename';
import { loadPictograms } from './ghsImages';
import { suggestControls, OverallSuggestion, SubstanceAnalysis } from '@/services/coshhEssentials';
import { COSHH_INTRO, HAZARD_GROUP_HELP, EP_HELP, APPROACH_HELP } from './coshhSummary';

// ── Layout ─────────────────────────────────────────────
const PAGE_W = 595;
const PAGE_H = 842;
const M_X = 48;
const M_TOP = 64;
const M_BOTTOM = 56;
const CONTENT_W = PAGE_W - M_X * 2;

// ── Palette ────────────────────────────────────────────
const TEAL = rgb(13 / 255, 148 / 255, 136 / 255);
const TEAL_DARK = rgb(15 / 255, 118 / 255, 110 / 255);
const INK = rgb(15 / 255, 23 / 255, 42 / 255);
const MUTED = rgb(100 / 255, 116 / 255, 139 / 255);
const LINE = rgb(226 / 255, 232 / 255, 240 / 255);
const ZEBRA = rgb(248 / 255, 250 / 255, 252 / 255);
const WHITE = rgb(1, 1, 1);

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  pageNo: number;
}

// WinAnsi (used by StandardFonts) cannot encode characters like → ✓ ← etc.
// Map the ones we actually emit; strip everything else outside printable WinAnsi.
const SAFE_MAP: Record<string, string> = {
  '→': '->',
  '←': '<-',
  '↔': '<->',
  '⇒': '=>',
  '✓': 'v',
  '✗': 'x',
  '•': '·',
};
function safe(s: string | undefined | null): string {
  if (!s) return '';
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (SAFE_MAP[ch]) { out += SAFE_MAP[ch]; continue; }
    // Allow basic Latin + Latin-1 Supplement printable + common CP1252 punctuation
    // that pdf-lib's WinAnsi can encode.
    if (code === 0x09 || code === 0x0A || code === 0x0D) { out += ch; continue; }
    if (code >= 0x20 && code <= 0x7E) { out += ch; continue; }
    if (code >= 0xA0 && code <= 0xFF) { out += ch; continue; }
    // CP1252 extras handled by WinAnsi
    if ('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.includes(ch)) {
      out += ch; continue;
    }
    out += '?';
  }
  return out;
}

function drawRect(ctx: Ctx, x: number, y: number, w: number, h: number, color: RGB) {
  ctx.page.drawRectangle({ x, y, width: w, height: h, color });
}

function drawHRule(ctx: Ctx, y: number, color: RGB = LINE) {
  ctx.page.drawRectangle({ x: M_X, y, width: CONTENT_W, height: 0.5, color });
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - M_TOP;
  ctx.pageNo += 1;
}

function ensure(ctx: Ctx, need: number) {
  if (ctx.y - need < M_BOTTOM) newPage(ctx);
}

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const safeStr = safe(text);
  if (!safeStr) return [''];
  const lines: string[] = [];
  for (const rawLine of safeStr.split('\n')) {
    const words = rawLine.split(/\s+/);
    let line = '';
    for (const w of words) {
      const trial = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(trial, size) > max) {
        if (line) lines.push(line);
        // Hard-wrap a single overlong token if needed
        if (font.widthOfTextAtSize(w, size) > max) {
          let chunk = '';
          for (const ch of w) {
            if (font.widthOfTextAtSize(chunk + ch, size) > max) {
              lines.push(chunk);
              chunk = ch;
            } else chunk += ch;
          }
          line = chunk;
        } else {
          line = w;
        }
      } else {
        line = trial;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [''];
}

function drawText(
  ctx: Ctx, str: string,
  opts: { size?: number; bold?: boolean; color?: RGB; x?: number; maxWidth?: number } = {},
): void {
  const size = opts.size ?? 10;
  const font = opts.bold ? ctx.bold : ctx.font;
  const color = opts.color ?? INK;
  const x = opts.x ?? M_X;
  const maxW = opts.maxWidth ?? (PAGE_W - x - M_X);
  const lines = wrap(str, font, size, maxW);
  for (const ln of lines) {
    ensure(ctx, size + 4);
    ctx.page.drawText(ln, { x, y: ctx.y - size, size, font, color });
    ctx.y -= size + 4;
  }
}

// ── Section banner: solid teal bar with title ──────────
function sectionBanner(ctx: Ctx, n: number, title: string): void {
  ensure(ctx, 40);
  ctx.y -= 8;
  const h = 28;
  drawRect(ctx, M_X, ctx.y - h, CONTENT_W, h, TEAL);
  ctx.page.drawText(safe(`${String(n).padStart(2, '0')}   ${title.toUpperCase()}`), {
    x: M_X + 14,
    y: ctx.y - h + 10,
    size: 12,
    font: ctx.bold,
    color: WHITE,
  });
  ctx.y -= h + 12;
}

// ── Subheading inside a section ────────────────────────
function subHeading(ctx: Ctx, s: string): void {
  ensure(ctx, 24);
  ctx.y -= 4;
  ctx.page.drawText(safe(s), {
    x: M_X,
    y: ctx.y - 12,
    size: 11,
    font: ctx.bold,
    color: TEAL_DARK,
  });
  ctx.y -= 16;
  drawHRule(ctx, ctx.y + 4, TEAL);
  ctx.y -= 4;
}

// ── Key/value row with zebra striping and bottom rule ──
function kvRow(ctx: Ctx, label: string, value: string, idx: number): void {
  const labelW = 150;
  const valueW = CONTENT_W - labelW - 16;
  const valueLines = wrap(value || '—', ctx.font, 10, valueW);
  const rowH = Math.max(20, valueLines.length * 14 + 8);
  ensure(ctx, rowH);
  if (idx % 2 === 1) {
    drawRect(ctx, M_X, ctx.y - rowH, CONTENT_W, rowH, ZEBRA);
  }
  // Label
  ctx.page.drawText(safe(label), {
    x: M_X + 8,
    y: ctx.y - 14,
    size: 9,
    font: ctx.bold,
    color: MUTED,
  });
  // Value lines
  let vy = ctx.y - 14;
  for (const ln of valueLines) {
    ctx.page.drawText(ln, {
      x: M_X + labelW + 8,
      y: vy,
      size: 10,
      font: ctx.font,
      color: INK,
    });
    vy -= 14;
  }
  ctx.y -= rowH;
  drawHRule(ctx, ctx.y);
}

function kvBlock(ctx: Ctx, rows: [string, string][]): void {
  // Top rule
  drawHRule(ctx, ctx.y);
  rows.forEach(([k, v], i) => kvRow(ctx, k, v, i));
  ctx.y -= 8;
}

function personsLine(p: PersonsAtRisk): string {
  const map: [keyof PersonsAtRisk, string][] = [
    ['staff', 'Staff'], ['students', 'Students'], ['thirdParty', 'Third Party'],
    ['contractors', 'Contractors'], ['visitors', 'Visitors'], ['public', 'Public'],
  ];
  const on = map.filter(([k]) => p[k]).map(([, l]) => l);
  return on.length ? on.join(', ') : '—';
}

// ── Cover / title block on the first page ──────────────
function cover(ctx: Ctx, a: Assessment): void {
  // Eyebrow
  ctx.page.drawText('COSHH RISK ASSESSMENT', {
    x: M_X, y: ctx.y - 10, size: 9, font: ctx.bold, color: TEAL,
  });
  ctx.y -= 22;

  // Title (wraps if long)
  const title = a.overview.activityTitle || 'Untitled assessment';
  const titleLines = wrap(title, ctx.bold, 24, CONTENT_W);
  for (const ln of titleLines) {
    ctx.page.drawText(ln, { x: M_X, y: ctx.y - 24, size: 24, font: ctx.bold, color: INK });
    ctx.y -= 28;
  }

  // Subtitle
  ctx.page.drawText(safe(a.overview.businessUnit || 'Business unit not set'), {
    x: M_X, y: ctx.y - 12, size: 11, font: ctx.font, color: MUTED,
  });
  ctx.y -= 22;

  // Accent rule
  drawRect(ctx, M_X, ctx.y, 64, 3, TEAL);
  ctx.y -= 24;

  // Meta strip (4 columns)
  const cells: [string, string][] = [
    ['REF', a.overview.riskAssessmentRef || '—'],
    ['ASSESSOR', a.overview.assessor || '—'],
    ['ASSESSED', a.overview.dateOfAssessment || '—'],
    ['NEXT REVIEW', a.overview.dateOfNextReview || '—'],
  ];
  const colW = CONTENT_W / cells.length;
  const stripH = 50;
  drawRect(ctx, M_X, ctx.y - stripH, CONTENT_W, stripH, ZEBRA);
  cells.forEach(([k, v], i) => {
    const cx = M_X + colW * i + 12;
    ctx.page.drawText(k, { x: cx, y: ctx.y - 16, size: 8, font: ctx.bold, color: MUTED });
    const vLine = wrap(v, ctx.bold, 11, colW - 24)[0];
    ctx.page.drawText(vLine, { x: cx, y: ctx.y - 34, size: 11, font: ctx.bold, color: INK });
  });
  ctx.y -= stripH + 12;

  const today = new Date().toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  ctx.page.drawText(safe(`Generated ${today} with CAT — COSHH Assessment Tool`), {
    x: M_X, y: ctx.y - 10, size: 9, font: ctx.font, color: MUTED,
  });
  ctx.y -= 24;
}

// ── Pictogram strip ────────────────────────────────────
interface PictoEntry { id: GhsPictogram; label: string; image: PDFImage }

function drawPictograms(ctx: Ctx, entries: PictoEntry[], opts: { withLabels?: boolean } = {}): void {
  if (entries.length === 0) {
    drawText(ctx, 'No GHS pictograms recorded.', { color: MUTED, size: 9 });
    return;
  }
  const size = 40;
  const gap = 10;
  const labelH = opts.withLabels ? 22 : 0;
  const rowH = size + labelH + 6;
  let x = M_X;
  ensure(ctx, rowH);
  const lineY = ctx.y;
  entries.forEach((e) => {
    if (x + size > M_X + CONTENT_W) {
      // wrap
      ctx.y -= rowH;
      ensure(ctx, rowH);
      x = M_X;
    }
    ctx.page.drawImage(e.image, { x, y: ctx.y - size, width: size, height: size });
    if (opts.withLabels) {
      const lines = wrap(e.label, ctx.font, 7, size + gap);
      let ly = ctx.y - size - 8;
      for (const ln of lines.slice(0, 2)) {
        const w = ctx.font.widthOfTextAtSize(ln, 7);
        ctx.page.drawText(ln, {
          x: x + (size - w) / 2,
          y: ly,
          size: 7,
          font: ctx.font,
          color: MUTED,
        });
        ly -= 9;
      }
    }
    x += size + gap;
  });
  ctx.y = Math.min(lineY, ctx.y) - rowH;
}

// ── COSHH per-substance breakdown table ────────────────
function drawCoshhBreakdown(ctx: Ctx, analyses: SubstanceAnalysis[], drivingApproach: number): void {
  const cols = [
    { title: 'Substance', w: 0.26 },
    { title: 'Group', w: 0.08 },
    { title: 'H-codes', w: 0.22 },
    { title: 'Scale', w: 0.10 },
    { title: 'Band', w: 0.16 },
    { title: 'EP', w: 0.08 },
    { title: 'Approach', w: 0.10 },
  ];
  const widths = cols.map((c) => Math.floor(c.w * CONTENT_W));
  const headerH = 22;

  const drawHeader = () => {
    ensure(ctx, headerH + 4);
    drawRect(ctx, M_X, ctx.y - headerH, CONTENT_W, headerH, TEAL);
    let cx = M_X;
    cols.forEach((c, i) => {
      ctx.page.drawText(c.title, {
        x: cx + 6, y: ctx.y - headerH + 7, size: 8, font: ctx.bold, color: WHITE,
      });
      cx += widths[i];
    });
    ctx.y -= headerH;
  };
  drawHeader();

  analyses.forEach((a, i) => {
    const drives = a.approach === drivingApproach;
    const values = [
      a.name || '—',
      a.hazardGroup,
      a.drivingHCodes.join(', ') || '—',
      `${a.scale}${a.assumed.scale ? ' *' : ''}`,
      a.bandKind === 'not-applicable' ? '—' : `${a.band} (${a.bandKind})${a.assumed.band ? ' *' : ''}`,
      a.exposurePredictor ?? '—',
      `${a.approach}`,
    ];
    // Compute wrapped lines per cell
    const wrapped = values.map((v, idx) =>
      wrap(v, idx === 0 ? ctx.bold : ctx.font, 9, widths[idx] - 12),
    );
    const lineCount = Math.max(...wrapped.map((l) => l.length));
    const rowH = Math.max(20, lineCount * 11 + 8);

    if (ctx.y - rowH < M_BOTTOM) {
      newPage(ctx);
      drawHeader();
    }
    if (i % 2 === 1) drawRect(ctx, M_X, ctx.y - rowH, CONTENT_W, rowH, ZEBRA);

    let cx = M_X;
    wrapped.forEach((lines, idx) => {
      let ly = ctx.y - 12;
      const useFont = idx === 0 ? ctx.bold : (idx === 6 ? ctx.bold : ctx.font);
      const color = (idx === 6 && drives) ? TEAL_DARK : INK;
      for (const ln of lines) {
        ctx.page.drawText(ln, { x: cx + 6, y: ly, size: 9, font: useFont, color });
        ly -= 11;
      }
      cx += widths[idx];
    });
    if (drives) {
      // Tiny indicator row under name
      const tag = 'drives controls';
      const lastY = ctx.y - 12 - wrapped[0].length * 11;
      ctx.page.drawText(tag, { x: M_X + 6, y: lastY, size: 7, font: ctx.font, color: TEAL_DARK });
    }
    ctx.y -= rowH;
    drawHRule(ctx, ctx.y);
  });
  ctx.y -= 4;
  drawText(ctx, '* assumed value used because input was missing or unparseable.',
    { size: 8, color: MUTED });
  ctx.y -= 4;
}

// ── Reference table for legend entries ─────────────────
function drawReferenceTable(ctx: Ctx, title: string, rows: [string, string][]): void {
  ensure(ctx, 24);
  drawRect(ctx, M_X, ctx.y - 20, CONTENT_W, 20, TEAL);
  ctx.page.drawText(safe(title), {
    x: M_X + 8, y: ctx.y - 14, size: 9, font: ctx.bold, color: WHITE,
  });
  ctx.y -= 20;
  const keyW = 86;
  rows.forEach(([k, v], i) => {
    const lines = wrap(v, ctx.font, 9, CONTENT_W - keyW - 16);
    const rowH = Math.max(16, lines.length * 12 + 6);
    ensure(ctx, rowH);
    if (i % 2 === 1) drawRect(ctx, M_X, ctx.y - rowH, CONTENT_W, rowH, ZEBRA);
    ctx.page.drawText(safe(k), {
      x: M_X + 8, y: ctx.y - 12, size: 9, font: ctx.bold, color: TEAL_DARK,
    });
    let ly = ctx.y - 12;
    for (const ln of lines) {
      ctx.page.drawText(ln, { x: M_X + keyW + 8, y: ly, size: 9, font: ctx.font, color: INK });
      ly -= 12;
    }
    ctx.y -= rowH;
    drawHRule(ctx, ctx.y);
  });
  ctx.y -= 10;
}

// ── Page footer rendered after layout pass ─────────────
function renderFooters(doc: PDFDocument, font: PDFFont): void {
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    const label = `CAT — COSHH Assessment Tool   ·   Page ${i + 1} / ${pages.length}`;
    const w = font.widthOfTextAtSize(label, 8);
    page.drawRectangle({
      x: M_X, y: M_BOTTOM - 14, width: CONTENT_W, height: 0.5, color: LINE,
    });
    page.drawText(safe(label), {
      x: PAGE_W - M_X - w,
      y: M_BOTTOM - 26,
      size: 8,
      font,
      color: MUTED,
    });
  });
}

export async function exportPdf(a: Assessment): Promise<void> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = {
    doc,
    page: doc.addPage([PAGE_W, PAGE_H]),
    y: PAGE_H - M_TOP,
    font, bold,
    pageNo: 1,
  };

  // Pre-load pictograms used + the full legend, embed each PNG once.
  const usedPictoIds: GhsPictogram[] = Array.from(new Set(
    a.processSteps.flatMap((s) => s.chemicals.flatMap((c) => c.ghsPictograms)),
  ));
  const ALL_PICTOS: GhsPictogram[] = [
    'explosive', 'flammable', 'oxidising', 'compressed-gas',
    'corrosive', 'toxic', 'harmful', 'health-hazard', 'environmental',
  ];
  const pictoUnion = Array.from(new Set<GhsPictogram>([...usedPictoIds, ...ALL_PICTOS]));
  const pictoRaw = await loadPictograms(pictoUnion);
  const pictoMap = new Map<GhsPictogram, PictoEntry>();
  for (const p of pictoRaw) {
    const image = await doc.embedPng(p.bytes);
    pictoMap.set(p.id, { id: p.id, label: p.label, image });
  }
  const legendEntries: PictoEntry[] = ALL_PICTOS
    .map((id) => pictoMap.get(id))
    .filter((p): p is PictoEntry => !!p);

  const coshh: OverallSuggestion | null = suggestControls(
    a.processSteps.flatMap((s) => s.chemicals),
  );

  // Cover
  cover(ctx, a);

  // 01 Overview
  sectionBanner(ctx, 1, 'Overview');
  kvBlock(ctx, [
    ['Business Unit', a.overview.businessUnit],
    ['Risk Assessment Ref', a.overview.riskAssessmentRef],
    ['SOP Ref', a.overview.sopRef],
    ['Risk Assessor', a.overview.assessor],
    ['Date of Assessment', a.overview.dateOfAssessment],
    ['Date of Next Review', a.overview.dateOfNextReview],
    ['Location(s)', a.overview.locations],
    ['Activity Title', a.overview.activityTitle],
    ['Persons at Risk', personsLine(a.overview.personsAtRisk)],
  ]);
  drawText(ctx, 'Activity Outline', { size: 9, bold: true, color: MUTED });
  drawText(ctx, a.overview.activityOutline || '—', { size: 10 });
  ctx.y -= 6;

  // 02 Task Hazards
  sectionBanner(ctx, 2, 'Task Hazards');
  if (a.taskHazards.length === 0) {
    drawText(ctx, 'No hazards recorded.', { color: MUTED });
  } else {
    a.taskHazards.forEach((h, i) => {
      subHeading(ctx, `Hazard ${i + 1} — ${h.hazard || '—'}`);
      kvBlock(ctx, [
        ['How harm occurs', h.harmMechanism],
        ['Risk (before controls)',
          `${riskRating(h.riskEvaluation) || '—'}  (L${h.riskEvaluation.likelihood} × S${h.riskEvaluation.severity})`],
        ['Controls in place', h.controlsInPlace],
        ['Residual risk',
          `${riskRating(h.residualRisk) || '—'}  (L${h.residualRisk.likelihood} × S${h.residualRisk.severity})`],
        ['Further action', h.furtherAction],
        ['Owner', h.owner],
        ['Due', h.dueDate],
        ['Completed', h.completionDate],
      ]);
    });
  }

  // 03 Process Steps & Chemicals
  sectionBanner(ctx, 3, 'COSHH Process Steps & Chemicals');
  if (a.processSteps.length === 0) {
    drawText(ctx, 'No process steps recorded.', { color: MUTED });
  } else {
    a.processSteps.forEach((step, si) => {
      subHeading(ctx, `Step ${si + 1} — ${step.step || '—'}`);
      if (step.chemicals.length === 0) {
        drawText(ctx, 'No chemicals recorded for this step.', { color: MUTED, size: 9 });
      }
      step.chemicals.forEach((s, ci) => {
        const idParts = [
          s.cas ? `CAS ${s.cas}` : null,
          s.pubchemCid ? `PubChem CID ${s.pubchemCid}` : null,
        ].filter(Boolean).join('  ·  ');
        ctx.y -= 4;
        drawText(ctx, `${si + 1}.${ci + 1}    ${s.name || '—'}${idParts ? `    (${idParts})` : ''}`,
          { bold: true, size: 11 });
        const routes = Object.entries(s.exposureRoutes).filter(([, v]) => v).map(([k]) => k).join(', ');
        kvBlock(ctx, [
          ['Form / quantity', `${s.form}  ·  ${s.quantity || '—'}`],
          ['H-codes', s.hazardStatements.map((c) => `${c.code} ${c.text}`).join('; ') || '—'],
          ['WEL TWA / STEL',
            `${s.wel.twa || '—'}  /  ${s.wel.stel || '—'}${s.wel.source ? `  (${s.wel.source})` : ''}`],
          ['Exposure',
            `${s.exposureDuration || '—'}, ${s.exposureFrequency || '—'}  ·  routes: ${routes || '—'}`],
        ]);
        drawText(ctx, 'GHS pictograms', { size: 8, bold: true, color: MUTED });
        ctx.y -= 2;
        const entries = s.ghsPictograms
          .map((id) => pictoMap.get(id))
          .filter((p): p is PictoEntry => !!p);
        drawPictograms(ctx, entries);
        ctx.y -= 4;
      });
    });
  }

  // 04 COSHH Essentials Screening
  sectionBanner(ctx, 4, 'COSHH Essentials Screening');
  for (const line of COSHH_INTRO) {
    drawText(ctx, line, { size: 9 });
    ctx.y -= 2;
  }
  if (!coshh) {
    drawText(ctx, 'No substances have been recorded, so a screening could not be produced.',
      { color: MUTED });
  } else {
    subHeading(ctx, `Recommended approach — ${coshh.approachLabel}`);
    const d = coshh.driver;
    if (d) {
      const line =
        `Driven by ${d.name} — hazard group ${d.hazardGroup}` +
        (d.drivingHCodes.length ? ` (${d.drivingHCodes.join(', ')})` : '') +
        `, scale ${d.scale}` +
        (d.bandKind !== 'not-applicable' ? `, ${d.bandKind} ${d.band}` : '') +
        (d.exposurePredictor ? `, exposure predictor ${d.exposurePredictor}` : '') + '.';
      drawText(ctx, line, { size: 10 });
    }
    drawText(ctx, `Reference: ${coshh.gSheetRef}.`, { size: 9, color: MUTED });
    ctx.y -= 6;
    drawText(ctx, 'Per-substance breakdown', { size: 10, bold: true, color: TEAL_DARK });
    ctx.y -= 2;
    drawCoshhBreakdown(ctx, coshh.analyses, coshh.approach);
    if (coshh.warnings.length) {
      ctx.y -= 4;
      drawText(ctx, 'Caveats & assumptions', { size: 10, bold: true, color: TEAL_DARK });
      coshh.warnings.forEach((w) => drawText(ctx, `• ${w}`, { size: 9 }));
      ctx.y -= 4;
    }
  }
  drawText(ctx, 'Reference legend', { size: 10, bold: true, color: TEAL_DARK });
  ctx.y -= 4;
  drawReferenceTable(ctx, 'Hazard group',
    HAZARD_GROUP_HELP.map(([k, v]): [string, string] => [`Group ${k}`, v]));
  drawReferenceTable(ctx, 'Exposure predictor (EP) band', EP_HELP);
  drawReferenceTable(ctx, 'Control approach',
    APPROACH_HELP.map(([k, v]): [string, string] => [`Approach ${k}`, v]));

  subHeading(ctx, 'GHS pictogram legend');
  drawPictograms(ctx, legendEntries, { withLabels: true });
  ctx.y -= 4;

  // 05 Control Measures
  sectionBanner(ctx, 5, 'Control Measures');
  kvBlock(ctx, [
    ['Elimination', a.controls.elimination],
    ['Substitution', a.controls.substitution],
    ['Reduction', a.controls.reduction],
    ['Engineering', a.controls.engineering],
    ['Administrative', a.controls.administrative],
    ['PPE', `${a.controls.ppe.type || '—'}${a.controls.ppe.standard ? `  (${a.controls.ppe.standard})` : ''}`],
    ['Air Monitoring', a.controls.airMonitoring],
    ['Health Surveillance', a.controls.healthSurveillance],
  ]);

  // 05 Additional
  sectionBanner(ctx, 6, 'Additional Requirements');
  kvBlock(ctx, [
    ['ChemInventory logged', a.additional.cheminventoryLogged ? 'Yes' : 'No'],
    ['SDS version / date', `${a.additional.sdsVersion || '—'}  ·  ${a.additional.sdsDate || '—'}`],
    ['Storage', a.additional.storage],
    ['Incompatible substances', a.additional.incompatibles],
  ]);

  sectionBanner(ctx, 7, 'Emergency Response');
  kvBlock(ctx, [
    ['Emergency — Spills', a.emergency.emergencySpills],
    ['Emergency — First aid', a.emergency.emergencyFirstAid],
    ['Emergency — Fire', a.emergency.emergencyFire],
    ['Waste handling', a.emergency.wasteHandling],
    ['Other', a.emergency.other],
  ]);

  // 06 Briefing
  sectionBanner(ctx, 8, 'Briefing Record');
  if (a.briefing.length === 0) {
    drawText(ctx, 'No briefing entries recorded.', { color: MUTED });
  } else {
    for (const b of a.briefing) {
      ensure(ctx, 70);
      ctx.y -= 4;
      drawText(ctx, `${b.name || '(unsigned)'}    ·    ${b.date || '—'}`,
        { bold: true, size: 11 });
      if (b.signaturePng) {
        try {
          const png = await doc.embedPng(b.signaturePng);
          const w = 160;
          const h = (png.height / png.width) * w;
          ensure(ctx, h + 8);
          ctx.page.drawImage(png, { x: M_X, y: ctx.y - h, width: w, height: h });
          ctx.y -= h + 8;
        } catch {
          drawText(ctx, '(signature could not be embedded)', { color: MUTED, size: 9 });
        }
      }
    }
  }

  renderFooters(doc, font);

  const bytes = await doc.save();
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  const blob = new Blob([buf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName(a, 'pdf');
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
