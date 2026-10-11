// Downtown ("The Ledger"), the Phase 1 test district: 48 × 48 tiles of vector ground (docs/14).
//
// The map is authored in art/source/downtown_map.py, which writes downtown.json (ground shapes, placements,
// doors, street spans, spawn) and renders the approved drafts in art/drafts/downtown/ from the same data.
// Don't edit the JSON by hand: change the Python and re-run it (then art/source/pack_city.py for new art).
//
// It is a test map with one of each kind of place close together, not the final city (docs/01).

import data from './downtown.json';
import type { MapData } from './types';

export const DOWNTOWN = data as unknown as MapData;
