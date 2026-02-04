
import KakaoMap from '@/components/KakaoMap';
import { useFavoriteStore } from '@/store/useFavoriteStore';
import { useRecommendationStore } from '@/store/useRecommendationStore';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MyMapScreen() {
    const { favorites } = useFavoriteStore();
    const recommendation = useRecommendationStore((state) => state.recommendation);
    const getHotplaceById = useRecommendationStore((state) => state.getHotplaceById);

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
                    lat: Number(hotplace.y), // ensure number
                    lng: Number(hotplace.x),
                    title: hotplace.place_name,
                };
            })
            .filter((item): item is { lat: number; lng: number; title: string } => item !== null);
    }, [favorites, getHotplaceById, recommendation]);

    // Default center (Seoul City Hall) if no markers or current location
    const defaultCenter = {
        lat: recommendation?.currentLocation?.lat ?? 37.5665,
        lng: recommendation?.currentLocation?.lng ?? 126.9780
    };

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
                />
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
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: 'Pretendard-Bold',
        color: '#000',
    },
    mapContainer: {
        flex: 1,
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
    }
});
