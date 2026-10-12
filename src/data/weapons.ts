// Weapon and ammo catalogue (docs/07). Names, classes and what each weapon does; the numbers (price, damage, range,
// clip, ammo prices) live in config/balanceCombat.ts.

export type WeaponId =
  | 'bat'
  | 'knife'
  | 'pistol'
  | 'revolver'
  | 'shotgun'
  | 'smg'
  | 'assault_rifle'
  | 'hunting_rifle'
  | 'lmg'
  | 'grenade_launcher';

export type AmmoId = '9mm' | '357' | '12g' | '556' | '308' | 'belt' | 'grenade';

/** docs/07 class column. */
export type WeaponClass = 'melee' | 'handgun' | 'shotgun' | 'automatic' | 'rifle' | 'heavy';

/** Loadout slot (docs/07: 1 melee, 2 firearms, 1 heavy). */
export type SlotKind = 'melee' | 'firearm' | 'heavy';

export interface WeaponDef {
  id: WeaponId;
  /** HUD label (docs/11 weapon panel). */
  name: string;
  cls: WeaponClass;
  slot: SlotKind;
  /** null for melee. */
  ammo: AmmoId | null;
  /** Silent: doesn't alarm people nearby (docs/07: bat, knife). */
  silent?: boolean;
  /** Knocks the target down (bat) or back (shotgun). */
  knockdown?: boolean;
  /** Doesn't count as a visible weapon when holstered (docs/07: pistol; the knife is assumed). */
  concealable?: boolean;
  /** Slows movement while carried drawn (docs/07: LMG). */
  slows?: boolean;
  /** Area damage that also hurts vehicles (docs/07: grenade launcher). */
  explosive?: boolean;
  /** Sold at the legal gun store for clean cash, registered (docs/07: pistol and shotgun only). */
  legal?: boolean;
  /** Fires while the button is held. */
  automatic?: boolean;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  bat: { id: 'bat', name: 'BAT', cls: 'melee', slot: 'melee', ammo: null, silent: true, knockdown: true },
  /** Concealable like the pistol (assumed: docs/07 only names the pistol). */
  knife: {
    id: 'knife',
    name: 'KNIFE',
    cls: 'melee',
    slot: 'melee',
    ammo: null,
    silent: true,
    concealable: true,
  },
  pistol: {
    id: 'pistol',
    name: 'PISTOL',
    cls: 'handgun',
    slot: 'firearm',
    ammo: '9mm',
    concealable: true,
    legal: true,
  },
  revolver: { id: 'revolver', name: 'REVOLVER', cls: 'handgun', slot: 'firearm', ammo: '357' },
  shotgun: {
    id: 'shotgun',
    name: 'SHOTGUN',
    cls: 'shotgun',
    slot: 'firearm',
    ammo: '12g',
    knockdown: true,
    legal: true,
  },
  smg: { id: 'smg', name: 'SMG', cls: 'automatic', slot: 'firearm', ammo: '9mm', automatic: true },
  assault_rifle: {
    id: 'assault_rifle',
    name: 'RIFLE',
    cls: 'rifle',
    slot: 'firearm',
    ammo: '556',
    automatic: true,
  },
  hunting_rifle: { id: 'hunting_rifle', name: 'HUNTING RIFLE', cls: 'rifle', slot: 'firearm', ammo: '308' },
  lmg: { id: 'lmg', name: 'LMG', cls: 'heavy', slot: 'heavy', ammo: 'belt', automatic: true, slows: true },
  grenade_launcher: {
    id: 'grenade_launcher',
    name: 'LAUNCHER',
    cls: 'heavy',
    slot: 'heavy',
    ammo: 'grenade',
    explosive: true,
  },
};

/** HUD names for the ammo types (docs/11: "ammo type or MELEE"). */
export const AMMO_NAMES: Record<AmmoId, string> = {
  '9mm': '9MM',
  '357': '.357',
  '12g': '12 GA',
  '556': '5.56',
  '308': '.308',
  belt: 'BELT',
  grenade: 'GRENADE',
};

/** Dealer stock, in menu order: everything (docs/07: dealers sell to everyone). */
export const DEALER_STOCK: readonly WeaponId[] = [
  'bat',
  'knife',
  'pistol',
  'revolver',
  'shotgun',
  'smg',
  'hunting_rifle',
  'assault_rifle',
  'lmg',
  'grenade_launcher',
];

/** The legal gun store (docs/07): pistol and shotgun, and their ammo. */
export const GUN_STORE_STOCK: readonly WeaponId[] = ['pistol', 'shotgun'];
export const GUN_STORE_AMMO: readonly AmmoId[] = ['9mm', '12g'];
