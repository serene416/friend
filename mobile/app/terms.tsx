import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TermsScreen() {
    const router = useRouter();

    const TermSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
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
                <Text style={styles.headerTitle}>서비스 이용약관</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.introContainer}>
                    <Text style={styles.introTitle}>환영합니다!</Text>
                    <Text style={styles.introText}>
                        [우리 오늘 뭐 해?] 서비스 이용을 진심으로 환영합니다.
                        본 약관은 회원님의 권리 및 의무, 책임사항을 규정하고 있습니다.
                    </Text>
                    <Text style={styles.dateText}>시행일: 2026년 2월 3일</Text>
                </View>

                <TermSection title="제1조 (목적)">
                    본 약관은 [우리 오늘 뭐 해?] (이하 "회사")가 제공하는 위치 기반 친구 찾기 및 활동 추천 서비스(이하 "서비스")의 이용과 관련하여 회사와 회원의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
                </TermSection>

                <TermSection title="제2조 (용어의 정의)">
                    1. "서비스"란 단말기(PC, 휴대형단말기 등 포함) 상관없이 회원이 이용할 수 있는 [우리 오늘 뭐 해?] 및 관련 제반 서비스를 의미합니다.{'\n'}
                    2. "회원"이란 본 약관에 따라 회사와 이용계약을 체결하고 회사가 제공하는 서비스를 이용하는 고객을 말합니다.{'\n'}
                    3. "위치정보"란 GPS 등을 통해 수집된 회원의 실시간 위치 정보를 의미합니다.
                </TermSection>

                <TermSection title="제3조 (약관의 게시와 개정)">
                    1. 회사는 본 약관의 내용을 회원이 쉽게 확인할 수 있도록 서비스 초기 화면 또는 설정 메뉴에 게시합니다.{'\n'}
                    2. 회사는 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있으며, 개정 시에는 적용일자 및 개정사유를 명시하여 현행약관과 함께 서비스 내에 공지합니다.
                </TermSection>

                <TermSection title="제4조 (서비스의 제공 및 변경)">
                    회사는 회원에게 아래와 같은 서비스를 제공합니다.{'\n'}
                    1. 위치 기반 내 주변 친구 / 활동 찾기{'\n'}
                    2. 실시간 날씨 및 활동 추천 정보 제공{'\n'}
                    3. 커뮤니티 및 소셜 네트워킹 기능{'\n'}
                    4. 기타 회사가 추가 개발하거나 제휴 등을 통해 제공하는 일체의 서비스
                </TermSection>

                <TermSection title="제5조 (개인정보보호 의무)">
                    회사는 "개인정보보호법" 등 관계 법령이 정하는 바에 따라 회원의 개인정보를 보호하기 위해 노력합니다. 개인정보의 보호 및 사용에 대해서는 관련 법령 및 회사의 개인정보처리방침이 적용됩니다.
                </TermSection>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        본 약관에 명시되지 않은 사항은 관계 법령 및 상관례에 따릅니다.
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
    },
    footerText: {
        fontSize: 13,
        color: '#888',
        textAlign: 'center',
        fontFamily: 'Pretendard-Regular',
    },
});
