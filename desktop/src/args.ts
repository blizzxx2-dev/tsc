/**
 * Command-line flags (PLT-0020):
 *   --windowed  --fullscreen  --safe-mode  --reset-settings  --kiosk  --dev
 *   --log-level=<debug|info|warn|error>  --gl-backend=<d3d11|d3d9|gl|gles|vulkan|metal|swiftshader>
 *   --integrated-gpu   (stay on the power-saving GPU; by default the game asks for the discrete one)
 *   --flag=<name>=<0|1>   (QA builds; see src/platform/flags.ts)
 * Unknown arguments (Chromium switches, Steam's own, a file path from macOS) are ignored.
 */
import type { LaunchArgs } from '../../src/platform/bridge';

export const GL_BACKENDS = ['d3d11', 'd3d9', 'gl', 'gles', 'vulkan', 'metal', 'swiftshader'] as const;
const LEVELS = ['debug', 'info', 'warn', 'error'];

export function parseArgs(argv: readonly string[]): LaunchArgs {
  const a: LaunchArgs = {
    dev: false,
    windowed: false,
    fullscreen: false,
    safeMode: false,
    resetSettings: false,
    kiosk: false,
    logLevel: null,
    glBackend: null,
    flags: {},
  };
  for (const raw of argv) {
    const [k, ...rest] = raw.split('=');
    const v = rest.join('=');
    switch (k) {
      case '--dev':
        a.dev = true;
        break;
      case '--windowed':
        a.windowed = true;
        a.fullscreen = false;
        break;
      case '--fullscreen':
        a.fullscreen = true;
        a.windowed = false;
        break;
      case '--safe-mode':
        a.safeMode = true;
        break;
      case '--reset-settings':
        a.resetSettings = true;
        break;
      case '--kiosk':
        a.kiosk = true;
        break;
      case '--integrated-gpu':
        a.integratedGpu = true;
        break;
      case '--log-level':
        a.logLevel = LEVELS.includes(v) ? v : a.logLevel;
        break;
      case '--gl-backend':
        a.glBackend = (GL_BACKENDS as readonly string[]).includes(v) ? v : a.glBackend;
        break;
      case '--flag': {
        const [name, val = '1'] = v.split('=');
        if (/^[A-Za-z][A-Za-z0-9]*$/.test(name)) a.flags[name] = val;
        break;
      }
    }
  }
  return a;
}

/** Chromium ANGLE switch for a `--gl-backend` value. */
export function angleSwitch(backend: string | null): string | null {
  if (!backend) return null;
  return backend === 'swiftshader' ? 'swiftshader' : backend;
}

/**
 * Chromium switches that pick the graphics card. On a laptop with both an integrated and a discrete
 * GPU, WebGL's `powerPreference: 'high-performance'` alone does not move Chromium's GPU process off
 * the integrated chip; `force_high_performance_gpu` makes it choose the high-performance adapter
 * (Windows and macOS). Safe mode, the software renderer and `--integrated-gpu` leave the choice to
 * the system: safe mode is the path back from a GPU that crashes the game.
 */
export function gpuSwitches(o: { safeMode: boolean; glBackend: string | null; integratedGpu?: boolean }): string[] {
  if (o.safeMode || o.integratedGpu || o.glBackend === 'swiftshader') return [];
  return ['force_high_performance_gpu'];
}
