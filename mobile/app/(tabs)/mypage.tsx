import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBackendUrl } from '../../constants/api';
import { Friend } from '../../constants/data';
import { useAuthStore } from '../../store/useAuthStore';
import { useFriendStore } from '../../store/useFriendStore';

const BACKEND_URL = getBackendUrl();

function buildLocationLabel(place: Location.LocationGeocodedAddress) {
    const parts = [place.region, place.city, place.district ?? place.subregion]
        .map((part) => (part || '').trim())
        .filter(Boolean);

    const dedupedParts: string[] = [];
    for (const part of parts) {
        if (!dedupedParts.includes(part)) {
            dedupedParts.push(part);
        }
    }

    return dedupedParts.join(' ');
}

export default function MyPageScreen() {
    const router = useRouter();
    const { user, logout, updateStatusMessage } = useAuthStore();
    const { friends, removeFriend, loadFriends } = useFriendStore();
    const [locationName, setLocationName] = useState('위치 정보를 불러오는 중...');
    const [isCreatingInvite, setIsCreatingInvite] = useState(false);
    const [isLoadingFriends, setIsLoadingFriends] = useState(false);
    const [statusInput, setStatusInput] = useState(user?.statusMessage || '');
    const [isSavingStatus, setIsSavingStatus] = useState(false);
    const [isEditingStatus, setIsEditingStatus] = useState(false);
    const [deletingFriendId, setDeletingFriendId] = useState<string | null>(null);
    const lastSyncedLocationRef = useRef('');

    useEffect(() => {
        lastSyncedLocationRef.current = '';
    }, [user?.id]);

    const syncCurrentLocation = useCallback(
        async (latitude: number, longitude: number, locationLabel?: string) => {
            if (!user?.id) {
                return;
            }

            const roundedKey = `${latitude.toFixed(4)}:${longitude.toFixed(4)}:${locationLabel || ''}`;
            if (lastSyncedLocationRef.current === roundedKey) {
                return;
            }

            try {
                const response = await fetch(`${BACKEND_URL}/api/v1/users/location`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: user.id,
                        latitude,
                        longitude,
                        location_name: locationLabel || null,
                    }),
                });

                if (response.ok) {
                    lastSyncedLocationRef.current = roundedKey;
                }
            } catch (error) {
                console.error('Location Sync Error:', error);
            }
        },
        [user?.id]
    );

    useEffect(() => {
        let subscription: Location.LocationSubscription | null = null;

        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationName('위치 권한 필요');
                return;
            }

            try {
                subscription = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.Balanced,
                        distanceInterval: 100, // Update every 100 meters
                    },
                    async (location) => {
                        try {
                            const latitude = location.coords.latitude;
                            const longitude = location.coords.longitude;
                            let resolvedName: string | undefined;

                            const geocode = await Location.reverseGeocodeAsync({
                                latitude,
                                longitude,
                            });

                            if (geocode.length > 0) {
                                const place = geocode[0];
                                resolvedName = buildLocationLabel(place) || undefined;
                            }

                            setLocationName(resolvedName || '위치를 알 수 없음');
                            await syncCurrentLocation(latitude, longitude, resolvedName);
                        } catch (error) {
                            console.error('Location Watch Callback Error:', error);
                        }
                    }
                );
            } catch (error) {
                console.error('Location Error:', error);
                setLocationName('위치 정보를 가져올 수 없습니다');
            }
        })();

        return () => {
            if (subscription) {
                subscription.remove();
            }
        };
    }, [syncCurrentLocation]);

    const refreshFriends = useCallback(async () => {
        if (!user?.id) {
            return;
        }
        try {
            setIsLoadingFriends(true);
            await loadFriends(user.id);
        } catch (error) {
            console.error('Load Friends Error:', error);
        } finally {
            setIsLoadingFriends(false);
        }
    }, [user?.id, loadFriends]);

    useEffect(() => {
        refreshFriends();
    }, [refreshFriends]);

    useFocusEffect(
        useCallback(() => {
            refreshFriends();
            const interval = setInterval(refreshFriends, 30000);
            return () => clearInterval(interval);
        }, [refreshFriends])
    );

    useEffect(() => {
        setStatusInput(user?.statusMessage || '');
    }, [user?.statusMessage]);

    useEffect(() => {
        if (!user?.statusMessageExpiresAt) {
            return;
        }
        const expiresAt = new Date(user.statusMessageExpiresAt);
        if (Number.isNaN(expiresAt.getTime())) {
            return;
        }
        if (expiresAt <= new Date()) {
            updateStatusMessage('', null);
            setStatusInput('');
        }
    }, [user?.statusMessageExpiresAt, updateStatusMessage]);

    // --- 카카오 친구 목록 불러오기 (구현 가이드) ---
    const handleAddFriend = async () => {
        if (!user?.id) {
            Alert.alert('로그인이 필요합니다', '초대 링크를 만들려면 로그인해주세요.');
            return;
        }

        try {
            setIsCreatingInvite(true);
            const response = await fetch(`${BACKEND_URL}/api/v1/friends/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inviter_user_id: user.id }),
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                const message = errorBody?.detail || '초대 링크 생성에 실패했습니다.';
                throw new Error(message);
            }

            const data = await response.json();
            const inviteLink = __DEV__
                ? Linking.createURL('invite', { queryParams: { token: data.token } })
                : data.invite_link;

            await Share.share({
                message: `친구 추가 초대 링크입니다. 앱에서 열어주세요!\\n${inviteLink}`,
                url: inviteLink,
            });
        } catch (error: any) {
            Alert.alert('초대 링크 생성 실패', error?.message || '알 수 없는 오류가 발생했습니다.');
        } finally {
            setIsCreatingInvite(false);
        }
    };

    const handleLogout = () => {
        Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
            { text: '취소', style: 'cancel' },
            {
                text: '로그아웃',
                style: 'destructive',
                onPress: () => {
                    logout();
                    router.replace('/(onboarding)/login');
                }
            },
        ]);
    };

    const handleContact = () => {
        const email = 'support@example.com';
        const subject = '[우리 오늘 뭐 해?] 문의사항';
        const body = '여기에 문의 내용을 적어주세요.';

        Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    };

    const handleVersionPress = () => {
        Alert.alert('최신 버전', '현재 최신 버전을 사용하고 있습니다.');
    };

    const handleStatusSubmit = async () => {
        if (!user?.id) {
            Alert.alert('로그인이 필요합니다', '상태메시지를 저장하려면 로그인해주세요.');
            return;
        }

        try {
            setIsSavingStatus(true);
            const response = await fetch(`${BACKEND_URL}/api/v1/users/status-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, message: statusInput }),
            });

            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                const message = body?.detail || '상태메시지 저장에 실패했습니다.';
                throw new Error(message);
            }

            updateStatusMessage(body?.message || '', body?.expires_at || null);
            await refreshFriends();
            setIsEditingStatus(false);
        } catch (error: any) {
            Alert.alert('저장 실패', error?.message || '알 수 없는 오류가 발생했습니다.');
        } finally {
            setIsSavingStatus(false);
        }
    };

    const handleDeleteFriend = async (friendId: string) => {
        if (!user?.id) {
            Alert.alert('로그인이 필요합니다', '친구를 삭제하려면 로그인해주세요.');
            return;
        }

        try {
            setDeletingFriendId(friendId);
            const response = await fetch(`${BACKEND_URL}/api/v1/friends?user_id=${user.id}&friend_id=${friendId}`, {
                method: 'DELETE',
            });

            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                const message = body?.detail || '친구 삭제에 실패했습니다.';
                throw new Error(message);
            }

            removeFriend(friendId);
        } catch (error: any) {
            Alert.alert('삭제 실패', error?.message || '알 수 없는 오류가 발생했습니다.');
        } finally {
            setDeletingFriendId(null);
        }
    };

    const renderFriend = ({ item }: { item: Friend }) => (
        <View style={styles.friendItem}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{item.name}</Text>
                <Text style={styles.friendStatus}>
                    {item.statusMessage ? item.statusMessage : '상태메시지가 없습니다.'}
                </Text>
            </View>
            <TouchableOpacity
                onPress={() =>
                    Alert.alert('친구 삭제', `${item.name}님을 친구 목록에서 삭제하시겠어요?`, [
                        { text: '취소', style: 'cancel' },
                        {
                            text: '삭제',
                            style: 'destructive',
                            onPress: () => handleDeleteFriend(item.id),
                        },
                    ])
                }
                style={styles.deleteButton}
                disabled={deletingFriendId === item.id}
            >
                <Text style={styles.deleteText}>{deletingFriendId === item.id ? '삭제중' : '삭제'}</Text>
            </TouchableOpacity>
        </View>
    );

    const renderHeader = () => (
        <>
            {/* Profile Section */}
            <View style={styles.profileCard}>
                <Image
                    source={{ uri: user?.avatar || 'https://i.pravatar.cc/150?u=fallback' }}
                    style={styles.profileAvatar}
                />
                <View style={styles.profileTextContainer}>
                    <Text style={styles.profileName}>{user?.nickname || '사용자'}</Text>
                    <Text style={styles.profileLocation}>{locationName}</Text>
                    <View style={styles.statusInputContainer}>
                        {!isEditingStatus ? (
                            <TouchableOpacity onPress={() => setIsEditingStatus(true)}>
                                <Text style={styles.profileStatusText}>
                                    {user?.statusMessage || '상태 메시지를 입력하세요'}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.statusRow}>
                                <TextInput
                                    style={styles.statusInput}
                                    placeholder="상태 메시지 입력"
                                    value={statusInput}
                                    onChangeText={setStatusInput}
                                    autoFocus
                                    returnKeyType="done"
                                    onSubmitEditing={handleStatusSubmit}
                                />
                                <TouchableOpacity
                                    style={styles.statusSaveButton}
                                    onPress={handleStatusSubmit}
                                    disabled={isSavingStatus}
                                >
                                    <Text style={styles.statusSaveText}>{isSavingStatus ? '저장중' : '저장'}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            {/* Friend List Header */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>친구 목록</Text>
                <TouchableOpacity onPress={handleAddFriend} disabled={isCreatingInvite}>
                    <Text style={styles.addButton}>{isCreatingInvite ? '링크 생성 중...' : '+ 친구 추가'}</Text>
                </TouchableOpacity>
            </View>
        </>
    );

    // Settings Item Component
    const SettingItem = ({ icon, label, value, onPress }: { icon: string, label: string, value?: string, onPress: () => void }) => (
        <TouchableOpacity style={styles.settingItem} onPress={onPress}>
            <View style={styles.settingLeft}>
                <Ionicons name={icon as any} size={24} color="#333" style={styles.settingIcon} />
                <Text style={styles.settingText}>{label}</Text>
            </View>
            <View style={styles.settingRight}>
                {value && <Text style={styles.settingValue}>{value}</Text>}
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </View>
        </TouchableOpacity>
    );

    const renderFooter = () => (
        <View style={styles.section}>


            <Text style={styles.sectionTitle}>설정</Text>

            <View style={styles.settingsGroup}>
                <SettingItem
                    icon="heart-outline"
                    label="관심 목록"
                    onPress={() => router.push('/favorites' as any)}
                />
                <SettingItem
                    icon="information-circle-outline"
                    label="앱 버전"
                    value="1.0.0"
                    onPress={handleVersionPress}
                />
                <SettingItem
                    icon="mail-outline"
                    label="문의하기"
                    onPress={handleContact}
                />
                <SettingItem
                    icon="document-text-outline"
                    label="이용약관"
                    onPress={() => router.push('/terms' as any)}
                />
                <SettingItem
                    icon="shield-checkmark-outline"
                    label="개인정보 처리방침"
                    onPress={() => router.push('/privacy' as any)}
                />
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>로그아웃</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <FlatList
                data={friends}
                keyExtractor={(item) => item.id}
                renderItem={renderFriend}
                ListHeaderComponent={renderHeader}
                ListFooterComponent={renderFooter}
                contentContainerStyle={styles.listContent}
                refreshing={isLoadingFriends}
                onRefresh={refreshFriends}
                ListEmptyComponent={
                    <Text style={{ color: '#999', textAlign: 'center', marginTop: 20, marginBottom: 40 }}>
                        {isLoadingFriends ? '친구 목록을 불러오는 중...' : '친구가 없습니다.'}
                    </Text>
                }
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fcfcfc', paddingHorizontal: 20, paddingTop: 40 },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 30,
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 20,
        // Shadow/Card effect
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    profileAvatar: { width: 64, height: 64, borderRadius: 32, marginRight: 16, backgroundColor: '#f5f5f5' },
    profileTextContainer: { flex: 1 },
    profileName: { fontSize: 22, fontFamily: 'Pretendard-Bold', color: '#1a1a1a', marginBottom: 8 },
    profileLocation: { fontSize: 13, color: '#888', fontFamily: 'Pretendard-Medium', marginBottom: 4 },
    profileStatusText: {
        fontSize: 14,
        color: '#555',
        fontFamily: 'Pretendard-Medium',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    statusInputContainer: { marginTop: 4 },
    statusRow: { flexDirection: 'row', alignItems: 'center' },
    statusInput: {
        flex: 1,
        fontSize: 14,
        color: '#666',
        fontFamily: 'Pretendard-Medium',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    statusSaveButton: { marginLeft: 8, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#333', borderRadius: 8 },
    statusSaveText: { color: '#fff', fontSize: 12, fontFamily: 'Pretendard-Bold' },

    // Section Styles
    section: { marginBottom: 30, marginTop: 150, flex: 1 },

    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    sectionTitle: { fontSize: 20, fontFamily: 'Pretendard-Bold', marginBottom: 15 },
    addButton: { color: '#007AFF', fontSize: 16, fontFamily: 'Pretendard-Bold' },
    listContent: {},
    friendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: '#eee' },
    friendInfo: { flex: 1 },
    friendName: { fontSize: 16, fontFamily: 'Pretendard-Bold', marginBottom: 8 },
    friendStatus: { fontSize: 14, fontFamily: 'Pretendard-Medium' },
    deleteButton: { padding: 8, backgroundColor: '#fee', borderRadius: 8 },
    deleteText: { color: 'red', fontSize: 12, fontFamily: 'Pretendard-Bold' },

    // New Settings Styles matching reference
    settingsGroup: {
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingVertical: 8,
        // Shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 1,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    settingIcon: {
        width: 24,
        textAlign: 'center',
    },
    settingText: {
        fontSize: 16,
        fontFamily: 'Pretendard-Medium',
        color: '#333'
    },
    settingRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    settingValue: {
        fontSize: 14,
        color: '#999',
        fontFamily: 'Pretendard-Medium',
    },

    logoutButton: { marginTop: 30, paddingVertical: 15, alignItems: 'center', backgroundColor: '#f9f9f9', borderRadius: 12 },
    logoutText: { color: '#ff3b30', fontSize: 16, fontFamily: 'Pretendard-Bold' },
});
