import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Activity, MOCK_ACTIVITIES } from '../constants/data';
import { useFavoriteStore } from '../store/useFavoriteStore';

export default function FavoritesScreen() {
    const router = useRouter();
    const { favorites, toggleFavorite, isFavorite } = useFavoriteStore();

    const favoriteActivities = useMemo(() => {
        return MOCK_ACTIVITIES.filter((activity) => favorites.includes(activity.id));
    }, [favorites]);

    const renderItem = ({ item }: { item: Activity }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/activity-detail?id=${item.id}`)}
        >
            <Image source={{ uri: item.image }} style={styles.cardImage} />
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.cardMeta}>
                    <Text style={styles.metaText}>{item.distance}km</Text>
                    <Text style={styles.metaText}>•</Text>
                    <Text style={styles.metaText}>{item.headcount}</Text>
                    <Text style={styles.metaText}>•</Text>
                    <Text style={styles.metaText}>{item.time}</Text>
                </View>
                <View style={styles.tags}>
                    {item.tags.map((tag, index) => (
                        <View key={index} style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                        </View>
                    ))}
                </View>
            </View>
            <TouchableOpacity
                style={styles.heartButton}
                onPress={() => toggleFavorite(item.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <MaterialCommunityIcons
                    name="heart"
                    size={24}
                    color="#FF4B4B"
                />
            </TouchableOpacity>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialCommunityIcons name="arrow-left" size={28} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>관심 목록</Text>
            </View>

            <FlatList
                data={favoriteActivities}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="heart-outline" size={64} color="#ccc" />
                        <Text style={styles.emptyText}>아직 관심 있는 활동이 없어요.</Text>
                        <Text style={styles.emptySubText}>
                            마음에 드는 활동에 하트를 눌러보세요!
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fcfcfc' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    backButton: { marginRight: 15 },
    headerTitle: { fontSize: 20, fontFamily: 'Pretendard-Bold', color: '#333' },
    listContent: { padding: 20 },
    card: {
        backgroundColor: "#fff",
        borderRadius: 16,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardImage: {
        width: "100%",
        height: 180,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        backgroundColor: "#eee",
    },
    cardContent: { padding: 15 },
    cardTitle: { fontSize: 18, fontFamily: "Pretendard-Bold", marginBottom: 8 },
    cardMeta: { flexDirection: "row", marginBottom: 10 },
    metaText: { fontSize: 14, color: "#666", marginRight: 5, fontFamily: "Pretendard-Medium" },
    tags: { flexDirection: "row" },
    tag: {
        backgroundColor: "#f0f0f0",
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    tagText: { fontSize: 12, color: "#555", fontFamily: "Pretendard-Medium" },
    heartButton: {
        position: 'absolute',
        top: 15,
        right: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 20,
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    emptyText: {
        marginTop: 20,
        fontSize: 18,
        fontFamily: 'Pretendard-Bold',
        color: '#666',
    },
    emptySubText: {
        marginTop: 10,
        fontSize: 14,
        fontFamily: 'Pretendard-Medium',
        color: '#999',
    },
});
