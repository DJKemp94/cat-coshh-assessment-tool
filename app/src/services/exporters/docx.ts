import {
  Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell,
  WidthType, TextRun, AlignmentType, BorderStyle, ImageRun,
} from 'docx';
import { Assessment, riskRating, PersonsAtRisk } from '@/types/assessment';
import { exportFileName } from './_filename';

const TEAL = '0d9488';
const INK = '0f172a';
const MUTED = '64748b';

const p = (txt: string, opts: { bold?: boolean; size?: number; color?: string } = {}) =>
  new Paragraph({
    children: [new TextRun({ text: txt, bold: opts.bold, size: opts.size ?? 20, color: opts.color ?? INK })],
  });

const h = (txt: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text: txt, bold: true, color: TEAL, size: 26 })],
  });

const cell = (txt: string, opts: { bold?: boolean; width?: number } = {}) =>
  new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    children: [p(txt || '—', { bold: opts.bold })],
  });

const kvTable = (rows: [string, string][]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'e5e7eb' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'e5e7eb' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'e5e7eb' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'e5e7eb' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'e5e7eb' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'e5e7eb' },
    },
    rows: rows.map(([k, v]) => new TableRow({
      children: [cell(k, { bold: true, width: 30 }), cell(v, { width: 70 })],
    })),
  });

const personsLine = (per: PersonsAtRisk): string => {
  const map: [keyof PersonsAtRisk, string][] = [
    ['staff', 'Staff'], ['students', 'Students'], ['thirdParty', 'Third Party'],
    ['contractors', 'Contractors'], ['visitors', 'Visitors'], ['public', 'Public'],
  ];
  const on = map.filter(([k]) => per[k]).map(([, l]) => l);
  return on.length ? on.join(', ') : '—';
};

const dataUrlToBytes = (dataUrl: string): Uint8Array => {
  const b64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

export async function exportDocx(a: Assessment): Promise<void> {
  const children: (Paragraph | Table)[] = [];

  children.push(new Paragraph({
    alignment: AlignmentType.LEFT,
    children: [new TextRun({ text: 'COSHH Risk Assessment', bold: true, color: TEAL, size: 40 })],
  }));
  children.push(new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({ text: 'Generated with CAT — COSHH Assessment Tool', italics: true, color: MUTED, size: 18 })],
  }));

  children.push(h('Overview'));
  children.push(kvTable([
    ['Business Unit', a.overview.businessUnit],
    ['Risk Assessment Ref', a.overview.riskAssessmentRef],
    ['SOP Ref', a.overview.sopRef],
    ['Risk Assessor', a.overview.assessor],
    ['Date of Assessment', a.overview.dateOfAssessment],
    ['Date of Next Review', a.overview.dateOfNextReview],
    ['Location(s)', a.overview.locations],
    ['Activity Title', a.overview.activityTitle],
    ['Persons at Risk', personsLine(a.overview.personsAtRisk)],
    ['Activity Outline', a.overview.activityOutline],
  ]));

  children.push(h('Task Hazards'));
  if (a.taskHazards.length === 0) {
    children.push(p('No hazards recorded.', { color: MUTED }));
  } else {
    a.taskHazards.forEach((haz, i) => {
      children.push(p(`${i + 1}. ${haz.hazard || '—'}`, { bold: true }));
      children.push(kvTable([
        ['How harm occurs', haz.harmMechanism],
        ['Risk (before controls)', `${riskRating(haz.riskEvaluation) || '—'} (L${haz.riskEvaluation.likelihood}×S${haz.riskEvaluation.severity})`],
        ['Controls in place', haz.controlsInPlace],
        ['Residual risk', `${riskRating(haz.residualRisk) || '—'} (L${haz.residualRisk.likelihood}×S${haz.residualRisk.severity})`],
        ['Further action', haz.furtherAction],
        ['Owner', haz.owner],
        ['Due / Completed', `${haz.dueDate || '—'} → ${haz.completionDate || '—'}`],
      ]));
      children.push(p(''));
    });
  }

  children.push(h('COSHH Process Steps & Chemicals'));
  if (a.processSteps.length === 0) {
    children.push(p('No process steps recorded.', { color: MUTED }));
  } else {
    a.processSteps.forEach((step, si) => {
      children.push(p(`Step ${si + 1}: ${step.step || '—'}`, { bold: true }));
      if (step.chemicals.length === 0) {
        children.push(p('(no chemicals recorded for this step)', { color: MUTED }));
      }
      step.chemicals.forEach((s, ci) => {
        const idParts = [
          s.cas ? `CAS ${s.cas}` : null,
          s.pubchemCid ? `PubChem CID ${s.pubchemCid}` : null,
        ].filter(Boolean).join(' · ');
        children.push(p(`${si + 1}.${ci + 1}  ${s.name || '—'}${idParts ? `  (${idParts})` : ''}`, { bold: true }));
        const routes = Object.entries(s.exposureRoutes).filter(([, v]) => v).map(([k]) => k).join(', ');
        children.push(kvTable([
          ['Form / quantity', `${s.form} · ${s.quantity || '—'}`],
          ['H-codes', s.hazardStatements.map((c) => `${c.code} ${c.text}`).join('; ') || '—'],
          ['GHS pictograms', s.ghsPictograms.join(', ') || '—'],
          ['WEL TWA / STEL', `${s.wel.twa || '—'} / ${s.wel.stel || '—'}${s.wel.source ? ` (${s.wel.source})` : ''}`],
          ['Exposure', `${s.exposureDuration || '—'}, ${s.exposureFrequency || '—'} · routes: ${routes || '—'}`],
        ]));
      });
      children.push(p(''));
    });
  }

  children.push(h('Control Measures'));
  children.push(kvTable([
    ['Elimination', a.controls.elimination],
    ['Substitution', a.controls.substitution],
    ['Reduction', a.controls.reduction],
    ['Engineering', a.controls.engineering],
    ['Administrative', a.controls.administrative],
    ['PPE', `${a.controls.ppe.type || '—'}${a.controls.ppe.standard ? ` (${a.controls.ppe.standard})` : ''}`],
    ['Air Monitoring', a.controls.airMonitoring],
    ['Health Surveillance', a.controls.healthSurveillance],
  ]));

  children.push(h('Additional Requirements'));
  children.push(kvTable([
    ['ChemInventory logged', a.additional.cheminventoryLogged ? 'Yes' : 'No'],
    ['SDS version / date', `${a.additional.sdsVersion || '—'} · ${a.additional.sdsDate || '—'}`],
    ['Storage', a.additional.storage],
    ['Incompatible substances', a.additional.incompatibles],
    ['Emergency — Spills', a.additional.emergencySpills],
    ['Emergency — First aid', a.additional.emergencyFirstAid],
    ['Emergency — Fire', a.additional.emergencyFire],
    ['Waste handling', a.additional.wasteHandling],
    ['Other', a.additional.other],
  ]));

  children.push(h('Briefing Record'));
  if (a.briefing.length === 0) {
    children.push(p('No briefing entries recorded.', { color: MUTED }));
  } else {
    for (const b of a.briefing) {
      children.push(p(`${b.name || '(unsigned)'} — ${b.date || '—'}`, { bold: true }));
      if (b.signaturePng) {
        try {
          const bytes = dataUrlToBytes(b.signaturePng);
          children.push(new Paragraph({
            children: [new ImageRun({ data: bytes, transformation: { width: 200, height: 60 }, type: 'png' })],
          }));
        } catch {
          children.push(p('(signature could not be embedded)', { color: MUTED }));
        }
      }
      children.push(p(''));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName(a, 'docx');
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
