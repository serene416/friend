import * as Font from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { SafeAreaProvider as SafeAreaViewProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.preventAutoHideAsync();
        await Font.loadAsync({
          'Pretendard-Medium': require('../assets/fonts/Pretendard-Medium.otf'),
          'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.otf'),
        });
      } catch (e) {
        console.warn('Error loading fonts:', e);
        // Continue even if fonts fail to load
      } finally {
        setAppIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (!appIsReady) {
    return null;
  }

  return (
    <SafeAreaViewProvider>
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
    </SafeAreaViewProvider>
  );
}
