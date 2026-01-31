import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { makeRedirectUri, ResponseType, useAuthRequest } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Kakao OAuth Endpoints
const discovery = {
    authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
    tokenEndpoint: 'https://kauth.kakao.com/oauth/token',
};

export default function LoginScreen() {
    const router = useRouter();

    // Request Setup
    const redirectUri = makeRedirectUri({ scheme: 'myapp' });
    // console.log('Redirect URI (Register this in Kakao Console):', redirectUri);

    const [request, response, promptAsync] = useAuthRequest(
        {
            clientId: '27eaf2ae7141ea203eec2d24e3577d38',
            scopes: ['profile_nickname', 'account_email', 'friends'],
            redirectUri,
            responseType: ResponseType.Code,
        },
        discovery
    );

    // Handle Login Response
    useEffect(() => {
        //   console.log('Response:', response); // Debugging
        if (response?.type === 'success') {
            const { code } = response.params;

            // --- CONNECT TO BACKEND ---
            // Send this 'code' to your backend API
            console.log('Authorization Code:', code);

            // Example Fetch Call (Uncomment and update URL when ready)
            /*
            fetch('https://your-backend.com/api/auth/kakao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            })
            .then(res => res.json())
            .then(data => {
                // Save token and navigate
                router.push('/(onboarding)/permission');
            })
            .catch(err => Alert.alert('Login Failed', err.message));
            */

            // For now, mock success and proceed
            Alert.alert('로그인 성공', `인증 코드: ${code.substring(0, 5)}...`);
            router.push('/(onboarding)/permission');
        } else if (response?.type === 'error') {
            Alert.alert('인증 오류', '문제가 발생했습니다.');
        }
    }, [response]);

    const handleSkip = () => {
        router.push('/(onboarding)/permission');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>환영합니다!</Text>
                <Text style={styles.subtitle}>더 즐거운 모임을 위해 로그인해주세요.</Text>
            </View>

            <View style={styles.footer}>
                {/* Kakao Login Button */}
                <TouchableOpacity
                    style={styles.kakaoButton}
                    onPress={() => promptAsync()}
                    disabled={!request}
                >
                    <MaterialCommunityIcons name="chat-processing" size={20} color="#000" style={{ marginRight: 8 }} />
                    <Text style={styles.kakaoButtonText}>카카오 로그인</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                    <Text style={styles.skipText}>일단 둘러보기</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', padding: 20 },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 32, fontWeight: 'bold', marginBottom: 40 },
    subtitle: { fontSize: 16, color: '#666' },
    footer: { marginBottom: 30 },

    // Kakao Button Styles (Yellow #FEE500, Text #000000)
    kakaoButton: {
        backgroundColor: '#FEE500',
        paddingVertical: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 15,
        flexDirection: 'row',
        justifyContent: 'center',
    },
    kakaoButtonText: {
        color: '#000000',
        fontSize: 16,
        fontWeight: 'bold'
    },

    skipButton: { padding: 15, alignItems: 'center' },
    skipText: { color: '#666', fontSize: 14 },
});
