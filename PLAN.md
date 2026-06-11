# LabCAT — COSHH Assessment Tool: Build Plan

## Context

LabCAT is a static, browser-only web app for producing UK COSHH (Control of Substances Hazardous to Health) risk assessments. It exists to give assessors a fast, structured way to generate a single assessment document, pull chemical hazard data from PubChem, and export the result — **without** ever acting as an online repository of assessments. Privacy and the "you own your file" principle are first-class product constraints: no accounts, no database, no server-side storage, no telemetry on assessment content.

The app must look and feel like a serious occupational-health SaaS tool (per the supplied mock), with restrained cat branding ("Stay curious. Stay safe.").

---

## Decisions locked in

| Area | Decision |
|---|---|
| Stack | **React + Vite + TypeScript**, deployed to GitHub Pages |
| WEL/STEL/TWA | Auto-fill from PubChem where present (OSHA PEL / NIOSH REL); UK WEL fields editable, manual entry expected from HSE EH40 |
| Recovery code | Compressed full draft (deflate + Base45) split across **N numbered QR codes** when oversized |
| DOCX export | Clean modern layout containing all required fields; not pixel-matching SAF-FOR-011b |
| Signatures | Typed name required, drawn signature optional (canvas → PNG data URL) |
| PubChem cache | `localStorage` keyed by CID, with a per-row "Refresh from PubChem" button |
| Substances | Repeatable substance rows per assessment, independent PubChem lookup each |

---

## Architecture

Single-page React app, fully static. No backend.

```
┌─────────────────────────────────────────────────────────────┐
│  React + Vite + TypeScript SPA                              │
│  ┌──────────────┬──────────────────────┬──────────────────┐ │
│  │ Sidebar nav  │  Section editor      │ Export & Recovery│ │
│  │ (8 sections) │  (current section)   │ rail             │ │
│  └──────────────┴──────────────────────┴──────────────────┘ │
│         │                  │                    │           │
│         ▼                  ▼                    ▼           │
│   Zustand store ◄──── Form state ────► Export pipeline      │
│         │                                       │           │
│         ▼                                       ▼           │
│   localStorage           PubChem fetch    PDF / DOCX /      │
│   (autosave +            (rate-limited,   .labcatdraft / QR    │
│    PubChem cache)         CID-keyed)                        │
└─────────────────────────────────────────────────────────────┘
```

**Hosting:** GitHub Pages from `/dist`. PubChem is a public unauthenticated API and CORS-enabled.

**Routing:** Single route. Section navigation is local UI state.

---

## Data model

```ts
type UUID = string;

interface Assessment {
  schemaVersion: 1;
  id: UUID;
  overview: Overview;
  taskHazards: TaskHazard[];
  substances: Substance[];
  controls: ControlMeasures;
  additional: AdditionalRequirements;
  briefing: BriefingEntry[];
  meta: { createdAt: string; updatedAt: string; appVersion: string };
}

interface Overview {
  businessUnit: string;
  riskAssessmentRef: string;
  sopRef: string;
  assessor: string;
  dateOfAssessment: string;
  dateOfNextReview: string;
  locations: string;
  activityTitle: string;
  activityOutline: string;
  personsAtRisk: {
    staff: boolean; students: boolean; thirdParty: boolean;
    contractors: boolean; visitors: boolean; public: boolean;
  };
}

interface TaskHazard {
  id: UUID;
  hazard: string;
  harmMechanism: string;
  riskEvaluation: RiskScore;        // { likelihood, severity, rating }
  controlsInPlace: string;
  residualRisk: RiskScore;
  furtherAction: string;
  owner: string;
  dueDate: string;
  completionDate: string;
}

interface Substance {
  id: UUID;
  pubchemCid?: number;
  name: string;
  processStep: string;
  hazardStatements: HCode[];
  ghsPictograms: GhsPictogram[];
  wel: { twa?: string; stel?: string; source?: "PubChem-OSHA" | "PubChem-NIOSH" | "Manual-EH40" };
  quantity: string;
  form: "solid" | "liquid" | "gas" | "vapour" | "aerosol" | "mist" | "powder" | "other";
  formNote?: string;
  exposureDuration: string;
  exposureFrequency: string;
  exposureRoutes: { inhalation: boolean; skin: boolean; ingestion: boolean; eye: boolean };
  pubchemFetchedAt?: string;
}

interface ControlMeasures {
  elimination: string;
  substitution: string;
  reduction: string;
  engineering: string;
  administrative: string;
  ppe: { type: string; standard: string };
  airMonitoring: string;
  healthSurveillance: string;
}

interface AdditionalRequirements {
  cheminventoryLogged: boolean;
  sdsVersion: string;
  sdsDate: string;
  storage: string;
  incompatibles: string;
  emergencySpills: string;
  emergencyFirstAid: string;
  emergencyFire: string;
  wasteHandling: string;
  other: string;
}

interface BriefingEntry {
  id: UUID;
  name: string;
  signaturePng?: string;
  date: string;
}
```

**Persistence layers:**

1. `localStorage["cat.activeAssessment"]` — autosave on every change, debounced 500 ms.
2. `.labcatdraft` download — Base45(deflate(JSON)) wrapped with header `LabCATDRAFT/v1\n<payload>`.
3. QR recovery — same encoded payload, chunked into ≤2000-char QR frames numbered `i/N`.

**PubChem cache:** `localStorage["cat.pubchem.<CID>"] = { fetchedAt, raw }`. Evicted after 90 days unless kept.

---

## PubChem integration

| Need | Endpoint |
|---|---|
| Name → CID | `GET /rest/pug/compound/name/{name}/cids/JSON` |
| Synonyms | `GET /rest/pug/compound/cid/{cid}/synonyms/JSON` |
| GHS + Exposure limits | `GET /rest/pug/view/data/compound/{cid}/JSON?heading=GHS+Classification` and `?heading=Exposure+Limits` |
| Physical state | parsed from PUG-View "Physical Description" |

`src/services/pubchem.ts` — internal queue with a 250 ms minimum gap (≤5 req/s).

Every PubChem-derived field stays user-editable. Each substance row shows "from PubChem · <date>" + refresh icon. UK WEL fields blank with EH40 tooltip.

---

## Export pipeline

`src/services/exporters/`:

- `pdf.ts` — **pdf-lib**, branded clean layout, GHS pictograms embedded as SVGs.
- `docx.ts` — **docx** npm package, clean modern layout with tables.
- `labcatdraft.ts` — JSON → `pako.deflateRaw` → Base45 → header wrap → `Blob` download as `<ref>-<date>.labcatdraft`.
- `qr.ts` — chunk payload into ≤2000-char frames; render N QR codes with `1/3`, `2/3`, `3/3` captions.
- `import.ts` — accepts `.labcatdraft` file, pasted text, or scanned QR set; validates `schemaVersion`, runs migrations.

**File naming:** `LabCAT-<riskAssessmentRef>-<YYYYMMDD>.{pdf,docx,labcatdraft}`.

---

## UI structure

```
src/
├── App.tsx
├── main.tsx
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── TopBar.tsx
│   │   ├── Sidebar.tsx
│   │   └── ExportRail.tsx
│   ├── sections/
│   │   ├── OverviewSection.tsx
│   │   ├── TaskHazardsSection.tsx
│   │   ├── SubstancesSection.tsx
│   │   ├── ControlsSection.tsx
│   │   ├── AdditionalSection.tsx
│   │   ├── BriefingSection.tsx
│   │   ├── SettingsSection.tsx
│   │   └── HelpSection.tsx
│   ├── common/
│   │   ├── RiskMatrix.tsx
│   │   ├── SignaturePad.tsx
│   │   ├── PubChemBadge.tsx
│   │   ├── GhsPictogram.tsx
│   │   ├── QrFrameSet.tsx
│   │   └── PrivacyBanner.tsx
│   └── ui/
├── services/
│   ├── pubchem.ts
│   ├── storage.ts
│   ├── exporters/{pdf,docx,labcatdraft,qr,import}.ts
│   └── codec/{base45,compress}.ts
├── store/assessment.ts
├── types/assessment.ts
├── assets/{ghs/,logo/}
└── styles/theme.css
```

**Styling:** Tailwind CSS, neutral greys (`zinc`) + `teal-600` accent + `red-600` danger. Inter UI font. Subtle paw motifs only in empty states and sidebar footer.

**State:** Zustand + persistence middleware → `localStorage`.

---

## Privacy & trust UX

1. **First-run modal** — nothing leaves your browser except PubChem chemical lookups; you must export to keep your work.
2. **Persistent banner** in export rail — "No online repository. You are the only copy."
3. **Settings → Privacy** — shows what's stored locally, one-click "Clear all LabCAT data".

PubChem calls send only chemical names/CIDs, never assessment content.

---

## Dependencies

`react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss`, `postcss`, `autoprefixer`, `zustand`, `pdf-lib`, `docx`, `pako`, `qrcode`, `@zxing/browser`, `clsx`, `lucide-react`.

No backend, no auth, no analytics.

---

## Build phases

1. **Skeleton & shell** — Vite scaffold, Tailwind, AppShell, Sidebar, TopBar, ExportRail, Zustand store, autosave, schema types, first-run privacy modal.
2. **Section editors** — Overview, Task Hazards (risk matrix), Substances (no PubChem yet), Controls, Additional, Briefing, Settings, Help.
3. **PubChem integration** — `pubchem.ts` with queue + cache, wired into Substances rows.
4. **Exports** — `.labcatdraft` first, then DOCX, then PDF.
5. **QR recovery** — encoder, multi-frame printable view, scanner-driven import.
6. **Polish** — empty states, paw motifs, error toasts, keyboard nav, print stylesheet, Pages deploy workflow.

---

## Verification

1. `npm run dev` → privacy modal appears and dismisses.
2. Fill Overview, add 2 hazards, add 2 substances incl. "acetone" → PubChem fills H-codes, pictograms, exposure limit; UK WEL stays blank.
3. Reload → autosave restores intact.
4. Save `.labcatdraft` → clear data → re-import → state restores.
5. Generate recovery code → numbered QR frames render and print correctly.
6. Phone-scan frames in sequence → draft reconstructs byte-for-byte.
7. PDF and DOCX exports contain every prompt-specified field, GHS pictograms, briefing with optional signature.
8. Network throttled → PubChem failures show non-blocking toast.
9. "Clear all LabCAT data" empties localStorage and resets app.
10. `npm run build` → < 500 KB gzipped JS; Pages workflow deploys cleanly.

Automated: `tsc --noEmit` passes; `vitest` covers `codec/`, PubChem normaliser, import round-trip.

---

## Known limitations

- UK WEL/STEL/TWA values are not auto-filled.
- QR recovery requires scanning all frames in order.
- Less-common substances may lack PubChem GHS data — row stays manual.
- `localStorage` is per-browser, per-origin — clearing site data loses unsaved drafts.
