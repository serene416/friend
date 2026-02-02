import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Friend } from '../../constants/data';
import { useAuthStore } from '../../store/useAuthStore';
import { useFriendStore } from '../../store/useFriendStore';

export default function MyPageScreen() {
    const router = useRouter();
    const { user, logout, updateStatusMessage } = useAuthStore();
    const { friends, removeFriend } = useFriendStore();
    const [statusInput, setStatusInput] = useState(user?.statusMessage || '');

    const handleStatusSubmit = () => {
        updateStatusMessage(statusInput);
        Alert.alert('저장 완료', '상태 메시지가 업데이트되었습니다.');
    };

    const handleAddFriend = async () => {
        Alert.alert('친구 추가', '카카오톡 친구 목록 API를 호출합니다.');
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

    const renderFriend = ({ item }: { item: Friend }) => (
        <View style={styles.friendItem}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{item.name}</Text>
                <Text style={styles.friendStatus}>{item.statusMessage}</Text>
            </View>
            <TouchableOpacity onPress={() => removeFriend(item.id)} style={styles.deleteButton}>
                <Text style={styles.deleteText}>삭제</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Profile Section */}
            <View style={styles.profileCard}>
                <Image
                    source={{ uri: user?.avatar || 'https://i.pravatar.cc/150?u=fallback' }}
                    style={styles.profileAvatar}
                />
                <View style={styles.profileTextContainer}>
                    <Text style={styles.profileName}>{user?.nickname || '사용자'}</Text>
                    <View style={styles.statusInputContainer}>
                        <TextInput
                            style={styles.statusInput}
                            placeholder="상태 메시지를 입력하세요"
                            value={statusInput}
                            onChangeText={setStatusInput}
                            onBlur={handleStatusSubmit}
                            returnKeyType="done"
                        />
                    </View>
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
                <TouchableOpacity style={styles.settingItem} onPress={handleContact}>
                    <Text style={styles.settingText}>문의하기</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutText}>로그아웃</Text>
                </TouchableOpacity>
            </View>
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
    profileName: { fontSize: 22, fontFamily: 'Pretendard-Bold', color: '#1a1a1a', marginBottom: 4 },
    statusInputContainer: { marginTop: 4 },
    statusInput: { fontSize: 14, color: '#666', fontFamily: 'Pretendard-Medium', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#eee' },
    section: { marginBottom: 30, flex: 1 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    sectionTitle: { fontSize: 20, fontFamily: 'Pretendard-Bold' },
    addButton: { color: '#007AFF', fontSize: 16, fontFamily: 'Pretendard-Bold' },
    listContent: {},
    friendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: '#eee' },
    friendInfo: { flex: 1 },
    friendName: { fontSize: 16, fontFamily: 'Pretendard-Bold' },
    friendStatus: { fontSize: 14, fontFamily: 'Pretendard-Medium' },
    deleteButton: { padding: 8, backgroundColor: '#fee', borderRadius: 8 },
    deleteText: { color: 'red', fontSize: 12, fontFamily: 'Pretendard-Bold' },
    settingItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
    settingText: { fontSize: 16, fontFamily: 'Pretendard-Medium' },
    logoutButton: { marginTop: 20, paddingVertical: 15, alignItems: 'center', backgroundColor: '#f2f2f2', borderRadius: 8 },
    logoutText: { color: '#ff3b30', fontSize: 16, fontFamily: 'Pretendard-Bold' },
});
