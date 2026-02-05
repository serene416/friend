import { Coordinate, MidpointHotplace } from '@/types/recommendation';

const EARTH_RADIUS_KM = 6371;

export const PLAY_CATEGORIES = [
  '액티브 & 스포츠',
  '게임 & 소셜',
  '창작 & 클래스',
  '힐링 & 테마 카페',
  '문화 & 예술',
  '기록 & 쇼핑',
] as const;

const PREDEFINED_PLAY_KEYWORDS_BY_CATEGORY: Record<string, string[]> = {
  '액티브 & 스포츠': [
    '볼링장',
    '당구장',
    '포켓볼',
    '스크린야구',
    '스크린골프',
    '스크린테니스',
    '실내클라이밍',
    '양궁카페',
    '사격카페',
    '롤러스케이트장',
    '아이스링크',
    '탁구장',
    '풋살장',
  ],
  '게임 & 소셜': [
    '방탈출',
    '보드게임카페',
    '코인노래방',
    '노래연습장',
    'PC방',
    '오락실',
    '가챠샵',
    '홀덤펍',
    '마작카페',
    '레이싱카페',
  ],
  '창작 & 클래스': [
    '공방',
    '향수공방',
    '도자기공방',
    '가죽공방',
    '베이킹클래스',
    '원데이클래스',
    '반지공방',
    '목공소',
  ],
  '힐링 & 테마 카페': [
    '만화카페',
    '룸카페',
    '고양이카페',
    '강아지카페',
    '라쿤카페',
    '파충류카페',
    '드로잉카페',
    '심리상담카페',
    '족욕카페',
    '북카페',
    'LP바',
  ],
  '문화 & 예술': [
    '영화관',
    '미술관',
    '전시회',
    '박물관',
    '소극장',
    '독립영화관',
    '팝업스토어',
  ],
  '기록 & 쇼핑': [
    '인생네컷',
    '셀프사진관',
    '포토이즘',
    '포토그레이',
    '소품샵',
    '편집샵',
    '유니크샵',
    '플리마켓',
  ],
};

const normalizeKeyword = (keyword: string) =>
  keyword.trim().replace(/\s+/g, '').toLowerCase();

const KEYWORD_TO_CATEGORY = new Map<string, string>();
for (const [category, keywords] of Object.entries(PREDEFINED_PLAY_KEYWORDS_BY_CATEGORY)) {
  keywords.forEach((keyword) => KEYWORD_TO_CATEGORY.set(normalizeKeyword(keyword), category));
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const toRadians = (value: number) => (value * Math.PI) / 180;

const roundToOneDecimal = (value: number) => Math.round(value * 10) / 10;

const hasCoordinate = (value: Coordinate | null | undefined): value is Coordinate =>
  !!value && isFiniteNumber(value.lat) && isFiniteNumber(value.lng);

export const mapSourceKeywordToPlayCategory = (
  sourceKeyword?: string | null,
  fallbackCategory?: string | null
) => {
  if (sourceKeyword) {
    const mapped = KEYWORD_TO_CATEGORY.get(normalizeKeyword(sourceKeyword));
    if (mapped) {
      return mapped;
    }
  }

  const normalizedFallback = fallbackCategory?.trim();
  return normalizedFallback ? normalizedFallback : '기타';
};

export const getHotplaceImageUrl = (kakaoPlaceId: string) =>
  `https://picsum.photos/seed/midpoint-${encodeURIComponent(kakaoPlaceId)}/1200/800`;

export const calculateDistanceKm = (from: Coordinate, to: Coordinate) => {
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2) * Math.cos(fromLat) * Math.cos(toLat);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
};

export const getDistanceKmFromCurrentLocation = (
  hotplace: MidpointHotplace,
  currentLocation: Coordinate | null | undefined
) => {
  if (!hasCoordinate(currentLocation) || !isFiniteNumber(hotplace.y) || !isFiniteNumber(hotplace.x)) {
    return null;
  }

  return roundToOneDecimal(
    calculateDistanceKm(currentLocation, {
      lat: hotplace.y,
      lng: hotplace.x,
    })
  );
};

export const metersToKm = (distanceMeter?: number | null) => {
  if (!isFiniteNumber(distanceMeter)) {
    return null;
  }

  return roundToOneDecimal(distanceMeter / 1000);
};

export const formatDistanceKm = (distanceKm: number | null | undefined) => {
  if (!isFiniteNumber(distanceKm)) {
    return '거리 정보 없음';
  }

  return `${distanceKm.toFixed(1)}km`;
};
