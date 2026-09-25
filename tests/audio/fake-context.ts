/**
 * A minimal fake AudioContext that records the node graph and parameter
 * automation, for topology and bookkeeping tests that don't need real audio.
 */

export class FakeParam {
  value: number;
  events: { type: string; value: number; time: number }[] = [];
  constructor(v = 0) {
    this.value = v;
  }
  private rec(type: string, value: number, time: number) {
    this.events.push({ type, value, time });
    this.value = value;
    return this;
  }
  setValueAtTime(v: number, t: number) {
    return this.rec('set', v, t);
  }
  linearRampToValueAtTime(v: number, t: number) {
    return this.rec('lin', v, t);
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    return this.rec('exp', v, t);
  }
  setTargetAtTime(v: number, t: number) {
    return this.rec('target', v, t);
  }
  cancelScheduledValues(t: number) {
    this.events.push({ type: 'cancel', value: this.value, time: t });
    return this;
  }
  /** Last scheduled target value. */
  get target(): number {
    return this.events.length ? this.events[this.events.length - 1].value : this.value;
  }
}

export class FakeNode {
  static nextId = 1;
  id = FakeNode.nextId++;
  outputs: (FakeNode | FakeParam)[] = [];
  channelCount = 2;
  channelCountMode = 'max';
  channelInterpretation = 'speakers';
  constructor(
    public ctx: FakeContext,
    public kind: string,
  ) {
    ctx.nodes.push(this);
  }
  connect(dest: FakeNode | FakeParam) {
    this.outputs.push(dest);
    return dest;
  }
  disconnect() {
    this.outputs = [];
  }
}

class FakeSource extends FakeNode {
  started = false;
  stopped = false;
  frequency = new FakeParam(440);
  detune = new FakeParam(0);
  playbackRate = new FakeParam(1);
  buffer: unknown = null;
  loop = false;
  type = 'sine';
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}

export class FakeContext {
  nodes: FakeNode[] = [];
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination: FakeNode;
  constructor() {
    this.destination = new FakeNode(this, 'destination');
  }
  createGain() {
    const n = new FakeNode(this, 'gain') as FakeNode & { gain: FakeParam };
    n.gain = new FakeParam(1);
    return n;
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(this, 'biquad'), { type: 'lowpass', frequency: new FakeParam(350), Q: new FakeParam(1), gain: new FakeParam(0) });
  }
  createDynamicsCompressor() {
    return Object.assign(new FakeNode(this, 'compressor'), { threshold: new FakeParam(-24), ratio: new FakeParam(12), knee: new FakeParam(30), attack: new FakeParam(0.003), release: new FakeParam(0.25) });
  }
  createStereoPanner() {
    return Object.assign(new FakeNode(this, 'panner'), { pan: new FakeParam(0) });
  }
  createConvolver() {
    return Object.assign(new FakeNode(this, 'convolver'), { buffer: null as unknown });
  }
  createWaveShaper() {
    return Object.assign(new FakeNode(this, 'shaper'), { curve: null as unknown, oversample: 'none' });
  }
  createAnalyser() {
    return Object.assign(new FakeNode(this, 'analyser'), { fftSize: 2048, getFloatTimeDomainData: (a: Float32Array) => a.fill(0) });
  }
  createOscillator() {
    return new FakeSource(this, 'oscillator');
  }
  createBufferSource() {
    return new FakeSource(this, 'buffer');
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: (c: number) => data[c] };
  }
  createPeriodicWave() {
    return {};
  }
}

/** Follow a chain of single outputs from a node, returning the node kinds. */
export function chain(from: FakeNode, max = 12): string[] {
  const out: string[] = [];
  let n: FakeNode | undefined = from;
  for (let i = 0; i < max && n; i++) {
    out.push(n.kind);
    n = n.outputs.find((o): o is FakeNode => o instanceof FakeNode && o.kind !== 'analyser' && !(o.kind === 'gain' && (o as unknown as { __send?: boolean }).__send));
  }
  return out;
}
