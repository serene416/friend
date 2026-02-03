import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>개인정보 처리방침</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.text}>
                    1. 개인정보의 처리 목적{'\n'}
                    [우리 오늘 뭐 해?] (이하 "회사")는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.{'\n. . '}
                    - 회원 가입 및 관리{'\n'}
                    - 서비스 제공 (위치 기반 서비스 등){'\n\n'}

                    2. 처리하는 개인정보 항목{'\n'}
                    회사는 다음의 개인정보 항목을 처리하고 있습니다.{'\n'}
                    - 필수항목: 닉네임, 프로필 사진, 위치 정보{'\n\n'}

                    3. 개인정보의 파기{'\n'}
                    회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.{'\n\n'}

                    4. 개인정보의 안전성 확보조치{'\n'}
                    회사는 개인정보의 안전성 확보를 위해 관리적, 기술적, 물리적 조치를 취하고 있습니다.{'\n\n'}

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
