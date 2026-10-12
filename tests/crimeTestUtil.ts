import { Rng } from '../src/core/rng';

/** An Rng whose `next()` always returns the same value: chance(p) is true exactly when p > v. */
export class FixedRng extends Rng {
  constructor(private readonly v: number) {
    super(0);
  }

  override next(): number {
    return this.v;
  }
}
