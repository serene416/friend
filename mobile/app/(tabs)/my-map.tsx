
import KakaoMap from '@/components/KakaoMap';
import { useFavoriteStore } from '@/store/useFavoriteStore';
import { useRecommendationStore } from '@/store/useRecommendationStore';
import {
    formatDistanceKm,
    getDistanceKmFromCurrentLocation,
    getHotplaceImageUrl,
    mapSourceKeywordToPlayCategory,
    metersToKm,
} from '@/utils/recommendation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function MyMapScreen() {
    const router = useRouter();
    const { favorites } = useFavoriteStore();
    const recommendation = useRecommendationStore((state) => state.recommendation);
    const getHotplaceById = useRecommendationStore((state) => state.getHotplaceById);
    const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
    const bottomSheetRef = useRef<BottomSheet>(null);

    // Snap points: collapsed (half screen) -> full
    const snapPoints = useMemo(() => ['50%', '90%'], []);

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
                    lat: Number(hotplace.y),
                    lng: Number(hotplace.x),
                    title: hotplace.place_name,
                };
            })
            .filter((item): item is { id: string; lat: number; lng: number; title: string } => item !== null);
    }, [favorites, getHotplaceById, recommendation]);

    const defaultCenter = {
        lat: recommendation?.currentLocation?.lat ?? 37.5665,
        lng: recommendation?.currentLocation?.lng ?? 126.9780,
    };

    const selectedItem = useMemo(() => {
        if (!selectedMarkerId) return null;

        const hotplace =
            recommendation?.hotplaces.find((place) => place.kakao_place_id === selectedMarkerId) ??
            getHotplaceById(selectedMarkerId);

        if (!hotplace) return null;

        const distanceKm =
            getDistanceKmFromCurrentLocation(hotplace, recommendation?.currentLocation) ??
            metersToKm(hotplace.distance);

        return {
            id: hotplace.kakao_place_id,
            title: hotplace.place_name,
            image: getHotplaceImageUrl(hotplace.kakao_place_id),
            distanceLabel: formatDistanceKm(distanceKm),
            category: mapSourceKeywordToPlayCategory(hotplace.source_keyword, hotplace.category_name),
            address: hotplace.address_name || hotplace.road_address_name || '주소 정보 없음',
            phone: hotplace.phone || '전화번호 정보 없음',
            sourceStation: hotplace.source_station,
            sourceKeyword: hotplace.source_keyword,
        };
    }, [selectedMarkerId, recommendation, getHotplaceById]);

    const handleMarkerClick = useCallback((id: string) => {
        setSelectedMarkerId(id);
    }, []);

    const handleMapClick = useCallback(() => {
        setSelectedMarkerId(null);
    }, []);

    if (!favorites || favorites.length === 0) {
        return (
            <GestureHandlerRootView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>나의 지도</Text>
                </View>
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>아직 관심 목록이 비어있어요.</Text>
                    <Text style={styles.emptySubText}>마음에 들었던 장소를 추가해보세요!</Text>
                </View>
            </GestureHandlerRootView>
        );
    }

    // Detail helper variables derived similar to ActivityDetailScreen
    const description = selectedItem
        ? `${selectedItem.title}은(는) 친구들과의 중간 지점을 기준으로 추천된 장소예요. 카테고리: ${selectedItem.category}.`
        : '';

    const highlightItems = selectedItem
        ? [
            {
                icon: 'train',
                text: selectedItem.sourceStation ? `${selectedItem.sourceStation} 인근 추천` : '중앙 위치 기반 추천',
            },
            {
                icon: 'map-marker-radius',
                text: selectedItem.distanceLabel,
            },
            {
                icon: 'tag',
                text: selectedItem.sourceKeyword || selectedItem.category,
            },
        ]
        : [];

    return (
        <GestureHandlerRootView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>나의 지도</Text>
            </View>
            <View style={styles.mapContainer}>
                <KakaoMap
                    latitude={markers.length > 0 ? markers[0].lat : defaultCenter.lat}
                    longitude={markers.length > 0 ? markers[0].lng : defaultCenter.lng}
                    markers={markers}
                    onMarkerClick={handleMarkerClick}
                    onMapClick={handleMapClick}
                />
            </View>

            {selectedItem && (
                <BottomSheet
                    ref={bottomSheetRef}
                    index={0}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    onClose={() => setSelectedMarkerId(null)}
                    backgroundStyle={styles.sheetBackground}
                    handleIndicatorStyle={styles.sheetIndicator}
                >
                    <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
                        {/* Hero Image */}
                        <Image source={{ uri: selectedItem.image }} style={styles.sheetImage} />

                        <View style={styles.sheetInfo}>
                            {/* Title & Heart */}
                            <View style={styles.titleContainer}>
                                <Text style={styles.sheetTitle}>{selectedItem.title}</Text>
                                {/* Heart icon logic could be added here if needed, keeping simple for now */}
                            </View>

                            {/* Meta Row */}
                            <View style={styles.sheetMeta}>
                                <View style={styles.metaItem}>
                                    <MaterialCommunityIcons name="map-marker" size={16} color="#666" />
                                    <Text style={styles.metaText}>{selectedItem.distanceLabel}</Text>
                                </View>
                                <View style={styles.metaItem}>
                                    <MaterialCommunityIcons name="tag" size={16} color="#666" />
                                    <Text style={styles.metaText}>{selectedItem.category}</Text>
                                </View>
                            </View>

                            {/* Activity Intro Section */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>활동 소개</Text>
                                <Text style={styles.description}>{description}</Text>
                            </View>

                            {/* Highlights Section */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>주요 포인트</Text>
                                {highlightItems.map((item, index) => (
                                    <View key={index} style={styles.highlightItem}>
                                        <MaterialCommunityIcons name={item.icon as any} size={20} color="#666" />
                                        <Text style={styles.highlightText}>{item.text}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Location Info Section */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>상세 정보</Text>
                                {/* Address */}
                                <View style={styles.infoRow}>
                                    <MaterialCommunityIcons name="map-marker-outline" size={18} color="#888" />
                                    <Text style={styles.infoText}>{selectedItem.address}</Text>
                                </View>
                                {/* Phone */}
                                <View style={styles.infoRow}>
                                    <MaterialCommunityIcons name="phone-outline" size={18} color="#888" />
                                    <Text style={styles.infoText}>{selectedItem.phone}</Text>
                                </View>
                            </View>
                        </View>
                    </BottomSheetScrollView>
                </BottomSheet>
            )}
        </GestureHandlerRootView>
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
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
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
    },
    sheetBackground: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    sheetIndicator: {
        backgroundColor: '#ccc',
        width: 40,
    },
    sheetContent: {
        paddingBottom: 40,
    },
    sheetImage: {
        width: '100%',
        height: 200,
        backgroundColor: '#eee',
    },
    sheetInfo: {
        padding: 20,
    },
    titleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sheetTitle: {
        fontSize: 22,
        fontFamily: 'Pretendard-Bold',
        color: '#333',
        flex: 1,
    },
    sheetMeta: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 14,
        color: '#666',
        fontFamily: 'Pretendard-Medium',
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
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    infoText: {
        fontSize: 14,
        color: '#555',
        fontFamily: 'Pretendard-Medium',
        flex: 1,
    },
});
