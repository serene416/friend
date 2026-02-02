import React, { useState } from 'react';
import { FlatList, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFriendStore } from '../store/useFriendStore';

export default function FriendSelector() {
    const { friends, selectedFriends, toggleFriendSelection } = useFriendStore();
    const [modalVisible, setModalVisible] = useState(false);

    const selectedCount = selectedFriends.length;

    return (
        <View>
            <TouchableOpacity style={styles.button} onPress={() => setModalVisible(true)}>
                <Text style={styles.buttonText}>
                    {selectedCount > 0 ? `친구 ${selectedCount}명과 함께` : '함께 놀 친구를 선택하세요'}
                </Text>
            </TouchableOpacity>

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.header}>
                            <Text style={styles.title}>친구 선택</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={styles.closeText}>완료</Text>
                            </TouchableOpacity>
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
                    </View>
                </View>
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
    title: { fontSize: 20, fontFamily: 'Pretendard-Bold' },
    closeText: { fontSize: 16, color: '#007AFF', fontFamily: 'Pretendard-Bold' },
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
        shadowColor: '#000',
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
