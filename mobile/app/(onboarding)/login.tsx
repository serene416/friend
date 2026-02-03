import { getBackendUrl } from '@/constants/api';
import { useAuthStore } from '@/store/useAuthStore';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

const KAKAO_JS_KEY = '8723438c42d292525222427c14337829'; // User provided key
const REDIRECT_URI = 'http://localhost:8081/auth/kakao/callback'; // Dummy URI for interception

// Configure Backend URL
// 1) Prefer EXPO_PUBLIC_BACKEND_URL (set automatically in npm run start:lan)
// 2) Otherwise infer from Expo host URI
// 3) Fallbacks: Android emulator -> 10.0.2.2, iOS simulator -> localhost
const BACKEND_URL = getBackendUrl();

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
            const avatar = profileResponse.data.properties?.thumbnail_image || profileResponse.data.kakao_account?.profile?.thumbnail_image_url || null;

            // 3. Send Token to Backend
            const backendResponse = await axios.post(`${BACKEND_URL}/api/v1/auth/kakao`, {
                kakao_access_token: access_token,
                nickname: nickname,
                profile_image: avatar,
            });

            if (backendResponse.status === 200) {
                const userData = backendResponse.data;
                const finalUser = {
                    id: userData.user_id,
                    kakao_id: userData.kakao_id,
                    nickname: userData.nickname || nickname,
                    avatar: userData.profile_image || avatar,
                };
                login(finalUser, access_token);
                // Navigate to Main App (Home Tab)
                // @ts-ignore - Valid route in Expo Router
                router.replace('/home');
            }

        } catch (e: any) {
            console.error('Login Error:', e.response?.data || e.message);
            const errorMessage = e.response?.data?.detail || e.message || 'Unknown error';
            Alert.alert('Login Error', `Failed: ${JSON.stringify(errorMessage)}`);
        }
    };

    const handleSkip = () => {
        router.push('/(tabs)/home');
    };

    const runFirst = `
      window.ReactNativeWebView.postMessage(document.body.innerText);
      true;
    `;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>환영합니다</Text>
                <Text style={styles.subtitle}>로그인하여 시작해보세요</Text>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.button, styles.kakaoButton]}
                    onPress={() => setIsWebViewVisible(true)}
                >
                    <Text style={[styles.buttonText, { color: '#000' }]}>카카오로 로그인하기</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                    <Text style={styles.skipText}>다음에 하기</Text>
                </TouchableOpacity>

                {/* Debug Info in Dev */}
                <Text style={styles.debugText}>
                    Redirect URI: {REDIRECT_URI}
                </Text>
                <Text style={styles.debugText}>
                    Backend URL: {BACKEND_URL}
                </Text>
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
                        <Text style={styles.closeButtonText}>닫기</Text>
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
    container: { flex: 1, backgroundColor: '#fff', padding: 20 },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { fontFamily: 'Pretendard-Bold', fontSize: 32, marginBottom: 24 }, // Increased spacing
    subtitle: { fontFamily: 'Pretendard-Medium', fontSize: 18, color: '#666' }, // Slightly larger
    footer: { marginBottom: 20, alignItems: 'center', paddingHorizontal: 10 },
    skipButton: { padding: 10, alignItems: 'center' },
    skipText: { fontFamily: 'Pretendard-Medium', color: '#888', fontSize: 15 },
    button: {
        width: '100%',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 12, // Spacing between Kakao and Skip
    },
    kakaoButton: {
        backgroundColor: '#FEE500', // Kakao Yellow
    },
    buttonText: {
        fontFamily: 'Pretendard-Bold',
        fontSize: 17,
    },
    closeButton: {
        padding: 10,
        alignItems: 'flex-end',
        backgroundColor: '#f0f0f0'
    },
    closeButtonText: {
        fontFamily: 'Pretendard-Bold',
        fontSize: 16,
        color: '#007AFF',
    },
    debugText: {
        fontFamily: 'Pretendard-Medium',
        fontSize: 10,
        color: 'gray',
        marginTop: 5,
        textAlign: 'center'
    }
});
