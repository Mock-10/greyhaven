import { describe, expect, it } from 'vitest';
import { blend, createSurface, VITALS, type Surface } from '../src/ui/hudDraw';
import { ditherFade, ditherKeep } from '../src/ui/anim/dither';
import { transition, PANEL } from '../src/ui/anim/transition';
import { Bursts, Popups, RollingNumber, Shake } from '../src/ui/anim/motion';
import { HudAnimator, toastSlide, type HudAnimInput } from '../src/ui/anim/hudAnim';
import { FX } from '../src/config/balanceFx';

const opaque = (s: Surface, x0 = 0, y0 = 0, x1 = s.width, y1 = s.height) => {
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (s.data[(y * s.width + x) * 4 + 3]) n++;
  return n;
};

const filled = (w: number, h: number) => {
  const s = createSurface(w, h);
  blend(s, 0, h, 0, w, [200, 100, 50]);
  return s;
};

describe('dithered fades', () => {
  it('keeps about the asked share of pixels, in an even pattern', () => {
    for (const a of [0, 0.25, 0.5, 0.75, 1]) {
      const s = filled(32, 32);
      ditherFade(s, { x: 0, y: 0, w: 32, h: 32 }, a);
      expect(opaque(s) / 1024).toBeCloseTo(a, 1);
    }
    // every 4 × 4 block holds the same count, so the fade has no clumps
    const s = filled(16, 16);
    ditherFade(s, { x: 0, y: 0, w: 16, h: 16 }, 0.5);
    for (let by = 0; by < 16; by += 4)
      for (let bx = 0; bx < 16; bx += 4) expect(opaque(s, bx, by, bx + 4, by + 4)).toBe(8);
    expect(ditherKeep(0, 0, 1)).toBe(true);
    expect(ditherKeep(0, 0, 0)).toBe(false);
  });
});

describe('panel transitions', () => {
  it('leaves a fully open panel untouched and hides a closed one', () => {
    const s = filled(40, 30);
    const before = s.data.slice();
    transition(s, { x: 5, y: 5, w: 20, h: 10 }, 1);
    expect(s.data).toEqual(before);
    transition(s, { x: 5, y: 5, w: 20, h: 10 }, 0);
    expect(opaque(s, 5, 5, 25, 15)).toBe(0);
    // outside the rect is untouched
    expect(opaque(s)).toBe(40 * 30 - 200);
  });

  it('unfolds from the middle and fills in as it opens', () => {
    const counts = [0.1, 0.3, 0.6].map((t) => {
      const s = createSurface(60, 60);
      blend(s, 10, 50, 10, 50, [10, 20, 30]);
      transition(s, { x: 10, y: 10, w: 40, h: 40 }, t, PANEL);
      return opaque(s);
    });
    expect(counts[2]!).toBe(1600);
    for (let k = 1; k < counts.length; k++) expect(counts[k]!).toBeGreaterThan(counts[k - 1]!);
    expect(counts[0]!).toBeGreaterThan(0);
  });
});

describe('UI motion', () => {
  it('rolls a number to its new value and reports the change', () => {
    const n = new RollingNumber(100, 0.5);
    expect(n.set(160)).toBe(60);
    n.update(0.1);
    expect(n.value).toBeGreaterThan(100);
    expect(n.value).toBeLessThan(160);
    expect(n.rolling).toBe(true);
    n.update(1);
    expect(n.value).toBe(160);
    expect(n.rolling).toBe(false);
  });

  it('floats pop-ups and drops them after their time, keeping a few at most', () => {
    const p = new Popups();
    for (let k = 0; k < 6; k++) p.push(`+$${k}`, [255, 255, 255]);
    expect(p.list.length).toBe(FX.ui.popupMax);
    const s = createSurface(80, 40);
    p.draw(s, 70, 30);
    expect(opaque(s)).toBeGreaterThan(0);
    p.update(FX.ui.popupSeconds + 0.01);
    expect(p.busy).toBe(false);
  });

  it('shakes in whole pixels and settles', () => {
    const sh = new Shake();
    sh.kick(3);
    sh.update(0.02);
    const o = sh.offset;
    expect(Number.isInteger(o.x) && Number.isInteger(o.y)).toBe(true);
    expect(Math.abs(o.x)).toBeGreaterThan(0);
    sh.update(1);
    expect(sh.offset).toEqual({ x: 0, y: 0 });
  });

  it('bursts pixels that fall and vanish', () => {
    const b = new Bursts(1);
    b.emit('confetti', 20, 20, 30);
    const s = createSurface(40, 40);
    b.draw(s);
    expect(opaque(s)).toBeGreaterThan(0);
    for (let k = 0; k < 40; k++) b.update(0.05);
    expect(b.busy).toBe(false);
  });
});

describe('HUD animator', () => {
  const base: HudAnimInput = {
    clean: 100,
    dirty: 0,
    health: 1,
    stars: 0,
    objective: 'GO',
    hints: 'a',
    driving: false,
  };

  it('starts at rest, then animates money, damage and stars', () => {
    const h = new HudAnimator();
    h.update(0.016, base);
    expect(h.busy).toBe(false);
    h.update(0.016, { ...base, clean: 140 });
    expect(h.cleanPops.list[0]?.text).toBe('+$40');
    expect(h.clean.value).toBeLessThan(140);
    for (let k = 0; k < 120; k++) h.update(0.016, { ...base, clean: 140 });
    expect(h.clean.value).toBe(140);
    expect(h.busy).toBe(false);
    // damage drops the bar at once and leaves a trail that drains
    h.update(0.016, { ...base, clean: 140, health: 0.6 });
    expect(h.health).toBeCloseTo(0.6);
    const s = createSurface(200, 80);
    h.drawVitals(s, 0, 0);
    // the trail is drawn past the 60% mark of the bar
    const bx = 23 + 1 + Math.round((VITALS.w - 54) * 0.8);
    expect(s.data[((20 + 3) * 200 + bx) * 4 + 3]).toBe(255);
    expect(h.busy).toBe(true);
  });

  it('pulses when health is low and flashes a new star', () => {
    const h = new HudAnimator();
    h.update(0.016, { ...base, health: 0.2 });
    expect(h.lowHealth).toBe(true);
    const s = createSurface(300, 60);
    h.drawStars(s, 150, 5);
    h.update(0.016, { ...base, health: 0.2, stars: 1 });
    expect(h.bursts.busy).toBe(true);
  });

  it('eases toasts in and out', () => {
    expect(toastSlide(0, 5)).toBe(1);
    expect(toastSlide(1, 5)).toBe(0);
    expect(toastSlide(5.2, 5)).toBeGreaterThan(0);
    expect(toastSlide(5.4, 5)).toBeCloseTo(1);
  });
});
