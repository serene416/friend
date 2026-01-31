import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Friend, MOCK_USER } from '../../constants/data';
import { useFriendStore } from '../../store/useFriendStore';

export default function MyPageScreen() {
    const { friends, removeFriend } = useFriendStore();

    // --- 카카오 친구 목록 불러오기 (구현 가이드) ---
    const handleAddFriend = async () => {
        Alert.alert('친구 추가', '카카오톡 친구 목록 API를 호출합니다.');
    };

    const handleLogout = () => {
        Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
            { text: '취소', style: 'cancel' },
            { text: '로그아웃', style: 'destructive', onPress: () => console.log('Logged out') },
        ]);
    };

    const renderFriend = ({ item }: { item: Friend }) => (
        <View style={styles.friendItem}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{item.name}</Text>
                <Text style={[styles.friendStatus, { color: item.status === 'online' ? 'green' : '#888' }]}>
                    {item.status === 'online' ? '온라인' : '오프라인'} • {item.location}
                </Text>
            </View>
            <TouchableOpacity onPress={() => removeFriend(item.id)} style={styles.deleteButton}>
                <Text style={styles.deleteText}>삭제</Text>
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
                    <Text style={styles.sectionTitle}>카카오톡 친구</Text>
                    <TouchableOpacity onPress={handleAddFriend}>
                        <Text style={styles.addButton}>+ 친구 추가</Text>
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={friends}
                    keyExtractor={(item) => item.id}
                    renderItem={renderFriend}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<Text style={{ color: '#999', textAlign: 'center', marginTop: 20 }}>친구가 없습니다.</Text>}
                />
            </View>

            {/* Settings Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>설정</Text>
                <TouchableOpacity style={styles.settingItem}>
                    <Text style={styles.settingText}>앱 설정</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.settingItem}>
                    <Text style={styles.settingText}>위치 서비스</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutText}>로그아웃</Text>
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
    logoutButton: { marginTop: 20, paddingVertical: 15, alignItems: 'center', backgroundColor: '#f2f2f2', borderRadius: 8 },
    logoutText: { color: '#ff3b30', fontSize: 16, fontWeight: '600' },
});
