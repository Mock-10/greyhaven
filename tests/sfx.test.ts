import { describe, expect, it } from 'vitest';
import {
  BUSES,
  DEFAULT_LEVELS,
  Mixer,
  POS_FAR,
  POS_NEAR,
  POS_PAN_MAX,
  effectiveGain,
  sliderToGain,
  spatialise,
  type AudioContextLike,
} from '../src/audio/mixer';
import {
  LOOP_XFADE_S,
  RECIPES,
  RENDER_RATE,
  SFX_IDS,
  crossfadeLoop,
  renderSfx,
  takeSeed,
  type SfxId,
} from '../src/audio/recipes';
import { ENGINE_GEARS, ENGINE_IDLE_RATE, Sfx, createAudio, engineGain, engineRate } from '../src/audio/sfx';

const peak = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);

// ---------------------------------------------------------------------------------------------------------
// A stand-in for the WebAudio graph: records connections, values and start/stop calls.

class FakeParam {
  value = 0;
  targets: number[] = [];
  setTargetAtTime(v: number) {
    this.targets.push(v);
    this.value = v;
  }
  cancelScheduledValues() {}
}

class FakeNode {
  out: FakeNode[] = [];
  connect(n: FakeNode) {
    this.out.push(n);
    return n;
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakePanner extends FakeNode {
  pan = new FakeParam();
}

class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  loop = false;
  playbackRate = new FakeParam();
  started = -1;
  stopped = -1;
  onended: (() => void) | null = null;
  start(t: number) {
    this.started = t;
  }
  stop(t: number) {
    this.stopped = t;
  }
}

class FakeBuffer {
  data: Float32Array | null = null;
  constructor(
    readonly channels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {}
  copyToChannel(d: Float32Array) {
    this.data = d;
  }
}

class FakeCtx {
  currentTime = 0;
  destination = new FakeNode();
  gains: FakeGain[] = [];
  sources: FakeSource[] = [];
  buffers: FakeBuffer[] = [];
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createStereoPanner() {
    return new FakePanner();
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  createBuffer(ch: number, len: number, sr: number) {
    const b = new FakeBuffer(ch, len, sr);
    this.buffers.push(b);
    return b;
  }
}

const fake = () => {
  const ctx = new FakeCtx();
  return { ctx, audio: createAudio(ctx as unknown as AudioContextLike) };
};

/** The gain node a source plays through, and where that chain ends. */
function chain(src: FakeSource): FakeNode[] {
  const out: FakeNode[] = [];
  let n: FakeNode | undefined = src;
  while (n) {
    out.push(n);
    n = n.out[0];
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------

describe('sfx recipes (docs/13 must-have list)', () => {
  it('covers every must-have sound', () => {
    const must = [
      'step_concrete',
      'step_grass',
      'engine_loop',
      'tyre_screech',
      'crash',
      'door_open',
      'door_close',
      'lock_click',
      'lock_fail',
      'hotwire_spark',
      'siren_loop',
      'radio_blip',
      'cash',
      'ui_click',
      'ui_confirm',
      'ui_cancel',
      'paper_shuffle',
      'stamp',
      'clock_in_bell',
    ];
    expect([...SFX_IDS].sort()).toEqual(must.sort());
    expect(RECIPES.engine_loop.loop && RECIPES.siren_loop.loop).toBe(true);
    for (const id of ['ui_click', 'ui_confirm', 'ui_cancel'] as const) expect(RECIPES[id].bus).toBe('ui');
  });

  it.each(SFX_IDS.map((id) => [id]))(
    '%s renders a soft, finite, non-silent take of the right length',
    (id) => {
      const r = RECIPES[id as SfxId];
      for (let v = 0; v < r.variants; v++) {
        const x = renderSfx(id as SfxId, v);
        expect(x.length).toBe(Math.round(r.seconds * RENDER_RATE));
        expect(x.every(Number.isFinite)).toBe(true);
        expect(peak(x)).toBeCloseTo(r.peak, 5);
        expect(peak(x)).toBeLessThanOrEqual(0.9); // soft: nothing near full scale
        expect(rms(x)).toBeGreaterThan(0.005);
      }
    },
  );

  it('starts and ends one-shots at silence, so they never click', () => {
    for (const id of SFX_IDS) {
      if (RECIPES[id].loop) continue;
      const x = renderSfx(id, 0);
      expect(Math.abs(x[0]!)).toBe(0);
      expect(Math.abs(x[x.length - 1]!)).toBe(0);
    }
  });

  it('makes loops seamless: the last sample runs into the first like any other neighbour', () => {
    for (const id of ['engine_loop', 'siren_loop'] as const) {
      const x = renderSfx(id, 0);
      let maxStep = 0;
      for (let i = 1; i < x.length; i++) maxStep = Math.max(maxStep, Math.abs(x[i]! - x[i - 1]!));
      const seam = Math.abs(x[0]! - x[x.length - 1]!);
      expect(seam).toBeLessThanOrEqual(maxStep);
    }
  });

  it('has no DC offset, so loops never thump when they start or stop', () => {
    for (const id of ['engine_loop', 'siren_loop'] as const) {
      const x = renderSfx(id, 0);
      const mean = x.reduce((s, v) => s + v, 0) / x.length;
      expect(Math.abs(mean)).toBeLessThan(0.01 * RECIPES[id].peak);
    }
  });

  it('crossfades a loop tail over its head', () => {
    const period = 8;
    const x = Float32Array.from({ length: 12 }, (_, i) => (i < period ? 0 : 1));
    const out = crossfadeLoop(x, period);
    expect(out.length).toBe(period);
    expect(out[0]).toBe(1); // starts as the tail (which follows the last sample)
    expect(out[3]).toBeCloseTo(0.25); // and blends into the head
    expect(out[7]).toBe(0);
    expect(LOOP_XFADE_S).toBeGreaterThan(0);
  });

  it('is deterministic per take, and variants differ', () => {
    expect(renderSfx('crash', 1)).toEqual(renderSfx('crash', 1));
    expect(renderSfx('step_concrete', 0)).not.toEqual(renderSfx('step_concrete', 1));
    expect(takeSeed('crash', 0)).not.toBe(takeSeed('crash', 1));
    expect(takeSeed('crash', 0)).not.toBe(takeSeed('stamp', 0));
    // Variant numbers wrap rather than fail.
    expect(renderSfx('stamp', RECIPES.stamp.variants)).toEqual(renderSfx('stamp', 0));
  });

  it('pitches UI confirm up and cancel down', () => {
    // Zero crossings per half: more crossings = higher pitch.
    const crossings = (x: Float32Array, a: number, b: number) => {
      let n = 0;
      for (let i = a + 1; i < b; i++) if (Math.sign(x[i]!) !== Math.sign(x[i - 1]!)) n++;
      return n;
    };
    const half = (id: SfxId) => {
      const x = renderSfx(id);
      const cut = Math.round(0.07 * RENDER_RATE);
      return [crossings(x, 0, cut), crossings(x, cut, 2 * cut)] as const;
    };
    const [c1, c2] = half('ui_confirm');
    const [x1, x2] = half('ui_cancel');
    expect(c2).toBeGreaterThan(c1);
    expect(x2).toBeLessThan(x1);
  });
});

describe('mixer (docs/13: master, music, SFX and UI)', () => {
  it('maps sliders to gain and multiplies through the master', () => {
    expect(sliderToGain(0)).toBe(0);
    expect(sliderToGain(1)).toBe(1);
    expect(sliderToGain(0.5)).toBeCloseTo(0.25);
    expect(sliderToGain(2)).toBe(1);
    expect(sliderToGain(Number.NaN)).toBe(0);
    const lv = { master: 0.5, music: 1, sfx: 0.5, ui: 0, muted: false };
    expect(effectiveGain(lv, 'master')).toBeCloseTo(0.25);
    expect(effectiveGain(lv, 'music')).toBeCloseTo(0.25);
    expect(effectiveGain(lv, 'sfx')).toBeCloseTo(0.0625);
    expect(effectiveGain(lv, 'ui')).toBe(0);
    for (const b of BUSES) expect(effectiveGain({ ...lv, muted: true }, b)).toBe(0);
  });

  it('builds music, SFX and UI buses into the master and the speakers', () => {
    const ctx = new FakeCtx();
    const m = new Mixer(ctx as unknown as AudioContextLike);
    const master = ctx.gains[0]!;
    expect(master.out).toEqual([ctx.destination]);
    for (const b of ['music', 'sfx', 'ui'] as const) {
      const n = m.input(b) as unknown as FakeGain;
      expect(n.out).toEqual([master]);
      expect(n.gain.value).toBeCloseTo(sliderToGain(DEFAULT_LEVELS[b]));
    }
    m.setLevel('sfx', 0.5);
    expect((m.input('sfx') as unknown as FakeGain).gain.value).toBeCloseTo(0.25);
    expect(m.levels.sfx).toBe(0.5);
    m.setLevel('ui', -3);
    expect(m.levels.ui).toBe(0);
    m.setMuted(true);
    expect(master.gain.value).toBe(0);
    expect(m.gain('music')).toBe(0);
    m.setMuted(false);
    expect(master.gain.value).toBeCloseTo(sliderToGain(DEFAULT_LEVELS.master));
  });

  it('places a siren by distance and screen side', () => {
    const me = { x: 1000, y: 1000 };
    expect(spatialise(me, me)).toEqual({ gain: 1, pan: 0 });
    expect(spatialise(me, { x: 1000 + POS_NEAR, y: 1000 }).gain).toBe(1);
    expect(spatialise(me, { x: 1000 + POS_FAR, y: 1000 }).gain).toBe(0);
    const g = [200, 300, 500, 800].map((d) => spatialise(me, { x: 1000 + d, y: 1000 }).gain);
    for (let i = 1; i < g.length; i++) expect(g[i]!).toBeLessThan(g[i - 1]!);
    // +x is right on screen (screenX = x − y), +y is left; straight "down" the screen (+x +y) is centred.
    expect(spatialise(me, { x: 1200, y: 1000 }).pan).toBeGreaterThan(0);
    expect(spatialise(me, { x: 1000, y: 1200 }).pan).toBeLessThan(0);
    expect(spatialise(me, { x: 1200, y: 1200 }).pan).toBeCloseTo(0);
    expect(Math.abs(spatialise(me, { x: 9000, y: 1000 }).pan)).toBe(POS_PAN_MAX);
  });
});

describe('engine pitch by speed', () => {
  it('idles at the base rate and climbs through each gear, dropping at the shifts', () => {
    expect(engineRate(0)).toBe(ENGINE_IDLE_RATE);
    for (let g = 0; g < ENGINE_GEARS; g++) {
      const a = engineRate(g / ENGINE_GEARS + 0.01);
      const b = engineRate((g + 1) / ENGINE_GEARS - 0.01);
      expect(b).toBeGreaterThan(a);
    }
    expect(engineRate(0.25)).toBeLessThan(engineRate(0.2499));
    expect(engineRate(1)).toBeGreaterThan(engineRate(0.5));
    expect(engineRate(5)).toBe(engineRate(1));
    expect(engineRate(-1)).toBe(engineRate(0));
    expect(engineRate(Number.NaN)).toBe(ENGINE_IDLE_RATE);
    expect(engineRate(1)).toBeLessThan(3);
    expect(engineGain(1)).toBeGreaterThan(engineGain(0));
  });
});

describe('sfx player', () => {
  it('renders a take once, on a mono buffer at the render rate', () => {
    const { ctx, audio } = fake();
    audio.sfx.buffer('cash', 0);
    audio.sfx.buffer('cash', 0);
    expect(ctx.buffers.length).toBe(1);
    expect(ctx.buffers[0]!.channels).toBe(1);
    expect(ctx.buffers[0]!.sampleRate).toBe(RENDER_RATE);
    expect(ctx.buffers[0]!.data).not.toBeNull();
    audio.sfx.prewarm();
    const takes = SFX_IDS.reduce((n, id) => n + RECIPES[id].variants, 0);
    expect(ctx.buffers.length).toBe(takes);
  });

  it('routes each sound to its bus and starts it', () => {
    const { ctx, audio } = fake();
    audio.sfx.play('ui_click');
    audio.sfx.play('crash', { volume: 0.5, pan: -0.4 });
    const [ui, crash] = ctx.sources;
    expect(chain(ui!)).toContain(audio.mixer.input('ui'));
    expect(chain(crash!)).toContain(audio.mixer.input('sfx'));
    expect(chain(crash!).at(-1)).toBe(ctx.destination);
    expect(ui!.started).toBe(0);
    const amp = crash!.out[0] as FakeGain;
    expect(amp.gain.value).toBe(0.5);
    expect((amp.out[0] as FakePanner).pan.value).toBeCloseTo(-0.4);
  });

  it('spreads one-shot pitch within the recipe jitter, and keeps loops at the asked rate', () => {
    const { ctx, audio } = fake();
    const j = RECIPES.step_concrete.jitter;
    const rates = new Set<number>();
    for (let i = 0; i < 20; i++) {
      audio.sfx.play('step_concrete');
      const r = ctx.sources.at(-1)!.playbackRate.value;
      expect(r).toBeGreaterThanOrEqual(1 - j);
      expect(r).toBeLessThanOrEqual(1 + j);
      rates.add(r);
    }
    expect(rates.size).toBeGreaterThan(1);
    audio.sfx.play('siren_loop', { rate: 1 });
    expect(ctx.sources.at(-1)!.playbackRate.value).toBe(1);
    expect(ctx.sources.at(-1)!.loop).toBe(true);
  });

  it('caps overlapping copies by cutting the oldest', () => {
    const { ctx, audio } = fake();
    const cap = RECIPES.step_concrete.maxVoices;
    const first = audio.sfx.play('step_concrete');
    for (let i = 1; i < cap; i++) audio.sfx.play('step_concrete');
    expect(audio.sfx.playingCount('step_concrete')).toBe(cap);
    audio.sfx.play('step_concrete');
    expect(audio.sfx.playingCount('step_concrete')).toBe(cap);
    expect(first.playing).toBe(false);
    expect(ctx.sources[0]!.stopped).toBeGreaterThan(0);
    // A voice that finishes on its own frees its slot.
    ctx.sources[1]!.onended!();
    expect(audio.sfx.playingCount('step_concrete')).toBe(cap - 1);
  });

  it('pitches the engine with speed and stops it with a fade', () => {
    const { ctx, audio } = fake();
    const engine = audio.sfx.engine(0);
    const src = ctx.sources[0]!;
    expect(src.loop).toBe(true);
    expect(src.playbackRate.value).toBeCloseTo(engineRate(0));
    engine.setSpeed(0.6);
    expect(src.playbackRate.value).toBeCloseTo(engineRate(0.6));
    expect((src.out[0] as FakeGain).gain.value).toBeCloseTo(engineGain(0.6));
    engine.stop();
    expect(engine.playing).toBe(false);
    expect(src.stopped).toBeGreaterThan(0);
    expect(audio.sfx.playingCount('engine_loop')).toBe(0);
  });

  it('moves a siren around the player', () => {
    const { ctx, audio } = fake();
    const me = { x: 0, y: 0 };
    const siren = audio.sfx.siren(me, { x: 300, y: 0 });
    const amp = ctx.sources[0]!.out[0] as FakeGain;
    const panner = amp.out[0] as FakePanner;
    expect(panner.pan.value).toBeGreaterThan(0);
    const farGain = amp.gain.value;
    siren.setPosition(me, { x: 0, y: 100 });
    expect(panner.pan.value).toBeLessThan(0);
    expect(amp.gain.value).toBeGreaterThan(farGain);
    audio.sfx.stopAll();
    expect(siren.playing).toBe(false);
  });

  it('works without a stereo panner (older browsers)', () => {
    const ctx = new FakeCtx() as unknown as Record<string, unknown>;
    ctx.createStereoPanner = undefined;
    const { sfx, mixer } = createAudio(ctx as unknown as AudioContextLike);
    const v = sfx.play('cash', { pan: 1 });
    v.setPan(0.5);
    const src = (ctx as unknown as FakeCtx).sources[0]!;
    expect(chain(src)).toContain(mixer.input('sfx'));
    expect(new Sfx(ctx as unknown as AudioContextLike, mixer).playingCount('cash')).toBe(0);
  });
});
