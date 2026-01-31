import axios from 'axios';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAuthStore } from '../../store/useAuthStore';

const KAKAO_JS_KEY = '8723438c42d292525222427c14337829'; // User provided key
const REDIRECT_URI = 'http://localhost:8081/auth/kakao/callback'; // Dummy URI for interception

// Configure Backend URL - Update this with your actual machine IP if testing on device
// For Android Emulator use 'http://10.0.2.2:8000'
// For iOS Simulator use 'http://localhost:8000'
// For Physical Device, use your computer's LAN IP (e.g. 10.249.xx.xx)
const BACKEND_URL = 'http://10.249.79.38:8000'; // Updated to match Expo IP from logs

export default function LoginScreen() {
    const router = useRouter();
    const login = useAuthStore((state) => state.login);
    const [isWebViewVisible, setIsWebViewVisible] = useState(false);

    const handleKakaoLogin = async (code: string) => {
        setIsWebViewVisible(false); // Close WebView first
        try {
            // 1. Exchange Code for Token
            const tokenResponse = await axios.post('https://kauth.kakao.com/oauth/token', null, {
                params: {
                    grant_type: 'authorization_code',
                    client_id: KAKAO_JS_KEY,
                    redirect_uri: REDIRECT_URI,
                    code: code,
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
                },
            });

            const { access_token } = tokenResponse.data;

            if (!access_token) throw new Error('No access token received');

            // 2. Fetch User Profile for Nickname
            const profileResponse = await axios.get('https://kapi.kakao.com/v2/user/me', {
                headers: { Authorization: `Bearer ${access_token}` },
            });

            const nickname = profileResponse.data.properties?.nickname || profileResponse.data.kakao_account?.profile?.nickname || 'Unknown';

            // 3. Send Token to Backend
            const backendResponse = await axios.post(`${BACKEND_URL}/api/v1/auth/kakao`, {
                kakao_access_token: access_token,
                nickname: nickname
            });

            if (backendResponse.status === 200) {
                const userData = backendResponse.data;
                login(userData, access_token);
                // Navigate to Main App
                // @ts-ignore - Valid route in Expo Router
                router.replace('/(tabs)');
            }

        } catch (e: any) {
            console.error('Login Error:', e.response?.data || e.message);
            const errorMessage = e.response?.data?.detail || e.message || 'Unknown error';
            Alert.alert('Login Error', `Failed: ${JSON.stringify(errorMessage)}`);
        }
    };

    const handleSkip = () => {
        router.push('/(onboarding)/permission');
    };

    const runFirst = `
      window.ReactNativeWebView.postMessage(document.body.innerText);
      true;
    `;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Welcome</Text>
                <Text style={styles.subtitle}>Sign in to start exploring</Text>

                <TouchableOpacity
                    style={[styles.button, styles.kakaoButton]}
                    onPress={() => setIsWebViewVisible(true)}
                >
                    <Text style={[styles.buttonText, { color: '#000' }]}>Login with Kakao</Text>
                </TouchableOpacity>

                {/* Debug Info in Dev */}
                <Text style={{ fontSize: 10, color: 'gray', marginTop: 10 }}>
                    Redirect URI: {REDIRECT_URI}
                </Text>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                    <Text style={styles.skipText}>Skip for now</Text>
                </TouchableOpacity>
            </View>

            {/* Kakao Login WebView Modal */}
            <Modal
                visible={isWebViewVisible}
                animationType="slide"
                onRequestClose={() => setIsWebViewVisible(false)} // Handle Android back button
            >
                <SafeAreaView style={{ flex: 1 }}>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setIsWebViewVisible(false)}
                    >
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                    <WebView
                        source={{
                            uri: `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_JS_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code`
                        }}
                        injectedJavaScript={runFirst}
                        onShouldStartLoadWithRequest={(request) => {
                            // Intercept Redirect (iOS mainly)
                            if (request.url.startsWith(REDIRECT_URI)) {
                                const url = new URL(request.url);
                                const code = url.searchParams.get('code');
                                if (code) {
                                    handleKakaoLogin(code);
                                } else {
                                    setIsWebViewVisible(false);
                                }
                                return false; // Stop loading
                            }
                            return true; // Continue loading other URLs
                        }}
                        onNavigationStateChange={(e) => {
                            // Intercept Redirect (Android)
                            if (e.url.startsWith(REDIRECT_URI)) {
                                const url = new URL(e.url);
                                const code = url.searchParams.get('code');
                                if (code) {
                                    handleKakaoLogin(code);
                                }
                                // We can't return false here to stop loading on Android in the same way, 
                                // but we handle the login.
                            }
                        }}
                        // Android specific: ensure allows external creates new intent only if not intercepted
                        setSupportMultipleWindows={false}
                    />
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', padding: 20 },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
    subtitle: { fontSize: 16, color: '#666', marginBottom: 40 },
    footer: { marginBottom: 30 },
    skipButton: { padding: 15, alignItems: 'center' },
    skipText: { color: '#666', fontSize: 14 },
    button: {
        width: '100%',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 10,
    },
    kakaoButton: {
        backgroundColor: '#FEE500', // Kakao Yellow
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 10,
        alignItems: 'flex-end',
        backgroundColor: '#f0f0f0'
    },
    closeButtonText: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: 'bold'
    }
});
