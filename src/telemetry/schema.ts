/**
 * Telemetry event schema v1 (QAT-0094) as a JSON Schema (draft 2020-12). Every event the game
 * emits is validated against it in unit tests (QAT-0095); `scripts/qa/telemetry-schema.mjs`
 * writes it to docs/qa/telemetry/events.v1.schema.json for the ingest backend and dashboards.
 *
 * Privacy rules baked into the schema: no free text from the player, no IP or hardware serials,
 * positions quantised to 32 px, the install id is a random UUID the player can reset.
 */

export const SCHEMA_VERSION = 1;

export const EVENT_NAMES = [
  'session_start',
  'consent_answered',
  'title_view',
  'new_game',
  'chapter_start',
  'op_start',
  'op_end',
  'op_fail',
  'rating',
  'tool_select',
  'story_skip',
  'settings_changed',
  'demo_end_view',
  'wishlist_click',
  'quit',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

const str = { type: 'string', minLength: 1, maxLength: 64 } as const;
const opId = { type: 'string', pattern: '^[a-z0-9-]{1,32}$' } as const;
const nonNeg = { type: 'number', minimum: 0 } as const;
const int = { type: 'integer', minimum: 0 } as const;
const rank = { enum: ['XS', 'S', 'A', 'B', 'C'] } as const;
const rating = { enum: ['cool', 'good', 'bad', 'miss'] } as const;
const tool = { enum: ['lancet', 'tongs', 'leech', 'thread', 'salve', 'tincture', 'brand', 'lens'] } as const;
const counts = {
  type: 'object',
  additionalProperties: false,
  required: ['cool', 'good', 'bad', 'miss'],
  properties: { cool: int, good: int, bad: int, miss: int },
} as const;
const assists = {
  type: 'object',
  additionalProperties: false,
  required: ['timer', 'litanyKey'],
  properties: { timer: { enum: [1, 1.5, 2] }, litanyKey: { type: 'boolean' } },
} as const;

const obj = (required: string[], properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required, properties }) as const;

/** Props schema per event. */
export const EVENT_PROPS: Record<EventName, ReturnType<typeof obj>> = {
  session_start: obj(['os', 'gpuFamily', 'locale', 'edition', 'viewport'], {
    os: { enum: ['windows', 'macos', 'linux', 'steamos', 'other'] },
    gpuFamily: { enum: ['nvidia', 'amd', 'intel', 'apple', 'qualcomm', 'software', 'other', 'unknown'] },
    locale: { type: 'string', pattern: '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$' },
    edition: { enum: ['demo', 'full'] },
    viewport: obj(['w', 'h', 'dpr'], { w: int, h: int, dpr: nonNeg }),
  }),
  consent_answered: obj(['granted'], { granted: { type: 'boolean' } }),
  title_view: obj(['firstThisSession'], { firstThisSession: { type: 'boolean' } }),
  new_game: obj(['replacedSave'], { replacedSave: { type: 'boolean' } }),
  chapter_start: obj(['chapter'], { chapter: { type: 'integer', minimum: 1, maximum: 5 } }),
  op_start: obj(['op', 'attempt', 'assists'], { op: opId, attempt: { type: 'integer', minimum: 1 }, assists }),
  op_end: obj(['op', 'result', 'rank', 'score', 'duration', 'minVitals', 'counts', 'maxCombo', 'litanyUsed', 'tinctures', 'assists'], {
    op: opId,
    result: { enum: ['won', 'lost', 'quit'] },
    rank,
    score: int,
    duration: nonNeg,
    minVitals: { type: 'number', minimum: 0, maximum: 99 },
    counts,
    maxCombo: int,
    litanyUsed: { type: 'boolean' },
    tinctures: int,
    assists,
  }),
  op_fail: obj(['op', 'reason', 'phase', 'liveKinds'], {
    op: opId,
    reason: { enum: ['vitals', 'timer', 'quit'] },
    phase: { type: 'integer', minimum: -1 },
    liveKinds: { type: 'array', maxItems: 32, items: str },
  }),
  rating: obj(['op', 'tool', 'entity', 'rating', 'x', 'y'], {
    op: opId,
    tool,
    entity: str,
    label: str,
    rating,
    x: { type: 'integer', minimum: 0, maximum: 1280, multipleOf: 32 },
    y: { type: 'integer', minimum: 0, maximum: 720, multipleOf: 32 },
  }),
  tool_select: obj(['op', 'tool'], { op: opId, tool }),
  story_skip: obj(['story', 'line', 'lines'], { story: opId, line: int, lines: int }),
  settings_changed: obj(['changes'], {
    changes: {
      type: 'object',
      minProperties: 1,
      additionalProperties: false,
      properties: {
        volume: { type: 'number', minimum: 0, maximum: 1 },
        muted: { type: 'boolean' },
        shake: { type: 'number', minimum: 0, maximum: 1 },
        timerAssist: { enum: [1, 1.5, 2] },
        litanyKey: { type: 'boolean' },
        reduceFlashing: { type: 'boolean' },
      },
    },
  }),
  demo_end_view: obj([], {}),
  wishlist_click: obj(['source'], { source: { enum: ['demo_end', 'title', 'other'] } }),
  quit: obj(['scene', 'sessionSeconds'], { scene: str, sessionSeconds: nonNeg }),
};

/** The envelope every event travels in. */
export const ENVELOPE = {
  type: 'object',
  additionalProperties: false,
  required: ['schema', 'event', 'ts', 'session', 'install', 'seq', 'build', 'flavour', 'props'],
  properties: {
    schema: { const: SCHEMA_VERSION },
    event: { enum: EVENT_NAMES },
    ts: { type: 'string', format: 'date-time' },
    session: { type: 'string', pattern: '^[0-9a-f-]{36}$' },
    install: { type: 'string', pattern: '^[0-9a-f-]{36}$' },
    seq: int,
    build: { type: 'string', pattern: '^[A-Za-z0-9._+-]{1,40}$' },
    flavour: { enum: ['dev', 'qa', 'playtest', 'release'] },
    props: { type: 'object' },
  },
} as const;

/** One JSON Schema document: the envelope, with `props` selected by `event`. */
export function eventSchema(): Record<string, unknown> {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'urn:suture-and-steel:telemetry:events:v1',
    title: 'Suture & Steel telemetry event v1',
    ...ENVELOPE,
    allOf: EVENT_NAMES.map((name) => ({
      if: { properties: { event: { const: name } }, required: ['event'] },
      then: { properties: { props: EVENT_PROPS[name] } },
    })),
  };
}
