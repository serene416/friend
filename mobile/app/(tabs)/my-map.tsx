
import KakaoMap from '@/components/KakaoMap';
import { useFavoriteStore } from '@/store/useFavoriteStore';
import { useRecommendationStore } from '@/store/useRecommendationStore';
import { formatDistanceKm, getDistanceKmFromCurrentLocation, getHotplaceImageUrl, mapSourceKeywordToPlayCategory, metersToKm } from '@/utils/recommendation';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MyMapScreen() {
    const router = useRouter();
    const { favorites } = useFavoriteStore();
    const recommendation = useRecommendationStore((state) => state.recommendation);
    const getHotplaceById = useRecommendationStore((state) => state.getHotplaceById);
    const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

    const markers = useMemo(() => {
        return favorites
            .map((favoriteId) => {
                const hotplace =
                    recommendation?.hotplaces.find((place) => place.kakao_place_id === favoriteId) ??
                    getHotplaceById(favoriteId);

                if (!hotplace || !hotplace.x || !hotplace.y) {
                    return null;
                }

                return {
                    id: favoriteId,
                    lat: Number(hotplace.y), // ensure number
                    lng: Number(hotplace.x),
                    title: hotplace.place_name,
                };
            })
            .filter((item): item is { id: string; lat: number; lng: number; title: string } => item !== null);
    }, [favorites, getHotplaceById, recommendation]);

    // Default center (Seoul City Hall) if no markers or current location
    const defaultCenter = {
        lat: recommendation?.currentLocation?.lat ?? 37.5665,
        lng: recommendation?.currentLocation?.lng ?? 126.9780
    };

    const selectedItem = useMemo(() => {
        if (!selectedMarkerId) return null;

        const hotplace =
            recommendation?.hotplaces.find((place) => place.kakao_place_id === selectedMarkerId) ??
            getHotplaceById(selectedMarkerId);

        if (!hotplace) return null;

        return {
            id: hotplace.kakao_place_id,
            title: hotplace.place_name,
            image: getHotplaceImageUrl(hotplace.kakao_place_id),
            distanceLabel: formatDistanceKm(
                getDistanceKmFromCurrentLocation(hotplace, recommendation?.currentLocation) ??
                metersToKm(hotplace.distance)
            ),
            category: mapSourceKeywordToPlayCategory(hotplace.source_keyword, hotplace.category_name),
        };
    }, [selectedMarkerId, recommendation, getHotplaceById]);


    if (!favorites || favorites.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>아직 관심 목록이 비어있어요.</Text>
                    <Text style={styles.emptySubText}>마음에 들었던 장소를 추가해보세요!</Text>
                </View>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>나의 지도</Text>
            </View>
            <View style={styles.mapContainer}>
                <KakaoMap
                    latitude={markers.length > 0 ? markers[0].lat : defaultCenter.lat}
                    longitude={markers.length > 0 ? markers[0].lng : defaultCenter.lng}
                    markers={markers}
                    onMarkerClick={setSelectedMarkerId}
                    onMapClick={() => setSelectedMarkerId(null)}
                />

                {selectedItem && (
                    <View style={styles.cardContainer}>
                        <TouchableOpacity
                            style={styles.card}
                            activeOpacity={0.9}
                            onPress={() => {
                                router.push(`/activity-detail?id=${encodeURIComponent(selectedItem.id)}`);
                            }}
                        >
                            <Image source={{ uri: selectedItem.image }} style={styles.cardImage} />
                            <View style={styles.cardContent}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardTitle} numberOfLines={1}>{selectedItem.title}</Text>
                                    <TouchableOpacity onPress={() => setSelectedMarkerId(null)}>
                                        <Ionicons name="close" size={20} color="#999" />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.cardMeta}>
                                    <Text style={styles.metaText}>{selectedItem.distanceLabel}</Text>
                                    <Text style={styles.metaText}>•</Text>
                                    <Text style={styles.metaText}>{selectedItem.category}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        alignItems: 'center', // Center content
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: 'Pretendard-Bold',
        color: '#000',
    },
    mapContainer: {
        flex: 1,
        position: 'relative',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 18,
        fontFamily: 'Pretendard-Bold',
        color: '#333',
        marginBottom: 10,
    },
    emptySubText: {
        fontSize: 14,
        fontFamily: 'Pretendard-Medium',
        color: '#888',
    },
    cardContainer: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        zIndex: 10,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
        flexDirection: 'row',
        overflow: 'hidden',
        height: 100,
    },
    cardImage: {
        width: 100,
        height: '100%',
        backgroundColor: '#eee',
    },
    cardContent: {
        flex: 1,
        padding: 15,
        justifyContent: 'center',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    cardTitle: {
        fontSize: 16,
        fontFamily: 'Pretendard-Bold',
        color: '#333',
        flex: 1,
        marginRight: 8,
    },
    cardMeta: {
        flexDirection: 'row',
    },
    metaText: {
        fontSize: 13,
        color: '#666',
        marginRight: 5,
        fontFamily: 'Pretendard-Medium',
    },
});
