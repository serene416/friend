import { MidpointHotplaceResponse } from '@/types/recommendation';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getBackendUrl } from '../constants/api';
import { useAuthStore } from '../store/useAuthStore';
import { useFriendStore } from '../store/useFriendStore';
import { useRecommendationStore } from '../store/useRecommendationStore';

const BACKEND_URL = getBackendUrl();

interface FriendSelectorProps {
    currentLocation?: { lat: number; lng: number };
    weatherKey?: string;
}

export default function FriendSelector({ currentLocation, weatherKey }: FriendSelectorProps) {
    const { friends, selectedFriends, toggleFriendSelection, loadFriends } = useFriendStore();
    const setRecommendation = useRecommendationStore((state) => state.setRecommendation);
    const user = useAuthStore((state) => state.user);
    const [modalVisible, setModalVisible] = useState(false);
    const [midpointText, setMidpointText] = useState('친구를 2명 이상 선택하면 중앙 위치를 계산해요.');
    const [loadingMidpoint, setLoadingMidpoint] = useState(false);
    const [resultLocation, setResultLocation] = useState<string | null>(null);
    const midpointRequestInFlight = useRef(false);

    const selectedCount = selectedFriends.length;
    const selectedFriendProfiles = useMemo(
        () => friends.filter((friend) => selectedFriends.includes(friend.id)),
        [friends, selectedFriends]
    );
    const participants = useMemo(() => {
        const friendLocations = selectedFriendProfiles
            .filter(
                (friend) =>
                    typeof friend.latitude === 'number' &&
                    typeof friend.longitude === 'number'
            )
            .map((friend) => ({ lat: friend.latitude as number, lng: friend.longitude as number }));

        if (currentLocation) {
            return [currentLocation, ...friendLocations];
        }
        return friendLocations;
    }, [selectedFriendProfiles, currentLocation]);

    useEffect(() => {
        if (!modalVisible) {
            return;
        }

        if (participants.length < 2) {
            setLoadingMidpoint(false);
            setMidpointText('친구를 선택하거나 내 위치를 확인해주세요 (최소 2인 필요).');
            return;
        }

        setMidpointText('완료를 누르면 중앙 위치를 계산해요.');
        setResultLocation(null);
    }, [modalVisible, participants.length]);

    const fetchMidpoint = async () => {
        if (participants.length < 2) {
            setMidpointText('친구를 선택하거나 내 위치를 확인해주세요 (최소 2인 필요).');
            return false;
        }

        if (loadingMidpoint || midpointRequestInFlight.current) {
            return false;
        }

        setLoadingMidpoint(true);
        midpointRequestInFlight.current = true;
        let resolvedParticipants = participants;
        if (resolvedParticipants.length < 2 && user?.id) {
            try {
                await loadFriends(user.id);
                const refreshedFriends = useFriendStore.getState().friends;
                const refreshedParticipants = refreshedFriends
                    .filter((friend) => selectedFriends.includes(friend.id))
                    .filter(
                        (friend) =>
                            typeof friend.latitude === 'number' &&
                            typeof friend.longitude === 'number'
                    )
                    .map((friend) => ({ lat: friend.latitude as number, lng: friend.longitude as number }));
                resolvedParticipants = currentLocation
                    ? [currentLocation, ...refreshedParticipants]
                    : refreshedParticipants;
            } catch {
                // Keep original participant set and show fallback message below.
            }
        }

        if (resolvedParticipants.length < 2) {
            setMidpointText('선택한 친구의 위치 정보가 부족해요. 마이페이지에서 위치를 최신화한 뒤 다시 시도해주세요.');
            setLoadingMidpoint(false);
            return false;
        }

        try {
            const response = await fetch(`${BACKEND_URL}/api/v1/recommend/midpoint-hotplaces`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    participants: resolvedParticipants,
                    weather_key: typeof weatherKey === 'string' && weatherKey.trim() ? weatherKey.trim() : undefined,
                }),
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => ({}));
                const detail =
                    typeof errorPayload?.detail === 'string'
                        ? errorPayload.detail
                        : '중앙 위치를 불러오지 못했어요.';
                throw new Error(
                    `검색 중 일부 항목 실패 시 전체 요청이 중단돼요. 잠시 후 다시 시도해주세요. (${detail})`
                );
            }

            const data: MidpointHotplaceResponse = await response.json();
            if (
                !data?.midpoint ||
                typeof data.midpoint.lat !== 'number' ||
                typeof data.midpoint.lng !== 'number' ||
                !Array.isArray(data.hotplaces)
            ) {
                throw new Error('추천 응답 형식이 올바르지 않아요.');
            }

            setRecommendation({
                midpoint: data.midpoint,
                chosenStations: Array.isArray(data.chosen_stations) ? data.chosen_stations : [],
                hotplaces: data.hotplaces,
                currentLocation: currentLocation ?? null,
                receivedAt: new Date().toISOString(),
            });

            const station = data.chosen_stations?.[0];
            if (station) {
                const locationText = station.original_name || station.station_name;
                setMidpointText(`대략적인 중앙 위치: ${locationText} 근처`);
                setResultLocation(locationText);
            } else {
                const locationText = `${data.midpoint.lat.toFixed(4)}, ${data.midpoint.lng.toFixed(4)}`;
                setMidpointText(
                    `대략적인 중앙 좌표: ${locationText}`
                );
                setResultLocation(locationText);
            }
            return true;
        } catch (error: any) {
            console.error('[FriendSelector] midpoint-hotplaces request failed', error);
            setMidpointText(error?.message || '중앙 위치를 불러오지 못했어요.');
            return false;
        } finally {
            setLoadingMidpoint(false);
            midpointRequestInFlight.current = false;
        }
    };

    const handleCompletePress = async () => {
        // If less than 2 participants (e.g. just user or 0), just close the modal
        // because calculation is impossible and user likely wants to exit.
        if (participants.length < 2) {
            setModalVisible(false);
            return;
        }

        const succeeded = await fetchMidpoint();
        if (succeeded) {
            setModalVisible(false);
        }
    };

    return (
        <View>
            <TouchableOpacity style={styles.button} onPress={() => setModalVisible(true)}>
                <Text style={styles.buttonText}>
                    {resultLocation
                        ? resultLocation
                        : (selectedCount > 0 ? `친구 ${selectedCount}명과 함께` : '함께 놀 친구를 선택하세요')
                    }
                </Text>
            </TouchableOpacity>

            <Modal visible={modalVisible} animationType="slide" transparent>
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setModalVisible(false)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        style={styles.modalContent}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={styles.header}>
                            <Text style={styles.title}>친구 선택</Text>
                            <TouchableOpacity onPress={handleCompletePress} disabled={loadingMidpoint}>
                                <Text style={[styles.closeText, loadingMidpoint && styles.closeTextDisabled]}>
                                    {loadingMidpoint ? '계산중...' : '완료'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.midpointBox}>
                            <Text style={styles.midpointLabel}>중앙 위치</Text>
                            <Text style={styles.midpointText}>
                                {loadingMidpoint ? '중앙 위치 계산 중...' : midpointText}
                            </Text>
                        </View>

                        <FlatList
                            data={friends}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => {
                                const isSelected = selectedFriends.includes(item.id);
                                return (
                                    <TouchableOpacity
                                        style={styles.item}
                                        onPress={() => toggleFriendSelection(item.id)}
                                    >
                                        <Image source={{ uri: item.avatar }} style={styles.avatar} />
                                        <View style={styles.info}>
                                            <Text style={styles.name}>{item.name}</Text>
                                            <Text style={styles.status}>
                                                {item.statusMessage ? item.statusMessage : '상태메시지가 없습니다.'}
                                            </Text>
                                            <Text style={styles.location}>
                                                {item.locationName ? item.locationName : '위치 정보가 없습니다.'}
                                            </Text>
                                        </View>
                                        <View style={[styles.checkbox, isSelected && styles.checked]}>
                                            {isSelected && <Text style={styles.checkMark}>✓</Text>}
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    button: { backgroundColor: '#f0f0f0', padding: 12, borderRadius: 10, alignItems: 'center' },
    buttonText: { fontSize: 14, fontFamily: 'Pretendard-Medium', color: '#333' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '70%', padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    midpointBox: {
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 14,
        backgroundColor: '#F3F8FF',
        borderWidth: 1,
        borderColor: '#D8E6FF',
    },
    midpointLabel: { fontSize: 12, color: '#2C4A7D', fontFamily: 'Pretendard-Bold', marginBottom: 4 },
    midpointText: { fontSize: 14, color: '#1D2A3A', fontFamily: 'Pretendard-Medium' },
    title: { fontSize: 20, fontFamily: 'Pretendard-Bold' },
    closeText: { fontSize: 16, color: '#007AFF', fontFamily: 'Pretendard-Bold' },
    closeTextDisabled: { color: '#90B8E8' },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginBottom: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#eee',
        backgroundColor: '#fff',
        // Shadow for card effect
        shadowColor: '#e8b6b6',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    selectedItem: {
        backgroundColor: '#F0F8FF', // Light blue tint
        borderColor: '#007AFF', // Blue border for selected
    },
    avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 14, backgroundColor: '#ddd' },
    info: { flex: 1, paddingRight: 8 },
    name: { fontSize: 16, fontFamily: 'Pretendard-Bold', marginBottom: 4 }, // Added spacing
    status: { fontSize: 13, color: '#888', fontFamily: 'Pretendard-Medium' },
    location: { fontSize: 12, color: '#9a9a9a', fontFamily: 'Pretendard-Medium', marginTop: 2 },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center' },
    checked: { backgroundColor: '#007AFF', borderColor: '#007AFF' }, // Consistent blue theme
    checkMark: { color: '#fff', fontSize: 14, fontFamily: 'Pretendard-Bold' },
});
