import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MOCK_ACTIVITIES } from "../../constants/data";

const { width } = Dimensions.get("window");

export default function ActivityDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const activity = MOCK_ACTIVITIES.find((a) => a.id === id);

  if (!activity) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Activity not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={28} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity>
            <MaterialCommunityIcons
              name="heart-outline"
              size={28}
              color="#333"
            />
          </TouchableOpacity>
        </View>

        {/* Activity Image */}
        <Image source={{ uri: activity.image }} style={styles.heroImage} />

        {/* Activity Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.title}>{activity.title}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons
                name="map-marker"
                size={20}
                color="#666"
              />
              <Text style={styles.metaText}>{activity.distance} km</Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons
                name="account-multiple"
                size={20}
                color="#666"
              />
              <Text style={styles.metaText}>{activity.headcount}</Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={20}
                color="#666"
              />
              <Text style={styles.metaText}>{activity.time}</Text>
            </View>
          </View>

          {/* Tags */}
          <View style={styles.tagsContainer}>
            {activity.tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this activity</Text>
            <Text style={styles.description}>
              Discover the charm of this location with your friends. Perfect for
              a day out with stunning views and great memories.
            </Text>
          </View>

          {/* Highlights */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Highlights</Text>
            <View style={styles.highlightItem}>
              <MaterialCommunityIcons name="camera" size={20} color="#666" />
              <Text style={styles.highlightText}>Scenic photo spots</Text>
            </View>
            <View style={styles.highlightItem}>
              <MaterialCommunityIcons
                name="silverware-fork-knife"
                size={20}
                color="#666"
              />
              <Text style={styles.highlightText}>Great food options</Text>
            </View>
            <View style={styles.highlightItem}>
              <MaterialCommunityIcons name="walk" size={20} color="#666" />
              <Text style={styles.highlightText}>Easy walking trails</Text>
            </View>
          </View>

          {/* Map Placeholder */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location & Route</Text>
            <View style={styles.mapPlaceholder}>
              <MaterialCommunityIcons name="map" size={60} color="#ccc" />
              <Text style={styles.mapPlaceholderText}>
                Map will be displayed here
              </Text>
              <Text style={styles.mapPlaceholderSubtext}>
                Integration with Google Maps / Naver Map API pending
              </Text>
            </View>
          </View>

          {/* Call to Action */}
          <TouchableOpacity style={styles.ctaButton}>
            <Text style={styles.ctaButtonText}>Invite Friends & Go</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  heroImage: {
    width: "100%",
    height: 250,
    backgroundColor: "#eee",
  },
  infoContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#333",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: "#666",
  },
  tagsContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  tag: {
    backgroundColor: "#f0f0f0",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 12,
    color: "#555",
    fontWeight: "500",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  description: {
    fontSize: 14,
    color: "#666",
    lineHeight: 22,
  },
  highlightItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    paddingVertical: 8,
  },
  highlightText: {
    fontSize: 14,
    color: "#555",
  },
  mapPlaceholder: {
    width: "100%",
    height: 300,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
  },
  mapPlaceholderText: {
    fontSize: 16,
    color: "#999",
    marginTop: 16,
    fontWeight: "500",
  },
  mapPlaceholderSubtext: {
    fontSize: 12,
    color: "#bbb",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  ctaButton: {
    backgroundColor: "#333",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 30,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
});
