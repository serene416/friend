import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Friend, MOCK_USER } from '../../constants/data';
import { useFriendStore } from '../../store/useFriendStore';

export default function MyPageScreen() {
    const { friends, removeFriend } = useFriendStore();

    // --- 카카오 친구 목록 불러오기 (구현 가이드) ---
    const handleAddFriend = async () => {
        Alert.alert('친구 추가', '카카오톡 친구 목록 API를 호출합니다.');

        /*
        [카카오 친구 목록 API 연결 방법]

        1. 권한 확인: 
           이 기능을 사용하려면 로그인 시 'friends' 스코프 권한을 동의받아야 합니다.
           (login.tsx의 scopes 배열에 'friends' 추가 필요)

        2. 액세스 토큰 필요:
           로그인 성공 시 받은 Access Token이 필요합니다. 
           (보통 AsyncStorage나 Context에 저장해둔 것을 가져옵니다.)

        3. API 호출 예시 코드:
        
        try {
            const token = await AsyncStorage.getItem('userToken'); // 토큰 가져오기
            
            const response = await fetch('https://kapi.kakao.com/v1/api/talk/friends', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`, // 중요: Bearer 띄어쓰기 주의
                    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
                },
            });

            const data = await response.json();
            
            if (data.elements) {
                // data.elements가 친구 목록 배열입니다.
                // 여기서 useFriendStore의 addFriend 등을 사용하여 상태를 업데이트하세요.
                console.log('친구 목록:', data.elements);
            } else {
                console.log('친구 목록을 불러오지 못했습니다:', data);
            }

        } catch (error) {
            console.error('API 호출 실패:', error);
            Alert.alert('오류', '친구 목록을 불러오는데 실패했습니다.');
        }
        */
    };

    const renderFriend = ({ item }: { item: Friend }) => (
        <View style={styles.friendItem}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{item.name}</Text>
                <Text style={[styles.friendStatus, { color: item.status === 'online' ? 'green' : '#888' }]}>
                    {item.status === 'online' ? 'Online' : 'Offline'} • {item.location}
                </Text>
            </View>
            <TouchableOpacity onPress={() => removeFriend(item.id)} style={styles.deleteButton}>
                <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Profile Section */}
            <View style={styles.profileHeader}>
                <Image source={{ uri: MOCK_USER.avatar }} style={styles.profileAvatar} />
                <View>
                    <Text style={styles.profileName}>{MOCK_USER.name}</Text>
                    <Text style={styles.profileLocation}>{MOCK_USER.location}</Text>
                </View>
            </View>

            {/* Friend List Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>My Friends</Text>
                    <TouchableOpacity onPress={handleAddFriend}>
                        <Text style={styles.addButton}>+ 친구 추가</Text>
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={friends}
                    keyExtractor={(item) => item.id}
                    renderItem={renderFriend}
                    contentContainerStyle={styles.listContent}
                />
            </View>

            {/* Settings Section (Simple) */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Settings</Text>
                <TouchableOpacity style={styles.settingItem}>
                    <Text style={styles.settingText}>Preferences</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.settingItem}>
                    <Text style={styles.settingText}>Location Settings</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 20 },
    profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 30, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
    profileAvatar: { width: 70, height: 70, borderRadius: 35, marginRight: 20, backgroundColor: '#eee' },
    profileName: { fontSize: 24, fontWeight: 'bold' },
    profileLocation: { fontSize: 16, color: '#666' },
    section: { marginBottom: 30, flex: 1 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold' },
    addButton: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
    listContent: {},
    friendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: '#eee' },
    friendInfo: { flex: 1 },
    friendName: { fontSize: 16, fontWeight: '600' },
    friendStatus: { fontSize: 14 },
    deleteButton: { padding: 8, backgroundColor: '#fee', borderRadius: 8 },
    deleteText: { color: 'red', fontSize: 12, fontWeight: '600' },
    settingItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
    settingText: { fontSize: 16 },
});
