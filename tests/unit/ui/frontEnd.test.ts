/**
 * Front-end screens (UIX-0079/0082/0087/0092/0097/0105/0168/0173, PLT-0145): campaign-state
 * helpers, the title menu composition, chapter cards, save-slot cards, the credits roll, the
 * third-party notices table and the Display-tab settings, all driven headlessly.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ActionId } from '../../../src/input/actions';
import type { Game } from '../../../src/core/scene';
import type { UiInput } from '../../../src/ui/kit';
import { CAMPAIGN } from '../../../src/content/campaign';
import { fresh } from '../../../src/core/save';
import { DEFAULT_SETTINGS, WINDOW_SIZES, windowSizeOf } from '../../../src/core/settings/schema';
import { validateSettings } from '../../../src/core/settings/validate';
import { displayPrefs } from '../../../src/ui/display';
import {
  campaignComplete,
  campaignStarted,
  chapterCompletion,
  chapterReached,
  countRank,
  formatDate,
  formatPlaytime,
  recordStats,
  sealCount,
  statsOf,
  stepLabel,
} from '../../../src/scenes/campaignState';
import { save } from '../../../src/scenes/flow';
import { TitleScene } from '../../../src/scenes/title';
import { cardRect, ChapterSelectScene, LOCKED_CHAPTERS } from '../../../src/scenes/chapterSelect';
import { SaveSlotsScene, setCurrentSlot, slotCardRect } from '../../../src/scenes/saveSlots';
import { creditRows } from '../../../src/scenes/credits';
import { fontCredits } from '../../../src/scenes/creditsData';
import { NOTICES } from '../../../src/scenes/noticesData';
import { optionRows } from '../../../src/scenes/options';
import { VIEW_W } from '../../../src/ui/layout';

function fakeInput(): UiInput & { acts: Set<ActionId> } {
  const acts = new Set<ActionId>();
  return {
    pos: { x: -100, y: -100 },
    down: false,
    pressed: false,
    released: false,
    wheel: 0,
    device: 'kbm',
    acts,
    actPressed: (id) => acts.has(id),
    actRepeated: (id) => acts.has(id),
  };
}
const fakeGame = (): Game => ({
  input: fakeInput() as unknown as Game['input'],
  audio: {} as Game['audio'],
  gfx: {} as Game['gfx'],
  go: () => undefined,
  push: () => undefined,
  pop: () => undefined,
});

const withSave = (
  progress: { chapter: number; step: number },
  best: Record<string, { rank: 'C' | 'B' | 'A' | 'S' | 'XS'; score: number }> = {},
  fn: () => void,
) => {
  const prev = { progress: { ...save.progress }, best: { ...save.best }, stats: save.stats };
  Object.assign(save, { progress: { ...progress }, best: { ...best } });
  try {
    fn();
  } finally {
    Object.assign(save, prev);
  }
};
const lastCh = CAMPAIGN.length - 1;
const lastSteps = CAMPAIGN[lastCh].steps.length;

describe('campaign state helpers', () => {
  it('knows when the campaign has started and when it is complete', () => {
    const d = fresh();
    expect(campaignStarted(d)).toBe(false);
    expect(campaignComplete(d, 0)).toBe(false);
    d.progress = { chapter: lastCh, step: lastSteps };
    expect(campaignStarted(d)).toBe(true);
    expect(campaignComplete(d, 0)).toBe(true);
    // The chapters-cleared counter alone also marks it complete (the flow records it before the summary).
    expect(campaignComplete(fresh(), CAMPAIGN.length)).toBe(true);
  });

  it('chapter completion is the share of steps reached; earlier chapters are full, later ones empty', () => {
    const d = fresh();
    d.progress = { chapter: 1, step: 3 };
    expect(chapterCompletion(0, d)).toBe(1);
    expect(chapterCompletion(1, d)).toBeCloseTo(3 / CAMPAIGN[1].steps.length);
    expect(chapterCompletion(2, d)).toBe(0);
    expect(chapterReached(0, d)).toBe(true);
    expect(chapterReached(1, d)).toBe(true);
    expect(chapterReached(CAMPAIGN.length, d)).toBe(false);
  });

  it('counts seals up to a position and ranks at or above a threshold', () => {
    const d = fresh();
    d.best = { 'op1-1': { rank: 'XS', score: 1 }, 'op1-2': { rank: 'S', score: 1 }, 'op2-1': { rank: 'A', score: 1 } };
    expect(sealCount({ chapter: 0, step: 99 }, d)).toBe(2);
    expect(sealCount({ chapter: 1, step: 99 }, d)).toBe(3);
    expect(countRank('S', d)).toBe(2);
    expect(countRank('XS', d)).toBe(1);
  });

  it('formats play time and dates, tolerating bad input', () => {
    expect(formatPlaytime(5400.5)).toBe('1h 30m');
    expect(formatPlaytime(48 * 60)).toBe('48m');
    expect(formatPlaytime(-5)).toBe('0m');
    expect(formatPlaytime(NaN)).toBe('0m');
    expect(formatDate('2026-09-20T21:30:00.000Z', 'en-GB')).toMatch(/2026/);
    expect(formatDate('not a date')).toBe('');
    expect(formatDate(undefined)).toBe('');
  });

  it('names the next step: an operation title or the story scene place', () => {
    const op = CAMPAIGN[0].steps.findIndex((s) => s.kind === 'op');
    const story = CAMPAIGN[0].steps.findIndex((s) => s.kind === 'story');
    const opStep = CAMPAIGN[0].steps[op];
    expect(stepLabel({ chapter: 0, step: op })).toBe(opStep.kind === 'op' ? opStep.op.title : '');
    const storyStep = CAMPAIGN[0].steps[story];
    if (storyStep?.kind === 'story') expect(stepLabel({ chapter: 0, step: story })).toBe(storyStep.story.place);
    expect(stepLabel({ chapter: 99, step: 0 })).toBeTruthy();
  });

  it('keeps a run ledger on the profile: Litany uses and the longest chain (UIX-0168)', () => {
    const d = fresh();
    expect(statsOf(d)).toEqual({ litanyUses: 0, longestChain: 0, operations: 0 });
    recordStats(d, { litanyUsed: true, maxCombo: 12 });
    recordStats(d, { litanyUsed: false, maxCombo: 30 });
    recordStats(d, { litanyUsed: true, maxCombo: 7 });
    expect(statsOf(d)).toEqual({ litanyUses: 2, longestChain: 30, operations: 3 });
    d.stats = { litanyUses: -3, longestChain: 'x' };
    expect(statsOf(d)).toEqual({ litanyUses: 0, longestChain: 0, operations: 0 });
  });
});

describe('title menu (UIX-0079/0173)', () => {
  const ids = (scene: TitleScene, game: Game) => {
    scene.update(1 / 60, game);
    return scene.ui.nodes.map((n) => `${n.id}${n.enabled ? '' : '!'}`);
  };

  it('a fresh journal offers New Game first, with Chapter Select and the Theatre greyed', () => {
    withSave({ chapter: 0, step: 0 }, {}, () => {
      const list = ids(new TitleScene(), fakeGame());
      expect(list).not.toContain('continue');
      expect(list.indexOf('new')).toBeLessThan(list.indexOf('chapters!'));
      expect(list).toContain('theatre!');
      expect(list).toContain('extras');
      expect(list).toContain('options');
      expect(list).toContain('credits');
      // Quit is desktop-only.
      expect(list).not.toContain('quit');
    });
  });

  it('a journal in progress leads with Continue; the menu never runs off the screen', () => {
    withSave({ chapter: 1, step: 2 }, {}, () => {
      const scene = new TitleScene();
      const list = ids(scene, fakeGame());
      expect(list[0]).toBe('continue');
      expect(list).toContain('chapters');
      expect(list).toContain('theatre');
      for (const n of scene.ui.nodes) expect(n.rect.y + n.rect.h).toBeLessThanOrEqual(700);
    });
  });

  it('after the demo, Continue gives way to Chapter Select', () => {
    withSave({ chapter: lastCh, step: lastSteps }, {}, () => {
      const scene = new TitleScene();
      const list = ids(scene, fakeGame());
      expect(list).not.toContain('continue');
      expect(list).toContain('chapters');
      expect(scene.ui.focus).toBe('chapters');
    });
  });
});

describe('chapter select (UIX-0087)', () => {
  it('lays the shipped and locked cards out as one centred row', () => {
    const n = CAMPAIGN.length + LOCKED_CHAPTERS.length;
    const first = cardRect(0, n);
    const last = cardRect(n - 1, n);
    expect(first.x).toBeGreaterThan(0);
    expect(Math.abs(first.x - (VIEW_W - (last.x + last.w)))).toBeLessThanOrEqual(1);
    expect(last.x + last.w).toBeLessThanOrEqual(VIEW_W);
  });

  it('only reached chapters are playable; locked cards cannot take focus', () => {
    withSave({ chapter: 0, step: 3 }, {}, () => {
      const scene = new ChapterSelectScene();
      scene.update(1 / 60, fakeGame());
      const by = (id: string) => scene.ui.node(id)!;
      expect(by('ch0').enabled).toBe(true);
      if (CAMPAIGN.length > 1) expect(by('ch1').enabled).toBe(false);
      for (let i = 0; i < LOCKED_CHAPTERS.length; i++) {
        expect(by(`locked${i}`).enabled).toBe(false);
        expect(by(`locked${i}`).noNav).toBe(true);
      }
      expect(scene.ui.focus).toBe('ch0');
    });
  });
});

describe('save slots (UIX-0092/0097)', () => {
  it('declares a primary action per slot and a Back button, all inside the view', () => {
    setCurrentSlot(null);
    const scene = new SaveSlotsScene('new');
    scene.update(1 / 60, fakeGame());
    const ids = scene.ui.nodes.map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining(['slot1', 'slot2', 'slot3', 'back']));
    for (const n of scene.ui.nodes) {
      expect(n.rect.x).toBeGreaterThanOrEqual(0);
      expect(n.rect.x + n.rect.w).toBeLessThanOrEqual(VIEW_W);
      expect(n.rect.y + n.rect.h).toBeLessThanOrEqual(720);
    }
    for (let i = 0; i < 3; i++) {
      const r = slotCardRect(i);
      expect(r.x + r.w).toBeLessThanOrEqual(VIEW_W);
    }
  });
});

describe('credits and third-party notices (UIX-0085, PLT-0145)', () => {
  it('the roll has the team, type and software sections and the OFL notice', () => {
    const rows = creditRows();
    const kinds = rows.map((r) => r.kind);
    expect(kinds.filter((k) => k === 'heading').length).toBeGreaterThanOrEqual(4);
    expect(rows.some((r) => /Open Font License/.test(r.text))).toBe(true);
    for (const f of fontCredits()) expect(rows.some((r) => r.text.includes(f.family))).toBe(true);
    for (const n of NOTICES) expect(rows.some((r) => r.text.includes(n.name))).toBe(true);
  });

  it('every shipped font face appears once per family and style, all OFL', () => {
    const fc = fontCredits();
    expect(fc.length).toBeGreaterThan(0);
    expect(new Set(fc.map((f) => `${f.family}/${f.style}`)).size).toBe(fc.length);
    for (const f of fc) expect(f.licence).toBe('OFL-1.1');
  });

  it('the notices table covers every production and optional npm dependency and Electron', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string>; optionalDependencies: Record<string, string> };
    const listed = new Set(NOTICES.map((n) => n.pkg).filter(Boolean));
    for (const name of [...Object.keys(pkg.dependencies), ...Object.keys(pkg.optionalDependencies), 'electron']) expect(listed.has(name), name).toBe(true);
    for (const n of NOTICES) {
      expect(n.licence.length).toBeGreaterThan(2);
      expect(n.holder.length).toBeGreaterThan(2);
    }
  });
});

describe('Display tab (UIX-0105)', () => {
  it('screen shake is a 0–100 % slider and bloom has an intensity slider beside its toggle', () => {
    const ids = optionRows('display').map((r) => `${r.id}:${r.kind}`);
    expect(ids).toContain('shake:slider');
    expect(ids).toContain('bloom:toggle');
    expect(ids).toContain('bloom_amount:slider');
    const shake = optionRows('display').find((r) => r.id === 'shake')!;
    expect(shake.step).toBeCloseTo(0.05);
  });

  it('shake values between the old three steps survive validation', () => {
    const r = validateSettings({ shake: 0.35, bloomAmount: 40, windowSize: '1920x1080' });
    expect(r.settings.shake).toBeCloseTo(0.35);
    expect(r.settings.bloomAmount).toBeCloseTo(40);
    expect(r.settings.windowSize).toBe('1920x1080');
    expect(validateSettings({ windowSize: '640x480' }).settings.windowSize).toBe(DEFAULT_SETTINGS.windowSize);
    for (const s of WINDOW_SIZES) expect(windowSizeOf(s).w).toBeGreaterThan(windowSizeOf(s).h);
  });

  it('bloom intensity scales the post-process bloom; the toggle still switches it off', () => {
    const base = { ...DEFAULT_SETTINGS };
    expect(displayPrefs({ ...base, bloom: true, bloomAmount: 50 }).bloom).toBeCloseTo(0.5);
    expect(displayPrefs({ ...base, bloom: false, bloomAmount: 50 }).bloom).toBe(0);
    expect(displayPrefs({ ...base, bloom: true, bloomAmount: 700 }).bloom).toBe(1);
  });
});
