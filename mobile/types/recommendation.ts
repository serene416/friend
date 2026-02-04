export interface Coordinate {
  lat: number;
  lng: number;
}

export interface MidpointStation {
  kakao_place_id: string;
  station_name: string;
  original_name: string;
  category_name?: string | null;
  address_name?: string | null;
  road_address_name?: string | null;
  place_url?: string | null;
  x: number;
  y: number;
  distance?: number | null;
}

export interface MidpointHotplace {
  kakao_place_id: string;
  place_name: string;
  category_name?: string | null;
  address_name?: string | null;
  road_address_name?: string | null;
  place_url?: string | null;
  x: number;
  y: number;
  distance?: number | null;
  source_station: string;
  source_keyword: string;
}

export interface MidpointHotplaceResponse {
  midpoint: Coordinate;
  chosen_stations: MidpointStation[];
  hotplaces: MidpointHotplace[];
}

export interface RecommendationSnapshot {
  midpoint: Coordinate;
  chosenStations: MidpointStation[];
  hotplaces: MidpointHotplace[];
  currentLocation: Coordinate | null;
  receivedAt: string;
}
