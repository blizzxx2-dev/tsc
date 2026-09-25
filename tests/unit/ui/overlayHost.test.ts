/** ENG-0066: global overlays (toasts, achievement popups, FPS, Steam veil) render independently of the active scene. */
import { describe, expect, it } from 'vitest';
import type { Gfx } from '../../../src/render/gfx';
import { OverlayHost, TOAST_S, veilItem } from '../../../src/ui/overlayHost';

function recorder() {
  const calls: string[] = [];
  const g = {
    viewRect: () => ({ x: 0, y: 0, w: 1280, h: 720 }),
    setCamera: (m: unknown) => calls.push(m ? 'camera' : 'camera:null'),
    plate: () => calls.push('plate'),
    rect: () => calls.push('rect'),
    text: (s: string) => calls.push(`text:${s}`),
  } as unknown as Gfx;
  return { g, calls };
}

describe('global overlay host (ENG-0066)', () => {
  it('draws registered items in order, in screen space, with no scene involved', () => {
    const host = new OverlayHost();
    const order: string[] = [];
    host.add({ id: 'fps', order: 100, draw: () => order.push('fps') });
    host.add({ id: 'veil', order: 90, draw: () => order.push('veil') });
    const { g, calls } = recorder();
    host.draw(g);
    expect(calls[0]).toBe('camera:null');
    expect(order).toEqual(['veil', 'fps']);
    // Re-adding an id replaces it.
    host.add({ id: 'fps', order: 1, draw: () => order.push('fps2') });
    order.length = 0;
    host.draw(g);
    expect(order).toEqual(['fps2', 'veil']);
  });

  it('shows achievement toasts on real time and retires them', () => {
    const host = new OverlayHost();
    host.toast('Achievement unlocked', 'First, Do Little Harm', 'achievement');
    const { g, calls } = recorder();
    host.update(0.5);
    host.draw(g);
    expect(calls).toContain('text:Achievement unlocked');
    expect(calls).toContain('text:First, Do Little Harm');
    host.update(TOAST_S);
    expect(host.toasts).toHaveLength(0);
  });

  it('veils the screen while the Steam overlay is up', () => {
    let up = false;
    const host = new OverlayHost();
    host.add(
      veilItem(
        () => up,
        () => 'Paused',
      ),
    );
    const a = recorder();
    host.draw(a.g);
    expect(a.calls).not.toContain('text:Paused');
    up = true;
    const b = recorder();
    host.draw(b.g);
    expect(b.calls).toContain('rect');
    expect(b.calls).toContain('text:Paused');
  });
});
