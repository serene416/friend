import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFriendStore } from '../../store/useFriendStore';
import { MOCK_USER } from '../../constants/data';

export default function MyPageScreen() {
    const { friends, removeFriend } = useFriendStore();

    const renderFriend = ({ item }) => (
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
                    <TouchableOpacity>
                        <Text style={styles.addButton}>+ Add Friend</Text>
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
