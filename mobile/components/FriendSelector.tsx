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
                                        style={[styles.item, isSelected && styles.selectedItem]}
                                        onPress={() => toggleFriendSelection(item.id)}
                                    >
                                        <Image source={{ uri: item.avatar }} style={styles.avatar} />
                                        <View style={styles.info}>
                                            <Text style={styles.name}>{item.name}</Text>
                                            <Text style={styles.status}>{item.status} • {item.location}</Text>
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
    buttonText: { fontSize: 16, fontWeight: '500', color: '#333' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '70%', padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 20, fontWeight: 'bold' },
    closeText: { fontSize: 16, color: '#007AFF', fontWeight: 'bold' },
    item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
    selectedItem: { backgroundColor: '#f9f9f9' },
    avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: '#ddd' },
    info: { flex: 1 },
    name: { fontSize: 16, fontWeight: '500' },
    status: { fontSize: 13, color: '#888' },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center' },
    checked: { backgroundColor: '#333', borderColor: '#333' },
    checkMark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});
