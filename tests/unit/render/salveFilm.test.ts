import { describe, expect, it } from 'vitest';
import { coverageOf, FILM_FADE_S, filmPoints, SalveFilm } from '../../../src/render/salveFilm';
import type { Gfx } from '../../../src/render/gfx';
import { Burn, Laceration } from '../../../src/surgery/entities';
import { at, start } from '../../harness';

const gfx = (calls: string[]) => new Proxy({}, { get: (_t, k) => () => void calls.push(String(k)) }) as unknown as Gfx;

describe("Saint's Salve film (ENG-0118)", () => {
  it('coats exactly the salved cells of a live wound and fades once the wound is set', () => {
    let burn!: Burn;
    const op = start((o) => [(burn = new Burn(at(0, 0), 30, o, 'fire')), new Laceration(at(150, 0), 0, 30, 0.2)]);
    const cov = coverageOf(burn)!;
    expect(cov).not.toBeNull();
    expect(filmPoints(cov)).toHaveLength(0);
    cov.brush(at(0, 0), 16);
    const n = filmPoints(cov).length;
    expect(n).toBeGreaterThan(0);
    const film = new SalveFilm();
    const calls: string[] = [];
    film.draw(gfx(calls), op.entities, 0);
    expect(calls.filter((c) => c === 'circleGrad')).toHaveLength(n);
    // Set: the burn leaves; its film fades over FILM_FADE_S.
    burn.kill();
    film.set(burn, 10);
    calls.length = 0;
    film.draw(gfx(calls), [], 10 + FILM_FADE_S / 2);
    expect(calls.filter((c) => c === 'circleGrad')).toHaveLength(n);
    calls.length = 0;
    film.draw(gfx(calls), [], 10 + FILM_FADE_S + 0.01);
    expect(calls).toHaveLength(0);
    expect(film.fadingCount).toBe(0);
  });

  it('salve-closable cuts carry a film too', () => {
    const op = start(() => [new Laceration(at(0, 0), 0, 30, 0.2)]);
    expect(coverageOf(op.entities[0])).not.toBeNull();
  });
});
