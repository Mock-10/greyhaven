// Every art-pack atlas bundled into the build. Vite fingerprints the PNGs and serves them under the
// `/greyhaven/` base; the JSON is bundled into the code, so nothing is fetched from another origin.

import buildingsPng from '../../art/buildings.png';
import buildingsJson from '../../art/buildings.json';
import buildings2Png from '../../art/buildings2.png';
import buildings2Json from '../../art/buildings2.json';
import cityPng from '../../art/city.png';
import cityJson from '../../art/city.json';
import groundPng from '../../art/ground.png';
import charactersPng from '../../art/characters.png';
import charactersJson from '../../art/characters.json';
import stepsPng from '../../art/characters_steps.png';
import stepsJson from '../../art/characters_steps.json';
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
  buildings2: { url: buildings2Png, json: buildings2Json as unknown as AtlasJson },
  props: { url: propsPng, json: propsJson as unknown as AtlasJson },
  characters: { url: charactersPng, json: charactersJson as unknown as AtlasJson },
  steps: { url: stepsPng, json: stepsJson as unknown as AtlasJson },
  vehicles: { url: vehiclesPng, json: vehiclesJson as unknown as AtlasJson },
  interactables: { url: interactablesPng, json: interactablesJson as unknown as AtlasJson },
  city: { url: cityPng, json: cityJson as unknown as AtlasJson },
} as const;

/** Ground material swatches for vector-ground maps (art/ground.png, read as pixels, not drawn as frames). */
export const GROUND_SWATCHES_URL: string = groundPng;

export type AtlasKey = keyof typeof ATLASES;
export const ATLAS_KEYS = Object.keys(ATLASES) as AtlasKey[];
