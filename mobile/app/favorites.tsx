import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CategoryMockImage from '../components/CategoryMockImage';
import { Activity, MOCK_ACTIVITIES } from '../constants/data';
import { useFavoriteStore } from '../store/useFavoriteStore';
import { useRecommendationStore } from '../store/useRecommendationStore';
import {
  formatDistanceKm,
  getDistanceKmFromCurrentLocation,
  mapSourceKeywordToPlayCategory,
  metersToKm,
} from '../utils/recommendation';

interface FavoriteHotplaceItem {
  kind: 'hotplace';
  id: string;
  title: string;
  image: string | null;
  distanceLabel: string;
  category: string;
  sourceKeyword: string;
  photoCollectionStatus?: 'PENDING' | 'READY' | 'EMPTY' | 'FAILED';
  photoCollectionReason?: string | null;
}

type FavoriteItem = (Activity & { kind: 'mock' }) | FavoriteHotplaceItem;

export default function FavoritesScreen() {
  const router = useRouter();
  const { favorites, toggleFavorite } = useFavoriteStore();
  const recommendation = useRecommendationStore((state) => state.recommendation);
  const getHotplaceById = useRecommendationStore((state) => state.getHotplaceById);
  const [failedHotplaceImageMap, setFailedHotplaceImageMap] = useState<Record<string, true>>({});

  const favoriteItems = useMemo<FavoriteItem[]>(() => {
    const mockById = new Map(MOCK_ACTIVITIES.map((activity) => [activity.id, activity]));

    return favorites
      .map((favoriteId): FavoriteItem | null => {
        const mockActivity = mockById.get(favoriteId);
        if (mockActivity) {
          return {
            ...mockActivity,
            kind: 'mock' as const,
          };
        }

        const hotplace =
          recommendation?.hotplaces.find((place) => place.kakao_place_id === favoriteId) ??
          getHotplaceById(favoriteId);

        if (!hotplace) {
          return null;
        }

        const distanceKm =
          getDistanceKmFromCurrentLocation(hotplace, recommendation?.currentLocation) ??
          metersToKm(hotplace.distance);

        return {
          kind: 'hotplace' as const,
          id: hotplace.kakao_place_id,
          title: hotplace.place_name,
          image: hotplace.representative_image_url ?? hotplace.photo_urls?.[0] ?? null,
          distanceLabel: formatDistanceKm(distanceKm),
          category: mapSourceKeywordToPlayCategory(hotplace.source_keyword, hotplace.category_name),
          sourceKeyword: hotplace.source_keyword,
          photoCollectionStatus: hotplace.photo_collection_status ?? 'PENDING',
          photoCollectionReason: hotplace.photo_collection_reason ?? null,
        };
      })
      .filter((item): item is FavoriteItem => item !== null);
  }, [favorites, getHotplaceById, recommendation]);

  const renderItem = ({ item }: { item: FavoriteItem }) => {
    if (item.kind === 'hotplace') {
      const tags = Array.from(new Set([item.category, item.sourceKeyword].filter(Boolean)));
      const shouldRenderImage = Boolean(item.image) && !failedHotplaceImageMap[item.id];
      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push(`/activity-detail?id=${encodeURIComponent(item.id)}`)}
        >
          {shouldRenderImage ? (
            <Image
              source={{ uri: item.image as string }}
              style={styles.cardImage}
              onError={() =>
                setFailedHotplaceImageMap((previous) => ({ ...previous, [item.id]: true }))
              }
            />
          ) : (
            <CategoryMockImage
              style={styles.cardImage}
              category={item.category}
              sourceKeyword={item.sourceKeyword}
              photoCollectionStatus={item.photoCollectionStatus}
              photoCollectionReason={item.photoCollectionReason}
            />
          )}
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <TouchableOpacity
                onPress={() => toggleFavorite(item.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons
                  name="heart"
                  size={24}
                  color="#FF4B4B"
                />
              </TouchableOpacity>
            </View>
            <View style={styles.cardMeta}>
              <Text style={styles.metaText}>{item.distanceLabel}</Text>
              <Text style={styles.metaText}>•</Text>
              <Text style={styles.metaText}>{item.category}</Text>
            </View>
            <View style={styles.tags}>
              {tags.map((tag) => (
                <View key={`${item.id}-${tag}`} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </TouchableOpacity >
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
              onPress={() => toggleFavorite(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons
                name="heart"
                size={24}
                color="#FF4B4B"
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
              <View key={`${item.id}-${index}`} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={favoriteItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name='heart-outline' size={64} color='#ccc' />
            <Text style={styles.emptyText}>아직 관심 있는 활동이 없어요.</Text>
            <Text style={styles.emptySubText}>마음에 드는 활동에 하트를 눌러보세요!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcfcfc' },
  listContent: { padding: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#e8b6b6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
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
    paddingHorizontal: 16,
  },
  cardImagePlaceholderText: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Pretendard-Medium',
  },
  cardImagePlaceholderTextFailed: {
    color: '#B91C1C',
    fontFamily: 'Pretendard-Bold',
  },
  cardImagePlaceholderSubText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Pretendard-Medium',
    textAlign: 'center',
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
  cardMeta: { flexDirection: 'row', marginBottom: 10 },
  metaText: { fontSize: 14, color: '#666', marginRight: 5, fontFamily: 'Pretendard-Medium' },
  tags: { flexDirection: 'row', flexWrap: 'wrap' },
  tag: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 4,
  },
  tagText: { fontSize: 12, color: '#555', fontFamily: 'Pretendard-Medium' },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    marginTop: 20,
    fontSize: 18,
    fontFamily: 'Pretendard-Bold',
    color: '#666',
  },
  emptySubText: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    color: '#999',
  },
});
