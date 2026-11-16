import type {MapId} from '../core/types';

/** Painted water centres; independent of the route's logical arrival cell. */
export interface GuardianBathSpot {
  x:number; y:number; size:number; rippleRx:number; rippleRy:number; orangeBaseY:number;
}
export const GUARDIAN_BATH_SPOTS:Record<MapId,GuardianBathSpot>={
  sunny_backyard:{x:1053.5,y:531,size:74,rippleRx:31,rippleRy:14,orangeBaseY:-36},
  sakura_onsen:{x:263,y:490,size:90,rippleRx:40,rippleRy:18,orangeBaseY:-44},
  midnight_kitchen:{x:1055,y:323,size:80,rippleRx:34,rippleRy:15,orangeBaseY:-39},
  cat_tower_maze:{x:1054,y:325,size:74,rippleRx:31,rippleRy:14,orangeBaseY:-36},
};
