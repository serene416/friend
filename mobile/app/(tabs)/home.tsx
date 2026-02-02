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
import { Activity, MOCK_ACTIVITIES } from "../../constants/data";
import { useCurrentWeather } from "../../hooks/useCurrentWeather";

const WEATHER_ICONS: Record<string, any> = {
  '맑음': require('../../assets/weather/sun.png'),
  '구름많음': require('../../assets/weather/cloudy_sun.png'),
  '흐림': require('../../assets/weather/cloudy.png'),
  '눈': require('../../assets/weather/snow.png'),
  '비': require('../../assets/weather/cloudy.png'), // Fallback for rain if not provided
  'default': require('../../assets/weather/sun.png'),
};

export default function HomeScreen() {
  const router = useRouter();
  const { data, loading, error, permissionDenied } = useCurrentWeather();

  const getWeatherIcon = (status: string) => {
    return WEATHER_ICONS[status] || WEATHER_ICONS['default'];
  };

  const formatValue = (value: number | null, suffix: string) =>
    value === null ? "-" : `${value}${suffix}`;

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
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>오늘 뭐 할까요?</Text>
      </View>

      {/* Weather Widget */}
      <View style={styles.weatherCard}>
        {loading && (
          <Text style={styles.weatherDesc}>날씨 불러오는 중...</Text>
        )}
        {!loading && permissionDenied && (
          <Text style={styles.weatherDesc}>
            위치 권한이 필요합니다. 설정에서 권한을 허용해주세요.
          </Text>
        )}
        {!loading && !permissionDenied && error && (
          <Text style={styles.weatherDesc}>날씨 오류: {error}</Text>
        )}
        {!loading && !permissionDenied && !error && data && (
          <View style={styles.weatherContainer}>
            <View style={styles.weatherInfo}>
              <Text style={styles.weatherTemp}>
                {formatValue(data.temperature, "°")}
              </Text>
              <Text style={styles.weatherStatus}>{data.precipitationType}</Text>
              <View style={styles.weatherSubInfo}>
                <Text style={styles.weatherDetailText}>
                  습도 {formatValue(data.humidity, "%")}
                </Text>
                <Text style={styles.weatherDetailText}>
                  강수량 {data.precipitation1h}
                </Text>
              </View>
            </View>
            <Image
              source={getWeatherIcon(data.precipitationType)}
              style={styles.weatherIcon}
              resizeMode="contain"
            />
          </View>
        )}
      </View>

      {/* Friend Selector */}
      <View style={styles.selectorContainer}>
        <FriendSelector />
      </View>

      {/* Recommendations */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>오늘의 추천 활동</Text>
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
  headerTitle: { fontSize: 24, fontFamily: "Pretendard-Bold" },
  weatherCard: {
    backgroundColor: "#fff0f3", // Back to original light pink
    padding: 24,
    borderRadius: 24,
    marginBottom: 20,
  },
  weatherContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  weatherInfo: {
    flex: 1,
  },
  weatherTemp: {
    fontSize: 48,
    fontFamily: "Pretendard-Bold",
    color: "#1A1A1A",
    lineHeight: 56,
  },
  weatherStatus: {
    fontSize: 18,
    color: "#4A4A4A",
    fontFamily: "Pretendard-SemiBold",
    marginBottom: 8,
  },
  weatherSubInfo: {
    flexDirection: "row",
    gap: 12,
  },
  weatherIcon: {
    width: 100,
    height: 100,
  },
  weatherDesc: { fontSize: 16, color: "#666", fontFamily: "Pretendard-Medium" },
  weatherDetailText: {
    fontSize: 14,
    color: "#7A7A7A",
    fontFamily: "Pretendard-Medium",
  },
  selectorContainer: { marginBottom: 25 },
  sectionHeader: { marginBottom: 15 },
  sectionTitle: { fontSize: 20, fontFamily: "Pretendard-Bold" },
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
});
