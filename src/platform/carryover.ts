/**
 * Demo → full-game carry-over contract (PLT-0065, PLT-0066, PLT-0068).
 *
 * A demo profile records its `edition`, the `build` that wrote it and `contentIds` — the version of the
 * content-id table its keys use. The full game maps every demo id to a *stable* content id
 * (`ch1.op3`, `ch2.s4`) through the table for that version, then to its own engine ids. Tables are
 * append-only: once a demo build ships, its table is frozen (tests/carryover.test.ts guards v1 against
 * the live campaign and against fixture demo saves in tests/fixtures/saves/).
 *
 * Campaign flags (CON-0093) carry verbatim: flag names are stable content ids in their own right
 * (docs/narrative/flags.md), so `cantorMercy`, `litanySeenCount` and the recorded choices travel as
 * they are; malformed entries were already dropped by the save sanitiser.
 *
 * Steam Cloud cannot sync across app ids, so the full game reads the demo's local save folder
 * (`…/suture-and-steel/demo/`) — progress only imports on the machine where the demo was played.
 */
import type { CampaignPosition, Profile } from '../core/save/schema';
import { freshProfile, readProfile } from '../core/save/codec';
import { PROFILE_FILE } from '../core/save/schema';

export interface ContentIdTable {
  /** Engine step ids per demo chapter, in campaign order — positions resolve through these. */
  steps: readonly (readonly string[])[];
  /** Engine id → stable content id. */
  stable: Readonly<Record<string, string>>;
}

const ch1 = ['prologue', 'op1-1', 's1-2', 'op1-2', 's1-3', 'op1-3', 's1-4', 'op1-4', 's1-5', 'op1-5', 's1-end'];
const ch2 = ['s2-1', 'op2-1', 's2-2', 'op2-2', 's2-3', 'op2-3', 's2-4', 'op2-4', 's2-5', 'op2-5', 's2-end'];

function stableIds(chapters: readonly (readonly string[])[]): Record<string, string> {
  const out: Record<string, string> = {};
  chapters.forEach((steps, c) => {
    let op = 0;
    let st = 0;
    for (const id of steps) out[id] = id.startsWith('op') ? `ch${c + 1}.op${++op}` : `ch${c + 1}.s${++st}`;
  });
  return out;
}

/** Content-id tables by version. v1 = demo 0.9/1.0 (Chapters I–II, 10 operations). Append only. */
export const CONTENT_ID_TABLES: Readonly<Record<number, ContentIdTable>> = {
  1: { steps: [ch1, ch2], stable: stableIds([ch1, ch2]) },
};
export const CURRENT_CONTENT_IDS = 1;

/** Where the full game keeps each stable id today (engine ids are unchanged for Chapters I–II). */
export interface FullGameIndex {
  /** Stable content id → engine op id in the full game. */
  opId(stable: string): string | null;
  /** Stable content id of a step → campaign position in the full game. */
  position(stable: string): CampaignPosition | null;
  /** First step after the demo's chapters (Chapter III start). */
  afterDemo: CampaignPosition;
}

/** Build a FullGameIndex from the live campaign's step ids (used by the full edition and by tests). */
export function indexCampaign(chapters: readonly (readonly string[])[], table: ContentIdTable = CONTENT_ID_TABLES[CURRENT_CONTENT_IDS]): FullGameIndex {
  const byStable = new Map<string, { id: string; pos: CampaignPosition }>();
  chapters.forEach((steps, chapter) =>
    steps.forEach((id, step) => {
      const s = table.stable[id];
      if (s) byStable.set(s, { id, pos: { chapter, step } });
    }),
  );
  return {
    opId: (s) => byStable.get(s)?.id ?? null,
    position: (s) => byStable.get(s)?.pos ?? null,
    afterDemo: { chapter: table.steps.length, step: 0 },
  };
}

export interface ImportReport {
  imported: string[];
  dropped: string[];
  /** Campaign flags carried over (CON-0093). */
  flags: string[];
  position: CampaignPosition;
  demoCompleted: boolean;
}

/**
 * Convert a demo profile into a fresh full-game profile. Unknown ids are dropped (and reported)
 * rather than failing the import.
 */
export function importDemoProfile(demo: Profile, full: FullGameIndex, build: string, now = new Date().toISOString()): { profile: Profile; report: ImportReport } {
  const table = CONTENT_ID_TABLES[demo.contentIds] ?? CONTENT_ID_TABLES[CURRENT_CONTENT_IDS];
  const p = freshProfile('full', build, now);
  const imported: string[] = [];
  const dropped: string[] = [];
  for (const [id, best] of Object.entries(demo.best)) {
    const stable = table.stable[id];
    const target = stable ? full.opId(stable) : null;
    if (target) {
      p.best[target] = { ...best };
      imported.push(stable);
    } else dropped.push(id);
  }
  const demoCompleted = demo.progress.chapter >= table.steps.length;
  let position = full.afterDemo;
  if (!demoCompleted) {
    const stepId = table.steps[demo.progress.chapter]?.[demo.progress.step];
    position = (stepId && full.position(table.stable[stepId])) || { chapter: 0, step: 0 };
  }
  p.progress = { ...position };
  p.unlocks = [...demo.unlocks];
  p.flags = { ...demo.flags };
  p.playtime = demo.playtime;
  p.importedFrom = { edition: demo.edition, build: demo.build, at: now };
  return { profile: p, report: { imported, dropped, flags: Object.keys(p.flags), position, demoCompleted } };
}

/** Read the demo's profile from its save folder snapshot; null when absent or unreadable. */
export function readDemoProfile(files: Record<string, string> | null, build: string): Profile | null {
  if (!files) return null;
  const r = readProfile(files[PROFILE_FILE] ?? null, 'demo', build) ?? readProfile(files[`${PROFILE_FILE}.bak`] ?? null, 'demo', build);
  return r && r.profile.edition === 'demo' ? r.profile : null;
}

/** Import dialog text — states the same-machine limitation (PLT-0068). */
export const IMPORT_DIALOG = {
  title: 'Continue from the demo?',
  message: 'We found a Suture & Steel Demo journal on this computer. Carry its progress and best ranks into the full game?',
  detail:
    'Demo progress can only be imported on the computer where the demo was played — Steam Cloud keeps the demo and the full game separate. ' +
    'You can decline and begin afresh; the demo journal is left untouched either way.',
  confirm: 'Import demo progress',
  cancel: 'Begin afresh',
};
