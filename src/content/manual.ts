/**
 * The Surgeon's Manual (GAM-0209): one page per instrument and per ailment, each with a
 * three-frame animated diagram (src/ui/manualDiagram.ts). A page unlocks the first time the
 * surgeon meets it — an instrument when an operation hands it over, an ailment when it first
 * appears on the table — and is kept in the save's codex list as `manual.<page>`.
 * Text lives in the i18n tables: instruments reuse `tool.<id>.name|hint`, ailments use
 * `manual.<id>.title|body`.
 */
import { BloodPool, Bubo, Burn, Embedded, Grub, Incision, Laceration, Rot, Sigil, Venom } from '../surgery/entities';
import type { Entity } from '../surgery/entity';
import type { Operation } from '../surgery/operation';
import { TOOL_INFO, type ToolId } from '../surgery/types';

/** What a diagram shows being treated. */
export type DiagramKind = 'incision' | 'embedded' | 'pool' | 'laceration' | 'rot' | 'venom' | 'grub' | 'hidden' | 'burn' | 'bubo' | 'sigil';

export interface ManualPage {
  id: string;
  kind: 'tool' | 'ailment';
  /** The instrument the diagram shows at work. */
  tool: ToolId;
  diagram: DiagramKind;
}

/** Each instrument's page shows its signature use. */
const TOOL_DIAGRAM: Record<ToolId, DiagramKind> = {
  lancet: 'incision',
  tongs: 'embedded',
  leech: 'pool',
  thread: 'laceration',
  salve: 'rot',
  tincture: 'venom',
  brand: 'grub',
  lens: 'hidden',
};

/** The demo ailments (GAM-0006), each with the instrument that treats it. */
const AILMENTS: readonly { id: DiagramKind; tool: ToolId; cls: () => abstract new (...a: never[]) => Entity }[] = [
  { id: 'laceration', tool: 'thread', cls: () => Laceration },
  { id: 'pool', tool: 'leech', cls: () => BloodPool },
  { id: 'incision', tool: 'lancet', cls: () => Incision },
  { id: 'embedded', tool: 'tongs', cls: () => Embedded },
  { id: 'burn', tool: 'salve', cls: () => Burn },
  { id: 'bubo', tool: 'lancet', cls: () => Bubo },
  { id: 'rot', tool: 'salve', cls: () => Rot },
  { id: 'venom', tool: 'tincture', cls: () => Venom },
  { id: 'grub', tool: 'brand', cls: () => Grub },
  { id: 'sigil', tool: 'brand', cls: () => Sigil },
];

export const MANUAL_PAGES: readonly ManualPage[] = [
  ...TOOL_INFO.map((t): ManualPage => ({ id: t.id, kind: 'tool', tool: t.id, diagram: TOOL_DIAGRAM[t.id] })),
  ...AILMENTS.map((a): ManualPage => ({ id: a.id, kind: 'ailment', tool: a.tool, diagram: a.id })),
];

/** The save's codex id for a page. */
export const manualId = (page: string): string => `manual.${page}`;

/** The ailment page an entity belongs to, if any. */
export function manualPageOf(e: Entity): string | null {
  return AILMENTS.find((a) => e instanceof a.cls())?.id ?? null;
}

/**
 * Unlock pages on first encounter: the operation's instruments at once, each ailment the first
 * time one is on the table. Returns the unsubscribe.
 */
export function watchManual(op: Operation, onUnlock: (id: string) => void): () => void {
  const seen = new Set<string>();
  const unlock = (page: string | null) => {
    if (!page || seen.has(page)) return;
    seen.add(page);
    onUnlock(manualId(page));
  };
  for (const t of op.def.tools) unlock(t);
  for (const e of op.entities) if (e.alive && !e.hidden) unlock(manualPageOf(e));
  return op.events.on('spawn', ({ entity }) => {
    if (!entity.hidden) unlock(manualPageOf(entity));
  });
}
