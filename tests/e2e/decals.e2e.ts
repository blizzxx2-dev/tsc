/** ENG-0115/0116: draining a pool with the Leech-Pipe visibly cleans the blood decal map (64×36 GPU readback). */
import { describe, expect, it } from 'vitest';
import { useGame } from './helpers';

describe('blood decal map', () => {
  const game = useGame();

  it('pools soak into the map and draining one clears the blood under it', async () => {
    const g = game();
    await g.boot();
    await g.api('operation', 'showcase', true);
    let s = await g.until('the operation to run', (st) => st.op?.status === 'running', 1200, 20);
    const pool = s.op!.entities.find((e) => e.kind === 'BloodPool');
    expect(pool, 'showcase has a blood pool').toBeDefined();
    const r0 = (pool as { r?: number }).r ?? 0;
    // Let the pool soak into the field for two seconds of world time.
    await g.step(240, 'last');
    const R = Math.max(30, (pool as { r?: number }).r ?? 30);
    expect(await g.api<number>('decalCoverage')).toBeGreaterThan(0);
    const before = await g.api<number>('decalDensity', pool!.x, pool!.y, R);
    expect(before).toBeGreaterThan(0.1);
    // Leech-Pipe held over the pool.
    await g.api('tool', 'leech');
    await g.page.mouse.move(pool!.x, pool!.y);
    await g.step(1, 'all');
    await g.page.mouse.down();
    for (let i = 0; i < 12; i++) await g.step(30, 'last');
    await g.page.mouse.up();
    s = await g.step(1, 'last');
    const after = await g.api<number>('decalDensity', pool!.x, pool!.y, R);
    const left = s.op!.entities.find((e) => e.kind === 'BloodPool' && Math.hypot(e.x - pool!.x, e.y - pool!.y) < 5) as { r?: number } | undefined;
    // The sim drew the pool off, and the field shows it: coverage fell with it.
    expect(left === undefined || (left.r ?? 0) < r0).toBe(true);
    expect(after).toBeLessThan(before * 0.6);
  });
});
