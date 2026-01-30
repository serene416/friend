import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
    const router = useRouter();

    const handleLogin = () => {
        // Mock login logic
        router.push('/(onboarding)/permission');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Welcome</Text>
                <Text style={styles.subtitle}>Sign in to start exploring</Text>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.googleButton} onPress={handleLogin}>
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.skipButton} onPress={handleLogin}>
                    <Text style={styles.skipText}>Skip for now</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', padding: 20 },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
    subtitle: { fontSize: 16, color: '#666' },
    footer: { marginBottom: 30 },
    googleButton: { backgroundColor: '#4285F4', paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginBottom: 15 },
    googleButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    skipButton: { padding: 15, alignItems: 'center' },
    skipText: { color: '#666', fontSize: 14 },
});
