// Layout check for the M7 job panels (user request 2026-10-11: no text or picture in a panel may overlap another).
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { FAULTS } from '../src/data/faults';
import { MEETING_QUESTIONS } from '../src/data/meetings';
import { BoltTorqueGame } from '../src/minigames/boltTorque';
import { ChopGame } from '../src/minigames/chop';
import { DiagnoseGame } from '../src/minigames/diagnose';
import { DoorstepGame } from '../src/minigames/doorstep';
import { FellGame } from '../src/minigames/fell';
import { SignatureGame } from '../src/minigames/signature';
import { LoadGame } from '../src/minigames/load';
import { MeetingGame } from '../src/minigames/meeting';
import { ResprayGame } from '../src/minigames/respray';
import { RouteGame } from '../src/minigames/route';
import { StampSignGame } from '../src/minigames/stampSign';
import { TyreChangeGame } from '../src/minigames/tyreChange';
import {
  beginAudit,
  createSurface,
  endAudit,
  overlaps,
  textWidthPx,
  type DrawnRect,
  type Surface,
} from '../src/ui/hudDraw';
import {
  JOB_PANEL_SIZE,
  MEETING_REPLY_W,
  SYMPTOM_TEXT_W,
  diagnoseOption,
  drawBoltTorque,
  drawChop,
  drawDoorstep,
  drawFell,
  drawSignature,
  doorstepHouse,
  signaturePad,
  drawDiagnose,
  drawLoad,
  drawMeeting,
  drawRespray,
  drawRoute,
  drawStampSign,
  drawTyreChange,
  loadBed,
  resprayArea,
  routeMap,
  type JobPanelKind,
} from '../src/ui/panelsJobs';

const X = 40;
const Y = 30;

function check(kind: JobPanelKind, draw: (s: Surface) => void): DrawnRect[] {
  const s = createSurface(640, 360);
  beginAudit();
  draw(s);
  const rects = endAudit();
  expect(rects.length, `${kind}: nothing recorded`).toBeGreaterThan(3);
  const bad = overlaps(rects).map(([a, b]) => `${a.what} @${a.x},${a.y} overlaps ${b.what} @${b.x},${b.y}`);
  expect(bad, kind).toEqual([]);
  const P = JOB_PANEL_SIZE[kind];
  for (const r of rects)
    expect(
      r.x >= X && r.y >= Y && r.x + r.w <= X + P.w && r.y + r.h <= Y + P.h,
      `${kind}: ${r.what} leaves the panel`,
    ).toBe(true);
  return rects;
}

describe('job panel layouts never overlap', () => {
  it('diagnose, every fault, a flash and the end', () => {
    const g = new DiagnoseGame(new Rng(1));
    for (let k = 0; k < FAULTS.length; k++) {
      g.cars[0]!.fault = k;
      g.cars[0]!.options = [k, (k + 1) % FAULTS.length, (k + 2) % FAULTS.length, (k + 3) % FAULTS.length];
      check('diagnose', (s) => drawDiagnose(s, X, Y, g, 'TASK 1/3'));
    }
    for (const f of FAULTS)
      for (const sym of f.symptoms)
        expect(textWidthPx(sym.text), sym.text).toBeLessThanOrEqual(SYMPTOM_TEXT_W);
    for (const f of FAULTS) expect(textWidthPx(f.part) + 22).toBeLessThan(diagnoseOption(0, 0, 0).w);
    g.pick(0);
    check('diagnose', (s) => drawDiagnose(s, X, Y, g, 'TASK 1/3'));
    g.update(999);
    check('diagnose', (s) => drawDiagnose(s, X, Y, g, 'TASK 1/3'));
  });

  it('bolt torque, in play, after a miss, and at the end', () => {
    const g = new BoltTorqueGame(new Rng(2), 4);
    check('boltTorque', (s) => drawBoltTorque(s, X, Y, g, 'TASK 2/3'));
    g.needle = (g.zone + 180) % 360;
    g.hit();
    check('boltTorque', (s) => drawBoltTorque(s, X, Y, g, 'TASK 2/3'));
    while (!g.done) {
      g.needle = g.zone;
      g.hit();
    }
    check('boltTorque', (s) => drawBoltTorque(s, X, Y, g, 'TASK 2/3'));
  });

  it('tyre change through every step', () => {
    const g = new TyreChangeGame(new Rng(3));
    g.errors = 12;
    g.wrongT = 0;
    while (!g.done) {
      check('tyreChange', (s) => drawTyreChange(s, X, Y, g, 'TASK 3/3'));
      g.press(g.keys[g.pos]!);
    }
    check('tyreChange', (s) => drawTyreChange(s, X, Y, g, 'TASK 3/3'));
  });

  it('respray, spraying with runs, and done', () => {
    const g = new ResprayGame();
    g.aim(1, 1);
    g.spray(true);
    g.update(2);
    check('respray', (s) => drawRespray(s, X, Y, g, 'TASK 1/3'));
    const A = resprayArea(X, Y, g);
    expect(A.x + A.w).toBeLessThanOrEqual(X + JOB_PANEL_SIZE.respray.w - 8);
    g.finish();
    check('respray', (s) => drawRespray(s, X, Y, g, 'TASK 1/3'));
  });

  it('chop, after a swing, and at the end', () => {
    const g = new ChopGame(new Rng(4));
    check('chop', (s) => drawChop(s, X, Y, g, 'TASK 1/3'));
    g.cursor = g.spot;
    g.swing();
    g.misses = 9;
    g.swings = 9;
    check('chop', (s) => drawChop(s, X, Y, g, 'TASK 1/3'));
    g.depth = 99;
    g.update(1);
    g.swing();
    check('chop', (s) => drawChop(s, X, Y, g, 'TASK 1/3'));
  });

  it('load, crates and logs, a full queue, a piece left behind, and the end', () => {
    for (const mode of ['crates', 'logs'] as const) {
      const g = new LoadGame(new Rng(5), mode);
      check('load', (s) => drawLoad(s, X, Y, g, 'TASK 1/3'));
      const B = loadBed(X, Y, g);
      expect(B.x + B.w + 20).toBeLessThanOrEqual(X + 168);
      while (!g.done && g.leftBehind.length === 0) {
        g.moveTo(0);
        g.drop();
      }
      check('load', (s) => drawLoad(s, X, Y, g, 'TASK 1/3'));
      g.update(999);
      check('load', (s) => drawLoad(s, X, Y, g, 'TASK 1/3'));
    }
  });

  it('route, before and after a pick, and at the end', () => {
    const g = new RouteGame(new Rng(6));
    check('route', (s) => drawRoute(s, X, Y, g, 'TASK 2/3'));
    const M = routeMap(X, Y);
    expect(M.x + M.w + 4).toBeLessThan(X + 140);
    g.pick(g.current!.best);
    check('route', (s) => drawRoute(s, X, Y, g, 'TASK 2/3'));
    g.update(999);
    g.update(999);
    check('route', (s) => drawRoute(s, X, Y, g, 'TASK 2/3'));
  });

  it('stamp and sign, as papers pass, and at the end', () => {
    const g = new StampSignGame();
    for (let k = 0; k < 40 && !g.done; k++) {
      check('stampSign', (s) => drawStampSign(s, X, Y, g, 'TASK 1/3'));
      g.update(0.3);
      if (k % 3 === 0) g.press();
    }
    g.update(999);
    check('stampSign', (s) => drawStampSign(s, X, Y, g, 'TASK 1/3'));
  });

  it('meeting, every question and reaction, and the end', () => {
    for (const q of MEETING_QUESTIONS)
      for (const r of q.replies) expect(textWidthPx(r.text), r.text).toBeLessThanOrEqual(MEETING_REPLY_W);
    const g = new MeetingGame(new Rng(7));
    for (const q of MEETING_QUESTIONS) {
      g.rounds[0]!.question = q;
      g.rounds[0]!.replies = [...q.replies];
      check('meeting', (s) => drawMeeting(s, X, Y, g, 'TASK 3/3'));
      g.last = { reaction: q.replies[0].reaction, delta: 0, t: 0 };
      check('meeting', (s) => drawMeeting(s, X, Y, g, 'TASK 3/3'));
      g.last = null;
    }
    g.mood = 0;
    check('meeting', (s) => drawMeeting(s, X, Y, g, 'TASK 3/3'));
    while (!g.done) g.choose(0);
    check('meeting', (s) => drawMeeting(s, X, Y, g, 'TASK 3/3'));
  });

  it('fell direction, after a cut, a timeout and the end', () => {
    const g = new FellGame(new Rng(8));
    check('fell', (s) => drawFell(s, X, Y, g, 'TASK 2/3'));
    g.cut();
    check('fell', (s) => drawFell(s, X, Y, g, 'TASK 2/3'));
    g.update(99);
    g.update(99);
    check('fell', (s) => drawFell(s, X, Y, g, 'TASK 2/3'));
  });

  it('doorstep, big house numbers, a wrong door and the end', () => {
    const g = new DoorstepGame(new Rng(9));
    for (let k = 0; k < g.numbers.length; k++) g.numbers[k] = 191 + k * 2;
    check('doorstep', (s) => drawDoorstep(s, X, Y, g, 'TASK 3/3'));
    for (let k = 0; k < g.numbers.length; k++) {
      const h = doorstepHouse(X, Y, k);
      expect(textWidthPx(String(g.numbers[k]))).toBeLessThan(h.w - 2);
      expect(h.x + h.w).toBeLessThanOrEqual(X + JOB_PANEL_SIZE.doorstep.w - 8);
    }
    g.errors = 9;
    g.deliver();
    if (g.last?.ok) g.deliver();
    check('doorstep', (s) => drawDoorstep(s, X, Y, g, 'TASK 3/3'));
    g.update(999);
    check('doorstep', (s) => drawDoorstep(s, X, Y, g, 'TASK 3/3'));
  });

  it('signature, mid-stroke and at the end', () => {
    const g = new SignatureGame(new Rng(10));
    const P = signaturePad(X, Y, g);
    expect(P.y + P.h + 6).toBeLessThan(Y + 126);
    g.penDown(0.1, 0.1);
    g.penMove(0.6, 0.3);
    check('signature', (s) => drawSignature(s, X, Y, g, 'TASK 3/3'));
    g.penUp();
    check('signature', (s) => drawSignature(s, X, Y, g, 'TASK 3/3'));
  });
});
