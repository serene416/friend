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
  phone?: string | null;
  x: number;
  y: number;
  distance?: number | null;
  source_station: string;
  source_keyword: string;
  representative_image_url?: string | null;
  photo_urls?: string[];
  naver_rating?: number | null;
  naver_rating_count?: number | null;
  photo_collection_status?: 'PENDING' | 'READY' | 'EMPTY' | 'FAILED';
  photo_collection_reason?: string | null;
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
