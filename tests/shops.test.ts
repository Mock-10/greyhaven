import { describe, expect, it } from 'vitest';
import player from '../art/player.json';
import { BALANCE } from '../src/config/balance';
import { createState } from '../src/core/store';
import {
  DEFAULT_LOOK,
  HAIR_COLOURS,
  OUTFITS,
  SKIN_TONES,
  STARTING_OUTFITS,
  cleanName,
} from '../src/data/looks';
import { DEALER_STOCK, typeOfModel } from '../src/data/vehicles';
import { CLOTHING_STOCK, buyOutfit, outfitPrice, wearOutfit } from '../src/systems/clothing';
import { bayFree, boughtCar, canAfford, carPrice, payDealer } from '../src/systems/dealer';
import { createFinance } from '../src/systems/finance';
import { swapPixels, swapTable, type Part, type Rgb } from '../src/systems/lookSwap';
import { parkedCar } from '../src/systems/vehicle';
import { clothingPage, dealerPage, wardrobePage, type ShopCtx } from '../src/world/shops';

const MARKERS = (player as unknown as { markers: Record<Part, Rgb[]> }).markers;

describe('the look (docs/11 character creator)', () => {
  it('has six skin tones, five hair colours and three starting outfits', () => {
    expect(SKIN_TONES).toHaveLength(6);
    expect(HAIR_COLOURS).toHaveLength(5);
    expect(STARTING_OUTFITS).toHaveLength(3);
    for (const o of OUTFITS) expect(o.top).toHaveLength(6);
  });

  it('cleans names to the pixel font, upper case, 16 characters', () => {
    expect(cleanName('robin')).toBe('ROBIN');
    expect(cleanName('  a@b#c')).toBe('ABC');
    expect(cleanName('x'.repeat(30))).toHaveLength(16);
  });

  it('swaps every marker tone and outline for the chosen ramps', () => {
    const t = swapTable(DEFAULT_LOOK, MARKERS);
    expect(t.size).toBe(4 * 7);
    const skin = MARKERS.skin[3] as Rgb;
    const px = new Uint8ClampedArray([...skin, 255, 1, 2, 3, 255, ...skin, 0]);
    swapPixels(px, t);
    const want = SKIN_TONES[1]!.ramp[3];
    expect(Array.from(px.slice(0, 3))).toEqual(
      [1, 2, 3].map((_, k) => parseInt(want.slice(1 + 2 * k, 3 + 2 * k), 16)),
    );
    expect(Array.from(px.slice(4, 7))).toEqual([1, 2, 3]); // not a marker
    expect(Array.from(px.slice(8, 11))).toEqual(skin); // transparent pixels are left alone
  });
});

describe('the clothing store and the wardrobe', () => {
  it('sells every store outfit at a price in BALANCE', () => {
    expect(CLOTHING_STOCK.length).toBeGreaterThan(0);
    for (const id of CLOTHING_STOCK) expect(outfitPrice(id)).toBeGreaterThan(0);
  });

  it('takes clean cash once, then the outfit is yours to wear', () => {
    const money = { clean: 100 };
    const wardrobe = [...STARTING_OUTFITS];
    expect(buyOutfit(money, wardrobe, 'navy_suit').ok).toBe(false);
    expect(money.clean).toBe(100);
    const r = buyOutfit(money, wardrobe, 'grey_hoodie');
    expect(r.ok).toBe(true);
    expect(money.clean).toBe(100 - BALANCE.clothing.grey_hoodie!);
    expect(buyOutfit(money, wardrobe, 'grey_hoodie').ok).toBe(false);
    expect(wearOutfit(DEFAULT_LOOK, wardrobe, 'grey_hoodie')?.outfit).toBe('grey_hoodie');
    expect(wearOutfit(DEFAULT_LOOK, wardrobe, 'navy_suit')).toBeNull();
  });

  it('lists the store and the wardrobe with pictures, and buying puts it on', () => {
    const state = createState(1, 'downtown', { x: 0, y: 0 });
    state.money.clean = 500;
    let worn = '';
    const ctx: ShopCtx = { state, wear: (o) => (worn = o), buyCar: () => '' };
    const page = clothingPage(ctx);
    expect(page.rows).toHaveLength(CLOTHING_STOCK.length);
    expect(page.rows.every((r) => r.icon?.startsWith('outfit/'))).toBe(true);
    page.rows[0]!.act!();
    expect(state.wardrobe).toContain(CLOTHING_STOCK[0]);
    expect(worn).toBe(CLOTHING_STOCK[0]);
    expect(wardrobePage(ctx).rows).toHaveLength(STARTING_OUTFITS.length + 1);
  });
});

describe('the used-car lot (docs/08)', () => {
  it('sells beaters, sedans and the Phase 4 cars at the docs prices', () => {
    expect(carPrice('beater_khaki')).toBe(1500);
    expect(carPrice('sedan_teal')).toBe(5000);
    expect(new Set(DEALER_STOCK.map(typeOfModel))).toEqual(
      new Set(['beater', 'sedan', 'pickup', 'sports', 'armoredSuv']),
    );
  });

  it('charges the bank first, then clean cash, and records it', () => {
    const m = { clean: 600, dirty: 900, bank: 1000 };
    const f = createFinance();
    expect(canAfford(m, 1500)).toBe(true);
    expect(payDealer(m, f, 0, 'beater_brick')).toBe(true);
    expect(m).toEqual({ clean: 100, dirty: 900, bank: 0 });
    expect(f.ledger[0]?.amount).toBe(-1500);
    expect(payDealer(m, f, 0, 'beater_brick')).toBe(false); // dirty cash doesn't count
  });

  it('hands over an owned, keyed car with a full tank, once the bay is clear', () => {
    const slot = { x: 100, y: 100, dir: 2 };
    const v = boughtCar('b1', 'beater_khaki', slot);
    expect(v).toMatchObject({ owned: true, locked: false, running: true, type: 'beater', hotUntil: 0 });
    expect(v.fuel).toBe(BALANCE.vehicles.types.beater.tank);
    expect(bayFree([v], slot)).toBe(false);
    expect(bayFree([parkedCar('x', 'sedan_teal', 400, 100, 0)], slot)).toBe(true);
  });

  it('greys out cars you cannot afford', () => {
    const state = createState(1, 'downtown', { x: 0, y: 0 });
    state.money.bank = 2000;
    state.money.clean = 0;
    const rows = dealerPage({ state, wear: () => {}, buyCar: () => 'OK' }).rows;
    expect(rows.find((r) => r.label.startsWith('BEATER'))?.enabled).toBe(true);
    expect(rows.find((r) => r.label.startsWith('SEDAN'))?.enabled).toBe(false);
  });
});
