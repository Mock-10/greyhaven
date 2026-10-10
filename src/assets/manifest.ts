// Every art-pack atlas bundled into the build. Vite fingerprints the PNGs and serves them under the
// `/greyhaven/` base; the JSON is bundled into the code, so nothing is fetched from another origin.

import buildingsPng from '../../art/buildings.png';
import buildingsJson from '../../art/buildings.json';
import charactersPng from '../../art/characters.png';
import charactersJson from '../../art/characters.json';
import interactablesPng from '../../art/interactables.png';
import interactablesJson from '../../art/interactables.json';
import propsPng from '../../art/props.png';
import propsJson from '../../art/props.json';
import tilesVarPng from '../../art/tiles_var.png';
import tilesVarJson from '../../art/tiles_var.json';
import vehiclesPng from '../../art/vehicles.png';
import vehiclesJson from '../../art/vehicles.json';
import type { AtlasJson } from './atlasFormat';

export const ATLASES = {
  tiles: { url: tilesVarPng, json: tilesVarJson as unknown as AtlasJson },
  buildings: { url: buildingsPng, json: buildingsJson as unknown as AtlasJson },
  props: { url: propsPng, json: propsJson as unknown as AtlasJson },
  characters: { url: charactersPng, json: charactersJson as unknown as AtlasJson },
  vehicles: { url: vehiclesPng, json: vehiclesJson as unknown as AtlasJson },
  interactables: { url: interactablesPng, json: interactablesJson as unknown as AtlasJson },
} as const;

export type AtlasKey = keyof typeof ATLASES;
export const ATLAS_KEYS = Object.keys(ATLASES) as AtlasKey[];
