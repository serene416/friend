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
import { useFavoriteStore } from "../../store/useFavoriteStore";



const WEATHER_THEMES: Record<string, { bg: string, text: string, border?: string }> = {
  '맑음': { bg: '#81CFEF', text: '#FFFFFF' },
  '구름많음': { bg: '#A8D8EA', text: '#FFFFFF' },
  '흐림': { bg: '#90AFC5', text: '#FFFFFF' },
  '눈': { bg: '#F8B1C0', text: '#FFFFFF' },
  '비': { bg: '#7692AD', text: '#FFFFFF' },
  'default': { bg: '#fff0f3', text: '#1A1A1A' },
};


const WEATHER_BG_IMAGES: Record<string, any> = {
  '맑음': require('../../assets/weather/sun_bg.png'),
  '구름많음': require('../../assets/weather/cloudy_sun_bg.png'),
  '흐림': require('../../assets/weather/cloudy_bg.png'),
  '눈': require('../../assets/weather/snow_bg.png'),
  '비': require('../../assets/weather/rain_bg.png'), // Added rain background
  'default': require('../../assets/weather/sun_bg.png'),
};

export default function HomeScreen() {
  const router = useRouter();

  const { data, loading, error, permissionDenied } = useCurrentWeather();
  const { toggleFavorite, isFavorite } = useFavoriteStore();

  const isNoPrecipitation = data?.precipitationType === "없음";
  const weatherStatusText = isNoPrecipitation
    ? `현재 하늘: ${data?.skyLabel ?? data?.weatherLabel ?? "알수없음"}`
    : data?.precipitationType ?? "알수없음";

  /* 
   * Weather label mapping helper
   * Maps '비/눈', '빗방울' etc. to main categories present in WEATHER_THEMES/IMAGES
   */
  const getWeatherKey = (label: string): string => {
    if (!label) return 'default';
    if (['비', '빗방울', '비/눈', '빗방울눈날림'].includes(label)) return '비';
    if (['눈', '눈날림'].includes(label)) return '눈';
    if (['맑음', '구름많음', '흐림'].includes(label)) return label;
    return 'default';
  };

  const weatherKey = data ? getWeatherKey(data.weatherLabel) : 'default';

  const getWeatherBackground = () => {
    return WEATHER_BG_IMAGES[weatherKey] || WEATHER_BG_IMAGES['default'];
  };

  const currentTheme = WEATHER_THEMES[weatherKey] || WEATHER_THEMES['default'];

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

    </TouchableOpacity >
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={MOCK_ACTIVITIES}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}> 오늘 뭐할래? </Text>
            </View>

            {/* Weather Widget */}
            <View style={styles.weatherCard}>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, overflow: 'hidden' }}>
                <Image
                  source={data ? getWeatherBackground() : WEATHER_BG_IMAGES['default']}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </View>

              {/* Content Overlay */}
              <View style={{ zIndex: 1 }}>
                {loading && (
                  <Text style={[styles.weatherDesc, { color: currentTheme.text }]}>날씨 불러오는 중...</Text>
                )}
                {!loading && permissionDenied && (
                  <Text style={[styles.weatherDesc, { color: currentTheme.text }]}>
                    위치 권한이 필요합니다. 설정에서 권한을 허용해주세요.
                  </Text>
                )}
                {!loading && !permissionDenied && error && (
                  <Text style={[styles.weatherDesc, { color: currentTheme.text }]}>날씨 오류: {error}</Text>
                )}
                {!loading && !permissionDenied && !error && data && (
                  <View style={styles.weatherContainer}>
                    <View style={styles.weatherInfo}>
                      <Text style={[styles.weatherTemp, { color: currentTheme.text }]}>
                        {formatValue(data.temperature, "°C")}
                      </Text>
                      <Text style={[styles.weatherStatus, { color: currentTheme.text }]}>
                        {weatherStatusText}
                      </Text>
                      {!isNoPrecipitation && data.weatherLabel !== data.precipitationType && (
                        <Text style={[styles.weatherLabel, { color: currentTheme.text }]}>
                          현재 하늘: {data.weatherLabel}
                        </Text>
                      )}
                      <View style={styles.weatherSubInfo}>
                        <Text style={[styles.weatherDetailText, { color: currentTheme.text, opacity: 0.9 }]}>
                          습도 {formatValue(data.humidity, "%")}
                        </Text>
                        <Text style={[styles.weatherDetailText, { color: currentTheme.text, opacity: 0.9 }]}>
                          강수량 {data.precipitation1h}
                        </Text>
                      </View>
                    </View>
                    {/* Icon is now part of the background image */}
                  </View>
                )}
              </View>
            </View>

            {/* Friend Selector */}
            <View style={styles.selectorContainer}>
              <FriendSelector currentLocation={data ? { lat: data.latitude, lng: data.longitude } : undefined} />
            </View>

            {/* Recommendations Title */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>오늘의 추천 활동</Text>
            </View>
          </>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 20 },
  header: { marginTop: 10, marginBottom: 20 },
  headerTitle: { fontSize: 24, fontFamily: "Pretendard-Bold" },
  weatherCard: {
    backgroundColor: "#fff0f3",
    padding: 16,
    borderRadius: 24,
    marginBottom: 20,
  },
  weatherContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  weatherInfo: {
    flex: 1,
  },
  weatherTemp: {
    fontSize: 24,
    fontFamily: "Pretendard-Bold",
    lineHeight: 32,
  },
  weatherStatus: {
    fontSize: 16,
    color: "#4A4A4A",
    fontFamily: "Pretendard-Bold",
    marginBottom: 4,
  },
  weatherLabel: {
    fontSize: 13,
    fontFamily: "Pretendard-Medium",
    marginBottom: 6,
  },
  weatherSubInfo: {
    flexDirection: "row",
    gap: 12,
  },
  weatherDesc: { fontSize: 14, color: "#666", fontFamily: "Pretendard-Medium" },
  weatherDetailText: {
    fontSize: 13,
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
