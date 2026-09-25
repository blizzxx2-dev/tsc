/**
 * Dev/QA overlays (DOM, not WebGL, so they never touch the renderer):
 * - the console (` key): type commands, see output, ↑/↓ recall history;
 * - the cheat menu (F1, or the gamepad View/Back button — QAT-0076): a list mirroring the common
 *   console commands, navigable with arrows/Enter/Esc, the d-pad/A/B or the mouse, for testers
 *   without a keyboard (Steam Deck, controller).
 */
import { CAMPAIGN } from '../content/campaign';
import type { DebugApi } from './api';
import type { CommandRegistry } from './commands';
import { PRESET_NAMES } from './presets';

const CSS = `
.qa-ovl{position:fixed;z-index:1000;font:14px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#f3e6c8;background:rgba(12,8,6,.92);border:1px solid #8a6a3a;box-shadow:0 4px 24px #000a}
.qa-con{left:12px;right:12px;bottom:12px;max-height:45vh;display:flex;flex-direction:column}
.qa-con pre{margin:0;padding:8px 10px;overflow:auto;white-space:pre-wrap;flex:1}
.qa-con input{all:unset;border-top:1px solid #8a6a3a;padding:8px 10px;color:#fff}
.qa-menu{top:12px;right:12px;width:340px;max-height:calc(100vh - 24px);overflow:auto;padding:6px 0}
.qa-menu h3{margin:4px 12px 8px;font-size:13px;letter-spacing:.08em;color:#d8a040;text-transform:uppercase}
.qa-menu .st{margin:0 12px 8px;color:#a89c80;font-size:12px}
.qa-menu button{all:unset;display:block;box-sizing:border-box;width:100%;padding:7px 14px;cursor:pointer}
.qa-menu button.sel,.qa-menu button:hover{background:#5a1418;color:#fff0c0}
`;

interface MenuItem {
  label: string;
  run?: () => unknown;
  sub?: () => MenuItem[];
}

export class DebugOverlay {
  private root: HTMLDivElement;
  private con: HTMLDivElement | null = null;
  private out!: HTMLPreElement;
  private field!: HTMLInputElement;
  private menu: HTMLDivElement | null = null;
  private stack: { title: string; items: () => MenuItem[] }[] = [];
  private sel = 0;
  private recall = -1;
  private padPrev: boolean[] = [];
  private padRepeat = 0;
  private padHeld = false;

  constructor(
    private api: DebugApi,
    private reg: CommandRegistry<DebugApi>,
  ) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'qa-debug';
    document.body.appendChild(this.root);
    window.addEventListener('keydown', (e) => this.onKey(e), true);
    requestAnimationFrame(() => this.pollPad());
  }

  // ------------------------------------------------------------------ keyboard routing

  private onKey(e: KeyboardEvent): void {
    if (e.code === 'Backquote') {
      e.preventDefault();
      e.stopPropagation();
      this.toggleConsole();
      return;
    }
    if (e.code === 'F1') {
      e.preventDefault();
      e.stopPropagation();
      this.toggleMenu();
      return;
    }
    if (this.menu && !this.con) {
      const handled = this.menuKey(e.code);
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }

  // ------------------------------------------------------------------ console

  toggleConsole(): void {
    if (this.con) {
      this.con.remove();
      this.con = null;
      return;
    }
    this.con = document.createElement('div');
    this.con.className = 'qa-ovl qa-con';
    this.out = document.createElement('pre');
    this.out.textContent = 'Suture & Steel QA console — "help" lists commands. ` closes.\n';
    this.field = document.createElement('input');
    this.field.placeholder = '> command';
    this.field.setAttribute('aria-label', 'QA console command');
    // Keep keystrokes out of the game's window listeners while typing.
    this.field.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') void this.submit();
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const h = this.reg.history;
        if (!h.length) return;
        this.recall = this.recall < 0 ? h.length : this.recall;
        this.recall = Math.max(0, Math.min(h.length, this.recall + (e.key === 'ArrowUp' ? -1 : 1)));
        this.field.value = h[this.recall] ?? '';
        e.preventDefault();
      }
    });
    this.field.addEventListener('keyup', (e) => e.stopPropagation());
    this.con.append(this.out, this.field);
    this.root.appendChild(this.con);
    this.field.focus();
  }

  private async submit(): Promise<void> {
    const line = this.field.value;
    this.field.value = '';
    this.recall = -1;
    const res = await this.reg.run(line);
    this.out.textContent += `> ${line}\n${res}\n`;
    this.out.scrollTop = this.out.scrollHeight;
  }

  // ------------------------------------------------------------------ cheat menu

  toggleMenu(): void {
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
      this.stack = [];
      return;
    }
    this.menu = document.createElement('div');
    this.menu.className = 'qa-ovl qa-menu';
    this.menu.setAttribute('role', 'menu');
    this.root.appendChild(this.menu);
    this.stack = [{ title: 'QA cheats', items: () => this.rootItems() }];
    this.sel = 0;
    this.renderMenu();
  }

  private cmd(label: string, line: string): MenuItem {
    return { label, run: () => this.reg.run(line) };
  }

  private rootItems(): MenuItem[] {
    const st = this.api.state();
    const inOp = !!st.op;
    const items: MenuItem[] = [];
    if (inOp) {
      items.push(
        this.cmd('Skip phase', 'skip'),
        this.cmd('Win operation', 'win'),
        this.cmd('Lose (vitals)', 'lose'),
        this.cmd('Lose (timer)', 'lose time'),
        this.cmd('Vitals → 99', 'vitals 99'),
        this.cmd('Vitals → 10', 'vitals 10'),
        this.cmd('Time → 10 s', 'time 10'),
        this.cmd('Invoke the Litany', 'litany'),
      );
    }
    items.push(
      { label: 'Load preset ▸', sub: () => PRESET_NAMES.map((n) => this.cmd(n, `preset ${n}`)) },
      {
        label: 'Go to ▸',
        sub: () => [
          this.cmd('Title', 'title'),
          ...CAMPAIGN.flatMap((ch, ci) => [
            this.cmd(`Chapter ${ch.numeral} — start`, `chapter ${ci + 1} 0`),
            ...ch.steps.flatMap((s) =>
              s.kind === 'op' ? [this.cmd(`  ${s.op.id} ${s.op.title}`, `op ${s.op.id}`)] : [this.cmd(`  story ${s.story.id}`, `story ${s.story.id}`)],
            ),
          ]),
          this.cmd('Demo end', 'demoend'),
        ],
      },
      {
        label: 'Results screen ▸',
        sub: () => ['XS', 'S', 'A', 'B', 'C'].map((r) => this.cmd(`Rank ${r}`, `results ${r}`)).concat([this.cmd('Lost', 'results C op1-1 lost')]),
      },
      this.cmd('Unlock all operations', 'unlockall'),
      st.frozen ? this.cmd('Thaw (resume updates)', 'thaw') : this.cmd('Freeze updates', 'freeze'),
      { label: 'Close', run: () => this.toggleMenu() },
    );
    return items;
  }

  private items(): MenuItem[] {
    return this.stack[this.stack.length - 1].items();
  }

  private renderMenu(): void {
    if (!this.menu) return;
    const items = this.items();
    this.sel = Math.max(0, Math.min(items.length - 1, this.sel));
    this.menu.replaceChildren();
    const h = document.createElement('h3');
    h.textContent = this.stack.map((s) => s.title).join(' › ');
    const st = document.createElement('div');
    st.className = 'st';
    const s = this.api.state();
    st.textContent = s.op
      ? `${s.op.id} · ${s.op.status} · phase ${s.op.phase + 1}/${s.op.phaseCount} · vitals ${Math.round(s.op.vitals)}`
      : `${s.scene} · save ch${s.save.progress.chapter + 1}/${s.save.progress.step}`;
    this.menu.append(h, st);
    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.textContent = it.label;
      b.setAttribute('role', 'menuitem');
      if (i === this.sel) b.className = 'sel';
      b.addEventListener('click', () => {
        this.sel = i;
        void this.activate();
      });
      this.menu!.appendChild(b);
    });
  }

  private async activate(): Promise<void> {
    const it = this.items()[this.sel];
    if (!it) return;
    if (it.sub) {
      this.stack.push({ title: it.label.replace(' ▸', ''), items: it.sub });
      this.sel = 0;
    } else await it.run?.();
    this.renderMenu();
  }

  private back(): void {
    if (this.stack.length > 1) {
      this.stack.pop();
      this.sel = 0;
      this.renderMenu();
    } else this.toggleMenu();
  }

  private menuKey(code: string): boolean {
    if (code === 'ArrowDown' || code === 'KeyS') this.move(1);
    else if (code === 'ArrowUp' || code === 'KeyW') this.move(-1);
    else if (code === 'Enter' || code === 'Space') void this.activate();
    else if (code === 'Escape' || code === 'Backspace') this.back();
    else return false;
    return true;
  }

  private move(d: number): void {
    const n = this.items().length;
    this.sel = (this.sel + d + n) % n;
    this.renderMenu();
  }

  // ------------------------------------------------------------------ gamepad

  private pollPad(): void {
    const pad = navigator.getGamepads?.().find((p) => p && p.connected);
    if (pad) {
      const down = pad.buttons.map((b) => b.pressed);
      const edge = (i: number) => down[i] && !this.padPrev[i];
      if (edge(8)) this.toggleMenu();
      if (this.menu) {
        const axis = pad.axes[1] ?? 0;
        const up = down[12] || axis < -0.6;
        const dn = down[13] || axis > 0.6;
        if (up || dn) {
          // First press moves at once; holding repeats after a short delay.
          if (this.padRepeat <= 0) {
            this.move(dn ? 1 : -1);
            this.padRepeat = this.padHeld ? 6 : 18;
          } else this.padRepeat--;
          this.padHeld = true;
        } else {
          this.padRepeat = 0;
          this.padHeld = false;
        }
        if (edge(0)) void this.activate();
        if (edge(1)) this.back();
      }
      this.padPrev = down;
    }
    requestAnimationFrame(() => this.pollPad());
  }
}
