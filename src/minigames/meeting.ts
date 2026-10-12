// Meeting (office, rank 3+; docs/03): the boss asks a few questions and you pick a reply (keys 1–3 or a click)
// before the silence gets awkward. Each reply moves the boss's mood; the mood at the end is the grade.

import { BALANCE_JOBS } from '../config/balanceJobs';
import type { Rng } from '../core/rng';
import {
  MEETING_QUESTIONS,
  MEETING_SILENCE,
  type MeetingQuestion,
  type MeetingReply,
} from '../data/meetings';
import type { Grade } from '../systems/career';
import type { MinigameLogic } from './logic';

export interface MeetingRound {
  question: MeetingQuestion;
  /** The replies in the order shown. */
  replies: MeetingReply[];
}

export class MeetingGame implements MinigameLogic {
  readonly rounds: MeetingRound[];
  round = 0;
  mood: number;
  /** Seconds left to answer the current question. */
  timeLeft: number;
  readonly timeTotal: number;
  /** The boss's answer to the last reply, shown for a moment, and how it moved the mood. */
  last: { reaction: string; delta: number; t: number } | null = null;
  done = false;
  grade: Grade | null = null;

  constructor(rng: Rng) {
    const M = BALANCE_JOBS.meeting;
    this.rounds = rng
      .shuffle([...MEETING_QUESTIONS])
      .slice(0, M.rounds)
      .map((question) => ({ question, replies: rng.shuffle([...question.replies]) }));
    this.mood = M.startMood;
    this.timeTotal = M.seconds;
    this.timeLeft = M.seconds;
  }

  get current(): MeetingRound | null {
    return this.done ? null : (this.rounds[this.round] ?? null);
  }

  /** Answer with reply `k` (0-based). */
  choose(k: number): void {
    const r = this.current;
    const reply = r?.replies[k];
    if (!reply) return;
    this.react(reply.reaction, reply.mood);
  }

  private react(reaction: string, delta: number): void {
    this.mood = Math.max(0, Math.min(100, this.mood + delta));
    this.last = { reaction, delta, t: 0 };
    this.round++;
    this.timeLeft = this.timeTotal;
    if (this.round >= this.rounds.length) this.finish();
  }

  private finish(): void {
    this.done = true;
    const F = BALANCE_JOBS.meeting.moodFor;
    if (this.mood >= F.excellent) this.grade = 'excellent';
    else if (this.mood >= F.good) this.grade = 'good';
    else if (this.mood >= F.ok) this.grade = 'ok';
    else if (this.mood >= F.poor) this.grade = 'poor';
    else this.grade = 'fail';
  }

  update(dt: number): void {
    if (this.last) this.last.t += dt;
    if (this.done) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft === 0) this.react(MEETING_SILENCE, BALANCE_JOBS.meeting.silence);
  }
}
