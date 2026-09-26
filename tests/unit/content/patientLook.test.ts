import { describe, expect, it } from 'vitest';
import { CAST, patientLook } from '../../../src/content/characters';

describe('patient busts (ART-0115…0123, ART-0128)', () => {
  it('the demo cast have their own looks; the rest are seeded from the name; no name is the generic patient', () => {
    expect(patientLook('Jost, drover').silhouette).toBe('cap');
    expect(patientLook('Ushkar').skin).toBe('#7a8a70');
    expect(patientLook(undefined)).toBe(CAST.patient);
    const a = patientLook('Ute Brandt');
    expect(patientLook('Ute Brandt')).toEqual(a);
    const looks = ['Ute Brandt', 'Gerd Mahler', 'Anka Roth', 'Konrad Pell', 'Lotte Harrach', 'Veit', 'Kaspar'].map((n) =>
      JSON.stringify({ ...patientLook(n), name: '' }),
    );
    expect(new Set(looks).size).toBeGreaterThan(4);
    expect(patientLook('Sister Agathe').silhouette).toBe('coif');
  });
});
