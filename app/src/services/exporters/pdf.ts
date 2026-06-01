import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage, RGB } from 'pdf-lib';
import { Assessment, riskRating, PersonsAtRisk, GhsPictogram } from '@/types/assessment';
import { exportFileName } from './_filename';
import { loadPictograms } from './ghsImages';
import { suggestControls, OverallSuggestion, SubstanceAnalysis } from '@/services/coshhEssentials';
import { classifyStorage, StorageGroupId } from '@/services/storageClassifier';
import { HAZARD_GROUP_HELP, EP_HELP, APPROACH_HELP } from './coshhSummary';
import { fullReportOptions, ReportOptions } from './reportOptions';

// ── Layout ─────────────────────────────────────────────
const PAGE_W = 842;
const PAGE_H = 595;
const M_X = 30;
const M_TOP = 34;
const M_BOTTOM = 40;
const CONTENT_W = PAGE_W - M_X * 2;

// ── Palette ────────────────────────────────────────────
const NAVY = rgb(7 / 255, 48 / 255, 99 / 255);
const NAVY_2 = rgb(14 / 255, 74 / 255, 132 / 255);
const TEAL = rgb(13 / 255, 148 / 255, 136 / 255);
const TEAL_DARK = rgb(15 / 255, 118 / 255, 110 / 255);
const INK = rgb(15 / 255, 23 / 255, 42 / 255);
const MUTED = rgb(100 / 255, 116 / 255, 139 / 255);
const LINE = rgb(226 / 255, 232 / 255, 240 / 255);
const ZEBRA = rgb(248 / 255, 250 / 255, 252 / 255);
const SOFT_BLUE = rgb(239 / 255, 246 / 255, 255 / 255);
const SOFT_TEAL = rgb(240 / 255, 253 / 255, 250 / 255);
const SOFT_AMBER = rgb(255 / 255, 251 / 255, 235 / 255);
const SOFT_PURPLE = rgb(250 / 255, 245 / 255, 255 / 255);
const WHITE = rgb(1, 1, 1);
const DASH = '—';

const formatStepControlList = (values: string[] | undefined) =>
  values && values.length > 0 ? values.join(', ') : DASH;

const formatStepControls = (step: { controls?: { engineering?: string[]; ppe?: string[]; other?: string } }) => [
  ['Engineering controls', formatStepControlList(step.controls?.engineering)],
  ['PPE', formatStepControlList(step.controls?.ppe)],
  ['Other step controls', step.controls?.other?.trim() || DASH],
] as [string, string][];

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

type Chemical = Assessment['processSteps'][number]['chemicals'][number];
type RowCell = string | { text: string; bold?: boolean; color?: RGB };
type ChemicalDetailRow = Chemical & {
  formSummary: string;
  quantitySummary: string;
  welSummary: { twa: string; stel: string; source: string };
  exposureDuration: string;
  exposureFrequency: string;
};

function drawBorder(ctx: Ctx, x: number, y: number, w: number, h: number, color: RGB = LINE) {
  ctx.page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: 0.7, color });
  ctx.page.drawLine({ start: { x, y: y - h }, end: { x: x + w, y: y - h }, thickness: 0.7, color });
  ctx.page.drawLine({ start: { x, y }, end: { x, y: y - h }, thickness: 0.7, color });
  ctx.page.drawLine({ start: { x: x + w, y }, end: { x: x + w, y: y - h }, thickness: 0.7, color });
}

function drawCard(ctx: Ctx, x: number, topY: number, w: number, h: number, fill: RGB = WHITE, border: RGB = LINE) {
  ctx.page.drawRectangle({ x, y: topY - h, width: w, height: h, color: fill });
  drawBorder(ctx, x, topY, w, h, border);
}

function drawLabelledValue(
  ctx: Ctx,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number,
  opts: { labelSize?: number; valueSize?: number } = {},
) {
  ctx.page.drawText(safe(label.toUpperCase()), {
    x,
    y,
    size: opts.labelSize ?? 6.5,
    font: ctx.bold,
    color: NAVY,
  });
  const lines = wrap(value || DASH, ctx.font, opts.valueSize ?? 8, w);
  lines.slice(0, 2).forEach((line, i) => {
    ctx.page.drawText(line, {
      x,
      y: y - 12 - (i * 10),
      size: opts.valueSize ?? 8,
      font: ctx.font,
      color: INK,
    });
  });
}

function drawSectionTab(ctx: Ctx, n: number | string, title: string, x = M_X, y = ctx.y, w?: number) {
  const label = `${String(n).padStart(2, '0')}  ${title.toUpperCase()}`;
  const tabW = w ?? Math.min(260, ctx.bold.widthOfTextAtSize(label, 8.5) + 26);
  ctx.page.drawRectangle({ x, y: y - 18, width: tabW, height: 18, color: NAVY });
  ctx.page.drawText(safe(label), {
    x: x + 10,
    y: y - 12.5,
    size: 8.5,
    font: ctx.bold,
    color: WHITE,
  });
}

function drawHeader(ctx: Ctx, a: Assessment) {
  const title = a.overview.activityTitle || 'Untitled assessment';
  ctx.page.drawText('COSHH RISK ASSESSMENT', {
    x: M_X,
    y: PAGE_H - M_TOP - 4,
    size: 8.5,
    font: ctx.bold,
    color: NAVY_2,
  });
  wrap(title, ctx.bold, 21, 350).slice(0, 2).forEach((line, i) => {
    ctx.page.drawText(line, {
      x: M_X,
      y: PAGE_H - M_TOP - 26 - (i * 24),
      size: 21,
      font: ctx.bold,
      color: NAVY,
    });
  });
  ctx.page.drawText(safe(a.overview.businessUnit || 'Business unit not set'), {
    x: M_X,
    y: PAGE_H - M_TOP - 76,
    size: 9,
    font: ctx.font,
    color: INK,
  });

  const metaX = PAGE_W - M_X - 405;
  drawCard(ctx, metaX, PAGE_H - 24, 405, 58, WHITE, LINE);
  const meta: [string, string][] = [
    ['Ref', a.overview.riskAssessmentRef],
    ['Assessor', a.overview.assessor],
    ['Assessed', a.overview.dateOfAssessment],
    ['Next review', a.overview.dateOfNextReview],
  ];
  const colW = 405 / 4;
  meta.forEach(([label, value], i) => {
    const x = metaX + 16 + (i * colW);
    if (i > 0) {
      ctx.page.drawLine({
        start: { x: metaX + (i * colW), y: PAGE_H - 34 },
        end: { x: metaX + (i * colW), y: PAGE_H - 70 },
        thickness: 0.6,
        color: LINE,
      });
    }
    drawLabelledValue(ctx, label, value || DASH, x, PAGE_H - 45, colW - 24, { valueSize: 8.5 });
  });

  const generated = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const line = `Generated ${generated} with CAT — COSHH Assessment Tool`;
  const w = ctx.font.widthOfTextAtSize(line, 7.5);
  ctx.page.drawText(safe(line), {
    x: PAGE_W - M_X - w,
    y: PAGE_H - 98,
    size: 7.5,
    font: ctx.font,
    color: MUTED,
  });
  ctx.y = PAGE_H - 122;
}

function drawCompactKvGrid(ctx: Ctx, rows: [string, string][], x: number, topY: number, w: number, cols: number) {
  const colW = w / cols;
  const rowH = 32;
  rows.forEach(([label, value], i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    drawLabelledValue(ctx, label, value || DASH, x + (col * colW) + 12, topY - 25 - (row * rowH), colW - 24);
  });
}

function drawInfoCard(
  ctx: Ctx,
  title: string,
  body: string,
  x: number,
  topY: number,
  w: number,
  h: number,
  fill: RGB = WHITE,
) {
  drawCard(ctx, x, topY, w, h, fill);
  ctx.page.drawText(safe(title), {
    x: x + 12,
    y: topY - 17,
    size: 9,
    font: ctx.bold,
    color: NAVY,
  });
  wrap(body || DASH, ctx.font, 8, w - 24).slice(0, Math.max(2, Math.floor((h - 28) / 10))).forEach((line, i) => {
    ctx.page.drawText(line, {
      x: x + 12,
      y: topY - 32 - (i * 10),
      size: 8,
      font: ctx.font,
      color: INK,
    });
  });
}

function chemicalNames(step: Assessment['processSteps'][number]) {
  return step.chemicals.map((chemical) => chemical.name.trim()).filter(Boolean).join(', ') || DASH;
}

function hCodeSummary(c: Chemical) {
  return c.hazardStatements.map((h) => h.text ? `${h.code} ${h.text}` : h.code).join('; ') || DASH;
}

function uniqueText(values: Array<string | undefined>) {
  const unique = [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
  return unique.length ? unique.join(', ') : DASH;
}

function chemicalDetailRows(a: Assessment): ChemicalDetailRow[] {
  const groups = new Map<string, Chemical[]>();
  a.processSteps.flatMap((step) => step.chemicals).forEach((chemical) => {
    const key = (chemical.cas?.trim() || chemical.name).toLowerCase().trim() || chemical.id;
    groups.set(key, [...(groups.get(key) ?? []), chemical]);
  });
  return [...groups.values()].map((items) => {
    const primary = items[0];
    return {
      ...primary,
      hazardStatements: [...new Map(items.flatMap((item) => item.hazardStatements).map((h) => [h.code, h])).values()],
      ghsPictograms: [...new Set(items.flatMap((item) => item.ghsPictograms))],
      formSummary: uniqueText(items.map((item) => item.form)),
      quantitySummary: uniqueText(items.map((item) => item.quantity)),
      welSummary: {
        twa: uniqueText(items.map((item) => item.wel.twa)),
        stel: uniqueText(items.map((item) => item.wel.stel)),
        source: uniqueText(items.map((item) => item.wel.source)),
      },
      exposureDuration: uniqueText(items.map((item) => item.exposureDuration)),
      exposureFrequency: uniqueText(items.map((item) => item.exposureFrequency)),
    };
  });
}

function exposureSummary(c: Chemical) {
  const routes = Object.entries(c.exposureRoutes).filter(([, on]) => on).map(([name]) => name).join(', ');
  return [c.exposureDuration, c.exposureFrequency, routes].filter(Boolean).join(' · ') || DASH;
}

function approachColor(approach: number) {
  if (approach === 1) return rgb(6 / 255, 95 / 255, 70 / 255);
  if (approach === 2) return rgb(133 / 255, 77 / 255, 14 / 255);
  if (approach === 3) return rgb(154 / 255, 52 / 255, 18 / 255);
  return rgb(153 / 255, 27 / 255, 27 / 255);
}

function groupColor(group: string) {
  if (group === 'A') return rgb(6 / 255, 95 / 255, 70 / 255);
  if (group === 'B') return rgb(133 / 255, 77 / 255, 14 / 255);
  if (group === 'C') return rgb(154 / 255, 52 / 255, 18 / 255);
  return rgb(153 / 255, 27 / 255, 27 / 255);
}

function epColor(ep?: string) {
  if (ep === 'EP1') return rgb(6 / 255, 95 / 255, 70 / 255);
  if (ep === 'EP2') return rgb(133 / 255, 77 / 255, 14 / 255);
  if (ep === 'EP3') return rgb(154 / 255, 52 / 255, 18 / 255);
  if (ep === 'EP4') return rgb(153 / 255, 27 / 255, 27 / 255);
  return INK;
}

const STORAGE_LABELS: Record<StorageGroupId, string> = {
  '1': 'Flammable Cabinet',
  '2a': 'Corrosives Cabinet (Acids)',
  '2b': 'Organic Acids Cabinet',
  '3': 'Corrosives Cabinet (Bases)',
  '4': 'Oxidizers Cabinet',
  '5a': 'Toxins Cabinet - inorganic',
  '5b': 'Toxins Cabinet - organic',
  '5c': 'Locked Poisons Cabinet',
  '6': 'Reactive Materials Cabinet',
};

const STORAGE_GUIDANCE: Record<StorageGroupId, string> = {
  '1': 'Keep away from heat, sparks, ignition sources and oxidizers.',
  '2a': 'Store acids separately from bases, cyanides, sulphides and oxidizers.',
  '2b': 'Store organic acids separately from bases and oxidizers unless the SDS confirms compatibility.',
  '3': 'Store bases separately from acids and oxidizers.',
  '4': 'Keep away from organic materials, flammables, acids and reducing agents.',
  '5a': 'Store securely with restricted access and compatible secondary containment.',
  '5b': 'Store securely with restricted access. Keep liquids below solids where practicable.',
  '5c': 'Store in locked storage with access restricted to authorised users.',
  '6': 'Keep dry, tightly closed, and away from water, acids and incompatible materials.',
};

const STORAGE_INCOMPATIBLES: Record<StorageGroupId, string> = {
  '1': 'Oxidizers, strong acids/bases, inorganic toxins and reactive materials unless SDS confirms compatibility.',
  '2a': 'Bases, cyanides, sulphides, flammables, organic acids and reactive materials unless SDS confirms compatibility.',
  '2b': 'Bases, oxidizers, mineral acids, toxins and reactive materials unless SDS confirms compatibility.',
  '3': 'Acids, flammables, organic toxins and reactive materials unless SDS confirms compatibility.',
  '4': 'Flammables, organic materials, organic acids, organic toxins and reactive materials unless SDS confirms compatibility.',
  '5a': 'Flammables, acids, organic acids, organic toxins and reactive materials unless SDS confirms compatibility.',
  '5b': 'Acids, bases, oxidizers, inorganic toxins and reactive materials unless SDS confirms compatibility.',
  '5c': 'Store separately and securely unless SDS/local poison controls confirm compatibility.',
  '6': 'Water, acids, oxidizers and incompatible aqueous waste streams unless SDS confirms compatibility.',
};

function storageAssignmentFor(a: Assessment, chemical: Chemical) {
  const classification = classifyStorage(chemical);
  const edit = a.additional.assignments?.[chemical.id];
  const override = edit?.groupOverride;
  const groupId = override && override !== 'general' && override !== 'review'
    ? override
    : classification.groupId;
  const groupLabel = override === 'general'
    ? 'General shelving / non-hazardous item'
    : override === 'review' || !groupId
      ? 'Review SDS sections 7 and 10'
      : STORAGE_LABELS[groupId];
  const guidance = edit?.guidance ?? (groupId ? STORAGE_GUIDANCE[groupId] : 'Check SDS sections 7 and 10 before assigning storage.');
  const alert = edit?.alert ?? (groupId ? STORAGE_INCOMPATIBLES[groupId] : 'Check SDS sections 7 and 10.');
  return {
    groupLabel,
    suggested: classification.groupId ? STORAGE_LABELS[classification.groupId] : 'Review required',
    guidance,
    alert,
    reason: override ? 'Assessor override. Verify against SDS sections 7 and 10.' : classification.reason,
    hazards: classification.primaryHazards.join(', ') || classification.hCodes.join(', ') || DASH,
    confirmed: edit?.confirmed === true ? 'Confirmed' : 'Not confirmed',
  };
}

function approachesPresent(coshh: OverallSuggestion) {
  return [...new Set(coshh.analyses.map((a) => a.approach))].sort((a, b) => a - b);
}

function drawSimpleTable(
  ctx: Ctx,
  columns: Array<{ title: string; w: number }>,
  rows: RowCell[][],
  opts: { x?: number; topY?: number; width?: number; fontSize?: number; headerFill?: RGB; rowMinH?: number } = {},
) {
  const x = opts.x ?? M_X;
  const width = opts.width ?? CONTENT_W;
  const fontSize = opts.fontSize ?? 7.5;
  const headerH = 20;
  const widths = columns.map((c) => c.w * width);
  let y = opts.topY ?? ctx.y;

  const drawHeaderRow = () => {
    drawRect(ctx, x, y - headerH, width, headerH, opts.headerFill ?? NAVY);
    let cx = x;
    columns.forEach((c, i) => {
      ctx.page.drawText(safe(c.title.toUpperCase()), {
        x: cx + 5,
        y: y - 13,
        size: 6.6,
        font: ctx.bold,
        color: WHITE,
      });
      cx += widths[i];
    });
    y -= headerH;
  };

  drawHeaderRow();
  rows.forEach((row, ri) => {
    const wrapped = row.map((cell, ci) => {
      const value = typeof cell === 'string' ? cell : cell.text;
      const font = typeof cell === 'string' ? ctx.font : (cell.bold ? ctx.bold : ctx.font);
      return wrap(value || DASH, font, fontSize, widths[ci] - 10).slice(0, 5);
    });
    const rowH = Math.max(opts.rowMinH ?? 24, Math.max(...wrapped.map((lines) => lines.length)) * (fontSize + 2.5) + 10);
    if (y - rowH < M_BOTTOM + 20) {
      ctx.y = y;
      newPage(ctx);
      y = ctx.y;
      drawHeaderRow();
    }
    if (ri % 2 === 1) drawRect(ctx, x, y - rowH, width, rowH, ZEBRA);
    drawBorder(ctx, x, y, width, rowH, LINE);
    let cx = x;
    wrapped.forEach((lines, ci) => {
      const cell = row[ci];
      const font = typeof cell === 'string' ? ctx.font : (cell.bold ? ctx.bold : ctx.font);
      const color = typeof cell === 'string' ? INK : (cell.color ?? INK);
      lines.forEach((line, li) => {
        ctx.page.drawText(line, {
          x: cx + 5,
          y: y - 12 - (li * (fontSize + 2.5)),
          size: fontSize,
          font,
          color,
        });
      });
      cx += widths[ci];
    });
    y -= rowH;
  });
  ctx.y = y - 10;
}

function drawMiniPictograms(ctx: Ctx, entries: PictoEntry[], x: number, y: number, size = 18) {
  entries.slice(0, 4).forEach((entry, i) => {
    ctx.page.drawImage(entry.image, { x: x + (i * (size + 4)), y: y - size, width: size, height: size });
  });
}

function drawChemicalDetailTable(
  ctx: Ctx,
  chemicals: ChemicalDetailRow[],
  pictoMap: Map<GhsPictogram, PictoEntry>,
  showGhs: boolean,
) {
  const columns = [
    { title: '#', w: 0.04 },
    { title: 'Chemical', w: 0.18 },
    { title: 'Form / qty', w: 0.10 },
    { title: 'Hazard statements', w: 0.27 },
    { title: 'WEL TWA / STEL', w: 0.13 },
    { title: 'Exposure', w: 0.15 },
    { title: 'GHS', w: 0.13 },
  ];
  const widths = columns.map((c) => c.w * CONTENT_W);
  const headerH = 20;
  let y = ctx.y;

  const drawHeaderRow = () => {
    drawRect(ctx, M_X, y - headerH, CONTENT_W, headerH, NAVY);
    let cx = M_X;
    columns.forEach((c, i) => {
      ctx.page.drawText(c.title.toUpperCase(), {
        x: cx + 5,
        y: y - 13,
        size: 6.6,
        font: ctx.bold,
        color: WHITE,
      });
      cx += widths[i];
    });
    y -= headerH;
  };

  drawHeaderRow();
  chemicals.forEach((chemical, index) => {
    const pictoEntries = showGhs
      ? chemical.ghsPictograms.map((id) => pictoMap.get(id)).filter((p): p is PictoEntry => !!p)
      : [];
    const cells = [
      String(index + 1),
      `${chemical.name || DASH}${chemical.cas ? `\nCAS ${chemical.cas}` : ''}${chemical.pubchemCid ? `\nPubChem CID ${chemical.pubchemCid}` : ''}`,
      `Forms: ${chemical.formSummary}\nMass/volume range: ${chemical.quantitySummary}`,
      hCodeSummary(chemical),
      `TWA: ${chemical.welSummary.twa}\nSTEL: ${chemical.welSummary.stel}\nSource: ${chemical.welSummary.source}`,
      exposureSummary(chemical),
      pictoEntries.map((entry) => entry.label).join('\n') || DASH,
    ];
    const wrapped = cells.map((cell, ci) => wrap(cell, ci === 1 ? ctx.bold : ctx.font, 6.4, widths[ci] - 10).slice(0, 5));
    const textRowH = Math.max(...wrapped.map((lines) => lines.length)) * 8.8 + 10;
    const iconRows = Math.ceil(pictoEntries.length / 4);
    const rowH = Math.max(44, textRowH, iconRows ? (iconRows * 18) + 18 : 0);
    if (y - rowH < M_BOTTOM + 20) {
      ctx.y = y;
      newPage(ctx);
      y = ctx.y;
      drawHeaderRow();
    }
    if (index % 2 === 1) drawRect(ctx, M_X, y - rowH, CONTENT_W, rowH, ZEBRA);
    drawBorder(ctx, M_X, y, CONTENT_W, rowH, LINE);
    let cx = M_X;
    wrapped.forEach((lines, ci) => {
      if (ci === 6 && pictoEntries.length > 0) {
        pictoEntries.forEach((entry, pi) => {
          const iconX = cx + 5 + ((pi % 4) * 18);
          const iconY = y - 8 - (Math.floor(pi / 4) * 18);
          ctx.page.drawImage(entry.image, { x: iconX, y: iconY - 14, width: 14, height: 14 });
        });
        return;
      }
      const font = ci === 1 ? ctx.bold : ctx.font;
      lines.forEach((line, li) => {
        ctx.page.drawText(line, {
          x: cx + 5,
          y: y - 12 - (li * 8.8),
          size: 6.4,
          font,
          color: INK,
        });
      });
      cx += widths[ci];
    });
    y -= rowH;
  });
  ctx.y = y - 10;
}

void [formatStepControls, sectionBanner, kvBlock, cover, drawMiniPictograms];

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
      const color = idx === 1
        ? groupColor(a.hazardGroup)
        : idx === 5
          ? epColor(a.exposurePredictor)
          : idx === 6
            ? approachColor(a.approach)
            : INK;
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

export async function exportPdf(a: Assessment, options: ReportOptions = fullReportOptions()): Promise<void> {
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

  const chemicals = a.processSteps.flatMap((step) => step.chemicals);
  const emergencyRows: [string, string][] = [];
  if (options.emergency.spills) emergencyRows.push(['Spills', a.emergency.emergencySpills]);
  if (options.emergency.firstAid) emergencyRows.push(['First aid', a.emergency.emergencyFirstAid]);
  if (options.emergency.fire) emergencyRows.push(['Fire', a.emergency.emergencyFire]);
  if (options.emergency.waste) emergencyRows.push(['Waste handling', a.emergency.wasteHandling]);
  if (options.emergency.other) emergencyRows.push(['Other', a.emergency.other]);

  drawHeader(ctx, a);
  let sectionNo = 1;

  if (options.overview.include) {
    drawSectionTab(ctx, sectionNo++, 'Overview');
    drawCard(ctx, M_X, ctx.y - 18, CONTENT_W, 88, WHITE);
    if (options.overview.details) {
      drawCompactKvGrid(ctx, [
        ['Business Unit', a.overview.businessUnit],
        ['Location', a.overview.locations],
        ['Risk Assessor', a.overview.assessor],
        ['SOP Ref number(s)', a.overview.sopRef],
        ['Date of Assessment', a.overview.dateOfAssessment],
        ['Date of Review', a.overview.dateOfNextReview],
        ['Persons at Risk', personsLine(a.overview.personsAtRisk)],
      ], M_X, ctx.y - 18, CONTENT_W * 0.72, 3);
    }
    if (options.overview.activityOutline) {
      drawLabelledValue(ctx, 'Activity Outline', a.overview.activityOutline || DASH,
        M_X + CONTENT_W * 0.72 + 8, ctx.y - 43, CONTENT_W * 0.26);
    }
    ctx.y -= 108;
  }

  const topY = ctx.y;
  const leftW = (CONTENT_W * 0.38);
  const rightW = CONTENT_W - leftW - 18;
  if (options.taskHazards.include) {
    drawSectionTab(ctx, sectionNo++, 'Task Hazards', M_X, topY);
    drawCard(ctx, M_X, topY - 18, leftW, 104, a.taskHazards.length ? SOFT_AMBER : SOFT_TEAL);
    if (a.taskHazards.length === 0) {
      ctx.page.drawText('No non-chemical hazards recorded.', {
        x: M_X + 24,
        y: topY - 70,
        size: 9,
        font: ctx.bold,
        color: TEAL_DARK,
      });
    } else {
      const rows = a.taskHazards.slice(0, 3).map((haz, i) => [
        `${i + 1}`,
        haz.hazard || DASH,
        options.taskHazards.riskDetails ? `${riskRating(haz.residualRisk) || DASH}` : DASH,
        options.taskHazards.actions ? (haz.furtherAction || DASH) : DASH,
      ]);
      drawSimpleTable(ctx, [
        { title: '#', w: 0.08 },
        { title: 'Hazard', w: 0.44 },
        { title: 'Residual', w: 0.16 },
        { title: 'Action', w: 0.32 },
      ], rows, { x: M_X + 12, topY: topY - 42, width: leftW - 24, fontSize: 6.8, rowMinH: 22 });
    }
  }

  if (options.process.include) {
    drawSectionTab(ctx, sectionNo++, 'Process Steps & Chemicals', M_X + leftW + 18, topY);
    drawCard(ctx, M_X + leftW + 18, topY - 18, rightW, 104, WHITE);
    const rows = a.processSteps.map((step, i) => [
      `Step ${i + 1}`,
      { text: step.step || DASH, bold: true },
      chemicalNames(step),
      options.process.stepControls ? formatStepControlList(step.controls.engineering) : DASH,
      options.process.stepControls ? formatStepControlList(step.controls.ppe) : DASH,
    ]);
    drawSimpleTable(ctx, [
      { title: 'Step', w: 0.14 },
      { title: 'Activity', w: 0.28 },
      { title: 'Chemicals', w: 0.15 },
      { title: 'Engineering controls', w: 0.23 },
      { title: 'PPE', w: 0.20 },
    ], rows.length ? rows : [['-', 'No process steps recorded.', '-', '-', '-']], {
      x: M_X + leftW + 30,
      topY: topY - 42,
      width: rightW - 24,
      fontSize: 6.8,
      rowMinH: 24,
    });
  }

  ctx.y = topY - 132;

  if (options.controls.include && (options.controls.hierarchy || options.controls.coshhScreening)) {
    drawSectionTab(ctx, sectionNo++, 'Controls', M_X, ctx.y);
    const controlsTop = ctx.y - 18;
    drawCard(ctx, M_X, controlsTop, CONTENT_W, 126, WHITE);
    const controlW = CONTENT_W / 3;
    if (options.controls.coshhScreening && coshh) {
      const present = approachesPresent(coshh).map((approach) => `Approach ${approach}`).join(', ');
      drawInfoCard(ctx, 'COSHH screening output', `Substance-level screening gives: ${present}. Highest output: ${coshh.approachLabel}, driven by ${coshh.driver?.name || DASH}. This is not a single blanket recommendation; see Appendix C and verify against SDS/task conditions.`,
        M_X + 10, controlsTop - 14, controlW - 16, 90, SOFT_PURPLE);
    }
    if (options.controls.hierarchy) {
      drawInfoCard(ctx, 'Hierarchy controls', 'Elimination, substitution and reduction controls are recorded in Appendix D for assessor review.',
        M_X + controlW + 4, controlsTop - 14, controlW - 16, 90, SOFT_BLUE);
      drawInfoCard(ctx, 'Administration / monitoring', 'Administrative controls, air monitoring and health surveillance are recorded in Appendix D.',
        M_X + (controlW * 2) - 2, controlsTop - 14, controlW - 8, 90, SOFT_TEAL);
    }
    ctx.y -= 146;
  }

  if (ctx.y - 125 < M_BOTTOM + 20) newPage(ctx);
  const lowerTop = ctx.y;
  if (options.storage.include) {
    drawSectionTab(ctx, sectionNo++, 'Storage', M_X, lowerTop);
    drawInfoCard(ctx, 'Storage and segregation', `Storage: ${a.additional.storage || DASH}\nIncompatibles: ${a.additional.incompatibles || DASH}`,
      M_X, lowerTop - 18, CONTENT_W, 74, WHITE);
    ctx.y = lowerTop - 96;
  }
  if (options.emergency.include) {
    if (ctx.y - 170 < M_BOTTOM + 20) newPage(ctx);
    drawSectionTab(ctx, sectionNo++, 'Emergency Response and Waste', M_X, ctx.y);
    const emergencyTop = ctx.y;
    drawCard(ctx, M_X, emergencyTop - 18, CONTENT_W, 176, WHITE);
    drawSimpleTable(ctx, [
      { title: 'Area', w: 0.26 },
      { title: 'Instruction', w: 0.74 },
    ], emergencyRows.length ? emergencyRows : [['Included content', 'No emergency subsections selected.']], {
      x: M_X + 12,
      topY: emergencyTop - 42,
      width: CONTENT_W - 24,
      fontSize: 6.8,
      rowMinH: 20,
    });
  }

  if (options.briefing.include) {
    if (ctx.y - 76 < M_BOTTOM + 20) newPage(ctx);
    drawSectionTab(ctx, sectionNo++, 'Briefing & Sign-off', M_X, ctx.y);
    drawCard(ctx, M_X, ctx.y - 18, CONTENT_W, 54, WHITE);
    const briefing = a.briefing.length
      ? a.briefing.map((b) => `${b.name || '(unsigned)'} · ${b.date || DASH}`).join('    ')
      : 'No briefing entries recorded.';
    ctx.page.drawText(safe(briefing), {
      x: M_X + 14,
      y: ctx.y - 50,
      size: 8,
      font: ctx.font,
      color: INK,
    });
  }

  if (options.process.include && options.process.chemicalDetails && chemicals.length > 0) {
    newPage(ctx);
    drawSectionTab(ctx, 'A1', 'Appendix A — Chemical Detail', M_X, ctx.y);
    ctx.y -= 24;
    drawChemicalDetailTable(ctx, chemicalDetailRows(a), pictoMap, options.process.ghsPictograms);
  }

  if (options.storage.include && chemicals.length > 0) {
    newPage(ctx);
    drawSectionTab(ctx, 'B1', 'Appendix B — Storage Classification Detail', M_X, ctx.y);
    ctx.y -= 24;
    drawText(ctx, 'Storage assignments are report evidence from the Storage page. Each row must still be checked against SDS sections 7 and 10 and local storage rules.', {
      size: 8,
      color: MUTED,
    });
    ctx.y -= 4;
    const rows = chemicals.map((chemical, index) => {
      const storage = storageAssignmentFor(a, chemical);
      return [
        `${index + 1}`,
        { text: `${chemical.name || DASH}${chemical.cas ? `\nCAS ${chemical.cas}` : ''}`, bold: true },
        storage.groupLabel,
        storage.suggested,
        storage.hazards,
        storage.guidance,
        storage.alert,
        `${storage.confirmed}\n${storage.reason}`,
      ];
    });
    drawSimpleTable(ctx, [
      { title: '#', w: 0.04 },
      { title: 'Chemical', w: 0.15 },
      { title: 'Final storage group', w: 0.15 },
      { title: 'Suggested group', w: 0.13 },
      { title: 'Hazards', w: 0.12 },
      { title: 'Guidance', w: 0.17 },
      { title: 'Segregation alert', w: 0.14 },
      { title: 'Confirmation / reason', w: 0.10 },
    ], rows, { fontSize: 6.2, rowMinH: 42 });
  }

  if (options.controls.include && options.controls.coshhScreening) {
    newPage(ctx);
    drawSectionTab(ctx, 'C1', 'Appendix C — COSHH Essentials Screening', M_X, ctx.y);
    ctx.y -= 28;
    if (!coshh) {
      drawText(ctx, 'No substances have been recorded, so a screening could not be produced.', { color: MUTED });
    } else {
      drawInfoCard(ctx, 'Assessor confirmation', `This is a substance-level screening output, not one blanket control recommendation. Verify each chemical against SDS, task, route, quantity, duration, WELs and local conditions.`,
        M_X, ctx.y, CONTENT_W, 56, SOFT_AMBER);
      ctx.y -= 82;
      drawText(ctx, 'Per-substance breakdown', { size: 9, bold: true, color: NAVY });
      ctx.y -= 4;
      drawCoshhBreakdown(ctx, coshh.analyses, coshh.approach);
      if (coshh.warnings.length) {
        drawInfoCard(ctx, 'Caveats & assumptions', coshh.warnings.join('\n'), M_X, ctx.y, CONTENT_W, 76, WHITE);
        ctx.y -= 86;
      }
    }
  }

  if (options.controls.include && options.controls.hierarchy) {
    newPage(ctx);
    drawSectionTab(ctx, 'D1', 'Appendix D — Control Measures Detail', M_X, ctx.y);
    ctx.y -= 24;
    drawSimpleTable(ctx, [
      { title: 'Control area', w: 0.22 },
      { title: 'Recorded assessment content', w: 0.78 },
    ], [
      ['Elimination', a.controls.elimination || DASH],
      ['Substitution', a.controls.substitution || DASH],
      ['Reduction', a.controls.reduction || DASH],
      ['Administrative controls', a.controls.administrative || DASH],
      ['Air monitoring', a.controls.airMonitoring || DASH],
      ['Health surveillance', a.controls.healthSurveillance || DASH],
    ], { fontSize: 7.2, rowMinH: 26 });
  }

  if (options.controls.include && options.controls.coshhLegend) {
    newPage(ctx);
    drawSectionTab(ctx, 'E1', 'Appendix E — Reference Legend', M_X, ctx.y);
    ctx.y -= 28;
    drawReferenceTable(ctx, 'Hazard group', HAZARD_GROUP_HELP.map(([k, v]): [string, string] => [`Group ${k}`, v]));
    drawReferenceTable(ctx, 'Exposure predictor (EP) band', EP_HELP);
    drawReferenceTable(ctx, 'Control approach', APPROACH_HELP.map(([k, v]): [string, string] => [`Approach ${k}`, v]));
    subHeading(ctx, 'GHS pictogram legend');
    drawPictograms(ctx, legendEntries, { withLabels: true });
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
