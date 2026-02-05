import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FriendSelector from '../../components/FriendSelector';
import { Activity } from '../../constants/data';
import { useCurrentWeather } from '../../hooks/useCurrentWeather';
import { useFavoriteStore } from '../../store/useFavoriteStore';
import { useFriendStore } from '../../store/useFriendStore';
import { useRecommendationStore } from '../../store/useRecommendationStore';
import {
  formatDistanceKm,
  getDistanceKmFromCurrentLocation,
  mapSourceKeywordToPlayCategory,
  metersToKm,
  PLAY_CATEGORIES,
} from '../../utils/recommendation';

interface HotplaceCardItem {
  kind: 'hotplace';
  id: string;
  title: string;
  image?: string | null;
  distanceLabel: string;
  category: string;
  sourceKeyword: string;
  naverRating?: number | null;
  naverRatingCount?: number | null;
  photoCollectionStatus?: 'PENDING' | 'READY' | 'EMPTY' | 'FAILED';
  photoCollectionReason?: string | null;
}

type HomeCardItem = (Activity & { kind: 'mock' }) | HotplaceCardItem;
type PlayCategoryFilter = (typeof PLAY_CATEGORIES)[number];

const WEATHER_THEMES: Record<string, { bg: string; text: string; border?: string }> = {
  맑음: { bg: '#81CFEF', text: '#FFFFFF' },
  구름많음: { bg: '#A8D8EA', text: '#FFFFFF' },
  흐림: { bg: '#90AFC5', text: '#FFFFFF' },
  눈: { bg: '#F8B1C0', text: '#FFFFFF' },
  비: { bg: '#7692AD', text: '#FFFFFF' },
  default: { bg: '#fff0f3', text: '#1A1A1A' },
};

const WEATHER_BG_IMAGES: Record<string, any> = {
  맑음: require('../../assets/weather/sun_bg.png'),
  구름많음: require('../../assets/weather/cloudy_sun_bg.png'),
  흐림: require('../../assets/weather/cloudy_bg.png'),
  눈: require('../../assets/weather/snow_bg.png'),
  비: require('../../assets/weather/rain_bg.png'),
  default: require('../../assets/weather/sun_bg.png'),
};

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

export default function HomeScreen() {
  const router = useRouter();

  const { data, loading, error, permissionDenied } = useCurrentWeather();
  const { toggleFavorite, isFavorite, favorites } = useFavoriteStore();
  const { selectedFriends } = useFriendStore();
  const [showFavoritePopup, setShowFavoritePopup] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PlayCategoryFilter | null>(null);
  const recommendation = useRecommendationStore((state) => state.recommendation);

  const isNoPrecipitation = data?.precipitationType === '없음';
  const weatherStatusText = isNoPrecipitation
    ? `현재 하늘: ${data?.skyLabel ?? data?.weatherLabel ?? '알수없음'}`
    : data?.precipitationType ?? '알수없음';

  const getWeatherKey = (label: string): string => {
    if (!label) return 'default';
    if (['비', '빗방울', '비/눈', '빗방울눈날림'].includes(label)) return '비';
    if (['눈', '눈날림'].includes(label)) return '눈';
    if (['맑음', '구름많음', '흐림'].includes(label)) return label;
    return 'default';
  };

  const weatherKey = data ? getWeatherKey(data.weatherLabel) : 'default';

  const getWeatherBackground = () => {
    return WEATHER_BG_IMAGES[weatherKey] || WEATHER_BG_IMAGES.default;
  };

  const currentTheme = WEATHER_THEMES[weatherKey] || WEATHER_THEMES.default;

  const formatValue = (value: number | null, suffix: string) =>
    value === null ? '-' : `${value}${suffix}`;

  const getPhotoPlaceholderMeta = (
    status: HotplaceCardItem['photoCollectionStatus'],
    reason: HotplaceCardItem['photoCollectionReason']
  ) => {
    if (status === 'FAILED') {
      return {
        icon: 'alert-circle-outline' as const,
        iconColor: '#DC2626',
        title: '사진 수집 실패',
        subtitle: reason ? PHOTO_COLLECTION_REASON_LABELS[reason] ?? `실패 사유: ${reason}` : null,
      };
    }
    if (status === 'EMPTY') {
      return {
        icon: 'image-outline' as const,
        iconColor: '#9DA3AF',
        title: '수집된 장소 사진이 없어요',
        subtitle: null,
      };
    }
    return {
      icon: 'clock-outline' as const,
      iconColor: '#9DA3AF',
      title: '사진 수집 대기 중',
      subtitle: null,
    };
  };

  const hotplaceItems = useMemo<HotplaceCardItem[]>(() => {
    if (!recommendation?.hotplaces?.length) {
      return [];
    }

    const sortedHotplaces = [...recommendation.hotplaces].sort((a, b) => {
      const aRankingScore = typeof a.ranking_score === 'number' ? a.ranking_score : null;
      const bRankingScore = typeof b.ranking_score === 'number' ? b.ranking_score : null;
      if (aRankingScore !== null && bRankingScore !== null && aRankingScore !== bRankingScore) {
        return bRankingScore - aRankingScore;
      }
      if (aRankingScore !== null && bRankingScore === null) {
        return -1;
      }
      if (aRankingScore === null && bRankingScore !== null) {
        return 1;
      }

      const aDistance = getDistanceKmFromCurrentLocation(a, recommendation.currentLocation) ?? metersToKm(a.distance);
      const bDistance = getDistanceKmFromCurrentLocation(b, recommendation.currentLocation) ?? metersToKm(b.distance);
      if (aDistance !== null && bDistance !== null && aDistance !== bDistance) {
        return aDistance - bDistance;
      }
      if (aDistance !== null && bDistance === null) {
        return -1;
      }
      if (aDistance === null && bDistance !== null) {
        return 1;
      }

      return a.kakao_place_id.localeCompare(b.kakao_place_id);
    });

    return sortedHotplaces.map((hotplace) => {
      const distanceKm =
        getDistanceKmFromCurrentLocation(hotplace, recommendation.currentLocation) ??
        metersToKm(hotplace.distance);

      return {
        kind: 'hotplace',
        id: hotplace.kakao_place_id,
        title: hotplace.place_name,
        image:
          hotplace.representative_image_url ??
          hotplace.photo_urls?.[0] ??
          null,
        distanceLabel: formatDistanceKm(distanceKm),
        category: mapSourceKeywordToPlayCategory(
          hotplace.source_keyword,
          hotplace.category_name
        ),
        sourceKeyword: hotplace.source_keyword,
        naverRating: hotplace.naver_rating ?? null,
        naverRatingCount: hotplace.naver_rating_count ?? null,
        photoCollectionStatus: hotplace.photo_collection_status ?? 'PENDING',
        photoCollectionReason: hotplace.photo_collection_reason ?? null,
      };
    });
  }, [recommendation]);

  const filteredHotplaceItems = useMemo(() => {
    if (!selectedCategory) {
      return hotplaceItems;
    }
    return hotplaceItems.filter((item) => item.category === selectedCategory);
  }, [hotplaceItems, selectedCategory]);

  const recommendationItems = selectedFriends.length > 0 ? filteredHotplaceItems : [];

  const renderItem = ({ item }: { item: HomeCardItem }) => {
    if (item.kind === 'hotplace') {
      const tags = Array.from(new Set([item.category, item.sourceKeyword].filter(Boolean)));
      const placeholder = getPhotoPlaceholderMeta(item.photoCollectionStatus, item.photoCollectionReason);
      const isFailedPhotoCollection = item.photoCollectionStatus === 'FAILED';

      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push(`/activity-detail?id=${encodeURIComponent(item.id)}`)}
        >
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.cardImage} />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              <MaterialCommunityIcons name={placeholder.icon} size={32} color={placeholder.iconColor} />
              <Text style={[
                styles.cardImagePlaceholderText,
                isFailedPhotoCollection && styles.cardImagePlaceholderTextFailed,
              ]}>
                {placeholder.title}
              </Text>
              {placeholder.subtitle ? (
                <Text style={[
                  styles.cardImagePlaceholderSubText,
                  isFailedPhotoCollection && styles.cardImagePlaceholderSubTextFailed,
                ]}>
                  {placeholder.subtitle}
                </Text>
              ) : null}
            </View>
          )}
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <TouchableOpacity
                onPress={() => {
                  if (!isFavorite(item.id)) {
                    setShowFavoritePopup(true);
                    setTimeout(() => setShowFavoritePopup(false), 3000);
                  }
                  toggleFavorite(item.id);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons
                  name={isFavorite(item.id) ? "heart" : "heart-outline"}
                  size={24}
                  color={isFavorite(item.id) ? "#FF4B4B" : "#ccc"}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.cardMeta}>
              <Text style={styles.metaText}>{item.distanceLabel}</Text>
              <Text style={styles.metaText}>•</Text>
              <Text style={styles.metaText}>{item.category}</Text>
              {(typeof item.naverRating === 'number' || typeof item.naverRatingCount === 'number') && (
                <>
                  <Text style={styles.metaText}>•</Text>
                  <View style={styles.ratingMeta}>
                    {typeof item.naverRating === 'number' && (
                      <MaterialCommunityIcons name='star' size={14} color='#F59E0B' />
                    )}
                    <Text style={styles.metaText}>
                      {typeof item.naverRating === 'number'
                        ? `${item.naverRating.toFixed(1)}${typeof item.naverRatingCount === 'number'
                          ? ` (${item.naverRatingCount.toLocaleString()}명)`
                          : ''
                        }`
                        : `평점 참여 ${item.naverRatingCount?.toLocaleString()}명`}
                    </Text>
                  </View>
                </>
              )}
            </View>
            <View style={styles.tags}>
              {tags.map((tag) => (
                <View key={`${item.id}-${tag}`} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/activity-detail?id=${encodeURIComponent(item.id)}`)}
      >
        <Image source={{ uri: item.image }} style={styles.cardImage} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <TouchableOpacity
              onPress={() => {
                if (!isFavorite(item.id)) {
                  setShowFavoritePopup(true);
                  setTimeout(() => setShowFavoritePopup(false), 3000);
                }
                toggleFavorite(item.id);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons
                name={isFavorite(item.id) ? "heart" : "heart-outline"}
                size={24}
                color={isFavorite(item.id) ? "#FF4B4B" : "#ccc"}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.metaText}>{item.distance}km</Text>
            <Text style={styles.metaText}>•</Text>
            <Text style={styles.metaText}>{item.headcount}</Text>
            <Text style={styles.metaText}>•</Text>
            <Text style={styles.metaText}>{item.time}</Text>
          </View>
          <View style={styles.tags}>
            {item.tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </TouchableOpacity >
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={recommendationItems}
        extraData={favorites}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          selectedFriends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>오늘 누구랑 놀까요? 친구를 선택해보세요! 🥳</Text>
            </View>
          ) : selectedCategory ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {selectedCategory} 카테고리 추천이 아직 없어요.
              </Text>
              <Text style={styles.emptySubText}>다른 카테고리를 선택해보세요.</Text>
            </View>
          ) : null
        }
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.headerTitle}> 오늘 뭐할래? </Text>
            </View>

            <View style={styles.weatherCard}>
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 24,
                  overflow: 'hidden',
                }}
              >
                <Image
                  source={data ? getWeatherBackground() : WEATHER_BG_IMAGES.default}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode='cover'
                />
              </View>

              <View style={{ zIndex: 1 }}>
                {loading && (
                  <Text style={[styles.weatherDesc, { color: currentTheme.text }]}>날씨 불러오는 중...</Text>
                )}
                {!loading && permissionDenied && (
                  <Text style={[styles.weatherDesc, { color: currentTheme.text }]}>위치 권한이 필요합니다. 설정에서 권한을 허용해주세요.</Text>
                )}
                {!loading && !permissionDenied && error && (
                  <Text style={[styles.weatherDesc, { color: currentTheme.text }]}>날씨 오류: {error}</Text>
                )}
                {!loading && !permissionDenied && !error && data && (
                  <View style={styles.weatherContainer}>
                    <View style={styles.weatherInfo}>
                      <Text style={[styles.weatherTemp, { color: currentTheme.text }]}>
                        {formatValue(data.temperature, '°C')}
                      </Text>
                      <Text style={[styles.weatherStatus, { color: currentTheme.text }]}>
                        {weatherStatusText}
                      </Text>
                      {!isNoPrecipitation && data.weatherLabel !== data.precipitationType && (
                        <Text style={[styles.weatherLabel, { color: currentTheme.text }]}>현재 하늘: {data.weatherLabel}</Text>
                      )}
                      <View style={styles.weatherSubInfo}>
                        <Text
                          style={[
                            styles.weatherDetailText,
                            { color: currentTheme.text, opacity: 0.9 },
                          ]}
                        >
                          습도 {formatValue(data.humidity, '%')}
                        </Text>
                        <Text
                          style={[
                            styles.weatherDetailText,
                            { color: currentTheme.text, opacity: 0.9 },
                          ]}
                        >
                          강수량 {data.precipitation1h}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.selectorContainer}>
              <FriendSelector
                currentLocation={data ? { lat: data.latitude, lng: data.longitude } : undefined}
                weatherKey={weatherKey}
              />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {hotplaceItems.length > 0 ? '위치 기반 추천 활동' : '오늘의 추천 활동'}
              </Text>
              {selectedFriends.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryFilterScroll}
                  contentContainerStyle={styles.categoryFilterContent}
                >
                  {PLAY_CATEGORIES.map((category) => {
                    const isSelected = selectedCategory === category;
                    return (
                      <TouchableOpacity
                        key={category}
                        style={[
                          styles.categoryChip,
                          isSelected && styles.categoryChipSelected,
                        ]}
                        onPress={() =>
                          setSelectedCategory((previous) =>
                            previous === category ? null : category
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            isSelected && styles.categoryChipTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {category}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>
          </>
        }
      />
      {/* Favorite Popup */}
      {showFavoritePopup && (
        <View style={styles.popupContainer}>
          <View style={styles.popupContent}>
            <Text style={styles.popupText}>관심목록에 추가했어요.</Text>
            <TouchableOpacity onPress={() => {
              setShowFavoritePopup(false);
              router.push('/favorites' as any);
            }}>
              <Text style={styles.popupLink}>관심목록 보기</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
  header: { marginTop: 10, marginBottom: 20 },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Pretendard-Black',
    color: '#000',
    letterSpacing: -1,
  },
  weatherCard: {
    backgroundColor: '#fff0f3',
    padding: 16,
    borderRadius: 24,
    marginBottom: 20,
  },
  weatherContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherInfo: {
    flex: 1,
  },
  weatherTemp: {
    fontSize: 24,
    fontFamily: 'Pretendard-Bold',
    lineHeight: 32,
  },
  weatherStatus: {
    fontSize: 16,
    color: '#4A4A4A',
    fontFamily: 'Pretendard-Bold',
    marginBottom: 4,
  },
  weatherLabel: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    marginBottom: 6,
  },
  weatherSubInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  weatherDesc: { fontSize: 14, color: '#666', fontFamily: 'Pretendard-Medium' },
  weatherDetailText: {
    fontSize: 13,
    color: '#7A7A7A',
    fontFamily: 'Pretendard-Medium',
  },
  selectorContainer: { marginBottom: 25 },
  sectionHeader: {
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Pretendard-Bold',
    flexShrink: 0,
  },
  categoryFilterScroll: {
    flex: 1,
  },
  categoryFilterContent: {
    alignItems: 'center',
    paddingLeft: 4,
  },
  categoryChip: {
    marginLeft: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#F4F4F5',
  },
  categoryChipSelected: {
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#4B5563',
    fontFamily: 'Pretendard-Medium',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'Pretendard-Bold',
  },
  listContent: { paddingBottom: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#e8b6b6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: '#eee',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cardImagePlaceholderText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Pretendard-Medium',
  },
  cardImagePlaceholderTextFailed: {
    color: '#B91C1C',
    fontFamily: 'Pretendard-Bold',
  },
  cardImagePlaceholderSubText: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'Pretendard-Medium',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  cardImagePlaceholderSubTextFailed: {
    color: '#991B1B',
  },
  cardContent: { padding: 15 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-Bold',
    flex: 1,
    marginRight: 8,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  metaText: {
    fontSize: 14,
    color: '#666',
    marginRight: 5,
    fontFamily: 'Pretendard-Medium',
  },
  ratingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap' },
  tag: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 4,
  },
  tagText: { fontSize: 12, color: "#555", fontFamily: "Pretendard-Medium" },
  popupContainer: {
    position: 'absolute',
    bottom: 30, // Above tab bar if present, or just bottom
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  popupContent: {
    backgroundColor: 'rgba(30, 30, 30, 0.9)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    shadowColor: "#e8b6b6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
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
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#aaa',
    fontFamily: 'Pretendard-Medium',
    textAlign: 'center',
  },
  emptySubText: {
    marginTop: 6,
    fontSize: 13,
    color: '#b3b3b3',
    fontFamily: 'Pretendard-Medium',
  },
});
