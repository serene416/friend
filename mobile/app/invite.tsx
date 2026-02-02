import { getBackendUrl } from '@/constants/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BACKEND_URL = getBackendUrl();

type InviteStatus = 'loading' | 'success' | 'error';

export default function InviteScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const params = useLocalSearchParams<{ token?: string | string[] }>();
    const token = useMemo(() => (Array.isArray(params.token) ? params.token[0] : params.token), [params.token]);

    const [status, setStatus] = useState<InviteStatus>('loading');
    const [message, setMessage] = useState('초대 정보를 확인하는 중...');

    useEffect(() => {
        let cancelled = false;

        if (!token) {
            setStatus('error');
            setMessage('초대 토큰이 없습니다.');
            return;
        }

        if (!user?.id) {
            setStatus('error');
            setMessage('로그인이 필요합니다.');
            return;
        }

        (async () => {
            try {
                setStatus('loading');
                setMessage('초대 수락 중...');

                const response = await fetch(`${BACKEND_URL}/api/v1/friends/invite/accept`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, acceptor_user_id: user.id }),
                });

                const body = await response.json().catch(() => ({}));

                if (!response.ok) {
                    const detail = body?.detail || '초대 수락에 실패했습니다.';
                    throw new Error(detail);
                }

                if (cancelled) return;
                setStatus('success');
                setMessage('친구가 추가되었습니다!');
            } catch (error: any) {
                if (cancelled) return;
                setStatus('error');
                setMessage(error?.message || '알 수 없는 오류가 발생했습니다.');
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [token, user?.id]);

    const handleGoHome = () => {
        router.replace('/home');
    };

    const handleGoLogin = () => {
        router.replace('/(onboarding)/login');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.title}>친구 초대</Text>
                {status === 'loading' ? (
                    <ActivityIndicator size="large" color="#333" />
                ) : null}
                <Text style={styles.message}>{message}</Text>

                {status === 'success' ? (
                    <TouchableOpacity style={styles.primaryButton} onPress={handleGoHome}>
                        <Text style={styles.primaryButtonText}>홈으로 이동</Text>
                    </TouchableOpacity>
                ) : null}

                {status === 'error' ? (
                    <TouchableOpacity style={styles.secondaryButton} onPress={user?.id ? handleGoHome : handleGoLogin}>
                        <Text style={styles.secondaryButtonText}>{user?.id ? '홈으로 이동' : '로그인하기'}</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fcfcfc' },
    card: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 2,
    },
    title: { fontSize: 22, fontFamily: 'Pretendard-Bold', marginBottom: 12 },
    message: { fontSize: 15, fontFamily: 'Pretendard-Medium', color: '#444', marginTop: 16, textAlign: 'center' },
    primaryButton: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 28, backgroundColor: '#333', borderRadius: 12 },
    primaryButtonText: { color: '#fff', fontFamily: 'Pretendard-Bold', fontSize: 15 },
    secondaryButton: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 28, backgroundColor: '#f2f2f2', borderRadius: 12 },
    secondaryButtonText: { color: '#333', fontFamily: 'Pretendard-Bold', fontSize: 15 },
});
