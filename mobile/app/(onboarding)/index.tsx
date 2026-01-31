import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const SLIDES = [
    { id: 1, title: '친구들과의 특별한 시간', desc: '완벽한 놀 거리를 찾아보세요.', image: require('../../assets/images/onboarding1.png') },
    { id: 2, title: '요즘 뜨는 트렌드 반영', desc: '가장 핫한 핫플을 추천해드려요.', image: require('../../assets/images/onboarding2.png') },
    { id: 3, title: '위치 기반 스마트 추천', desc: '친구들과 만나기 좋은 중간 지점을 찾아드려요.', image: require('../../assets/images/onboarding3.png') },
];

export default function OnboardingScreen() {
    const router = useRouter();
    const [slideIndex, setSlideIndex] = useState(0);

    const handleNext = () => {
        if (slideIndex < SLIDES.length - 1) {
            setSlideIndex(slideIndex + 1);
        } else {
            router.push('/(onboarding)/login');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.slideContainer}>
                {/* Simple Slider Implementation for MVP */}
                <View style={styles.slide}>
                    <Image source={SLIDES[slideIndex].image} style={styles.image} />
                    <Text style={styles.title}>{SLIDES[slideIndex].title}</Text>
                    <Text style={styles.desc}>{SLIDES[slideIndex].desc}</Text>
                </View>

                {/* Pagination Dots */}
                <View style={styles.pagination}>
                    {SLIDES.map((_, i) => (
                        <View key={i} style={[styles.dot, i === slideIndex && styles.activeDot]} />
                    ))}
                </View>
            </View>

            <TouchableOpacity style={styles.button} onPress={handleNext}>
                <Text style={styles.buttonText}>{slideIndex === 2 ? '시작하기' : '다음'}</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 20, justifyContent: 'space-between' },
    slideContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    slide: { alignItems: 'center', paddingHorizontal: 20 },
    image: { width: width * 0.8, height: width * 0.8, resizeMode: 'contain', marginBottom: 20 },
    title: { fontSize: 24, fontFamily: 'Pretendard-Bold', textAlign: 'center', marginBottom: 10 },
    desc: { fontSize: 16, color: '#666', fontFamily: 'Pretendard-Medium', textAlign: 'center' },
    pagination: { flexDirection: 'row', marginTop: 30 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ddd', marginHorizontal: 5 },
    activeDot: { backgroundColor: '#333' },
    button: { backgroundColor: '#333', paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginBottom: 20 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
