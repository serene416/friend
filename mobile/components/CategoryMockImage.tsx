import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import {
  ImageBackground,
  ImageSourcePropType,
  StyleProp,
  StyleSheet,
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
  image: ImageSourcePropType;
}

const MOCK_VISUALS: { tokens: string[]; visual: MockVisual }[] = [
  {
    tokens: ['pc', '피시', '컴퓨터'],
    visual: {
      icon: 'desktop-classic',
      image: require('../assets/mock/pc.jpg'),
    },
  },
  {
    tokens: ['노래', '코인노래', 'karaoke', 'mic'],
    visual: {
      icon: 'microphone',
      image: require('../assets/mock/karaoke.jpg'),
    },
  },
  {
    tokens: ['볼링', '당구', '포켓볼', '클라이밍', '풋살', '탁구', '양궁', '사격', '스포츠'],
    visual: {
      icon: 'basketball',
      image: require('../assets/mock/active.jpg'),
    },
  },
  {
    tokens: ['영화', '미술', '전시', '박물', '극장', '아트', '문화'],
    visual: {
      icon: 'movie-open',
      image: require('../assets/mock/culture.jpg'),
    },
  },
  {
    tokens: ['공방', '클래스', '베이킹', '향수', '도자기', '가죽', '목공', '반지'],
    visual: {
      icon: 'palette',
      image: require('../assets/mock/class.jpg'),
    },
  },
  {
    tokens: ['카페', '룸카페', '만화카페', '고양이', '강아지', '라쿤', '북카페', 'lp'],
    visual: {
      icon: 'coffee',
      image: require('../assets/mock/cafe.jpg'),
    },
  },
  {
    tokens: ['인생네컷', '사진', '포토', '소품', '편집샵', '쇼핑', '플리마켓'],
    visual: {
      icon: 'camera',
      image: require('../assets/mock/photo.jpg'),
    },
  },
  {
    tokens: ['게임', '오락', '방탈출', '보드게임', '가챠', '마작', '홀덤'],
    visual: {
      icon: 'gamepad-variant',
      image: require('../assets/mock/game.jpg'),
    },
  },
];

const DEFAULT_VISUAL: MockVisual = {
  icon: 'map-marker-star',
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

export default function CategoryMockImage({
  category,
  sourceKeyword,
  style,
}: CategoryMockImageProps) {
  const visual = resolveMockVisual(category, sourceKeyword);

  return (
    <ImageBackground source={visual.image} style={[styles.container, style]} imageStyle={styles.photo}>
      <View style={styles.photoDimmer} />
      <View style={styles.decorationLarge} />
      <View style={styles.decorationSmall} />

      <View style={styles.centerContent}>
        <View style={styles.iconBubble}>
          <MaterialCommunityIcons name={visual.icon} size={42} color='rgba(255,255,255,0.95)' />
        </View>
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
  },
  iconBubble: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(255,255,255,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
