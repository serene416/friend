import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import {
  ImageBackground,
  ImageSourcePropType,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

type PhotoCollectionStatus = 'PENDING' | 'READY' | 'EMPTY' | 'FAILED' | null | undefined;
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface CategoryMockImageProps {
  category?: string | null;
  sourceKeyword?: string | null;
  photoCollectionStatus?: PhotoCollectionStatus;
  photoCollectionReason?: string | null;
  style?: StyleProp<ViewStyle>;
}

interface MockVisual {
  icon: IconName;
  label: string;
  image: ImageSourcePropType;
}

const PHOTO_COLLECTION_REASON_LABELS: Record<string, string> = {
  no_candidates: '네이버 장소를 찾지 못했어요',
  low_confidence: '장소 매칭 정확도가 낮아요',
  search_error: '검색 중 오류가 발생했어요',
  missing_place_name: '장소 이름 정보가 부족해요',
  missing_naver_place_id: '네이버 장소 ID를 찾지 못했어요',
  crawler_error: '크롤러 실행 중 오류가 발생했어요',
  naver_target_unavailable: '대상 페이지 접근이 불가능해요',
  crawl_skipped: '크롤러가 대상을 건너뛰었어요',
  crawler_partial_error: '수집 중 일부 단계에서 오류가 있었어요',
};

const MOCK_VISUALS: { tokens: string[]; visual: MockVisual }[] = [
  {
    tokens: ['pc', '피시', '컴퓨터'],
    visual: {
      icon: 'desktop-classic',
      label: 'PC 라운지 무드',
      image: require('../assets/mock/pc.jpg'),
    },
  },
  {
    tokens: ['노래', '코인노래', 'karaoke', 'mic'],
    visual: {
      icon: 'microphone',
      label: '노래방 무드',
      image: require('../assets/mock/karaoke.jpg'),
    },
  },
  {
    tokens: ['볼링', '당구', '포켓볼', '클라이밍', '풋살', '탁구', '양궁', '사격', '스포츠'],
    visual: {
      icon: 'basketball',
      label: '액티브 플레이 무드',
      image: require('../assets/mock/active.jpg'),
    },
  },
  {
    tokens: ['영화', '미술', '전시', '박물', '극장', '아트', '문화'],
    visual: {
      icon: 'movie-open',
      label: '문화/예술 무드',
      image: require('../assets/mock/culture.jpg'),
    },
  },
  {
    tokens: ['공방', '클래스', '베이킹', '향수', '도자기', '가죽', '목공', '반지'],
    visual: {
      icon: 'palette',
      label: '클래스/체험 무드',
      image: require('../assets/mock/class.jpg'),
    },
  },
  {
    tokens: ['카페', '룸카페', '만화카페', '고양이', '강아지', '라쿤', '북카페', 'lp'],
    visual: {
      icon: 'coffee',
      label: '카페 무드',
      image: require('../assets/mock/cafe.jpg'),
    },
  },
  {
    tokens: ['인생네컷', '사진', '포토', '소품', '편집샵', '쇼핑', '플리마켓'],
    visual: {
      icon: 'camera',
      label: '기록/쇼핑 무드',
      image: require('../assets/mock/photo.jpg'),
    },
  },
  {
    tokens: ['게임', '오락', '방탈출', '보드게임', '가챠', '마작', '홀덤'],
    visual: {
      icon: 'gamepad-variant',
      label: '게임/소셜 무드',
      image: require('../assets/mock/game.jpg'),
    },
  },
];

const DEFAULT_VISUAL: MockVisual = {
  icon: 'map-marker-star',
  label: '추천 활동 무드',
  image: require('../assets/mock/default.jpg'),
};

const normalizeForTokenMatch = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();

const resolveMockVisual = (category?: string | null, sourceKeyword?: string | null): MockVisual => {
  const source = normalizeForTokenMatch(`${sourceKeyword ?? ''} ${category ?? ''}`);
  if (!source) {
    return DEFAULT_VISUAL;
  }

  const matched = MOCK_VISUALS.find(({ tokens }) =>
    tokens.some((token) => source.includes(normalizeForTokenMatch(token)))
  );
  return matched?.visual ?? DEFAULT_VISUAL;
};

const resolveFallbackDescription = (
  status?: PhotoCollectionStatus,
  reason?: string | null
): string => {
  if (status === 'FAILED') {
    if (reason) {
      return PHOTO_COLLECTION_REASON_LABELS[reason] ?? '실사진 수집에 실패해 카테고리 목업을 표시했어요';
    }
    return '실사진 수집에 실패해 카테고리 목업을 표시했어요';
  }
  if (status === 'EMPTY') {
    return '실사진이 없어 카테고리 목업을 표시했어요';
  }
  return '실사진 준비 중이라 카테고리 목업을 표시했어요';
};

export default function CategoryMockImage({
  category,
  sourceKeyword,
  photoCollectionStatus,
  photoCollectionReason,
  style,
}: CategoryMockImageProps) {
  const visual = resolveMockVisual(category, sourceKeyword);
  const description = resolveFallbackDescription(photoCollectionStatus, photoCollectionReason);

  return (
    <ImageBackground source={visual.image} style={[styles.container, style]} imageStyle={styles.photo}>
      <View style={styles.photoDimmer} />
      <View style={styles.decorationLarge} />
      <View style={styles.decorationSmall} />

      <View style={styles.centerContent}>
        <View style={styles.iconBubble}>
          <MaterialCommunityIcons name={visual.icon} size={42} color='rgba(255,255,255,0.95)' />
        </View>
        <Text style={styles.categoryLabel}>{visual.label}</Text>
      </View>

      <View style={styles.footerBadge}>
        <MaterialCommunityIcons name='image-off-outline' size={14} color='rgba(255,255,255,0.9)' />
        <Text numberOfLines={2} style={styles.footerText}>
          {description}
        </Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  photo: {
    resizeMode: 'cover',
  },
  photoDimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.24)',
  },
  decorationLarge: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -50,
    right: -20,
  },
  decorationSmall: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.10)',
    bottom: -30,
    left: -20,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 10,
  },
  iconBubble: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(255,255,255,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Pretendard-Bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.34)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.92)',
    fontFamily: 'Pretendard-Medium',
    flex: 1,
    lineHeight: 14,
  },
});
