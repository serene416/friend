import KakaoMap from "@/components/KakaoMap";
import { MOCK_ACTIVITIES } from "@/constants/data";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ActivityDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isMapVisible, setIsMapVisible] = useState(false);
  const isFetchingLocationRef = useRef(false);

  const activity = MOCK_ACTIVITIES.find((a) => a.id === id);

  const fetchCurrentLocation = useCallback(async () => {
    if (isFetchingLocationRef.current) {
      return;
    }

    isFetchingLocationRef.current = true;
    setIsLoadingLocation(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Location permission denied.");
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocationError("Location services are disabled.");
        return;
      }

      const timeoutMs = 8000;
      const currentPosition = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          mayShowUserSettingsDialog: true,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), timeoutMs)
        ),
      ]);

      setLocation({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "timeout") {
        setLocationError("Location request timed out.");
      } else {
        setLocationError("Unable to fetch location.");
      }
    } finally {
      isFetchingLocationRef.current = false;
      setIsLoadingLocation(false);
    }
  }, []);

  const handleLocationRoutePress = useCallback(() => {
    setIsMapVisible(true);
    void fetchCurrentLocation();
  }, [fetchCurrentLocation]);

  useEffect(() => {
    void fetchCurrentLocation();
  }, [fetchCurrentLocation]);

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
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Location & Route</Text>
              <TouchableOpacity
                style={styles.locationButton}
                onPress={handleLocationRoutePress}
              >
                <Text style={styles.locationButtonText}>
                  {isMapVisible ? "Refresh" : "Show My Location"}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.mapPlaceholder}>
              {isLoadingLocation ? (
                <View style={styles.mapPlaceholderContent}>
                  <ActivityIndicator size="large" color="#666" />
                </View>
              ) : locationError ? (
                <View style={styles.mapPlaceholderContent}>
                  <Text style={styles.mapPlaceholderText}>{locationError}</Text>
                </View>
              ) : location && isMapVisible ? (
                <KakaoMap
                  latitude={location.latitude}
                  longitude={location.longitude}
                />
              ) : (
                <View style={styles.mapPlaceholderContent}>
                  <MaterialCommunityIcons name="map" size={60} color="#ccc" />
                  <Text style={styles.mapPlaceholderText}>
                    Tap to load your current location
                  </Text>
                  <Text style={styles.mapPlaceholderSubtext}>
                    Kakao map will appear here
                  </Text>
                </View>
              )}
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
    fontFamily: "Pretendard-Bold",
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
    fontFamily: "Pretendard-Medium",
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
    fontFamily: "Pretendard-Bold",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Pretendard-Bold",
    marginBottom: 12,
    color: "#333",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  locationButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#333",
  },
  locationButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  description: {
    fontSize: 14,
    color: "#666",
    lineHeight: 22,
    fontFamily: "Pretendard-Medium",
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
    fontFamily: "Pretendard-Medium",
  },
  mapPlaceholder: {
    width: "100%",
    height: 300,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
    overflow: "hidden",
  },
  mapPlaceholderContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  mapPlaceholderText: {
    fontSize: 16,
    color: "#999",
    marginTop: 16,
    fontFamily: "Pretendard-Bold",
  },
  mapPlaceholderSubtext: {
    fontSize: 12,
    color: "#bbb",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 20,
    fontFamily: "Pretendard-Medium",
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
    fontFamily: "Pretendard-Bold",
    color: "#fff",
  },
});
