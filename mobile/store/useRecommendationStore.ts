import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  Coordinate,
  MidpointHotplace,
  MidpointStation,
  RecommendationSnapshot,
} from '@/types/recommendation';

interface SetRecommendationPayload {
  midpoint: Coordinate;
  chosenStations: MidpointStation[];
  hotplaces: MidpointHotplace[];
  currentLocation?: Coordinate | null;
  receivedAt?: string;
}

interface RecommendationState {
  recommendation: RecommendationSnapshot | null;
  hotplaceCache: Record<string, MidpointHotplace>;
  setRecommendation: (payload: SetRecommendationPayload) => void;
  clearRecommendation: () => void;
  getHotplaceById: (id: string) => MidpointHotplace | undefined;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const normalizeCoordinate = (value?: Coordinate | null): Coordinate | null => {
  if (!value || !isFiniteNumber(value.lat) || !isFiniteNumber(value.lng)) {
    return null;
  }

  return {
    lat: value.lat,
    lng: value.lng,
  };
};

const normalizeStation = (station: MidpointStation): MidpointStation => ({
  ...station,
  distance: isFiniteNumber(station.distance) ? station.distance : null,
  x: isFiniteNumber(station.x) ? station.x : 0,
  y: isFiniteNumber(station.y) ? station.y : 0,
});

const normalizeHotplace = (hotplace: MidpointHotplace): MidpointHotplace => ({
  ...hotplace,
  distance: isFiniteNumber(hotplace.distance) ? hotplace.distance : null,
  x: isFiniteNumber(hotplace.x) ? hotplace.x : 0,
  y: isFiniteNumber(hotplace.y) ? hotplace.y : 0,
});

export const useRecommendationStore = create<RecommendationState>()(
  persist(
    (set, get) => ({
      recommendation: null,
      hotplaceCache: {},
      setRecommendation: ({ midpoint, chosenStations, hotplaces, currentLocation, receivedAt }) =>
        set((state) => {
          const normalizedMidpoint = normalizeCoordinate(midpoint) ?? { lat: 0, lng: 0 };
          const normalizedCurrentLocation = normalizeCoordinate(currentLocation);
          const normalizedStations = chosenStations.map(normalizeStation);
          const normalizedHotplaces = hotplaces
            .filter((hotplace) => !!hotplace?.kakao_place_id)
            .map(normalizeHotplace);

          const nextCache = { ...state.hotplaceCache };
          normalizedHotplaces.forEach((hotplace) => {
            nextCache[hotplace.kakao_place_id] = hotplace;
          });

          return {
            recommendation: {
              midpoint: normalizedMidpoint,
              chosenStations: normalizedStations,
              hotplaces: normalizedHotplaces,
              currentLocation: normalizedCurrentLocation,
              receivedAt: receivedAt ?? new Date().toISOString(),
            },
            hotplaceCache: nextCache,
          };
        }),
      clearRecommendation: () => set({ recommendation: null }),
      getHotplaceById: (id) => get().hotplaceCache[id],
    }),
    {
      name: 'recommendation-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
