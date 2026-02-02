import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_REMOTE_BACKEND = 'https://playwithme.ngrok.app';

const getHostUri = () => {
    const hostUri =
        Constants.expoConfig?.hostUri ||
        Constants.expoGoConfig?.hostUri ||
        Constants.manifest2?.extra?.expoGo?.developer?.hostUri ||
        Constants.manifest?.hostUri;

    if (!hostUri) return null;
    return hostUri.split(':')[0];
};

export const getBackendUrl = () => {
    const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;

    if (envUrl && !envUrl.includes('localhost')) {
        return envUrl;
    }

    const host = getHostUri();
    if (host) {
        return `http://${host}:8000`;
    }

    if (envUrl) {
        if (Platform.OS === 'android' && envUrl.includes('localhost')) {
            return 'http://10.0.2.2:8000';
        }
        return envUrl;
    }

    return DEFAULT_REMOTE_BACKEND;
};
