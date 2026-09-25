/**
 * A small ICU MessageFormat implementation: enough of the syntax for game text
 * (argument, number, plural, selectordinal, select, apostrophe quoting) with
 * no dependencies. Messages are parsed once and cached.
 *
 *   "{n, plural, one {# stitch} other {# stitches}}"
 *   "{gender, select, f {her pulse} m {his pulse} other {their pulse}}"
 */

export type Params = Record<string, string | number>;

type Node =
  | { k: 'text'; v: string }
  | { k: 'arg'; name: string }
  | { k: 'hash' }
  | { k: 'number'; name: string; style?: string }
  | { k: 'plural'; name: string; ordinal: boolean; offset: number; options: Record<string, Node[]> }
  | { k: 'select'; name: string; options: Record<string, Node[]> };

export class IcuSyntaxError extends Error {}

class Parser {
  i = 0;
  constructor(private s: string) {}

  fail(msg: string): never {
    throw new IcuSyntaxError(`${msg} at ${this.i} in "${this.s}"`);
  }

  /** Parse a message until an unmatched `}` (inside options) or the end. */
  message(inPlural: boolean, depth: number): Node[] {
    const out: Node[] = [];
    let text = '';
    const flush = () => {
      if (text) out.push({ k: 'text', v: text });
      text = '';
    };
    const s = this.s;
    while (this.i < s.length) {
      const c = s[this.i];
      if (c === "'") {
        // ICU apostrophe rules: '' is a literal apostrophe; '{...' / '#' quotes syntax chars.
        const next = s[this.i + 1];
        if (next === "'") {
          text += "'";
          this.i += 2;
        } else if (next === '{' || next === '}' || (inPlural && next === '#') || next === '|') {
          const end = s.indexOf("'", this.i + 1);
          if (end < 0) {
            text += s.slice(this.i + 1);
            this.i = s.length;
          } else {
            text += s.slice(this.i + 1, end).replace(/''/g, "'");
            this.i = end + 1;
          }
        } else {
          text += "'";
          this.i++;
        }
      } else if (c === '{') {
        flush();
        this.i++;
        out.push(this.argument(depth));
      } else if (c === '}') {
        if (depth === 0) this.fail('Unmatched }');
        break;
      } else if (c === '#' && inPlural) {
        flush();
        out.push({ k: 'hash' });
        this.i++;
      } else {
        text += c;
        this.i++;
      }
    }
    flush();
    return out;
  }

  ws(): void {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++;
  }

  ident(): string {
    this.ws();
    const m = /^[^\s,{}#']+/.exec(this.s.slice(this.i));
    if (!m) this.fail('Expected identifier');
    this.i += m[0].length;
    this.ws();
    return m[0];
  }

  expect(ch: string): void {
    this.ws();
    if (this.s[this.i] !== ch) this.fail(`Expected "${ch}"`);
    this.i++;
  }

  argument(depth: number): Node {
    const name = this.ident();
    if (this.s[this.i] === '}') {
      this.i++;
      return { k: 'arg', name };
    }
    this.expect(',');
    const type = this.ident();
    if (type === 'number') {
      let style: string | undefined;
      if (this.s[this.i] === ',') {
        this.i++;
        style = this.ident();
      }
      this.expect('}');
      return { k: 'number', name, style };
    }
    if (type !== 'plural' && type !== 'select' && type !== 'selectordinal') this.fail(`Unknown argument type "${type}"`);
    this.expect(',');
    let offset = 0;
    const options: Record<string, Node[]> = {};
    for (;;) {
      this.ws();
      if (this.s[this.i] === '}') {
        this.i++;
        break;
      }
      const sel = this.ident();
      if (sel.startsWith('offset:')) {
        offset = Number(sel.slice(7));
        continue;
      }
      if (options[sel]) this.fail(`Duplicate option "${sel}"`);
      this.expect('{');
      options[sel] = this.message(type !== 'select', depth + 1);
      this.expect('}');
    }
    if (!options.other) this.fail(`"${type}" argument "${name}" needs an "other" option`);
    if (type === 'select') return { k: 'select', name, options };
    return { k: 'plural', name, ordinal: type === 'selectordinal', offset, options };
  }
}

export function parse(message: string): Node[] {
  const p = new Parser(message);
  const nodes = p.message(false, 0);
  if (p.i < message.length) p.fail('Unexpected }');
  return nodes;
}

/** Argument names used by a message (for placeholder-consistency checks). */
export function argNames(message: string): string[] {
  const names = new Set<string>();
  const walk = (ns: Node[]) => {
    for (const n of ns) {
      if (n.k === 'arg' || n.k === 'number') names.add(n.name);
      else if (n.k === 'plural' || n.k === 'select') {
        names.add(n.name);
        Object.values(n.options).forEach(walk);
      }
    }
  };
  walk(parse(message));
  return [...names].sort();
}

const cache = new Map<string, Node[]>();
const pluralRules = new Map<string, Intl.PluralRules>();
const numberFormats = new Map<string, Intl.NumberFormat>();

function rules(locale: string, ordinal: boolean): Intl.PluralRules {
  const key = `${locale}|${ordinal}`;
  let r = pluralRules.get(key);
  if (!r) pluralRules.set(key, (r = new Intl.PluralRules(locale, { type: ordinal ? 'ordinal' : 'cardinal' })));
  return r;
}

export function numberFormat(locale: string, style?: string): Intl.NumberFormat {
  const key = `${locale}|${style ?? ''}`;
  let f = numberFormats.get(key);
  if (!f) {
    const opts: Intl.NumberFormatOptions = style === 'integer' ? { maximumFractionDigits: 0 } : style === 'percent' ? { style: 'percent' } : {};
    numberFormats.set(key, (f = new Intl.NumberFormat(locale, opts)));
  }
  return f;
}

function render(nodes: Node[], params: Params, locale: string, hash?: number): string {
  let out = '';
  for (const n of nodes) {
    switch (n.k) {
      case 'text':
        out += n.v;
        break;
      case 'hash':
        out += hash === undefined ? '#' : numberFormat(locale).format(hash);
        break;
      case 'arg': {
        const v = params[n.name];
        out += v === undefined ? `{${n.name}}` : typeof v === 'number' ? numberFormat(locale).format(v) : v;
        break;
      }
      case 'number': {
        const v = Number(params[n.name]);
        out += Number.isFinite(v) ? numberFormat(locale, n.style).format(v) : `{${n.name}}`;
        break;
      }
      case 'plural': {
        const v = Number(params[n.name]);
        const exact = n.options[`=${v}`];
        const opt = exact ?? n.options[rules(locale, n.ordinal).select(v - n.offset)] ?? n.options.other;
        out += render(opt, params, locale, v - n.offset);
        break;
      }
      case 'select': {
        const v = String(params[n.name]);
        out += render(n.options[v] ?? n.options.other, params, locale, hash);
        break;
      }
    }
  }
  return out;
}

/** Format an ICU message. Throws IcuSyntaxError on malformed patterns. */
export function format(message: string, params: Params = {}, locale = 'en'): string {
  let nodes = cache.get(message);
  if (!nodes) cache.set(message, (nodes = parse(message)));
  return render(nodes, params, locale);
}

function quote(text: string, inPlural: boolean): string {
  let out = text.replace(/'/g, "''");
  out = out.replace(/[{}]/g, (c) => `'${c}'`);
  if (inPlural) out = out.replace(/#/g, "'#'");
  return out;
}

function serialize(nodes: Node[], inPlural: boolean): string {
  return nodes
    .map((n) => {
      switch (n.k) {
        case 'text':
          return quote(n.v, inPlural);
        case 'hash':
          return '#';
        case 'arg':
          return `{${n.name}}`;
        case 'number':
          return n.style ? `{${n.name}, number, ${n.style}}` : `{${n.name}, number}`;
        case 'plural': {
          const head = `${n.name}, ${n.ordinal ? 'selectordinal' : 'plural'},${n.offset ? ` offset:${n.offset}` : ''}`;
          return `{${head} ${Object.entries(n.options)
            .map(([k, v]) => `${k} {${serialize(v, true)}}`)
            .join(' ')}}`;
        }
        case 'select':
          return `{${n.name}, select, ${Object.entries(n.options)
            .map(([k, v]) => `${k} {${serialize(v, inPlural)}}`)
            .join(' ')}}`;
      }
    })
    .join('');
}

/**
 * Rewrite only the translatable text of a message, leaving every argument,
 * plural/select selector and `#` untouched (used by the pseudo-localiser).
 */
export function mapText(message: string, fn: (text: string) => string): string {
  const walk = (ns: Node[]): Node[] =>
    ns.map((n): Node => {
      if (n.k === 'text') return { k: 'text', v: fn(n.v) };
      if (n.k === 'plural' || n.k === 'select') return { ...n, options: Object.fromEntries(Object.entries(n.options).map(([k, v]) => [k, walk(v)])) };
      return n;
    });
  return serialize(walk(parse(message)), false);
}

/** All literal text of a message, space-joined (for glyph, width and word counts). */
export function plainText(message: string): string {
  const parts: string[] = [];
  const walk = (ns: Node[]) => {
    for (const n of ns) {
      if (n.k === 'text') parts.push(n.v);
      else if (n.k === 'plural' || n.k === 'select') Object.values(n.options).forEach(walk);
    }
  };
  walk(parse(message));
  return parts.join(' ');
}
