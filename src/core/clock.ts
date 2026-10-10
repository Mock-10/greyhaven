// Fixed-timestep accumulator (docs/14): game logic advances in equal ticks whatever the frame rate.

export class FixedStep {
  readonly dt: number;
  private acc = 0;
  private readonly maxFrame: number;

  constructor(tickHz: number, maxFrameSeconds: number) {
    this.dt = 1 / tickHz;
    this.maxFrame = maxFrameSeconds;
  }

  /**
   * Feed real elapsed seconds. Calls `tick(dt)` zero or more times and returns the interpolation
   * factor in [0, 1) for rendering between the last two ticks.
   */
  advance(elapsedSeconds: number, tick: (dt: number) => void): number {
    this.acc += Math.min(Math.max(elapsedSeconds, 0), this.maxFrame);
    while (this.acc >= this.dt) {
      tick(this.dt);
      this.acc -= this.dt;
    }
    return this.acc / this.dt;
  }

  reset(): void {
    this.acc = 0;
  }
}
