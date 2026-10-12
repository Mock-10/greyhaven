// Property catalogue (docs/09 "Housing" and "Hideout add-ons", Phase 5). The homes for sale are real houses on the
// map (art/source/downtown_map.py: the "sale_<id>" zones and the "park_<id>" driveways); the types carry the docs
// table's names (the numbers are in BALANCE.property). Industrial units and waterfront warehouses come with their districts (docs/15 Phase 6).

export type PropertyType = 'smallHouse' | 'familyHouse' | 'industrialUnit' | 'warehouse';

export interface PropertyTypeDef {
  name: string;
  district: string;
  /** The home's own interior (data/interiors.ts). */
  interior: 'home_small' | 'home_family' | null;
}

export const PROPERTY_TYPES: Record<PropertyType, PropertyTypeDef> = {
  smallHouse: {
    name: 'SMALL HOUSE',
    district: 'SUBURBS',
    interior: 'home_small',
  },
  familyHouse: {
    name: 'FAMILY HOUSE',
    district: 'SUBURBS',
    interior: 'home_family',
  },
  industrialUnit: {
    name: 'INDUSTRIAL UNIT',
    district: 'INDUSTRIAL',
    interior: null,
  },
  warehouse: {
    name: 'WATERFRONT WAREHOUSE',
    district: 'DOCKS',
    interior: null,
  },
};

/** The homes on the market: id = the map's house drop (its street number on Linden Avenue). */
export type HomeId = 'linden4' | 'linden10';

export interface HomeDef {
  id: HomeId;
  type: PropertyType;
  address: string;
  /** The map zone at the front door (the delivery drop of milestone 7). */
  door: string;
}

export const HOMES: Record<HomeId, HomeDef> = {
  linden4: { id: 'linden4', type: 'smallHouse', address: '4 LINDEN AVENUE', door: 'drop_4' },
  linden10: { id: 'linden10', type: 'familyHouse', address: '10 LINDEN AVENUE', door: 'drop_10' },
};

export const HOME_IDS = Object.keys(HOMES) as HomeId[];

export type AddonId = 'stashRoom' | 'garageBay' | 'workbench' | 'press' | 'chopBay' | 'lab' | 'crewRoom';

export interface AddonDef {
  name: string;
  effect: string;
  /** Built in this phase's milestones so far: the operations come in M16, the crew in M17. */
  ready: boolean;
}

export const ADDONS: Record<AddonId, AddonDef> = {
  stashRoom: { name: 'STASH ROOM', effect: '+20 STASH SLOTS. RAIDS NEVER FIND IT.', ready: true },
  garageBay: { name: 'GARAGE BAY', effect: '+2 PARKING', ready: true },
  workbench: { name: 'WORKBENCH', effect: 'CRAFT TOOLS. RESPRAY AT HOME.', ready: true },
  press: { name: 'COUNTERFEIT PRESS', effect: 'PRINTING OPERATION', ready: false },
  chopBay: { name: 'CHOP BAY', effect: 'CHOP SHOP OPERATION', ready: false },
  lab: { name: 'PRODUCT LAB', effect: 'LAB OPERATION', ready: false },
  crewRoom: { name: 'CREW ROOM', effect: 'NEEDED TO HIRE CREW (CAP 4)', ready: false },
};

export const ADDON_IDS = Object.keys(ADDONS) as AddonId[];
