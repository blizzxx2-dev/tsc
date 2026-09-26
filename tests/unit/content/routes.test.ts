import { describe, expect, it } from 'vitest';
import { endingFor, endingInputs } from '../../../src/content/endings';

const reader = (flags: Record<string, unknown>) => ({
  get: (k: string) => flags[k] as never,
  has: (k: string) => k in flags,
  truthy: (k: string) => !!flags[k],
});

describe('CON-0253: the documented playthrough routes reach their endings (docs/qa/playthrough-routes.md)', () => {
  it('route 1 — pardon', () => {
    expect(endingFor(endingInputs(reader({ cantorMercy: false, hornchildCertificate: 'turned', strohTooth: true, litanySeenCount: 0 })))).toBe('pardon');
  });
  it('route 2 — pyre', () => {
    expect(endingFor(endingInputs(reader({ cantorMercy: true, hornchildCertificate: 'natural', mauerFate: 'hale', litanySeenCount: 2 })))).toBe('pyre');
  });
  it('route 3 — exile', () => {
    expect(
      endingFor(endingInputs(reader({ cantorMercy: true, hornchildCertificate: 'natural', mauerFate: 'maimed', hallerFate: 'scarred', litanySeenCount: 4 }))),
    ).toBe('exile');
  });
});
