import { useRouter } from "expo-router";
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FriendSelector from "../../components/FriendSelector";
import { MOCK_ACTIVITIES } from "../../constants/data";

export default function HomeScreen() {
  const router = useRouter();
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(tabs)/activity-detail?id=${item.id}`)}
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
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>What are we doing today?</Text>
      </View>

      {/* Weather Widget (Mock) */}
      <View style={styles.weatherCard}>
        <Text style={styles.weatherTemp}>12°C</Text>
        <Text style={styles.weatherDesc}>Sunny • Good for walking</Text>
      </View>

      {/* Friend Selector */}
      <View style={styles.selectorContainer}>
        <FriendSelector />
      </View>

      {/* Recommendations */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Today's Recommendations</Text>
      </View>

      <FlatList
        data={MOCK_ACTIVITIES}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 20 },
  header: { marginTop: 10, marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: "bold" },
  weatherCard: {
    backgroundColor: "#eef",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  weatherTemp: { fontSize: 28, fontWeight: "bold", color: "#333" },
  weatherDesc: { fontSize: 16, color: "#666" },
  selectorContainer: { marginBottom: 25 },
  sectionHeader: { marginBottom: 15 },
  sectionTitle: { fontSize: 20, fontWeight: "bold" },
  listContent: { paddingBottom: 20 },
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
  cardTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  cardMeta: { flexDirection: "row", marginBottom: 10 },
  metaText: { fontSize: 14, color: "#666", marginRight: 5 },
  tags: { flexDirection: "row" },
  tag: {
    backgroundColor: "#f0f0f0",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  tagText: { fontSize: 12, color: "#555" },
});
