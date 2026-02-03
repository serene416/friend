import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TermsScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>이용약관</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.text}>
                    제1조 (목적){'\n'}
                    본 약관은 [우리 오늘 뭐 해?] (이하 "회사")가 제공하는 서비스의 이용조건 및 절차, 회사와 회원의 권리, 의무 및 책임사항 등을 규정함을 목적으로 합니다.{'\n\n'}

                    제2조 (용어의 정의){'\n'}
                    1. "서비스"라 함은 회사가 제공하는 모바일 애플리케이션 및 관련 제반 서비스를 의미합니다.{'\n'}
                    2. "회원"이라 함은 본 약관에 동의하고 서비스를 이용하는 자를 의미합니다.{'\n\n'}

                    제3조 (약관의 효력 및 변경){'\n'}
                    1. 본 약관은 서비스 화면에 게시하거나 기타의 방법으로 공지함으로써 효력이 발생합니다.{'\n'}
                    2. 회사는 필요한 경우 관련 법령을 위배하지 않는 범위 내에서 본 약관을 변경할 수 있습니다.{'\n\n'}

                    제4조 (서비스의 제공){'\n'}
                    회사는 회원에게 다음과 같은 서비스를 제공합니다.{'\n'}
                    1. 위치 기반 친구 추천 서비스{'\n'}
                    2. 날씨 정보 제공 서비스{'\n'}
                    3. 기타 회사가 정하는 서비스{'\n\n'}

                    (이하 생략 - 실제 운영 시 필요한 법적 검토를 거친 내용을 작성해주세요.)
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: { padding: 10 },
    backButtonText: { fontSize: 24, color: '#333' },
    headerTitle: { fontSize: 18, fontFamily: 'Pretendard-Bold', color: '#333' },
    content: { padding: 20 },
    text: { fontSize: 14, lineHeight: 24, color: '#555', fontFamily: 'Pretendard-Medium' },
});
