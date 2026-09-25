import { describe, expect, it } from 'vitest';
import { BRIGHTNESS, stepBrightness } from '../../../src/scenes/calibrate';
import { cursorColour, CURSOR_COLOURS, DamageAggregator, FIRST_USES, IDLE_REMIND, NEUTRAL_TINT, ToolHints } from '../../../src/ui/hudPrefs';

describe('UIX-0049 damage-number aggregation', () => {
  it('sums rapid hits from one source into one number per 0.5 s', () => {
    const a = new DamageAggregator();
    for (let i = 0; i < 5; i++) expect(a.absorb('-2', { x: 100, y: 100 }, '#c0392b')).toBe(true);
    expect(a.tick(0.4)).toEqual([]);
    expect(a.tick(0.11).map((p) => p.text)).toEqual(['-10']);
    expect(a.tick(1)).toEqual([]);
  });

  it('keeps separate sources apart', () => {
    const a = new DamageAggregator();
    a.absorb('-3', { x: 100, y: 100 }, '#c0392b');
    a.absorb('-4', { x: 400, y: 300 }, '#c0392b');
    expect(
      a
        .tick(0.5)
        .map((p) => p.text)
        .sort(),
    ).toEqual(['-3', '-4']);
  });

  it('with damage numbers off, absorbs and never releases', () => {
    const a = new DamageAggregator(false);
    expect(a.absorb('-9', { x: 1, y: 1 }, '#fff')).toBe(true);
    expect(a.tick(5)).toEqual([]);
  });

  it('leaves other popups alone', () => {
    const a = new DamageAggregator();
    expect(a.absorb('+25', { x: 1, y: 1 }, '#fff')).toBe(false);
    expect(a.absorb('It burst!', { x: 1, y: 1 }, '#fff')).toBe(false);
  });
});

describe('UIX-0053 tool hint modes', () => {
  it('always shows on every switch', () => {
    const h = new ToolHints('always');
    for (let i = 0; i < 10; i++) expect(h.selected('lancet')).toBe(true);
  });

  it('first uses: the first three selections per instrument, then reminders only while idle in a tutorial', () => {
    const h = new ToolHints('first');
    for (let i = 0; i < FIRST_USES; i++) expect(h.selected('tongs')).toBe(true);
    expect(h.selected('tongs')).toBe(false);
    expect(h.selected('brand')).toBe(true);
    expect(h.remind(IDLE_REMIND, true)).toBe(true);
    expect(h.remind(IDLE_REMIND - 0.1, true)).toBe(false);
    expect(h.remind(IDLE_REMIND, false)).toBe(false);
  });

  it('off never shows', () => {
    const h = new ToolHints('off');
    expect(h.selected('lancet')).toBe(false);
    expect(h.remind(60, true)).toBe(false);
  });
});

describe('UIX-0056 cursor colour', () => {
  it('replaces only the neutral tint', () => {
    expect(cursorColour(NEUTRAL_TINT, 'cyan')).toBe(CURSOR_COLOURS.cyan);
    expect(cursorColour('#9fe0a8', 'cyan')).toBe('#9fe0a8');
  });
});

describe('UIX-0076 brightness calibration', () => {
  it('steps by 5 % and clamps to the slider range', () => {
    expect(stepBrightness(1, 1)).toBe(1.05);
    expect(stepBrightness(1, -1)).toBe(0.95);
    expect(stepBrightness(BRIGHTNESS.max, 1)).toBe(BRIGHTNESS.max);
    expect(stepBrightness(BRIGHTNESS.min, -1)).toBe(BRIGHTNESS.min);
  });
});
