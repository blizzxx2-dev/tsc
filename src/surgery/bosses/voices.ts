import type { Vec } from '../../core/math';
import { Entity } from '../entity';
import type { Operation } from '../operation';

/**
 * What each Hour says while it fights — shown as italic lines rising from the
 * curse itself. Original verse; none quotes a real liturgy.
 */
export const MALISON_VOICES = {
  prime: [
    'Aldo Brenck. Grete Hollweg. Read them out.',
    'The first work of the day is the roll of the dead.',
    'Every name is a candle put out.',
    'I only write down what the city already did.',
    'There is room on the roll. There is always room.',
    'Hold still. The ink must dry.',
    'You strike them out. They were never yours to keep.',
    'Registrar, read on. Your hand knows the way.',
    'Kreuzer. A fine hand for a name.',
    'The roll is not finished until the city is.',
    'Who will read your name, Doctor?',
  ],
  terce: [
    'Speak, and the fire speaks with you.',
    'Every tongue of the guild at once.',
    'Heat is a kind of prayer. Give me more.',
    'Burn me, surgeon. I drink it.',
    'He struck a name from the rolls. I remember the smell.',
    'Three tongues, one word.',
    'The hall was always going to burn.',
    'Your salve is only water that has learned manners.',
    'Old hands. Old guild. Old kindling.',
    'I leap where you are not looking.',
    'Pentecost comes to the barber-surgeons at last.',
  ],
  sext: [
    'It is noon. Lie down. Everyone is lying down.',
    'Why hurry? The sun will not.',
    'Your hands are so heavy. Rest them on me.',
    'His pulse is fine. Look. It is fine.',
    'Nothing is wrong. Nothing will ever be wrong again.',
    'The camp sleeps. The captain sleeps. You should sleep.',
    'Counting men is tiring work.',
    'Stone is patient. Be stone.',
    'You have a stillness too, I hear. Let us compare.',
    'The heat, the flies, the long afternoon. Stay.',
    'One more hour of this, and then none.',
  ],
  none: [
    'The ninth hour. The hour the heart stops.',
    'I am going home. Home is the heart.',
    'Down, and down, and down.',
    'Count with me: one, two, none.',
    'You cut me. I become more.',
    'Pieter. You missed me once, at Matins.',
    'Every road in a body leads to the same room.',
    'I am small now. Small things get everywhere.',
    'The militia never taught you to hold a line against this.',
    'Listen: his heart is knocking. I will answer.',
    'He sings through me — the one who writes these hours.',
  ],
  vespers: [
    'Light the lamps. Then let them go out.',
    'Tallow is only blood that learned to wait.',
    'Sister, you kept the ledgers. Keep this one.',
    'In the dark I am everywhere at once.',
    'Evening falls on the ward, one lamp at a time.',
    'She prays well. Listen: she prays for you.',
    'The wick runs deeper than you think.',
    'What is a lamp but a small, controlled fire?',
    'Brand the lamps. Brand me. It is all the same light.',
    'Magnificat. My soul is a candle-end.',
    'The last light is the kindest one.',
  ],
  compline: [
    'A quiet night and a perfect end.',
    'Hush. Nothing more will hurt.',
    'I sang Matins to begin this. I sing Compline to finish it.',
    'Your stillness was always mine. I lent it to you.',
    'There — no pulse to worry about. No sound at all.',
    'Inquisitor. You wanted certainty. Here it is.',
    'Put down the blade. Put down the brand.',
    'Every bell in Kessendorf, silent at once.',
    'Now let your servant depart in peace.',
    'Why do you keep him awake?',
    'The Office is complete, save one small voice. Yours.',
  ],
  office: [
    'Eight hours. One breath.',
    'Matins, Lauds, Prime, Terce, Sext, None, Vespers, Compline.',
    'I am the whole day of dying.',
    'Aurel wrote me. Aurel is inside me now.',
    'Mercy, the Precentor called it. Mercy.',
    'Every sigil lit is a candle for the city.',
    'Two at once, surgeon. The choir sings in parts.',
    'Turn the dial. It always comes back to midnight.',
    'You cannot unsing a hymn.',
    'Then sing over it.',
  ],
} as const;

export type VoiceHour = keyof typeof MALISON_VOICES;

/** One spoken line, rising and fading beside the curse. */
export class VoiceLine extends Entity {
  t = 0;
  constructor(
    pos: Vec,
    public text: string,
    public color = '#d8b0ff',
    public life = 3.2,
  ) {
    super(pos);
    this.required = false;
    this.layer = 9;
  }
  override update(_op: Operation, dt: number): void {
    this.t += dt;
    if (this.t >= this.life) this.kill();
  }
}

/** Speaks an Hour's lines in turn, one every `every` seconds of world time. */
export class Voice {
  private t: number;
  private i = 0;
  constructor(
    public hour: VoiceHour,
    public every = 9,
    public color = '#d8b0ff',
  ) {
    this.t = every * 0.4;
  }
  tick(op: Operation, dt: number, at: Vec): void {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = this.every;
    const lines = MALISON_VOICES[this.hour];
    op.spawn(new VoiceLine({ x: at.x, y: at.y - 70 }, lines[this.i++ % lines.length], this.color));
  }
}
