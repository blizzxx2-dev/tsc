/** Console command registry and parser — DOM-free so it is unit-tested in Node. */

export interface CommandSpec<Ctx> {
  name: string;
  /** Argument synopsis for help, e.g. `<chapter> <step>`. */
  usage?: string;
  help: string;
  /** Minimum number of arguments. */
  min?: number;
  run(ctx: Ctx, args: string[]): string | void | Promise<string | void>;
}

/** Split a command line into words; double quotes group words (`say "two words"`). */
export function tokenize(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2]);
  return out;
}

export class CommandRegistry<Ctx> {
  private cmds = new Map<string, CommandSpec<Ctx>>();
  readonly history: string[] = [];

  constructor(private ctx: Ctx) {}

  add(...specs: CommandSpec<Ctx>[]): this {
    for (const s of specs) this.cmds.set(s.name, s);
    return this;
  }

  list(): CommandSpec<Ctx>[] {
    return [...this.cmds.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  help(): string {
    return this.list()
      .map((c) => `${c.name}${c.usage ? ' ' + c.usage : ''} — ${c.help}`)
      .join('\n');
  }

  /** Run one command line; every attempt (valid or not) is kept in the history. */
  async run(line: string): Promise<string> {
    const trimmed = line.trim();
    if (!trimmed) return '';
    this.history.push(trimmed);
    if (this.history.length > 500) this.history.shift();
    const [name, ...args] = tokenize(trimmed);
    const cmd = this.cmds.get(name.toLowerCase());
    if (!cmd) return `unknown command: ${name} (try "help")`;
    if (args.length < (cmd.min ?? 0)) return `usage: ${cmd.name} ${cmd.usage ?? ''}`.trim();
    try {
      const out = await cmd.run(this.ctx, args);
      return out ?? 'ok';
    } catch (err) {
      return `error: ${(err as Error).message}`;
    }
  }
}

/** Parse an integer argument or throw a readable error. */
export function intArg(v: string | undefined, what: string): number {
  const n = Number(v);
  if (v === undefined || !Number.isInteger(n)) throw new Error(`${what} must be an integer`);
  return n;
}

/** Parse a number argument (a dot decimal, whatever the OS locale) or throw. */
export function numArg(v: string | undefined, what: string): number {
  const n = Number(v);
  if (v === undefined || v.trim() === '' || !Number.isFinite(n)) throw new Error(`${what} must be a number`);
  return n;
}

export function boolArg(v: string | undefined): boolean {
  return !['0', 'false', 'off', 'no'].includes(String(v ?? 'true').toLowerCase());
}
