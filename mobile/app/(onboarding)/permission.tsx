import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PermissionScreen() {
    const router = useRouter();

    const handleAllow = () => {
        // Mock permission request
        // Navigate to Main Tabs
        router.replace('/(tabs)/home');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.title}>위치 권한 허용</Text>
                <Text style={styles.desc}>
                    내 주변과 친구들 사이의 최적의 장소를 추천하기 위해 위치 권한이 필요합니다.
                </Text>

                <TouchableOpacity style={styles.allowButton} onPress={handleAllow}>
                    <Text style={styles.buttonText}>권한 허용</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.denyButton} onPress={handleAllow}>
                    <Text style={styles.denyText}>나중에 하기</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    card: { backgroundColor: '#fff', borderRadius: 20, padding: 30, alignItems: 'center' },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 15 },
    desc: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 30, lineHeight: 22 },
    allowButton: { backgroundColor: '#333', paddingVertical: 12, paddingHorizontal: 40, borderRadius: 25, marginBottom: 15, width: '100%', alignItems: 'center' },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    denyButton: { padding: 10 },
    denyText: { color: '#999', fontSize: 14 },
});
