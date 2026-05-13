import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { Assessment, riskRating, PersonsAtRisk } from '@/types/assessment';
import { exportFileName } from './_filename';

const MARGIN = 50;
const PAGE_W = 595;
const PAGE_H = 842;
const TEAL = rgb(13 / 255, 148 / 255, 136 / 255);
const INK = rgb(15 / 255, 23 / 255, 42 / 255);
const MUTED = rgb(100 / 255, 116 / 255, 139 / 255);

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN;
}

function ensure(ctx: Ctx, need: number) {
  if (ctx.y - need < MARGIN) newPage(ctx);
}

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) > max) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function text(ctx: Ctx, str: string, size = 10, font?: PDFFont, color = INK) {
  const f = font ?? ctx.font;
  const lines = wrap(str || '', f, size, PAGE_W - MARGIN * 2);
  for (const ln of lines) {
    ensure(ctx, size + 4);
    ctx.page.drawText(ln, { x: MARGIN, y: ctx.y - size, size, font: f, color });
    ctx.y -= size + 3;
  }
}

function heading(ctx: Ctx, str: string) {
  ensure(ctx, 24);
  ctx.y -= 6;
  ctx.page.drawRectangle({
    x: MARGIN, y: ctx.y - 18, width: PAGE_W - MARGIN * 2, height: 22, color: rgb(0.96, 0.99, 0.98),
  });
  ctx.page.drawText(str, { x: MARGIN + 8, y: ctx.y - 12, size: 12, font: ctx.bold, color: TEAL });
  ctx.y -= 26;
}

function kv(ctx: Ctx, label: string, value: string) {
  ensure(ctx, 14);
  ctx.page.drawText(`${label}:`, { x: MARGIN, y: ctx.y - 10, size: 9, font: ctx.bold, color: MUTED });
  const lines = wrap(value || '—', ctx.font, 10, PAGE_W - MARGIN * 2 - 130);
  ctx.page.drawText(lines[0], { x: MARGIN + 130, y: ctx.y - 10, size: 10, font: ctx.font, color: INK });
  ctx.y -= 14;
  for (let i = 1; i < lines.length; i++) {
    ensure(ctx, 12);
    ctx.page.drawText(lines[i], { x: MARGIN + 130, y: ctx.y - 10, size: 10, font: ctx.font, color: INK });
    ctx.y -= 12;
  }
}

function personsLine(p: PersonsAtRisk): string {
  const map: [keyof PersonsAtRisk, string][] = [
    ['staff', 'Staff'], ['students', 'Students'], ['thirdParty', 'Third Party'],
    ['contractors', 'Contractors'], ['visitors', 'Visitors'], ['public', 'Public'],
  ];
  const on = map.filter(([k]) => p[k]).map(([, l]) => l);
  return on.length ? on.join(', ') : '—';
}

export async function exportPdf(a: Assessment): Promise<void> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { doc, page: doc.addPage([PAGE_W, PAGE_H]), y: PAGE_H - MARGIN, font, bold };

  // Title
  ctx.page.drawText('COSHH Risk Assessment', {
    x: MARGIN, y: ctx.y - 20, size: 20, font: bold, color: TEAL,
  });
  ctx.y -= 26;
  ctx.page.drawText('Generated with CAT — COSHH Assessment Tool', {
    x: MARGIN, y: ctx.y - 12, size: 9, font, color: MUTED,
  });
  ctx.y -= 24;

  // Overview
  heading(ctx, 'Overview');
  kv(ctx, 'Business Unit', a.overview.businessUnit);
  kv(ctx, 'Risk Assessment Ref', a.overview.riskAssessmentRef);
  kv(ctx, 'SOP Ref', a.overview.sopRef);
  kv(ctx, 'Risk Assessor', a.overview.assessor);
  kv(ctx, 'Date of Assessment', a.overview.dateOfAssessment);
  kv(ctx, 'Date of Next Review', a.overview.dateOfNextReview);
  kv(ctx, 'Location(s)', a.overview.locations);
  kv(ctx, 'Activity Title', a.overview.activityTitle);
  kv(ctx, 'Persons at Risk', personsLine(a.overview.personsAtRisk));
  ctx.y -= 4;
  text(ctx, 'Activity Outline', 10, bold, MUTED);
  text(ctx, a.overview.activityOutline || '—');

  // Task Hazards
  heading(ctx, 'Task Hazards');
  if (a.taskHazards.length === 0) text(ctx, 'No hazards recorded.', 10, font, MUTED);
  a.taskHazards.forEach((h, i) => {
    ensure(ctx, 30);
    text(ctx, `${i + 1}. ${h.hazard || '—'}`, 11, bold);
    kv(ctx, 'How harm occurs', h.harmMechanism);
    kv(ctx, 'Risk (before controls)', `${riskRating(h.riskEvaluation) || '—'} (L${h.riskEvaluation.likelihood}×S${h.riskEvaluation.severity})`);
    kv(ctx, 'Controls in place', h.controlsInPlace);
    kv(ctx, 'Residual risk', `${riskRating(h.residualRisk) || '—'} (L${h.residualRisk.likelihood}×S${h.residualRisk.severity})`);
    kv(ctx, 'Further action', h.furtherAction);
    kv(ctx, 'Owner', h.owner);
    kv(ctx, 'Due / Completed', `${h.dueDate || '—'}  →  ${h.completionDate || '—'}`);
    ctx.y -= 6;
  });

  // Process steps & chemicals
  heading(ctx, 'COSHH Process Steps & Chemicals');
  if (a.processSteps.length === 0) text(ctx, 'No process steps recorded.', 10, font, MUTED);
  a.processSteps.forEach((step, si) => {
    ensure(ctx, 30);
    text(ctx, `Step ${si + 1}: ${step.step || '—'}`, 11, bold);
    if (step.chemicals.length === 0) {
      text(ctx, '  (no chemicals recorded for this step)', 9, font, MUTED);
    }
    step.chemicals.forEach((s, ci) => {
      ensure(ctx, 24);
      const idParts = [
        s.cas ? `CAS ${s.cas}` : null,
        s.pubchemCid ? `PubChem CID ${s.pubchemCid}` : null,
      ].filter(Boolean).join(' · ');
      text(ctx, `  ${si + 1}.${ci + 1}  ${s.name || '—'}${idParts ? `  (${idParts})` : ''}`, 10, bold);
      kv(ctx, '  Form / quantity', `${s.form} · ${s.quantity || '—'}`);
      kv(ctx, '  H-codes', s.hazardStatements.map((c) => `${c.code} ${c.text}`).join('; ') || '—');
      kv(ctx, '  GHS pictograms', s.ghsPictograms.join(', ') || '—');
      kv(ctx, '  WEL TWA / STEL', `${s.wel.twa || '—'} / ${s.wel.stel || '—'}${s.wel.source ? ` (${s.wel.source})` : ''}`);
      const routes = Object.entries(s.exposureRoutes).filter(([, v]) => v).map(([k]) => k).join(', ');
      kv(ctx, '  Exposure', `${s.exposureDuration || '—'}, ${s.exposureFrequency || '—'} · routes: ${routes || '—'}`);
    });
    ctx.y -= 6;
  });

  // Controls
  heading(ctx, 'Control Measures');
  kv(ctx, 'Elimination', a.controls.elimination);
  kv(ctx, 'Substitution', a.controls.substitution);
  kv(ctx, 'Reduction', a.controls.reduction);
  kv(ctx, 'Engineering', a.controls.engineering);
  kv(ctx, 'Administrative', a.controls.administrative);
  kv(ctx, 'PPE', `${a.controls.ppe.type || '—'}${a.controls.ppe.standard ? ` (${a.controls.ppe.standard})` : ''}`);
  kv(ctx, 'Air Monitoring', a.controls.airMonitoring);
  kv(ctx, 'Health Surveillance', a.controls.healthSurveillance);

  // Additional
  heading(ctx, 'Additional Requirements');
  kv(ctx, 'ChemInventory logged', a.additional.cheminventoryLogged ? 'Yes' : 'No');
  kv(ctx, 'SDS version / date', `${a.additional.sdsVersion || '—'} · ${a.additional.sdsDate || '—'}`);
  kv(ctx, 'Storage', a.additional.storage);
  kv(ctx, 'Incompatible substances', a.additional.incompatibles);
  kv(ctx, 'Emergency — Spills', a.additional.emergencySpills);
  kv(ctx, 'Emergency — First aid', a.additional.emergencyFirstAid);
  kv(ctx, 'Emergency — Fire', a.additional.emergencyFire);
  kv(ctx, 'Waste handling', a.additional.wasteHandling);
  kv(ctx, 'Other', a.additional.other);

  // Briefing
  heading(ctx, 'Briefing Record');
  if (a.briefing.length === 0) text(ctx, 'No briefing entries recorded.', 10, font, MUTED);
  for (const b of a.briefing) {
    ensure(ctx, 70);
    text(ctx, `${b.name || '(unsigned)'}  ·  ${b.date || '—'}`, 10, bold);
    if (b.signaturePng) {
      try {
        const png = await doc.embedPng(b.signaturePng);
        const w = 160;
        const h = (png.height / png.width) * w;
        ensure(ctx, h + 6);
        ctx.page.drawImage(png, { x: MARGIN, y: ctx.y - h, width: w, height: h });
        ctx.y -= h + 4;
      } catch {
        text(ctx, '(signature could not be embedded)', 9, font, MUTED);
      }
    }
  }

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
