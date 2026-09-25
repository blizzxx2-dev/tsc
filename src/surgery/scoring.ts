import type { Rating, ToolId } from './types';
import { DEFAULT_TUNING } from './tuning';

/**
 * The scoring spec, in code: every rateable action, the label its popup shows,
 * and what earns each rating. Tests assert every label the simulation emits is
 * listed here; the results screen and the Surgeon's Manual read it.
 *
 * Points: COOL 100 / GOOD 60 / BAD 15 / MISS 0, × (1 + min(combo, 20) × 0.05).
 * Boss adds pay 25 % (combo capped at ×5, total capped at 15 % of S); entities
 * created by the surgeon's own mistakes pay nothing.
 *
 * End bonuses: 20 × the patient's *average* vitals over the operation (a
 * last-second tincture buys nothing), and 10 per second left (8 on boss
 * operations; nothing under 10 s).
 */
export interface ScoringRule {
  label: string;
  action: string;
  tools: readonly ToolId[];
  criteria: Partial<Record<Rating, string>>;
}

const S = DEFAULT_TUNING;

export const SCORING: readonly ScoringRule[] = [
  // Lancet
  { label: 'Incision', action: 'Trace an incision guide', tools: ['lancet'], criteria: { cool: `mean path error ≤ ${S.incision.coolDev} px`, good: `≤ ${S.incision.goodDev} px (or a stroke slower than ${S.incision.slowSpeed} px/s)`, bad: `> ${S.incision.goodDev} px` } },
  { label: 'Skin', action: 'Open the skin layer of a deep incision', tools: ['lancet'], criteria: { cool: 'as Incision', good: 'as Incision', bad: 'as Incision' } },
  { label: 'Fascia', action: 'Open the layer beneath', tools: ['lancet'], criteria: { cool: 'as Incision', good: 'as Incision', bad: 'as Incision' } },
  { label: 'Rushed', action: 'Incision stroke too fast', tools: ['lancet'], criteria: { bad: `faster than ${S.incision.rushedSpeed} px/s` } },
  { label: 'Off the line', action: 'Slip off an incision guide', tools: ['lancet'], criteria: { bad: `more than ${S.incision.slipDist} px from the guide` } },
  { label: 'Stray cut', action: 'Lancet held on empty flesh', tools: ['lancet'], criteria: { miss: `held > ${S.miss.emptyHold} s on nothing while work remains` } },
  { label: 'Reopened', action: 'Cut across your own stitches', tools: ['lancet'], criteria: { bad: 'always; the reopened wound pays nothing' } },
  { label: 'Nick', action: 'First nick to free a barbed head', tools: ['lancet'], criteria: { good: 'within 30 px of the entry' } },
  { label: 'Barbs freed', action: 'Second nick', tools: ['lancet'], criteria: { good: 'within 30 px of the entry' } },
  { label: 'Char excised', action: 'Cut the dead core from a grade-3 burn', tools: ['lancet'], criteria: { good: 'cut length ≥ 0.8 × burn radius inside it' } },
  { label: 'Lanced', action: 'Lance a bubo (or an egg sac)', tools: ['lancet'], criteria: { cool: 'before it is 75 % ripe', good: 'ripe' } },
  { label: 'Overcut', action: 'Lance a bubo with a cut longer than it is wide', tools: ['lancet'], criteria: { bad: 'cut > bubo diameter; it spills' } },
  // Tongs
  { label: 'Arrow', action: 'Extract an arrow', tools: ['tongs'], criteria: { cool: `pulled within ±${S.tongs.coolAngle}° of its axis`, good: `within ±${S.tongs.goodAngle}°` } },
  { label: 'Bolt', action: 'Extract a crossbow bolt (two-stage pull)', tools: ['tongs'], criteria: { cool: 'on axis, paused at 40 %', good: `within ±${S.tongs.goodAngle}°` } },
  { label: 'Lead shot', action: 'Extract lead shot', tools: ['tongs'], criteria: { cool: 'dragged off the body' } },
  { label: 'Fang', action: 'Extract a lodged fang', tools: ['tongs'], criteria: { cool: `on its (lens-revealed) axis ±${S.tongs.coolAngle}°`, good: `±${S.tongs.goodAngle}°` } },
  { label: 'Shard', action: 'Extract a shard', tools: ['tongs'], criteria: { cool: `±${S.tongs.coolAngle}°`, good: `±${S.tongs.goodAngle}°` } },
  { label: 'Glass', action: 'Extract glass', tools: ['tongs'], criteria: { cool: `±${S.tongs.coolAngle}° and slower than ${S.tongs.glassSpeed} px/s`, good: `±${S.tongs.goodAngle}°` } },
  { label: 'Hexstone', action: 'Extract hexstone into the lead dish', tools: ['tongs'], criteria: { cool: `±${S.tongs.coolAngle}°`, good: `±${S.tongs.goodAngle}°` } },
  { label: 'Wadding', action: 'Remove cloth wadding', tools: ['tongs'], criteria: { good: 'dragged off the body' } },
  { label: 'Torn', action: 'Pull a barbed head without nicking', tools: ['tongs'], criteria: { bad: 'always; 1.6× bleed laceration' } },
  { label: 'Wrenched', action: 'Pull against the axis', tools: ['tongs'], criteria: { bad: `more than ${S.tongs.goodAngle}° off axis` } },
  { label: 'Snapped', action: 'Pull a bolt through without pausing', tools: ['tongs'], criteria: { bad: 'past 70 % without the 0.3 s pause; head left inside' } },
  { label: 'Sliced', action: 'Drag glass too fast', tools: ['tongs'], criteria: { bad: `faster than ${S.tongs.glassSpeed} px/s` } },
  { label: 'Debrided', action: 'Pluck burn eschar', tools: ['tongs'], criteria: { good: 'each flake' } },
  { label: 'Plucked', action: 'Drag a grub off the body', tools: ['tongs'], criteria: { good: 'released off the body' } },
  { label: 'Cast out', action: 'Drag a Malison shard off the body', tools: ['tongs'], criteria: { cool: 'before it rejoins' } },
  // Leech-Pipe
  { label: 'Drained', action: 'Draw off a pool (≥ 20 px; blood from a wound left bleeding pays nothing)', tools: ['leech'], criteria: { cool: `cleared within ${S.blood.coolTime} s of first contact`, good: `within ${S.blood.goodTime} s` } },
  { label: 'Neutralised', action: 'Draw off live acid', tools: ['leech'], criteria: { good: `${S.burn.acidNeutralise} s of suction` } },
  // Gut Thread
  { label: 'Stitched', action: 'Stitch a laceration', tools: ['thread'], criteria: { cool: `one stroke, spacing ${S.stitch.coolMin}–${S.stitch.coolMax} px`, good: `any closure without a gap > ${S.stitch.goodMax} px` } },
  { label: 'Closed', action: 'Close the initial incision', tools: ['thread'], criteria: { cool: `as Stitched; +${S.scoring.closureBonus} bonus`, good: 'as Stitched' } },
  { label: 'Restitched', action: 'Close a reopened wound', tools: ['thread'], criteria: { good: 'pays nothing (penalty entity)' } },
  { label: 'Ligature', action: 'Tie off a venom vein', tools: ['thread'], criteria: { good: 'a stitch across the vein' } },
  // Salve
  { label: 'Sealed', action: 'Salve a small nick', tools: ['salve'], criteria: { good: `≥ ${S.laceration.salveCoverage * 100} % coverage` } },
  { label: 'Burn dressed', action: 'Salve a burn', tools: ['salve'], criteria: { cool: `≥ ${S.burn.coverage * 100} % in one stroke`, good: 'several strokes' } },
  { label: 'Cleansed', action: 'Salve a lanced bubo', tools: ['salve'], criteria: { good: 'after the pus is drained' } },
  { label: 'Rot purged', action: 'Salve rot away', tools: ['salve'], criteria: { cool: `≥ ${S.rot.coverage * 100} % in one stroke`, good: 'several strokes' } },
  { label: 'Soothed', action: 'Salve a scorch mark', tools: ['salve'], criteria: { good: 'always' } },
  { label: 'Salve on acid', action: 'Salve before the acid is drawn off', tools: ['salve'], criteria: { bad: 'once per stroke' } },
  // Tincture
  { label: 'Stabilised', action: 'Inject the red tincture', tools: ['tincture'], criteria: { cool: `vitals < ${S.tincture.coolBelow} (counts for the combo; rescue pays no points)`, good: `vitals < ${S.tincture.goodBelow}` } },
  { label: 'Wasteful', action: 'Inject when not needed', tools: ['tincture'], criteria: { bad: `vitals > ${S.tincture.badAbove}` } },
  { label: 'Into the wound', action: 'Inject into or beside an open wound', tools: ['tincture'], criteria: { miss: `< ${S.tincture.woundClearance} px from a wound` } },
  { label: 'Roused', action: 'Blue stimulant given to a patient in torpor', tools: ['tincture'], criteria: { good: 'torpor lifted' } },
  { label: 'Antidote', action: 'Hold the tincture on a bite', tools: ['tincture'], criteria: { cool: 'before the venom spreads 50 px', good: 'later' } },
  // Brand
  { label: 'Seared', action: 'Sear a grub or spiderling', tools: ['brand'], criteria: { cool: `${S.brand.grubHold} s held` } },
  { label: 'Split', action: 'Let go of a grub mid-searing', tools: ['brand'], criteria: { bad: `released between ${S.brand.grubSplitMin} and ${S.brand.grubSplitMax} s` } },
  { label: 'Scorched', action: 'Brand held on healthy flesh', tools: ['brand'], criteria: { bad: `> ${S.brand.fleshBurnAfter} s` } },
  { label: 'Stilled', action: 'Brand hexstone still', tools: ['brand'], criteria: { good: `${S.tongs.hexCalm} s held` } },
  { label: 'Ember out', action: 'Brand out a hexfire ember', tools: ['brand'], criteria: { good: `${S.brand.hexfireEmber} s held` } },
  { label: 'Curse broken', action: 'Sear every stroke of a curse-sigil in order', tools: ['brand'], criteria: { cool: 'no wrong stroke and within par time', good: 'otherwise' } },
  { label: 'Wrong stroke', action: 'Brand a later sigil stroke first', tools: ['brand'], criteria: { bad: 'once per stroke attempt' } },
  { label: 'Silenced', action: 'Silence a Lauds Voice', tools: ['brand'], criteria: { cool: 'always' } },
  { label: 'Wounded', action: 'Wound a Malison past a threshold', tools: ['brand'], criteria: { good: 'each threshold' } },
  { label: 'Malison unmade', action: 'Destroy a Malison', tools: ['brand'], criteria: { cool: 'always' } },
  // Consequences
  { label: 'Festered', action: 'Pus left in an open wound for 5 s', tools: ['leech'], criteria: { bad: 'the wound turns to rot' } },
  { label: 'It rejoined', action: 'Malison shards left on the body', tools: ['tongs'], criteria: { miss: 'a shard outlived its 9 s' } },
  { label: 'Hatched', action: 'An egg sac hatched on its own', tools: ['lancet'], criteria: { miss: 'not lanced in time' } },
];

export const scoringRule = (label: string): ScoringRule | undefined => SCORING.find((r) => r.label === label);
