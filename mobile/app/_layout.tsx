import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="activity-detail"
          options={{
            headerShown: true,
            title: "Activity Details",
            headerBackTitle: "Back"
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
