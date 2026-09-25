/**
 * The Chapter III teaser (NAR-0068): six lines read after the demo's end card, before the title —
 * foundry smoke, raised bridges, Haller's licence vote and Stroh's appointment "after Prime".
 */
import { n, say, type StoryDef } from './story';

export const TEASER_3: StoryDef = {
  id: 'teaser-3',
  place: 'Next — Chapter III: Prime and Terce',
  backdrop: 'orecamp',
  lighting: 'dusk',
  lines: [
    n('Foundry smoke lies so thick over the Kilnrows that the lamplighters go out at noon.'),
    n('At dusk the river bridges are raised, and the Watch asks every child at the gate to show its forehead.'),
    say('haller', 'The Guild will put your licence to the vote, boy. I stood in that hall once before. I can stand in it again.'),
    say('ilse', 'Doctor, there is a girl at the door with two nubs of horn in her hair, and her mother is praying.'),
    n('On the steps of the Hall of Records, a registrar reads the roll of the dead aloud, and the names keep coming.'),
    say('stroh', 'I said we would speak after Prime, Doctor. It is nearly after Prime.'),
  ],
};
