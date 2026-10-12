// M7 office tasks (docs/03): stamp and sign, and the meeting.
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { BALANCE_JOBS } from '../src/config/balanceJobs';
import { MEETING_QUESTIONS } from '../src/data/meetings';
import { StampSignGame } from '../src/minigames/stampSign';
import { MeetingGame } from '../src/minigames/meeting';
import { BODY_CHARS } from '../src/ui/pixelFont';

/** Run the desk until the next mark is `off` paper widths from the stamp (negative: before it), then press. */
function pressAt(g: StampSignGame, off: number): void {
  const m = g.next!;
  while (m.pos < off - 1e-9) g.update(Math.min(1 / 120, (off - m.pos) / g.speed));
  g.press();
}

describe('stamp and sign', () => {
  it('has a stamp box and a signature line on every paper', () => {
    const g = new StampSignGame();
    expect(g.marks.length).toBe(BALANCE_JOBS.stamp.docs * 2);
    expect(g.marks.filter((m) => m.kind === 'stamp').length).toBe(BALANCE_JOBS.stamp.docs);
    expect(g.marks.every((m) => m.pos < 0)).toBe(true);
  });

  it('is excellent dead on every time, and only ok when every mark is a little off', () => {
    const g = new StampSignGame();
    while (!g.done) pressAt(g, 0);
    expect(g.count('great')).toBe(g.marks.length);
    expect(g.grade).toBe('excellent');

    const off = new StampSignGame();
    while (!off.done) pressAt(off, BALANCE_JOBS.stamp.good * 0.8);
    expect(off.count('good')).toBe(off.marks.length);
    expect(off.grade).toBe('ok');
  });

  it('counts an early press and a mark that slides past as misses', () => {
    const g = new StampSignGame();
    g.press();
    expect(g.marks[0]!.result).toBe('miss');
    const first = g.next!;
    while (first.result === null) g.update(1 / 60);
    expect(first.result).toBe('miss');
    g.update(999);
    expect(g.done).toBe(true);
    expect(g.grade).toBe('fail');
  });

  it('speeds up as it goes', () => {
    const g = new StampSignGame();
    const v = g.speed;
    g.update(5);
    expect(g.speed).toBeGreaterThan(v);
  });
});

describe('meeting', () => {
  const best = (g: MeetingGame) => {
    const r = g.current!;
    return r.replies.indexOf(r.replies.reduce((a, b) => (b.mood > a.mood ? b : a)));
  };
  const worst = (g: MeetingGame) => {
    const r = g.current!;
    return r.replies.indexOf(r.replies.reduce((a, b) => (b.mood < a.mood ? b : a)));
  };
  const middle = (g: MeetingGame) => [0, 1, 2].find((k) => k !== best(g) && k !== worst(g))!;

  it('every question has a liked, a passable and a bad reply', () => {
    for (const q of MEETING_QUESTIONS) {
      const moods = q.replies.map((r) => r.mood).sort((a, b) => a - b);
      expect(moods[0]).toBeLessThan(0);
      expect(moods[1]).toBeGreaterThan(0);
      expect(moods[2]).toBeGreaterThan(moods[1]!);
    }
  });

  it('grades the best replies excellent, middling ones ok, and the worst a fail', () => {
    const ex = new MeetingGame(new Rng(1));
    while (!ex.done) ex.choose(best(ex));
    expect(ex.grade).toBe('excellent');

    const mid = new MeetingGame(new Rng(2));
    while (!mid.done) mid.choose(middle(mid));
    expect(mid.grade).toBe('ok');

    const bad = new MeetingGame(new Rng(3));
    while (!bad.done) bad.choose(worst(bad));
    expect(bad.grade).toBe('fail');
  });

  it('takes silence as an answer when the time runs out, and asks different questions', () => {
    const g = new MeetingGame(new Rng(4));
    g.update(BALANCE_JOBS.meeting.seconds + 0.01);
    expect(g.round).toBe(1);
    expect(g.mood).toBe(BALANCE_JOBS.meeting.startMood + BALANCE_JOBS.meeting.silence);
    expect(new Set(g.rounds.map((r) => r.question.boss)).size).toBe(g.rounds.length);
  });

  it('uses only letters the body font can draw', () => {
    const ok = new Set([...BODY_CHARS, ' ']);
    for (const q of MEETING_QUESTIONS)
      for (const s of [q.boss, ...q.replies.flatMap((r) => [r.text, r.reaction])])
        for (const ch of s) expect(ok.has(ch), `${ch} in ${s}`).toBe(true);
  });
});
