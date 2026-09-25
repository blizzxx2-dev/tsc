/** The QA console command set (QAT-0074/0075/0077), built on the automation API. */
import type { Rank, ToolId } from '../surgery/types';
import type { DebugApi } from './api';
import { boolArg, CommandRegistry, intArg, numArg } from './commands';
import { PRESET_NAMES } from './presets';

const RANKS: Rank[] = ['XS', 'S', 'A', 'B', 'C'];

export interface ConsoleHooks {
  /** Telemetry controls, when the telemetry module is present. */
  telemetry?: { setEnabled(on: boolean): void; enabled(): boolean; dump(): unknown[] };
}

const brief = (api: DebugApi) => {
  const s = api.state();
  const op = s.op;
  return op
    ? `${s.scene} ${op.id} ${op.status} phase ${op.phase + 1}/${op.phaseCount} vitals ${Math.round(op.vitals)} time ${Math.round(op.timeLeft)}s score ${op.score} (${op.rank})`
    : `${s.scene}${s.story ? ` ${s.story.id} line ${s.story.line + 1}/${s.story.lineCount}` : ''} — save ch${s.save.progress.chapter + 1} step ${s.save.progress.step}`;
};

export function buildCommands(api: DebugApi, hooks: ConsoleHooks = {}): CommandRegistry<DebugApi> {
  const reg = new CommandRegistry(api);
  reg.add(
    { name: 'help', help: 'list commands', run: () => reg.help() },
    { name: 'state', help: 'one-line summary of the current scene/operation', run: (a) => brief(a) },
    { name: 'json', help: 'full debug state as JSON (also window.__game.debug.state())', run: (a) => JSON.stringify(a.state(), null, 1) },
    { name: 'history', help: 'commands used this session', run: () => reg.history.join('\n') },
    { name: 'title', help: 'back to the title screen', run: (a) => a.title() },
    // Presets & progress
    { name: 'presets', help: 'list save presets', run: () => PRESET_NAMES.join(', ') },
    { name: 'preset', usage: '<name>', min: 1, help: `load a save preset (${PRESET_NAMES.join(', ')})`, run: (a, [n]) => (a.preset(n), `loaded preset ${n}`) },
    { name: 'unlockall', help: 'make every demo operation reachable in the Operating Theatre', run: (a) => (a.unlockAll(), 'all operations unlocked') },
    // Content navigation (QAT-0077)
    {
      name: 'chapter',
      usage: '<n> [step]',
      min: 1,
      help: 'play chapter n (1-based) from step (0-based)',
      run: (a, [n, s]) => (a.goto(intArg(n, 'chapter') - 1, s ? intArg(s, 'step') : 0), brief(a)),
    },
    {
      name: 'story',
      usage: '<id> [line]',
      min: 1,
      help: 'open a story scene at a line (1-based)',
      run: (a, [id, l]) => (a.story(id, l ? intArg(l, 'line') - 1 : 0), brief(a)),
    },
    {
      name: 'op',
      usage: '<id> [go]',
      min: 1,
      help: 'open an operation briefing ("go" starts it)',
      run: (a, [id, g]) => (a.operation(id, g === 'go'), brief(a)),
    },
    {
      name: 'results',
      usage: '<rank> [op] [lost]',
      min: 1,
      help: 'show the results screen at a rank',
      run: (a, [r, id, lost]) => {
        const rank = r.toUpperCase() as Rank;
        if (!RANKS.includes(rank)) throw new Error(`rank must be one of ${RANKS.join('/')}`);
        a.results(rank, id ?? 'op1-1', lost !== 'lost');
        return `results ${rank}`;
      },
    },
    { name: 'demoend', help: 'show the demo-complete / wishlist screen', run: (a) => (a.demoEnd(), 'demo end') },
    { name: 'flag', usage: '<name> <value>', min: 2, help: 'set (value true/1) or clear (false/0) a flag', run: (a, [n, v]) => a.flag(n, v) },
    // Operation cheats
    { name: 'skip', help: 'clear the current phase', run: (a) => (a.skipPhase(), brief(a)) },
    { name: 'win', help: 'clear every phase (win)', run: (a) => (a.win(), brief(a)) },
    {
      name: 'lose',
      usage: '[time]',
      help: 'lose the operation (by vitals, or by timer with "time")',
      run: (a, [why]) => (a.lose(why === 'time' ? 'Time has run out.' : undefined), brief(a)),
    },
    { name: 'vitals', usage: '<0-99>', min: 1, help: 'set vitals', run: (a, [v]) => (a.setVitals(numArg(v, 'vitals')), brief(a)) },
    { name: 'time', usage: '<seconds>', min: 1, help: 'set time left', run: (a, [v]) => (a.setTime(numArg(v, 'seconds')), brief(a)) },
    {
      name: 'tool',
      usage: '<id>',
      min: 1,
      help: 'select a tool (lancet, tongs, leech, thread, salve, tincture, brand, lens)',
      run: (a, [t]) => (a.tool(t as ToolId), brief(a)),
    },
    { name: 'litany', help: 'invoke the Litany of Stillness', run: (a) => (a.litany() ? 'the Litany holds' : 'the Litany cannot be invoked now') },
    { name: 'sim', usage: '<seconds>', min: 1, help: 'advance the operation simulation only', run: (a, [s]) => (a.simulate(numArg(s, 'seconds')), brief(a)) },
    { name: 'freeze', help: 'stop scene updates and drawing; advance with "step"', run: (a) => (a.freeze(), 'frozen') },
    { name: 'thaw', help: 'resume normal updates', run: (a) => (a.thaw(), 'running') },
    { name: 'step', usage: '[frames]', help: 'run whole frames while frozen', run: (a, [n]) => (a.step(n ? intArg(n, 'frames') : 1), brief(a)) },
    { name: 'hash', help: 'state hash of the running operation', run: (a) => a.hash() },
    // Rendering (ENG-0146)
    {
      name: 'post',
      usage: '[pass|all] [on|off]',
      help: 'list the post-process passes, or enable/disable/toggle one ("post bloom off", "post grain", "post all on")',
      run: (a, [id, v]) => {
        if (id === undefined)
          return a
            .postPasses()
            .map((p) => `${p.enabled ? '[x]' : '[ ]'} ${p.id.padEnd(9)} ${p.label}`)
            .join('\n');
        const on = a.postPass(id, v === undefined ? undefined : boolArg(v));
        return `post ${id} ${on ? 'on' : 'off'}`;
      },
    },
    // Shader quality tiers (ENG-0082): "quality low", "quality high live" (per-pixel noise for A/B against the bake).
    {
      name: 'quality',
      usage: '[low|medium|high] [baked|live]',
      help: 'show or set the shader quality tier; a second word overrides the flesh noise source',
      run: (a, [q, n]) => {
        const noise = n === 'baked' || n === 'live' ? n : n === undefined ? undefined : null;
        const r = a.shaderQuality(q, noise);
        return `quality ${r.quality} (noise ${r.noise})`;
      },
    },
  );
  if (hooks.telemetry) {
    const t = hooks.telemetry;
    reg.add({
      name: 'telemetry',
      usage: '[on|off|dump]',
      help: 'local opt-in telemetry: enable, disable or dump the queued events',
      run: (_a, [v]) => {
        if (v === 'dump') return JSON.stringify(t.dump(), null, 1);
        if (v !== undefined) t.setEnabled(boolArg(v));
        return `telemetry ${t.enabled() ? 'on' : 'off'}`;
      },
    });
  }
  return reg;
}
