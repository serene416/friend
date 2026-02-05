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

const toOptionalRating = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0 || value > 5) {
    return null;
  }
  return Math.round(value * 10) / 10;
};

const toOptionalPositiveInt = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : null;
};

const normalizePhotoCollectionStatus = (
  value: unknown
): 'PENDING' | 'READY' | 'EMPTY' | 'FAILED' => {
  if (typeof value !== 'string') {
    return 'PENDING';
  }
  const normalized = value.toUpperCase();
  if (normalized === 'READY' || normalized === 'EMPTY' || normalized === 'FAILED') {
    return normalized;
  }
  return 'PENDING';
};

const normalizePhotoCollectionReason = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

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

const normalizeHotplace = (hotplace: MidpointHotplace): MidpointHotplace => {
  const photoUrls = Array.isArray(hotplace.photo_urls)
    ? Array.from(
      new Set(
        hotplace.photo_urls
          .filter((url): url is string => typeof url === 'string' && url.startsWith('http'))
          .map((url) => url.trim())
          .filter((url) => url.length > 0)
      )
    ).slice(0, 5)
    : [];

  const representative =
    typeof hotplace.representative_image_url === 'string' &&
      hotplace.representative_image_url.startsWith('http')
      ? hotplace.representative_image_url
      : photoUrls[0] ?? null;
  const photoCollectionStatus = normalizePhotoCollectionStatus(hotplace.photo_collection_status);

  return {
    ...hotplace,
    distance: isFiniteNumber(hotplace.distance) ? hotplace.distance : null,
    x: isFiniteNumber(hotplace.x) ? hotplace.x : 0,
    y: isFiniteNumber(hotplace.y) ? hotplace.y : 0,
    photo_urls: photoUrls,
    representative_image_url: representative,
    naver_rating: toOptionalRating(hotplace.naver_rating),
    naver_rating_count: toOptionalPositiveInt(hotplace.naver_rating_count),
    photo_collection_status: photoUrls.length > 0 ? 'READY' : photoCollectionStatus,
    photo_collection_reason: normalizePhotoCollectionReason(hotplace.photo_collection_reason),
  };
};

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
