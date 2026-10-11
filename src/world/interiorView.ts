// Draws an interior (docs/18) and its sight state (docs/19) from art/interiors/<id>.json:
//  - floor in the ground layer; back walls behind everything; front stubs over everything;
//  - partition pieces sorted at x + y − 2 and furniture at x + y + zBias, like the drafts (export_interiors.py);
//  - door leaves shown while closed; NPCs on duty;
//  - sight: unseen cells under a dithered lid at the cut-wall height (sorted with the furniture), remembered
//    cells dimmed with last-seen ghosts for people, back walls darkened above rooms out of sight, 150 ms fades.
// The room sits at world origin; the scene hides the street while an interior is shown.

import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { frameInfo, framePixels } from '../assets/atlasLoader';
import type { AtlasKey } from '../assets/manifest';
import { addPixelsTexture } from '../assets/runtimeTextures';
import { characterFrame, poseFromWalk, type FrameRef } from '../assets/sprites';
import type { InteriorDef } from '../data/interiors';
import type { Footprint } from '../iso/depthSort';
import { roundHalfEven, worldToScreen } from '../iso/projection';
import type { Rect } from '../iso/shadows';
import { CELL, HID, MEM, VIS, computeSight, gridOf, roomLabels, type Grid } from '../systems/sight';
import type { DoorRuntime, InteriorJson } from './interiorModel';

const LID_A: [number, number, number] = [30, 23, 34];
const LID_B: [number, number, number] = [44, 34, 50];
const DIM = 0x85809e; // rooms.py dim (0.52, 0.5, 0.62) as a multiply colour
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((r) => r.map((v) => (v + 0.5) / 16));

/** A drawn piece with its sight cell, so it can be hidden or dimmed. */
interface Piece {
  obj: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  /** Live things (people) are replaced by ghosts in remembered rooms; static furniture is dimmed. */
  live: boolean;
  /** Segments hide only when both sides are unseen: the cells on either side. */
  sides?: [{ x: number; y: number }, { x: number; y: number }];
  target: number;
  ghost?: Phaser.GameObjects.Image;
  npc?: number;
}

export interface InteriorPlaced {
  sprite: Phaser.GameObjects.Sprite;
  bounds: Rect;
  height: number;
  frame: FrameRef;
  item: number;
}

function lidTexture(scene: Phaser.Scene, edge: boolean): string {
  const key = edge ? 'sight-lid-edge' : 'sight-lid';
  if (scene.textures.exists(key)) return key;
  // one 8 x 8 cell projected: a 16 x 8 diamond with its top vertex at (8, 0)
  const w = 16;
  const h = 9;
  const data = new Uint8ClampedArray(w * h * 4);
  const colA = edge ? LID_B : LID_A;
  const colB = edge ? (LID_B.map((v) => Math.min(255, Math.round(v * 1.25))) as number[]) : LID_B;
  const thrCut = edge ? 0.55 : 0.8;
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++) {
      if (Math.abs(px + 0.5 - 8) / 8 + Math.abs(py + 0.5 - 4) / 4 > 1.06) continue;
      // cells sit on multiples of (8, 4) screen pixels, so the Bayer phase is the same in every cell
      const c = ((BAYER[py % 4] as number[])[px % 4] as number) > thrCut ? colB : colA;
      data.set([c[0] as number, c[1] as number, c[2] as number, 255], (py * w + px) * 4);
    }
  addPixelsTexture(scene.textures, key, { width: w, height: h, data }, { ax: 8, ay: 0 });
  return key;
}

/** A 1 px outline of a frame's silhouette, for last-seen ghosts (docs/19: muted lavender, about 40%). */
function ghostTexture(scene: Phaser.Scene, ref: FrameRef): string {
  const key = `ghost:${ref.atlas}:${ref.frame}`;
  if (scene.textures.exists(key)) return key;
  const src = framePixels(scene.textures, ref.atlas, ref.frame);
  const { width: w, height: h } = src;
  const out = new Uint8ClampedArray(w * h * 4);
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && (src.data[(y * w + x) * 4 + 3] as number) > 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (solid(x, y) && (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)))
        out.set([188, 175, 182, 255], (y * w + x) * 4);
  const f = frameInfo(ref.atlas, ref.frame);
  addPixelsTexture(scene.textures, key, { width: w, height: h, data: out }, { ax: f.ax, ay: f.ay });
  return key;
}

export class InteriorView {
  readonly atlas: AtlasKey;
  readonly grid: Grid;
  readonly labels: Int32Array;
  readonly placed: InteriorPlaced[] = [];
  /** Box footprints (furniture, wall pieces) for the player's depth. */
  readonly footprints: { fp: Footprint; bounds: Rect }[] = [];
  private pieces: Piece[] = [];
  private lids: (Phaser.GameObjects.Image | null)[] = [];
  private lidTarget: number[] = [];
  private objects: Phaser.GameObjects.GameObject[] = [];
  private leaves = new Map<number, Phaser.GameObjects.Sprite>();
  private npcSprites: Piece[] = [];
  private wallGfx: Phaser.GameObjects.Graphics;
  private dimFloor: Phaser.GameObjects.Graphics;
  private dimWall: Phaser.GameObjects.Graphics;
  private state: Uint8Array;
  private lastViewer = { x: -1e9, y: -1e9 };
  private lastKey = '';
  private enabled = true;

  constructor(
    private scene: Phaser.Scene,
    readonly json: InteriorJson,
    readonly def: InteriorDef,
    private ground: Phaser.GameObjects.Layer,
    private layer: Phaser.GameObjects.Layer,
  ) {
    this.atlas = `in_${json.id}` as AtlasKey;
    this.grid = gridOf(json.W, json.D);
    this.labels = roomLabels(json.W, json.D, json.partitions);
    this.state = new Uint8Array(this.grid.nx * this.grid.ny).fill(VIS);
    const at = (frame: string) => {
      const o = worldToScreen(0, 0);
      return this.scene.add.sprite(roundHalfEven(o.x), roundHalfEven(o.y), this.atlas, frame);
    };
    const floor = at('floor');
    this.ground.add(floor);
    this.objects.push(floor);
    this.dimFloor = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.ground.add(this.dimFloor);
    const walls = at('walls').setDepth(-1e6);
    this.layer.add(walls);
    this.objects.push(walls);
    this.dimWall = this.scene.add
      .graphics()
      .setDepth(-1e6 + 1)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.wallGfx = this.scene.add.graphics().setDepth(-1e6 + 2);
    this.layer.add([this.dimWall, this.wallGfx]);
    const stubs = at('stubs').setDepth(1e6);
    this.layer.add(stubs);
    this.objects.push(stubs, this.dimFloor, this.dimWall, this.wallGfx);

    for (const s of json.segments) {
      const spr = at(s.frame).setDepth(s.x + s.y - 2);
      this.layer.add(spr);
      this.objects.push(spr);
      const off = 4;
      const sides: Piece['sides'] =
        s.axis === 'x'
          ? [
              { x: s.x, y: s.pos - off },
              { x: s.x, y: s.pos + off },
            ]
          : [
              { x: s.pos - off, y: s.y },
              { x: s.pos + off, y: s.y },
            ];
      this.pieces.push({ obj: spr, x: s.x, y: s.y, live: false, sides, target: 1 });
      const t = json.wallT / 2;
      const fp =
        s.axis === 'x'
          ? { minX: s.x - 8, minY: s.pos - t, maxX: s.x + 8, maxY: s.pos + t, depth: s.x + s.y - 2 }
          : { minX: s.pos - t, minY: s.y - 8, maxX: s.pos + t, maxY: s.y + 8, depth: s.x + s.y - 2 };
      this.footprints.push({ fp, bounds: this.boundsOf(spr, s.frame) });
    }
    json.items.forEach((it, i) => {
      const p = worldToScreen(it.x, it.y, it.wz);
      const spr = this.scene.add.sprite(roundHalfEven(p.x), roundHalfEven(p.y), this.atlas, it.frame);
      const depth = it.x + it.y + it.zBias;
      spr.setDepth(depth);
      this.layer.add(spr);
      this.objects.push(spr);
      this.pieces.push({ obj: spr, x: it.x, y: it.y, live: !!it.valuable, target: 1 });
      const bounds = this.boundsOf(spr, it.frame);
      const f = frameInfo(this.atlas, it.frame);
      this.placed.push({
        sprite: spr,
        bounds,
        height: f.ay - f.bounds.y,
        frame: { atlas: this.atlas, frame: it.frame },
        item: i,
      });
      if (it.door) this.leaves.set(i, spr);
      if (it.shadow?.kind === 'box' && it.wz <= 0)
        this.footprints.push({
          fp: {
            minX: it.x - it.shadow.hx,
            minY: it.y - it.shadow.hy,
            maxX: it.x + it.shadow.hx,
            maxY: it.y + it.shadow.hy,
            depth,
          },
          bounds,
        });
    });
    json.npcs.forEach((n, k) => {
      const ref = characterFrame(n.costume, poseFromWalk(n.walk), n.dir);
      const p = worldToScreen(n.x, n.y);
      const spr = this.scene.add.sprite(roundHalfEven(p.x), roundHalfEven(p.y), ref.atlas, ref.frame);
      spr.setDepth(n.x + n.y + n.zBias);
      const ghost = this.scene.add
        .image(spr.x, spr.y, ghostTexture(this.scene, ref))
        .setDepth(spr.depth)
        .setAlpha(0)
        .setVisible(false);
      this.layer.add([spr, ghost]);
      this.objects.push(spr, ghost);
      const piece: Piece = { obj: spr, x: n.x, y: n.y, live: true, target: 1, ghost, npc: k };
      this.pieces.push(piece);
      this.npcSprites.push(piece);
    });
    // lid sprites per cell, made on demand
    this.lids = new Array(this.grid.nx * this.grid.ny).fill(null);
    this.lidTarget = new Array(this.grid.nx * this.grid.ny).fill(0);
  }

  private boundsOf(spr: Phaser.GameObjects.Sprite, frame: string): Rect {
    const f = frameInfo(this.atlas, frame);
    return { x: spr.x - f.ax + f.bounds.x, y: spr.y - f.ay + f.bounds.y, w: f.bounds.w, h: f.bounds.h };
  }

  /** Screen rect of the whole room (walls included), for the camera bounds. */
  get bounds(): Rect {
    const { W, D, wallH, wallT } = this.json;
    const x0 = -D - wallT;
    const x1 = W + wallT;
    return { x: x0, y: -wallH - wallT, w: x1 - x0, h: (W + D) / 2 + wallH + 2 * wallT };
  }

  /** Show or hide door leaves (an open door leaves the gap empty) and the NPCs on duty. */
  setWorld(doors: readonly DoorRuntime[], npcsPresent: readonly boolean[]): void {
    for (const d of doors) this.leaves.get(d.item)?.setVisible(!d.open);
    for (const p of this.npcSprites) {
      const on = npcsPresent[p.npc as number] ?? false;
      p.obj.setData('onDuty', on);
    }
    this.lastKey = ''; // re-apply sight next update
  }

  private cellState(x: number, y: number): number {
    const i = Math.min(this.grid.nx - 1, Math.max(0, Math.floor(x / CELL)));
    const j = Math.min(this.grid.ny - 1, Math.max(0, Math.floor(y / CELL)));
    return this.state[i * this.grid.ny + j] as number;
  }

  /**
   * Recompute sight for a viewer (docs/19) when it moved far enough or the doors changed, and set every piece's
   * target opacity. Returns the rooms visible now (to add to the remembered set).
   */
  updateSight(
    viewer: { x: number; y: number },
    doors: readonly DoorRuntime[],
    remembered: ReadonlySet<number>,
    enabled: boolean,
  ): Set<number> | null {
    const key = doors.map((d) => (d.open ? 1 : 0)).join('') + (enabled ? 'on' : 'off');
    const moved = Math.hypot(viewer.x - this.lastViewer.x, viewer.y - this.lastViewer.y);
    if (key === this.lastKey && moved < BALANCE.interiors.sightMoveUnits) return null;
    this.lastKey = key;
    this.lastViewer = { ...viewer };
    this.enabled = enabled;
    const closed = doors.filter((d) => !d.open).map((d) => d.line);
    const { state, visibleRooms } = computeSight(
      this.json.W,
      this.json.D,
      this.json.partitions,
      this.labels,
      viewer,
      closed,
      remembered,
      BALANCE.interiors.sightRange,
    );
    // remembered-room dimming is on hold (BALANCE.interiors.rememberedDimming): seen rooms draw as visible
    if (!BALANCE.interiors.rememberedDimming) for (let k = 0; k < state.length; k++) if (state[k] === MEM) state[k] = VIS;
    this.state = enabled ? state : new Uint8Array(state.length).fill(VIS);
    this.applyState();
    return visibleRooms;
  }

  private applyState(): void {
    const g = this.grid;
    // pieces
    for (const p of this.pieces) {
      const onDuty = p.npc === undefined || (p.obj.getData('onDuty') as boolean);
      let st: number;
      if (p.sides) {
        const a = this.cellState(p.sides[0].x, p.sides[0].y);
        const b = this.cellState(p.sides[1].x, p.sides[1].y);
        st = a === HID && b === HID ? HID : a === VIS || b === VIS ? VIS : MEM;
      } else st = this.cellState(p.x, p.y);
      if (st === VIS) {
        p.target = onDuty ? 1 : 0;
        p.obj.clearTint();
        if (p.ghost) {
          p.ghost.setVisible(false);
          // a ghost marks where a person was last seen; someone off duty leaves no ghost
          p.ghost.setPosition(p.obj.x, p.obj.y).setData('seen', onDuty);
        }
      } else if (st === MEM) {
        if (p.live) {
          p.target = 0;
          if (p.ghost?.getData('seen')) p.ghost.setVisible(true).setAlpha(BALANCE.interiors.ghostAlpha);
        } else {
          p.target = 1;
          p.obj.setTint(DIM);
        }
      } else {
        p.target = 0;
        p.ghost?.setVisible(false);
      }
    }
    // lids over unseen cells
    for (let i = 0; i < g.nx; i++)
      for (let j = 0; j < g.ny; j++) {
        const k = i * g.ny + j;
        const hid = this.state[k] === HID;
        this.lidTarget[k] = hid ? 1 : 0;
        if (hid && !this.lids[k]) {
          const edge = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(([di, dj]) => {
            const a = i + (di as number);
            const b = j + (dj as number);
            return a >= 0 && b >= 0 && a < g.nx && b < g.ny && this.state[a * g.ny + b] !== HID;
          });
          const p = worldToScreen(i * CELL, j * CELL, this.json.partH + 0.6);
          const img = this.scene.add
            .image(Math.round(p.x), Math.round(p.y), lidTexture(this.scene, edge))
            .setDepth((i + 0.5) * CELL + (j + 0.5) * CELL + 1)
            .setAlpha(0);
          this.layer.add(img);
          this.lids[k] = img;
        }
      }
    // back walls over cells out of sight, and the remembered floor
    const W = this.json.wallH + 0.5;
    this.wallGfx.clear();
    this.dimWall.clear();
    this.dimFloor.clear();
    const quad = (gfx: Phaser.GameObjects.Graphics, pts: { x: number; y: number }[]) =>
      gfx.fillPoints(pts, true);
    this.wallGfx.fillStyle(Phaser.Display.Color.GetColor(...LID_B), 0.82);
    this.dimWall.fillStyle(DIM, 1);
    this.dimFloor.fillStyle(DIM, 1);
    for (let i = 0; i < g.nx; i++) {
      const st = this.state[i * g.ny] as number;
      if (st === VIS) continue;
      const pts = [
        worldToScreen(i * CELL, 0, 0),
        worldToScreen((i + 1) * CELL, 0, 0),
        worldToScreen((i + 1) * CELL, 0, W),
        worldToScreen(i * CELL, 0, W),
      ];
      quad(st === HID ? this.wallGfx : this.dimWall, pts);
    }
    for (let j = 0; j < g.ny; j++) {
      const st = this.state[j] as number;
      if (st === VIS) continue;
      const pts = [
        worldToScreen(0, j * CELL, 0),
        worldToScreen(0, (j + 1) * CELL, 0),
        worldToScreen(0, (j + 1) * CELL, W),
        worldToScreen(0, j * CELL, W),
      ];
      quad(st === HID ? this.wallGfx : this.dimWall, pts);
    }
    for (let i = 0; i < g.nx; i++)
      for (let j = 0; j < g.ny; j++)
        if (this.state[i * g.ny + j] === MEM)
          quad(this.dimFloor, [
            worldToScreen(i * CELL, j * CELL),
            worldToScreen((i + 1) * CELL, j * CELL),
            worldToScreen((i + 1) * CELL, (j + 1) * CELL),
            worldToScreen(i * CELL, (j + 1) * CELL),
          ]);
  }

  /** Per frame: fade pieces and lids toward their targets (docs/19: about 150 ms). */
  tick(dt: number): void {
    const rate = dt / BALANCE.interiors.sightFadeSeconds;
    const step = (a: number, b: number) => (Math.abs(b - a) <= rate ? b : a + Math.sign(b - a) * rate);
    for (const p of this.pieces) p.obj.setAlpha(step(p.obj.alpha, p.target));
    this.lids.forEach((img, k) => {
      if (!img) return;
      img.setAlpha(step(img.alpha, this.enabled ? (this.lidTarget[k] as number) : 0));
    });
  }

  /** The state (VIS / MEM / HID) of the cell at a world point, e.g. to hide prompts in unseen rooms. */
  stateAt(x: number, y: number): number {
    return this.cellState(x, y);
  }

  destroy(): void {
    for (const o of this.objects) o.destroy();
    for (const l of this.lids) l?.destroy();
    this.objects = [];
    this.lids = [];
  }
}
