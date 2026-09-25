// Writes the telemetry event schema (src/telemetry/schema.ts) as JSON for the ingest backend and
// dashboards: docs/qa/telemetry/events.v1.schema.json. A unit test fails when the two drift.
// Usage: npm run telemetry:schema
import { mkdirSync, writeFileSync } from 'node:fs';
import { eventSchema } from '../../src/telemetry/schema';

mkdirSync('docs/qa/telemetry', { recursive: true });
writeFileSync('docs/qa/telemetry/events.v1.schema.json', JSON.stringify(eventSchema(), null, 2) + '\n');
console.log('wrote docs/qa/telemetry/events.v1.schema.json');
