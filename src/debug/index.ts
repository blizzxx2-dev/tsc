/**
 * Dev/QA tooling entry point, loaded lazily by ./hooks.ts in dev and QA builds only.
 * Exposes `window.__game.debug` (the automation API), the ` console and the F1 cheat menu,
 * and applies `?preset=<name>`.
 */
import { DebugApi, type DebugGame } from './api';
import { buildCommands, type ConsoleHooks } from './console-commands';
import { DebugOverlay } from './overlay';
import { VisualDebug } from './visual';

export interface InstalledDebug {
  api: DebugApi;
  run(line: string): Promise<string>;
  history(): string[];
}

export function installDebug(game: DebugGame, hooks: ConsoleHooks = {}): InstalledDebug {
  const api = new DebugApi(game);
  // Hit shapes / layer counts (F2) and the render-target viewer (Shift+F2), ENG-0232/0233.
  const visual = new VisualDebug(game);
  window.addEventListener('keydown', (e) => {
    if (visual.onKey(e)) e.preventDefault();
  });
  const reg = buildCommands(api, { ...hooks, visual });
  const installed: InstalledDebug = { api, run: (l) => reg.run(l), history: () => [...reg.history] };
  // The API object itself carries the console so automation can drive both.
  Object.assign(api, { run: installed.run, history: installed.history });
  (window as unknown as { __game: { debug?: DebugApi } }).__game.debug = api;
  new DebugOverlay(api, reg);
  const params = new URLSearchParams(location.search);
  const preset = params.get('preset');
  if (preset) api.preset(preset);
  // ?botplay=<op>[&profile=expert][&speed=4] — watch the bot surgeon (GAM-0189).
  const botplay = params.get('botplay');
  if (botplay) api.botPlay(botplay, params.get('profile') ?? 'steady', Number(params.get('speed') ?? 1));
  return installed;
}
