import KakaoMap from '@/components/KakaoMap';
import { MOCK_ACTIVITIES } from '@/constants/data';
import { useFavoriteStore } from '@/store/useFavoriteStore';
import { useRecommendationStore } from '@/store/useRecommendationStore';
import {
  formatDistanceKm,
  getDistanceKmFromCurrentLocation,
  getHotplaceImageUrl,
  mapSourceKeywordToPlayCategory,
  metersToKm,
} from '@/utils/recommendation';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const parseIdParam = (value: string | string[] | undefined) => {
  const raw = typeof value === 'string' ? value : Array.isArray(value) ? value[0] : '';
  if (!raw) {
    return '';
  }

  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
};

export default function ActivityDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const activityId = useMemo(() => parseIdParam(id), [id]);

  const { toggleFavorite, isFavorite } = useFavoriteStore();
  const recommendation = useRecommendationStore((state) => state.recommendation);
  const getHotplaceById = useRecommendationStore((state) => state.getHotplaceById);
  const [isOpeningPlaceUrl, setIsOpeningPlaceUrl] = useState(false);
  const [showFavoritePopup, setShowFavoritePopup] = useState(false);

  const hotplaceFromLatest = useMemo(
    () => recommendation?.hotplaces.find((place) => place.kakao_place_id === activityId),
    [activityId, recommendation?.hotplaces]
  );
  const hotplace = hotplaceFromLatest ?? (activityId ? getHotplaceById(activityId) : undefined);
  const activity = useMemo(
    () => MOCK_ACTIVITIES.find((item) => item.id === activityId),
    [activityId]
  );

  const currentLocation = recommendation?.currentLocation ?? null;
  const category = hotplace
    ? mapSourceKeywordToPlayCategory(hotplace.source_keyword, hotplace.category_name)
    : activity?.tags?.[0] ?? '기타';

  const distanceKm = hotplace
    ? getDistanceKmFromCurrentLocation(hotplace, currentLocation) ?? metersToKm(hotplace.distance)
    : activity?.distance ?? null;

  const title = hotplace?.place_name ?? activity?.title ?? '활동 정보 없음';
  const heroImage = hotplace
    ? getHotplaceImageUrl(hotplace.kakao_place_id)
    : activity?.image ?? getHotplaceImageUrl(`fallback-${activityId || 'unknown'}`);

  const highlightItems = hotplace
    ? [
      {
        icon: 'train',
        text: hotplace.source_station ? `${hotplace.source_station} 인근 추천` : '중앙 위치 기반 추천',
      },
      {
        icon: 'map-marker-radius',
        text: formatDistanceKm(distanceKm),
      },
      {
        icon: 'tag',
        text: hotplace.source_keyword || category,
      },
    ]
    : activity?.highlights ?? [];

  const tags = hotplace
    ? [category, hotplace.source_keyword, hotplace.category_name].filter(
      (tag): tag is string => typeof tag === 'string' && tag.trim().length > 0
    )
    : activity?.tags ?? [];

  const description = hotplace
    ? `${title}은(는) 친구들과의 중간 지점을 기준으로 추천된 장소예요. 카테고리: ${category}.`
    : activity?.description ?? '활동 정보를 준비 중입니다.';

  const handleOpenPlaceUrl = useCallback(async () => {
    if (!hotplace?.place_url) {
      return;
    }

    setIsOpeningPlaceUrl(true);
    try {
      const canOpen = await Linking.canOpenURL(hotplace.place_url);
      if (!canOpen) {
        Alert.alert('안내', '장소 링크를 열 수 없습니다.');
        return;
      }
      await Linking.openURL(hotplace.place_url);
    } catch {
      Alert.alert('오류', '링크를 여는 중 문제가 발생했어요.');
    } finally {
      setIsOpeningPlaceUrl(false);
    }
  }, [hotplace?.place_url]);

  if (!activityId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>잘못된 접근이에요.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>뒤로가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!hotplace && !activity) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>활동을 찾을 수 없습니다.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>뒤로가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: heroImage }} style={styles.heroImage} />
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() => {
              if (!isFavorite(activityId)) {
                setShowFavoritePopup(true);
                setTimeout(() => setShowFavoritePopup(false), 3000);
              }
              toggleFavorite(activityId);
            }}
          >
            <MaterialCommunityIcons
              name={isFavorite(activityId) ? 'heart' : 'heart-outline'}
              size={28}
              color={isFavorite(activityId) ? '#FF4B4B' : '#fff'}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name='map-marker' size={20} color='#666' />
              <Text style={styles.metaText}>{formatDistanceKm(distanceKm)}</Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name='tag' size={20} color='#666' />
              <Text style={styles.metaText}>{category}</Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons
                name={hotplace ? 'map-search' : 'clock-outline'}
                size={20}
                color='#666'
              />
              <Text style={styles.metaText}>
                {hotplace ? hotplace.source_station : activity?.time ?? '정보 없음'}
              </Text>
            </View>
          </View>

          <View style={styles.tagsContainer}>
            {tags.map((tag, index) => (
              <View key={`tag-${index}`} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>활동 소개</Text>
            <Text style={styles.description}>{description}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>주요 포인트</Text>
            {highlightItems.map((item, index) => (
              <View key={index} style={styles.highlightItem}>
                <MaterialCommunityIcons name={item.icon as any} size={20} color='#666' />
                <Text style={styles.highlightText}>{item.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>위치 및 경로</Text>
              {hotplace?.place_url && (
                <TouchableOpacity
                  style={styles.locationButton}
                  onPress={handleOpenPlaceUrl}
                  disabled={isOpeningPlaceUrl}
                >
                  <Text style={styles.locationButtonText}>
                    {isOpeningPlaceUrl ? '열는 중...' : '카카오 장소 링크'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.mapPlaceholder}>
              {hotplace ? (
                <KakaoMap latitude={hotplace.y} longitude={hotplace.x} />
              ) : (
                <View style={styles.mapPlaceholderContent}>
                  <MaterialCommunityIcons name='map' size={60} color='#ccc' />
                  <Text style={styles.mapPlaceholderText}>추천 장소 지도는 추천 후 확인할 수 있어요</Text>
                  <Text style={styles.mapPlaceholderSubtext}>친구 선택 후 추천을 받아보세요</Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.ctaButton}>
            <Text style={styles.ctaButtonText}>친구 초대하고 함께 가기</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Favorite Popup */}
      {showFavoritePopup && (
        <View style={styles.popupContainer}>
          <View style={styles.popupContent}>
            <Text style={styles.popupText}>관심목록에 추가했어요.</Text>
            <TouchableOpacity
              onPress={() => {
                setShowFavoritePopup(false);
                router.push('/favorites' as any);
              }}
            >
              <Text style={styles.popupLink}>관심 목록으로 바로보기 &gt;</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  notFoundText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 12,
    fontFamily: 'Pretendard-Bold',
  },
  backButton: {
    backgroundColor: '#333',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  backButtonText: {
    color: '#fff',
    fontFamily: 'Pretendard-Medium',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 300,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#eee',
  },
  favoriteButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 1,
    // backgroundColor: 'rgba(0,0,0,0.3)', // Removed dark background
    // borderRadius: 20,
    padding: 8,
  },
  infoContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Pretendard-Bold',
    marginBottom: 16,
    color: '#333',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Pretendard-Medium',
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 12,
    color: '#555',
    fontFamily: 'Pretendard-Bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-Bold',
    marginBottom: 12,
    color: '#333',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  locationButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#333',
  },
  locationButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    fontFamily: 'Pretendard-Medium',
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    paddingVertical: 8,
  },
  highlightText: {
    fontSize: 14,
    color: '#555',
    fontFamily: 'Pretendard-Medium',
    flex: 1,
  },
  mapPlaceholder: {
    width: '100%',
    height: 300,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  mapPlaceholderContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    fontFamily: 'Pretendard-Bold',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  mapPlaceholderSubtext: {
    fontSize: 12,
    color: '#bbb',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontFamily: 'Pretendard-Medium',
  },
  ctaButton: {
    backgroundColor: '#333',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 30,
  },
  ctaButtonText: {
    fontSize: 16,
    fontFamily: "Pretendard-Bold",
    color: "#fff",
  },
  popupContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  popupContent: {
    backgroundColor: 'rgba(30, 30, 30, 0.9)',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  popupText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
  },
  popupLink: {
    color: '#FF4B4B',
    fontSize: 14,
    fontFamily: 'Pretendard-Bold',
    marginLeft: 10,
  },
});
