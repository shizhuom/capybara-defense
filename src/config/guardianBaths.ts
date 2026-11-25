import type {MapId} from '../core/types';

/** Painted water centres; independent of the route's logical arrival cell. */
export interface GuardianBathSpot {
  x:number; y:number; size:number; rippleRx:number; rippleRy:number; orangeBaseY:number;
  /**
   * Painted water surface relative to the spot, fitted from the map art (P15: mean error 0.3-1.6px).
   * The soup is clipped to this ellipse grown by {@link WATER_CLIP_GROW}.
   */
  water:{x:number;y:number;rx:number;ry:number};
  /** Front tub rim overlay `tub_rim_<map>`: pixels copied 1:1 from the map, drawn at this stage rectangle. */
  rim:{dx:number;dy:number;dw:number;dh:number};
}
/** Grow the soup clip by one pixel so no painted spring water peeks out; the rim overlay trims the front edge. */
export const WATER_CLIP_GROW=1;
/** Capybara waterline, as a fraction of `size` below the spot: sides, and the extra front bulge at the chest. */
export const GUARDIAN_WATERLINE={side:.232,bulge:.03} as const;
// Measured by design/assets/tools/p15_tub_rims.py (see tools/p15_tub_rims.json).
export const GUARDIAN_BATH_SPOTS:Record<MapId,GuardianBathSpot>={
  sunny_backyard:{x:1053.5,y:531,size:74,rippleRx:31,rippleRy:14,orangeBaseY:-36,
    water:{x:-.17,y:8.47,rx:40.51,ry:38.67},rim:{dx:998,dy:520,dw:110,dh:85}},
  sakura_onsen:{x:263,y:490,size:90,rippleRx:40,rippleRy:18,orangeBaseY:-44,
    water:{x:3.11,y:2.46,rx:76.8,ry:70.92},rim:{dx:175,dy:464,dw:182,dh:126}},
  midnight_kitchen:{x:1055,y:323,size:80,rippleRx:34,rippleRy:15,orangeBaseY:-39,
    water:{x:-.07,y:8.51,rx:46.16,ry:46.05},rim:{dx:994,dy:310,dw:122,dh:94}},
  cat_tower_maze:{x:1054,y:325,size:74,rippleRx:31,rippleRy:14,orangeBaseY:-36,
    water:{x:.4,y:7.5,rx:39.35,ry:39.84},rim:{dx:1001,dy:313,dw:107,dh:86}},
};

/** Pixel-fitted guardian tub spots for the 10×4 hand-illustrated mobile wide-screen maps (enlarged capybara!). */
export const WIDE_GUARDIAN_BATH_SPOTS:Record<MapId,GuardianBathSpot>={
  sunny_backyard:{x:1184.6,y:455.4,size:118,rippleRx:36,rippleRy:14,orangeBaseY:-51,
    water:{x:.03,y:20,rx:43.09,ry:34.83},rim:{dx:1127,dy:457,dw:115,dh:80}},
  sakura_onsen:{x:176.8,y:458.5,size:130,rippleRx:40,rippleRy:16,orangeBaseY:-56,
    water:{x:0,y:20.01,rx:49.28,ry:40.96},rim:{dx:113,dy:459,dw:128,dh:87}},
  midnight_kitchen:{x:1177.1,y:350.4,size:118,rippleRx:36,rippleRy:16,orangeBaseY:-51,
    water:{x:-.01,y:20.02,rx:43.45,ry:42.45},rim:{dx:1119,dy:350,dw:116,dh:89}},
  cat_tower_maze:{x:1184.8,y:351,size:114,rippleRx:35,rippleRy:16,orangeBaseY:-49,
    water:{x:.02,y:20.02,rx:42.01,ry:41.3},rim:{dx:1128,dy:351,dw:113,dh:88}},
};
