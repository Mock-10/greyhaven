import { describe, expect, it } from 'vitest';
import { FX_PRESETS } from '../src/data/fxPresets';
import { ParticleSim, particleFrame, Emitter, DIR_NAMES } from '../src/fx/particles';
import { StepFx } from '../src/fx/stepFx';
import { CarFx, type CarFxInput } from '../src/fx/carFx';
import { RainSim } from '../src/fx/rain';
import { rainAt, rainWindow } from '../src/fx/weather';
import { FX } from '../src/config/balanceFx';
import fxJson from '../art/fx.json';
import effectsJson from '../art/effects.json';

const frames = { fx: new Set(Object.keys(fxJson.frames)), effects: new Set(Object.keys(effectsJson.frames)) };

describe('particle presets', () => {
  it('only name frames that exist, over a whole life and every facing', () => {
    for (const [name, spec] of Object.entries(FX_PRESETS)) {
      const sim = new ParticleSim(1, 10);
      for (let d = 0; d < 8; d++) sim.emit(spec, 0, 0, 0, 1, { dir: d });
      for (let t = 0; t < 40; t++) {
        for (const p of sim.list)
          expect(frames[spec.sheet].has(particleFrame(p)), `${name}: ${particleFrame(p)}`).toBe(true);
        sim.update(0.05);
      }
    }
  });
});

describe('particle sim', () => {
  it('is deterministic for a seed', () => {
    const run = () => {
      const s = new ParticleSim(42, 100);
      s.emit(FX_PRESETS.sparks, 10, 10, 5, 8);
      for (let k = 0; k < 5; k++) s.update(0.03);
      return s.list.map((p) => [p.x, p.y, p.z]);
    };
    expect(run()).toEqual(run());
  });

  it('keeps particles above the ground and removes them when their life ends', () => {
    const s = new ParticleSim(1, 100);
    s.emit(FX_PRESETS.chips, 0, 0, 6, 10);
    for (let k = 0; k < 10; k++) {
      s.update(0.05);
      for (const p of s.list) expect(p.z).toBeGreaterThanOrEqual(0);
    }
    for (let k = 0; k < 40; k++) s.update(0.05);
    expect(s.list.length).toBe(0);
  });

  it('caps the pool, dropping the oldest', () => {
    const s = new ParticleSim(1, 5);
    s.emit(FX_PRESETS.footDust, 0, 0, 0, 3);
    s.emit(FX_PRESETS.sparks, 0, 0, 0, 4);
    expect(s.list.length).toBe(5);
    expect(s.list.filter((p) => p.spec === FX_PRESETS.sparks).length).toBe(4);
  });

  it('emits steady streams at their rate', () => {
    const e = new Emitter(FX_PRESETS.exhaust, 5);
    let n = 0;
    for (let k = 0; k < 100; k++) n += e.tick(0.01);
    expect(n).toBe(5);
  });

  it('names per-direction frames', () => {
    const s = new ParticleSim(1, 10);
    s.emit(FX_PRESETS.skid, 0, 0, 0, 1, { dir: 3 });
    expect(particleFrame(s.list[0]!)).toBe(`skid/${DIR_NAMES[3]}`);
  });
});

describe('footstep dust', () => {
  it('puffs every sprint stride and on soft ground, not on a walk on pavement', () => {
    const count = (sprinting: boolean, soft: boolean) => {
      const f = new StepFx();
      let n = 0;
      for (let x = 0; x <= 300; x += 2) n += f.update({ x, y: 0, sprinting, soft }).length;
      return n;
    };
    expect(count(false, false)).toBe(0);
    expect(count(true, false)).toBe(Math.floor(300 / FX.world.sprintStride));
    expect(count(false, true)).toBe(Math.floor(300 / FX.world.stride));
  });

  it('ignores a teleport', () => {
    const f = new StepFx();
    f.update({ x: 0, y: 0, sprinting: true, soft: true });
    expect(f.update({ x: 500, y: 0, sprinting: true, soft: true }).length).toBe(0);
  });
});

describe('car effects', () => {
  const car: CarFxInput = {
    x: 0,
    y: 0,
    heading: 0,
    speed: 0,
    running: true,
    halfLength: 30,
    halfWidth: 12,
    throttle: 0,
    handbrake: false,
    impact: 0,
    soft: false,
  };

  it('puffs exhaust from the back while the engine runs', () => {
    const c = new CarFx();
    const ev = Array.from({ length: 60 }, () => c.update(1 / 60, car).events).flat();
    expect(ev.filter((e) => e.preset === 'exhaust').length).toBeGreaterThan(0);
    for (const e of ev) expect(e.x).toBeLessThan(0);
    const off = new CarFx();
    expect(
      Array.from({ length: 60 }, () => off.update(1 / 60, { ...car, running: false }).events).flat(),
    ).toEqual([]);
  });

  it('skids and smokes under hard braking, then stops', () => {
    const c = new CarFx();
    c.update(1 / 60, { ...car, speed: 200 });
    let skids = 0;
    let speed = 200;
    for (let k = 0; k < 12; k++) {
      speed -= 8;
      const o = c.update(1 / 60, { ...car, speed, throttle: -1 });
      expect(o.skidding).toBe(true);
      skids += o.events.filter((e) => e.preset === 'skid').length;
    }
    expect(skids).toBeGreaterThan(0);
    expect(c.update(1 / 60, { ...car, speed }).skidding).toBe(false);
  });

  it('throws chips and sparks and shakes on a crash', () => {
    const c = new CarFx();
    const o = c.update(1 / 60, { ...car, speed: 150, impact: 150 });
    expect(o.shake).toBeGreaterThan(0);
    expect(o.events.some((e) => e.preset === 'chips')).toBe(true);
    expect(o.events.some((e) => e.preset === 'sparks')).toBe(true);
  });
});

describe('rain', () => {
  it('fills the view by intensity and splashes on landing', () => {
    const r = new RainSim(1);
    let splashes = 0;
    for (let k = 0; k < 60; k++) splashes += r.update(1 / 30, 640, 360, 1).length;
    expect(r.drops.length).toBe(RainSim.target(640, 360, 1));
    expect(splashes).toBeGreaterThan(10);
    for (let k = 0; k < 60; k++) r.update(1 / 30, 640, 360, 0);
    expect(r.drops.length).toBe(0);
  });

  it('rains about a quarter of nights, at night, ramping in', () => {
    let wet = 0;
    for (let d = 0; d < 400; d++) {
      const w = rainWindow(99, d);
      if (!w) continue;
      wet++;
      expect(w.from % 1440).toBeGreaterThanOrEqual(FX.rain.startMin);
      expect(rainAt(99, w.from)).toBe(0);
      expect(rainAt(99, w.from + FX.rain.ramp + 1)).toBe(1);
      expect(rainAt(99, w.to + 1)).toBe(0);
    }
    expect(wet / 400).toBeGreaterThan(0.18);
    expect(wet / 400).toBeLessThan(0.32);
    // daytime is always dry
    for (let d = 0; d < 50; d++) expect(rainAt(99, d * 1440 + 12 * 60)).toBe(0);
  });
});
