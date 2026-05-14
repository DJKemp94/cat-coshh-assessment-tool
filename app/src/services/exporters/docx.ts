import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  WidthType, TextRun, AlignmentType, BorderStyle, ImageRun,
  ShadingType, HeightRule, PageBreak, Footer, PageNumber,
} from 'docx';
import { Assessment, riskRating, PersonsAtRisk, GhsPictogram } from '@/types/assessment';
import { exportFileName } from './_filename';
import { loadPictograms, RasterisedPictogram } from './ghsImages';
import {
  suggestControls, OverallSuggestion, SubstanceAnalysis,
} from '@/services/coshhEssentials';
import { COSHH_INTRO, HAZARD_GROUP_HELP, EP_HELP, APPROACH_HELP } from './coshhSummary';

// Modern palette
const TEAL = '0d9488';
const TEAL_DARK = '0f766e';
const INK = '0f172a';
const MUTED = '64748b';
const LINE = 'e2e8f0';
const ZEBRA = 'f8fafc';
const WHITE = 'ffffff';

const FONT = 'Calibri';
const DASH = '—';

const txt = (
  s: string,
  opts: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {},
) =>
  new TextRun({
    text: s,
    bold: opts.bold,
    italics: opts.italics,
    size: opts.size ?? 20,
    color: opts.color ?? INK,
    font: FONT,
  });

const para = (
  s: string,
  opts: {
    bold?: boolean;
    italics?: boolean;
    size?: number;
    color?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spaceBefore?: number;
    spaceAfter?: number;
  } = {},
) =>
  new Paragraph({
    alignment: opts.align,
    spacing: { before: opts.spaceBefore ?? 0, after: opts.spaceAfter ?? 60 },
    children: [txt(s, opts)],
  });

const blank = (size = 80) => new Paragraph({ spacing: { after: size }, children: [] });

// Full-width shaded banner for a section title.
const sectionBanner = (n: number, title: string) =>
  new Paragraph({
    spacing: { before: 240, after: 160 },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: TEAL },
    border: {
      top: { style: BorderStyle.SINGLE, size: 2, color: TEAL_DARK },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: TEAL_DARK },
      left: { style: BorderStyle.SINGLE, size: 2, color: TEAL_DARK },
      right: { style: BorderStyle.SINGLE, size: 2, color: TEAL_DARK },
    },
    children: [
      new TextRun({
        text: `  ${String(n).padStart(2, '0')}   ${title.toUpperCase()}`,
        bold: true,
        color: WHITE,
        size: 26,
        font: FONT,
      }),
    ],
  });

// Subheading inside a section (e.g. hazard title, chemical row).
const subHeading = (s: string) =>
  new Paragraph({
    spacing: { before: 180, after: 80 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: TEAL },
    },
    children: [txt(s, { bold: true, size: 22, color: TEAL_DARK })],
  });

const cell = (
  s: string,
  opts: { bold?: boolean; width?: number; widthDxa?: number; fill?: string; color?: string } = {},
) =>
  new TableCell({
    width: opts.widthDxa
      ? { size: opts.widthDxa, type: WidthType.DXA }
      : opts.width
        ? { size: opts.width, type: WidthType.PERCENTAGE }
        : undefined,
    shading: opts.fill
      ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill }
      : undefined,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: [para(s || DASH, { bold: opts.bold, color: opts.color, size: 20, spaceAfter: 0 })],
  });

// Modern key/value table: no left/right/vertical borders, only horizontal hairlines + zebra rows.
const kvTable = (rows: [string, string][]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    },
    rows: rows.map(
      ([k, v], i) =>
        new TableRow({
          children: [
            cell(k, { bold: true, width: 32, color: MUTED, fill: i % 2 === 1 ? ZEBRA : undefined }),
            cell(v, { width: 68, fill: i % 2 === 1 ? ZEBRA : undefined }),
          ],
        }),
    ),
  });

const personsLine = (per: PersonsAtRisk): string => {
  const map: [keyof PersonsAtRisk, string][] = [
    ['staff', 'Staff'], ['students', 'Students'], ['thirdParty', 'Third Party'],
    ['contractors', 'Contractors'], ['visitors', 'Visitors'], ['public', 'Public'],
  ];
  const on = map.filter(([k]) => per[k]).map(([, l]) => l);
  return on.length ? on.join(', ') : DASH;
};

const dataUrlToBytes = (dataUrl: string): Uint8Array => {
  const b64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

// Title block on first page.
const titleBlock = (a: Assessment): (Paragraph | Table)[] => {
  const today = new Date().toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  return [
    new Paragraph({
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: 'COSHH RISK ASSESSMENT',
          bold: true,
          color: TEAL,
          size: 16,
          font: FONT,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: a.overview.activityTitle || 'Untitled assessment',
          bold: true,
          color: INK,
          size: 48,
          font: FONT,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL },
      },
      children: [
        new TextRun({
          text: a.overview.businessUnit || 'Business unit not set',
          color: MUTED,
          size: 22,
          font: FONT,
        }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      },
      rows: [
        new TableRow({
          height: { value: 600, rule: HeightRule.ATLEAST },
          children: [
            metaCell('Ref', a.overview.riskAssessmentRef),
            metaCell('Assessor', a.overview.assessor),
            metaCell('Assessed', a.overview.dateOfAssessment),
            metaCell('Next review', a.overview.dateOfNextReview),
          ],
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 200, after: 0 },
      children: [
        new TextRun({
          text: `Generated ${today} with CAT — COSHH Assessment Tool`,
          italics: true,
          color: MUTED,
          size: 18,
          font: FONT,
        }),
      ],
    }),
  ];
};

const metaCell = (label: string, value: string) =>
  new TableCell({
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: label.toUpperCase(),
            bold: true,
            size: 14,
            color: MUTED,
            font: FONT,
          }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: value || DASH,
            bold: true,
            size: 20,
            color: INK,
            font: FONT,
          }),
        ],
      }),
    ],
  });

const sectionBreak = () =>
  new Paragraph({ children: [new PageBreak()] });

// A horizontal strip of pictograms with their labels underneath.
const pictogramStrip = (pics: RasterisedPictogram[]): Paragraph[] => {
  if (pics.length === 0) {
    return [para('No GHS pictograms recorded.', { italics: true, color: MUTED, size: 18 })];
  }
  const iconRun: TextRun[] = [];
  pics.forEach((p, i) => {
    iconRun.push(
      new ImageRun({
        data: p.bytes,
        transformation: { width: 56, height: 56 },
        type: 'png',
      }) as unknown as TextRun,
    );
    if (i < pics.length - 1) {
      iconRun.push(new TextRun({ text: '   ', size: 20, font: FONT }));
    }
  });
  return [
    new Paragraph({ spacing: { before: 40, after: 40 }, children: iconRun }),
    para(pics.map((p) => p.label).join(' · '), { color: MUTED, size: 16, spaceAfter: 80 }),
  ];
};

// Wide table for the COSHH per-substance breakdown.
const coshhBreakdownTable = (analyses: SubstanceAnalysis[], drivingApproach: number): Table => {
  const headerFill = TEAL;
  const head = (s: string) =>
    new TableCell({
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: headerFill },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: s, bold: true, color: WHITE, size: 18, font: FONT })],
        }),
      ],
    });
  const bodyShaded = (s: string, fill?: string, opts: { bold?: boolean; color?: string } = {}) =>
    new TableCell({
      shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [
        new Paragraph({
          children: [new TextRun({
            text: s || DASH, bold: opts.bold, color: opts.color ?? INK, size: 18, font: FONT,
          })],
        }),
      ],
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          head('Substance'),
          head('Group'),
          head('H-codes'),
          head('Scale'),
          head('Band'),
          head('EP'),
          head('Approach'),
        ],
      }),
      ...analyses.map((a, i) => {
        const fill = i % 2 === 1 ? ZEBRA : undefined;
        const drives = a.approach === drivingApproach;
        const nameCell = new TableCell({
          shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: a.name || DASH, bold: true, size: 18, font: FONT })],
            }),
            ...(drives
              ? [new Paragraph({
                  children: [new TextRun({
                    text: 'drives controls', italics: true, color: TEAL_DARK, size: 14, font: FONT,
                  })],
                })]
              : []),
          ],
        });
        return new TableRow({
          children: [
            nameCell,
            bodyShaded(a.hazardGroup, fill, { bold: true }),
            bodyShaded(a.drivingHCodes.join(', ') || DASH, fill),
            bodyShaded(`${a.scale}${a.assumed.scale ? ' *' : ''}`, fill),
            bodyShaded(
              a.bandKind === 'not-applicable'
                ? DASH
                : `${a.band} (${a.bandKind})${a.assumed.band ? ' *' : ''}`,
              fill,
            ),
            bodyShaded(a.exposurePredictor ?? DASH, fill),
            bodyShaded(`${a.approach}`, fill, { bold: true, color: drives ? TEAL_DARK : INK }),
          ],
        });
      }),
    ],
  });
};


// Two-column reference table (key + explanation) for hazard groups / EP / approaches.
const referenceTable = (title: string, rows: [string, string][]): (Paragraph | Table)[] => {
  const head = new TableCell({
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: TEAL },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, color: WHITE, size: 18, font: FONT })],
      }),
    ],
    columnSpan: 2,
  });
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: LINE },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE },
        left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: LINE },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      },
      rows: [
        new TableRow({ tableHeader: true, children: [head] }),
        ...rows.map(([k, v], i) => new TableRow({
          children: [
            cell(k, { bold: true, width: 18, color: TEAL_DARK, fill: i % 2 === 1 ? ZEBRA : undefined }),
            cell(v, { width: 82, fill: i % 2 === 1 ? ZEBRA : undefined }),
          ],
        })),
      ],
    }),
    blank(60),
  ];
};

export async function exportDocx(a: Assessment): Promise<void> {
  const children: (Paragraph | Table)[] = [];

  // Pre-load all pictograms used anywhere in the assessment, plus the full
  // legend for the COSHH section. Done once up front so the document can be
  // assembled synchronously after.
  const usedPictoIds = Array.from(new Set(
    a.processSteps.flatMap((s) => s.chemicals.flatMap((c) => c.ghsPictograms)),
  ));
  const ALL_PICTOS: GhsPictogram[] = [
    'explosive', 'flammable', 'oxidising', 'compressed-gas',
    'corrosive', 'toxic', 'harmful', 'health-hazard', 'environmental',
  ];
  const [usedPictoMap, legendPictos] = await Promise.all([
    loadPictograms(usedPictoIds).then((arr) => {
      const m = new Map<GhsPictogram, RasterisedPictogram>();
      arr.forEach((p) => m.set(p.id, p));
      return m;
    }),
    loadPictograms(ALL_PICTOS),
  ]);

  const coshh: OverallSuggestion | null = suggestControls(
    a.processSteps.flatMap((s) => s.chemicals),
  );

  // ── Cover / title block ──────────────────────────────
  children.push(...titleBlock(a));

  // ── 01 Overview ──────────────────────────────────────
  children.push(sectionBreak());
  children.push(sectionBanner(1, 'Overview'));
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
  ]));
  children.push(blank(120));
  children.push(para('Activity Outline', { bold: true, color: MUTED, size: 18 }));
  children.push(para(a.overview.activityOutline || DASH, { size: 20 }));

  // ── 02 Task Hazards ──────────────────────────────────
  children.push(sectionBanner(2, 'Task Hazards'));
  if (a.taskHazards.length === 0) {
    children.push(para('No hazards recorded.', { italics: true, color: MUTED }));
  } else {
    a.taskHazards.forEach((haz, i) => {
      children.push(subHeading(`Hazard ${i + 1} — ${haz.hazard || DASH}`));
      children.push(kvTable([
        ['How harm occurs', haz.harmMechanism],
        ['Risk (before controls)',
          `${riskRating(haz.riskEvaluation) || DASH}  (L${haz.riskEvaluation.likelihood} × S${haz.riskEvaluation.severity})`],
        ['Controls in place', haz.controlsInPlace],
        ['Residual risk',
          `${riskRating(haz.residualRisk) || DASH}  (L${haz.residualRisk.likelihood} × S${haz.residualRisk.severity})`],
        ['Further action', haz.furtherAction],
        ['Owner', haz.owner],
        ['Due', haz.dueDate],
        ['Completed', haz.completionDate],
      ]));
    });
  }

  // ── 03 Process Steps & Chemicals ─────────────────────
  children.push(sectionBanner(3, 'COSHH Process Steps & Chemicals'));
  if (a.processSteps.length === 0) {
    children.push(para('No process steps recorded.', { italics: true, color: MUTED }));
  } else {
    a.processSteps.forEach((step, si) => {
      children.push(subHeading(`Step ${si + 1} — ${step.step || DASH}`));
      if (step.chemicals.length === 0) {
        children.push(para('No chemicals recorded for this step.', { italics: true, color: MUTED }));
      }
      step.chemicals.forEach((s, ci) => {
        const idParts = [
          s.cas ? `CAS ${s.cas}` : null,
          s.pubchemCid ? `PubChem CID ${s.pubchemCid}` : null,
        ].filter(Boolean).join('  ·  ');
        children.push(para(
          `${si + 1}.${ci + 1}    ${s.name || DASH}${idParts ? `    (${idParts})` : ''}`,
          { bold: true, size: 22, color: INK, spaceBefore: 120, spaceAfter: 60 },
        ));
        const routes = Object.entries(s.exposureRoutes).filter(([, v]) => v).map(([k]) => k).join(', ');
        children.push(kvTable([
          ['Form / quantity', `${s.form}  ·  ${s.quantity || DASH}`],
          ['H-codes', s.hazardStatements.map((c) => `${c.code} ${c.text}`).join('; ') || DASH],
          ['WEL TWA / STEL',
            `${s.wel.twa || DASH}  /  ${s.wel.stel || DASH}${s.wel.source ? `  (${s.wel.source})` : ''}`],
          ['Exposure',
            `${s.exposureDuration || DASH}, ${s.exposureFrequency || DASH}  ·  routes: ${routes || DASH}`],
        ]));
        // GHS pictograms — rendered as actual images.
        children.push(para('GHS pictograms', { bold: true, color: MUTED, size: 16, spaceBefore: 80, spaceAfter: 40 }));
        const pics = s.ghsPictograms
          .map((id) => usedPictoMap.get(id))
          .filter((p): p is RasterisedPictogram => !!p);
        children.push(...pictogramStrip(pics));
      });
    });
  }

  // ── 04 COSHH Essentials Screening ────────────────────
  children.push(sectionBanner(4, 'COSHH Essentials Screening'));
  for (const line of COSHH_INTRO) {
    children.push(para(line, { size: 20, spaceAfter: 120 }));
  }
  if (!coshh) {
    children.push(para(
      'No substances have been recorded, so a screening could not be produced.',
      { italics: true, color: MUTED },
    ));
  } else {
    children.push(subHeading(`Recommended approach — ${coshh.approachLabel}`));
    const driver = coshh.driver;
    if (driver) {
      const driverLine =
        `Driven by ${driver.name} — hazard group ${driver.hazardGroup}` +
        (driver.drivingHCodes.length ? ` (${driver.drivingHCodes.join(', ')})` : '') +
        `, scale ${driver.scale}` +
        (driver.bandKind !== 'not-applicable' ? `, ${driver.bandKind} ${driver.band}` : '') +
        (driver.exposurePredictor ? `, exposure predictor ${driver.exposurePredictor}` : '') + '.';
      children.push(para(driverLine, { size: 20, spaceAfter: 80 }));
    }
    children.push(para(`Reference: ${coshh.gSheetRef}.`, { color: MUTED, size: 18, spaceAfter: 160 }));

    children.push(para('Per-substance breakdown', { bold: true, color: TEAL_DARK, size: 20, spaceBefore: 60, spaceAfter: 60 }));
    children.push(coshhBreakdownTable(coshh.analyses, coshh.approach));
    children.push(para('* assumed value used because input was missing or unparseable.',
      { italics: true, color: MUTED, size: 14, spaceBefore: 60, spaceAfter: 160 }));

    if (coshh.warnings.length) {
      children.push(para('Caveats & assumptions', { bold: true, color: TEAL_DARK, size: 20, spaceAfter: 60 }));
      coshh.warnings.forEach((w) => {
        children.push(new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60 },
          children: [new TextRun({ text: w, size: 18, color: INK, font: FONT })],
        }));
      });
      children.push(blank(80));
    }
  }

  children.push(para('Reference legend', { bold: true, color: TEAL_DARK, size: 20, spaceBefore: 80, spaceAfter: 60 }));
  children.push(...referenceTable('Hazard group', HAZARD_GROUP_HELP.map(([k, v]) => [`Group ${k}`, v])));
  children.push(...referenceTable('Exposure predictor (EP) band', EP_HELP));
  children.push(...referenceTable('Control approach', APPROACH_HELP.map(([k, v]) => [`Approach ${k}`, v])));

  children.push(subHeading('GHS pictogram legend'));
  children.push(...pictogramStrip(legendPictos));

  // ── 05 Control Measures ──────────────────────────────
  children.push(sectionBanner(5, 'Control Measures'));
  children.push(kvTable([
    ['Elimination', a.controls.elimination],
    ['Substitution', a.controls.substitution],
    ['Reduction', a.controls.reduction],
    ['Engineering', a.controls.engineering],
    ['Administrative', a.controls.administrative],
    ['PPE', `${a.controls.ppe.type || DASH}${a.controls.ppe.standard ? `  (${a.controls.ppe.standard})` : ''}`],
    ['Air Monitoring', a.controls.airMonitoring],
    ['Health Surveillance', a.controls.healthSurveillance],
  ]));

  // ── 06 Additional Requirements ───────────────────────
  children.push(sectionBanner(6, 'Additional Requirements'));
  children.push(kvTable([
    ['ChemInventory logged', a.additional.cheminventoryLogged ? 'Yes' : 'No'],
    ['SDS version / date', `${a.additional.sdsVersion || DASH}  ·  ${a.additional.sdsDate || DASH}`],
    ['Storage', a.additional.storage],
    ['Incompatible substances', a.additional.incompatibles],
    ['Emergency — Spills', a.additional.emergencySpills],
    ['Emergency — First aid', a.additional.emergencyFirstAid],
    ['Emergency — Fire', a.additional.emergencyFire],
    ['Waste handling', a.additional.wasteHandling],
    ['Other', a.additional.other],
  ]));

  // ── 07 Briefing Record ───────────────────────────────
  children.push(sectionBanner(7, 'Briefing Record'));
  if (a.briefing.length === 0) {
    children.push(para('No briefing entries recorded.', { italics: true, color: MUTED }));
  } else {
    for (const b of a.briefing) {
      children.push(para(
        `${b.name || '(unsigned)'}    ·    ${b.date || DASH}`,
        { bold: true, size: 22, color: INK, spaceBefore: 120, spaceAfter: 40 },
      ));
      if (b.signaturePng) {
        try {
          const bytes = dataUrlToBytes(b.signaturePng);
          children.push(new Paragraph({
            spacing: { after: 120 },
            children: [
              new ImageRun({
                data: bytes,
                transformation: { width: 200, height: 60 },
                type: 'png',
              }),
            ],
          }));
        } catch {
          children.push(para('(signature could not be embedded)', { italics: true, color: MUTED }));
        }
      }
    }
  }

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: 'CAT — COSHH Assessment Tool   ·   Page ',
            color: MUTED,
            size: 16,
            font: FONT,
          }),
          new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 16, font: FONT }),
          new TextRun({ text: ' / ', color: MUTED, size: 16, font: FONT }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], color: MUTED, size: 16, font: FONT }),
        ],
      }),
    ],
  });

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: 20, color: INK } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
        },
      },
      footers: { default: footer },
      children,
    }],
  });

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
