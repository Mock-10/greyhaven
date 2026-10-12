// Stamp and sign (office, docs/03 "timing"): papers slide along the desk under the stamp and the pen. Each paper has a
// stamp box and then a signature line; hit Space as each one passes the mark. Dead on is great, close is good, and a
// press too early smudges the next mark (a miss), as does letting one slide past. The papers speed up as you go.

import { BALANCE_JOBS } from '../config/balanceJobs';
import type { Grade } from '../systems/career';
import type { MinigameLogic } from './logic';
import { scoreGrade } from './jobGrade';

export type MarkKind = 'stamp' | 'sign';
export type MarkResult = 'great' | 'good' | 'miss';

export interface Mark {
  kind: MarkKind;
  /** Which paper it is on. */
  doc: number;
  /** Position along the desk in paper widths; 0 is under the stamp, negative is still to come. */
  pos: number;
  result: MarkResult | null;
}

export class StampSignGame implements MinigameLogic {
  readonly marks: Mark[];
  readonly docs: number;
  /** Leading (right) edge of paper 0 along the desk; the others follow at the pitch. */
  docPos: number;
  speed: number;
  last: { result: MarkResult; t: number } | null = null;
  done = false;
  grade: Grade | null = null;

  constructor() {
    const S = BALANCE_JOBS.stamp;
    this.docs = S.docs;
    this.docPos = S.stampAt - S.lead;
    this.speed = S.speed;
    this.marks = [];
    for (let d = 0; d < S.docs; d++) {
      // papers slide right: the stamp box near the leading edge arrives first, then the signature line
      const lead = this.docPos - d * S.pitch;
      this.marks.push({ kind: 'stamp', doc: d, pos: lead - S.stampAt, result: null });
      this.marks.push({ kind: 'sign', doc: d, pos: lead - S.signAt, result: null });
    }
  }

  /** The next mark to hit. */
  get next(): Mark | null {
    return this.marks.find((m) => m.result === null) ?? null;
  }

  count(r: MarkResult): number {
    return this.marks.filter((m) => m.result === r).length;
  }

  get score(): number {
    const S = BALANCE_JOBS.stamp;
    return (this.count('great') + this.count('good') * S.goodWorth) / this.marks.length;
  }

  press(): void {
    const m = this.next;
    if (this.done || !m) return;
    const S = BALANCE_JOBS.stamp;
    const d = Math.abs(m.pos);
    this.resolve(m, d <= S.great ? 'great' : d <= S.good ? 'good' : 'miss');
  }

  private resolve(m: Mark, r: MarkResult): void {
    m.result = r;
    this.last = { result: r, t: 0 };
    if (!this.next) {
      this.done = true;
      this.grade = scoreGrade(this.score);
    }
  }

  update(dt: number): void {
    if (this.last) this.last.t += dt;
    if (this.done) return;
    const S = BALANCE_JOBS.stamp;
    const step = this.speed * dt;
    this.docPos += step;
    for (const m of this.marks) m.pos += step;
    this.speed += S.accel * dt;
    // a mark that slides past the window unhit is missed
    for (let m = this.next; m && m.pos > S.good; m = this.next) this.resolve(m, 'miss');
  }
}
