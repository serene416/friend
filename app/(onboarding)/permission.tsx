import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
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
                <Text style={styles.title}>Enable Location</Text>
                <Text style={styles.desc}>
                    We need your location to recommend activities near you and your friends.
                </Text>

                <TouchableOpacity style={styles.allowButton} onPress={handleAllow}>
                    <Text style={styles.buttonText}>Allow Access</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.denyButton} onPress={handleAllow}>
                    <Text style={styles.denyText}>Not Now</Text>
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
