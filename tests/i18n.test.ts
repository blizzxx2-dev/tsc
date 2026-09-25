import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EN, getLocale, i18nStats, menuLocales, onMissingKey, setLocale, sourceKey, t, tSource } from '../src/i18n';
import { formatClock, formatNumber } from '../src/i18n/format';
import { argNames, format, IcuSyntaxError, mapText, parse, plainText } from '../src/i18n/icu';
import { FACES, fontRoles } from '../src/i18n/fonts';
import { finalSound, particle, resolveParticles } from '../src/i18n/korean';
import { fallbackChain, LOCALES, negotiate } from '../src/i18n/locales';
import { pseudoMessage, pseudoTable } from '../src/i18n/pseudo';

const ROOT = join(__dirname, '..');

afterEach(async () => {
  await setLocale('en');
});

describe('ICU MessageFormat', () => {
  const stitches = '{n, plural, one {# szew} few {# szwy} many {# szwów} other {# szwu}}';

  it('selects Polish plural categories one/few/many/other', () => {
    expect(format(stitches, { n: 1 }, 'pl')).toBe('1 szew');
    expect(format(stitches, { n: 3 }, 'pl')).toBe('3 szwy');
    expect(format(stitches, { n: 22 }, 'pl')).toBe('22 szwy');
    expect(format(stitches, { n: 5 }, 'pl')).toBe('5 szwów');
    expect(format(stitches, { n: 12 }, 'pl')).toBe('12 szwów');
    expect(format(stitches, { n: 1.5 }, 'pl')).toBe('1,5 szwu');
  });

  it('treats 0 as singular in French but plural in English', () => {
    const fr = '{n, plural, one {# point} other {# points}}';
    expect(format(fr, { n: 0 }, 'fr')).toBe('0 point');
    expect(format(fr, { n: 1 }, 'fr')).toBe('1 point');
    expect(format(fr, { n: 2 }, 'fr')).toBe('2 points');
    expect(format('{n, plural, one {# point} other {# points}}', { n: 0 }, 'en')).toBe('0 points');
  });

  it('supports exact matches, offset, select, selectordinal and number styles', () => {
    expect(format('{n, plural, =0 {none} one {one} other {#}}', { n: 0 }, 'en')).toBe('none');
    expect(format('{n, plural, offset:1 =1 {just you} other {you and # others}}', { n: 3 }, 'en')).toBe('you and 2 others');
    const pulse = '{g, select, f {her pulse} m {his pulse} other {their pulse}}';
    expect(format(pulse, { g: 'f' })).toBe('her pulse');
    expect(format(pulse, { g: 'x' })).toBe('their pulse');
    expect(format('{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}', { n: 22 }, 'en')).toBe('22nd');
    expect(format('{v, number, percent}', { v: 0.6 }, 'en')).toBe('60%');
    expect(format('{v, number, integer}', { v: 12345.6 }, 'de')).toBe('12.346');
  });

  it('honours ICU apostrophe quoting', () => {
    expect(format("It''s {name}", { name: 'Ilse' })).toBe("It's Ilse");
    expect(format("'{literal}' {x}", { x: 1 })).toBe('{literal} 1');
    expect(format("{n, plural, other {'#' is # }}", { n: 4 })).toBe('# is 4 ');
    expect(format('Saint’s Salve')).toBe('Saint’s Salve');
  });

  it('rejects malformed patterns and lists argument names', () => {
    expect(() => parse('{n, plural, one {x}}')).toThrow(IcuSyntaxError);
    expect(() => parse('unbalanced }')).toThrow(IcuSyntaxError);
    expect(() => parse('{n, bogus}')).toThrow(IcuSyntaxError);
    expect(argNames('{b} {a, plural, other {{c}}}')).toEqual(['a', 'b', 'c']);
    expect(plainText('A {x} {n, plural, one {B} other {C}}')).toMatch(/^A\s+B C$/);
  });

  it('mapText rewrites text only and round-trips syntax', () => {
    const msg = "{n, plural, one {# stitch} other {# stitches}} for {name} — it''s done";
    expect(mapText(msg, (s) => s)).toBe(msg.replace('plural, one', 'plural, one'));
    expect(format(mapText(msg, (s) => s.toUpperCase()), { n: 2, name: 'Pieter' })).toBe("2 STITCHES FOR Pieter — IT'S DONE");
  });

  it('every English message compiles', () => {
    for (const [k, v] of Object.entries(EN)) expect(() => parse(v), k).not.toThrow();
  });
});

describe('runtime', () => {
  it('translates English keys with parameters and number formatting', () => {
    expect(t('ui.results.subtitle', { title: 'A Knife in the Dark', patient: 'Otto' })).toBe('A Knife in the Dark — Otto');
    expect(t('ui.theatre.best', { rank: 'XS', score: 12345 })).toBe('XS   12,345');
    expect(t('hud.chain_combo', { combo: 7 })).toBe('chain ×7');
  });

  it('renders the key and counts a missing key', () => {
    const before = i18nStats.missing;
    const seen: string[] = [];
    const off = onMissingKey((k) => seen.push(k));
    expect(t('nope.not.a.key')).toBe('nope.not.a.key');
    off();
    expect(i18nStats.missing).toBe(before + 1);
    expect(seen).toEqual(['nope.not.a.key']);
  });

  it('falls back to English for locales without a table', async () => {
    expect(await setLocale('xx-YY')).toBe('en');
    expect(getLocale()).toBe('en');
    expect(fallbackChain('pt-BR')).toEqual(['pt-BR', 'en']);
    expect(fallbackChain('es-ES')).toEqual(['es-ES', 'en']);
  });

  it('switches to a pseudo-locale generated from English', async () => {
    await setLocale('qps');
    expect(getLocale()).toBe('qps');
    const s = t('ui.results.subtitle', { title: 'Op', patient: 'Otto' });
    expect(s.startsWith('⟦')).toBe(true);
    expect(s).toContain('Op');
    expect(s).toContain('Otto');
  });

  it('negotiates the system language against offered locales', () => {
    const offered = LOCALES.filter((l) => ['en', 'de', 'pt-BR', 'es-ES'].includes(l.code));
    expect(negotiate(['de-AT', 'en'], offered)).toBe('de');
    expect(negotiate(['pt-BR'], offered)).toBe('pt-BR');
    expect(negotiate(['es-MX'], offered)).toBe('es-ES');
    expect(negotiate(['ja'], offered)).toBe('en');
  });

  it('only offers signed-off languages outside development builds', () => {
    expect(menuLocales(false).map((l) => l.code)).toEqual(LOCALES.filter((l) => l.shipped).map((l) => l.code));
    expect(menuLocales(true).map((l) => l.code)).toEqual(expect.arrayContaining(['en', 'qps', 'qps-long', 'qps-cjk']));
  });
});

describe('simulation text', () => {
  /** Every English literal the simulation hands to rate()/popup()/lose(). */
  function simLiterals(): string[] {
    const out: string[] = [];
    for (const f of readdirSync(join(ROOT, 'src/surgery'))) {
      const src = readFileSync(join(ROOT, 'src/surgery', f), 'utf8');
      for (const m of src.matchAll(/\b(?:rate\('[a-z]+', [^,]+, |popup\(|lose\()'([^']+)'/g)) out.push(m[1]);
      for (const m of src.matchAll(/label: '([^']+)'/g)) out.push(m[1]);
      for (const m of src.matchAll(/'([A-Z][a-z ]+)' : '([A-Z][a-z ]+)'/g)) out.push(m[1], m[2]);
    }
    return [...new Set(out)];
  }

  it('every rating label, popup and loss reason has a key', () => {
    const lits = simLiterals();
    expect(lits.length).toBeGreaterThan(30);
    for (const s of lits) expect(sourceKey(s), s).toBeDefined();
  });

  it('tSource localises labels, vitals popups and leaves content alone', async () => {
    await setLocale('qps');
    expect(tSource('Barbs freed')).toMatch(/^⟦Ɓàŕƀš ƒŕééð/);
    expect(tSource('-12')).toContain('-12');
    expect(tSource('+25')).toContain('+25');
    expect(tSource('Hold still, Doctor — the bleeding’s slowing.')).toBe('Hold still, Doctor — the bleeding’s slowing.');
  });
});

describe('pseudo-localisation', () => {
  it('preserves every placeholder, brackets the text and pads by ≥ 40 %', () => {
    for (const [k, v] of Object.entries(EN)) {
      const p = pseudoMessage(v, 'qps');
      expect(argNames(p), k).toEqual(argNames(v));
      expect(p.startsWith('⟦') && p.endsWith('⟧'), k).toBe(true);
      expect(plainText(p).length, k).toBeGreaterThanOrEqual(Math.floor(plainText(v).length * 1.4));
    }
  });

  it('qps-long doubles short strings', () => {
    const p = pseudoMessage('Tongs', 'qps-long');
    expect(p.length - 3).toBeGreaterThanOrEqual(10);
    expect(pseudoMessage('A much longer sentence here', 'qps-long').length).toBeLessThan(2 * 27);
  });

  it('qps-cjk is full-width with no spaces and keeps placeholders', () => {
    const p = pseudoMessage('{rank}  ({score, number}) best', 'qps-cjk');
    expect(argNames(p)).toEqual(['rank', 'score']);
    expect(format(p, { rank: 'S', score: 5 })).toBe('S（5）ｂｅｓｔ');
    const table = pseudoTable(EN, 'qps-cjk');
    expect(Object.keys(table)).toEqual(Object.keys(EN));
  });
});

describe('formatting', () => {
  it('groups numbers per locale', () => {
    expect(formatNumber(1234567, 'fr')).toBe('1 234 567');
    expect(formatNumber(12345, 'de')).toBe('12.345');
    expect(formatNumber(12345, 'pl')).toBe('12 345');
    expect(formatNumber(1234, 'pl')).toBe('1234');
    expect(formatNumber(12345, 'en')).toBe('12,345');
  });

  it('formats clocks as m:ss', () => {
    expect(formatClock(0, 'en')).toBe('0:00');
    expect(formatClock(95.9, 'fr')).toBe('1:35');
    expect(formatClock(-3, 'en')).toBe('0:00');
  });
});

describe('locale manifest and fonts', () => {
  it('ships a language only with a signed demo sign-off', () => {
    for (const l of LOCALES) {
      if (l.code === 'en' || l.pseudo) continue;
      expect(existsSync(join(ROOT, `docs/loc/signoff/${l.code}-demo.md`)), l.code).toBe(l.shipped);
    }
  });

  it('every locale resolves body, italic and display to faces for its script', () => {
    for (const l of LOCALES) {
      const roles = fontRoles(l.code);
      for (const role of ['body', 'italic', 'display'] as const) {
        expect(roles[role].length, `${l.code} ${role}`).toBeGreaterThan(0);
        expect(FACES[roles[role][0]].scripts, `${l.code} ${role}`).toContain(l.script);
      }
    }
    // CJK has no italics: the italic role maps to an upright Kai/Mincho-style face.
    expect(FACES[fontRoles('zh-Hans').italic[0]].style).toBe('normal');
  });

  it('bundled faces exist on disk', () => {
    for (const f of Object.values(FACES)) if (f.shipped) expect(existsSync(join(ROOT, 'node_modules', f.file!)), f.family).toBe(true);
  });
});

describe('Korean particles', () => {
  /** Proposed Korean forms of every proper noun in the termbase. */
  function termbaseKorean(): string[] {
    const csv = readFileSync(join(ROOT, 'docs/loc/termbase.csv'), 'utf8').trim().split('\n');
    const head = csv[0].split(',');
    const ko = head.indexOf('ko');
    const pos = head.indexOf('pos');
    return csv
      .slice(1)
      .map((l) => l.split(','))
      .filter((c) => c[pos] === 'proper noun' && /[\uac00-\ud7a3]$/.test(c[ko] ?? ''))
      .map((c) => c[ko]);
  }

  it('reads the final consonant', () => {
    expect(finalSound('크로이처')).toBe('none');
    expect(finalSound('말리손')).toBe('other');
    expect(finalSound('일')).toBe('rieul');
    expect(finalSound('7')).toBe('rieul');
    expect(finalSound('Kreuzer')).toBeUndefined();
  });

  it('picks allomorphs, including ㄹ + (으)로', () => {
    expect(particle('크로이처', '은(는)')).toBe('는');
    expect(particle('말리손', '은(는)')).toBe('은');
    expect(particle('말리손', '이(가)')).toBe('이');
    expect(particle('일제', '을(를)')).toBe('를');
    expect(particle('칼', '(으)로')).toBe('로');
    expect(particle('말리손', '(으)로')).toBe('으로');
    expect(particle('Kreuzer', '은(는)')).toBe('은(는)');
    expect(resolveParticles('크로이처은(는) 말리손을(를) 칼(으)로 벤다')).toBe('크로이처는 말리손을 칼로 벤다');
  });

  it('resolves particles after every termbase proper noun', () => {
    const names = termbaseKorean();
    expect(names.length).toBeGreaterThan(10);
    for (const n of names) {
      const out = resolveParticles(`${n}은(는) ${n}이(가) ${n}을(를) ${n}(으)로`);
      expect(out, n).not.toMatch(/\(/);
    }
  });
});
