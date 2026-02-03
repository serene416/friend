import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyScreen() {
    const router = useRouter();

    const PolicySection = ({ title, children }: { title: string, children: React.ReactNode }) => (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.sectionContent}>{children}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>개인정보 처리방침</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.introContainer}>
                    <Text style={styles.introTitle}>개인정보 보호를 위해{'\n'}최선을 다하겠습니다.</Text>
                    <Text style={styles.introText}>
                        [우리 오늘 뭐 해?]는 회원의 개인정보를 중요하게 생각하며,
                        "개인정보보호법" 등 관련 법령을 준수하고 있습니다.
                    </Text>
                    <Text style={styles.dateText}>최종 수정일: 2026년 2월 3일</Text>
                </View>

                <PolicySection title="1. 개인정보의 수집 및 이용 목적">
                    회사는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.{'\n\n'}
                    • 회원 가입 의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증{'\n'}
                    • 위치 기반 서비스 제공 (내 주변 친구/활동 찾기 등){'\n'}
                    • 서비스 부정이용 방지 및 비인가 사용 방지
                </PolicySection>

                <PolicySection title="2. 수집하는 개인정보 항목">
                    회사는 서비스 제공을 위해 최소한의 개인정보를 수집하고 있습니다.{'\n\n'}
                    [필수항목]{'\n'}
                    • 닉네임, 프로필 사진, 실시간 위치 정보, 기기 식별값{'\n\n'}
                    [자동 수집항목]{'\n'}
                    • 서비스 이용 기록, 접속 로그, 쿠키, 접속 IP 정보
                </PolicySection>

                <PolicySection title="3. 개인정보의 보유 및 이용기간">
                    회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.{'\n\n'}
                    • 회원 탈퇴 시: 지체 없이 파기{'\n'}
                    • 부정이용 방지: 탈퇴 후 1년간 보관 (부정 이용 기록에 한함)
                </PolicySection>

                <PolicySection title="4. 개인정보의 파기절차 및 방법">
                    회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다.{'\n'}
                    파기 방법은 전자적 파일 형태인 경우 복구 및 재생되지 않도록 기술적인 방법을 이용하여 완전하게 삭제합니다.
                </PolicySection>

                <PolicySection title="5. 개인정보의 안전성 확보조치">
                    회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.{'\n\n'}
                    1. 개인정보의 암호화 (전송 구간 및 저장 시){'\n'}
                    2. 해킹 등에 대비한 기술적 대책 수립 및 운영{'\n'}
                    3. 개인정보 취급 직원의 최소화 및 교육
                </PolicySection>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        개인정보 처리와 관련하여 궁금한 점이 있으시면{'\n'}언제든지 고객센터로 문의해 주세요.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F2F2F2',
        backgroundColor: '#fff',
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: 17,
        fontFamily: 'Pretendard-Bold',
        color: '#1A1A1A',
    },
    content: {
        padding: 24,
        paddingBottom: 40,
    },
    introContainer: {
        marginBottom: 32,
        paddingBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#F2F2F2',
        backgroundColor: '#FAFAFA',
        padding: 20,
        borderRadius: 12,
    },
    introTitle: {
        fontSize: 20,
        fontFamily: 'Pretendard-Bold',
        color: '#333',
        marginBottom: 8,
        lineHeight: 28,
    },
    introText: {
        fontSize: 14,
        lineHeight: 22,
        color: '#666',
        fontFamily: 'Pretendard-Regular',
        marginBottom: 12,
    },
    dateText: {
        fontSize: 12,
        color: '#999',
        fontFamily: 'Pretendard-Medium',
    },
    section: {
        marginBottom: 28,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: 'Pretendard-Bold',
        color: '#333',
        marginBottom: 10,
    },
    sectionContent: {
        fontSize: 14,
        lineHeight: 24,
        color: '#555',
        fontFamily: 'Pretendard-Regular',
        textAlign: 'justify',
    },
    footer: {
        marginTop: 10,
        padding: 16,
        backgroundColor: '#F8F8F8',
        borderRadius: 8,
    },
    footerText: {
        fontSize: 13,
        color: '#888',
        textAlign: 'center',
        fontFamily: 'Pretendard-Regular',
        lineHeight: 20,
    },
});
