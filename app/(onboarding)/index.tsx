import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const SLIDES = [
    { id: 1, title: 'Special time with friends', desc: 'Find the perfect activity.' },
    { id: 2, title: 'Reflecting latest trends', desc: 'Visit the hottest places.' },
    { id: 3, title: 'Location-based recommendation', desc: 'Convenient meeting spots.' },
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
                <Text style={styles.buttonText}>{slideIndex === 2 ? 'Start' : 'Next'}</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 20, justifyContent: 'space-between' },
    slideContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    slide: { alignItems: 'center', paddingHorizontal: 20 },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
    desc: { fontSize: 16, color: '#666', textAlign: 'center' },
    pagination: { flexDirection: 'row', marginTop: 30 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ddd', marginHorizontal: 5 },
    activeDot: { backgroundColor: '#333' },
    button: { backgroundColor: '#333', paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginBottom: 20 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
