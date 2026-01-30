import { Stack } from 'expo-router';

export default function OnboardingLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="permission" options={{ presentation: 'transparentModal', animation: 'fade' }} />
        </Stack>
    );
}
