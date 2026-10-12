// Every art-pack atlas bundled into the build. Vite fingerprints the PNGs and serves them under the
// `/greyhaven/` base; the JSON is bundled into the code, so nothing is fetched from another origin.

import buildingsPng from '../../art/buildings.png';
import buildingsJson from '../../art/buildings.json';
import buildings2Png from '../../art/buildings2.png';
import buildings2Json from '../../art/buildings2.json';
import cityPng from '../../art/city.png';
import cityJson from '../../art/city.json';
import groundPng from '../../art/ground.png';
import inApartmentPng from '../../art/interiors/apartment.png';
import inApartmentJson from '../../art/interiors/apartment.json';
import inStorePng from '../../art/interiors/store.png';
import inStoreJson from '../../art/interiors/store.json';
import inLobbyPng from '../../art/interiors/tower_lobby.png';
import inLobbyJson from '../../art/interiors/tower_lobby.json';
import inOfficePng from '../../art/interiors/office_floor.png';
import inOfficeJson from '../../art/interiors/office_floor.json';
import inBarPng from '../../art/interiors/bar.png';
import inBarJson from '../../art/interiors/bar.json';
import inHardwarePng from '../../art/interiors/hardware.png';
import inHardwareJson from '../../art/interiors/hardware.json';
import inClothingPng from '../../art/interiors/clothing.png';
import inClothingJson from '../../art/interiors/clothing.json';
import inDealerPng from '../../art/interiors/dealer.png';
import inDealerJson from '../../art/interiors/dealer.json';
import inGaragePng from '../../art/interiors/garage.png';
import inGarageJson from '../../art/interiors/garage.json';
import inDepotPng from '../../art/interiors/depot.png';
import inDepotJson from '../../art/interiors/depot.json';
import inSiteTrailerPng from '../../art/interiors/site_trailer.png';
import inSiteTrailerJson from '../../art/interiors/site_trailer.json';
import inBungalowPng from '../../art/interiors/house_bungalow.png';
import inBungalowJson from '../../art/interiors/house_bungalow.json';
import inFamilyPng from '../../art/interiors/house_family.png';
import inFamilyJson from '../../art/interiors/house_family.json';
import inTownhousePng from '../../art/interiors/house_townhouse.png';
import inTownhouseJson from '../../art/interiors/house_townhouse.json';
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
import playerPng from '../../art/player.png';
import playerJson from '../../art/player.json';
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
  // the palette-swap player (art/source/pack_player.py): repainted at runtime in the player's look (playerLook.ts)
  player: { url: playerPng, json: playerJson as unknown as AtlasJson },
  vehicles: { url: vehiclesPng, json: vehiclesJson as unknown as AtlasJson },
  interactables: { url: interactablesPng, json: interactablesJson as unknown as AtlasJson },
  city: { url: cityPng, json: cityJson as unknown as AtlasJson },
  // interiors (art/source/export_interiors.py): every piece anchored at the room origin or its ground point
  in_apartment: { url: inApartmentPng, json: inApartmentJson as unknown as AtlasJson },
  in_store: { url: inStorePng, json: inStoreJson as unknown as AtlasJson },
  in_tower_lobby: { url: inLobbyPng, json: inLobbyJson as unknown as AtlasJson },
  in_office_floor: { url: inOfficePng, json: inOfficeJson as unknown as AtlasJson },
  in_bar: { url: inBarPng, json: inBarJson as unknown as AtlasJson },
  in_hardware: { url: inHardwarePng, json: inHardwareJson as unknown as AtlasJson },
  in_clothing: { url: inClothingPng, json: inClothingJson as unknown as AtlasJson },
  in_dealer: { url: inDealerPng, json: inDealerJson as unknown as AtlasJson },
  in_garage: { url: inGaragePng, json: inGarageJson as unknown as AtlasJson },
  in_depot: { url: inDepotPng, json: inDepotJson as unknown as AtlasJson },
  in_site_trailer: { url: inSiteTrailerPng, json: inSiteTrailerJson as unknown as AtlasJson },
  in_house_bungalow: { url: inBungalowPng, json: inBungalowJson as unknown as AtlasJson },
  in_house_family: { url: inFamilyPng, json: inFamilyJson as unknown as AtlasJson },
  in_house_townhouse: { url: inTownhousePng, json: inTownhouseJson as unknown as AtlasJson },
} as const;

/** Ground material swatches for vector-ground maps (art/ground.png, read as pixels, not drawn as frames). */
export const GROUND_SWATCHES_URL: string = groundPng;

export type AtlasKey = keyof typeof ATLASES;
export const ATLAS_KEYS = Object.keys(ATLASES) as AtlasKey[];
