import Constants from 'expo-constants';
import { Platform } from 'react-native';

const BACKEND_PORT = '8000';

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1']);
const HOST_FROM_URL_REGEX = /^(https?:\/\/)([^/:?#]+)/i;
const IPV4_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$/;

const getHostUri = () => {
    const hostUri =
        Constants.expoConfig?.hostUri ||
        Constants.expoGoConfig?.hostUri ||
        Constants.manifest2?.extra?.expoGo?.developer?.hostUri ||
        Constants.manifest?.hostUri;

    if (!hostUri) return null;
    return hostUri.split(':')[0];
};

const normalizeHostForPlatform = (host: string) => {
    if (Platform.OS === 'android' && LOCALHOST_HOSTS.has(host)) {
        return '10.0.2.2';
    }

    return host;
};

const normalizeBackendUrl = (url: string) => {
    const sanitized = url.trim().replace(/\/+$/, '');
    const hostMatch = sanitized.match(HOST_FROM_URL_REGEX);
    const matchedHost = hostMatch?.[2]?.toLowerCase();
    const hostFromExpo = getHostUri()?.toLowerCase();

    // When .env points to localhost, prefer the Expo dev host IP on physical devices.
    if (matchedHost && LOCALHOST_HOSTS.has(matchedHost)) {
        if (hostFromExpo && IPV4_REGEX.test(hostFromExpo) && !LOCALHOST_HOSTS.has(hostFromExpo)) {
            return sanitized.replace(HOST_FROM_URL_REGEX, `$1${hostFromExpo}`);
        }

        if (Platform.OS === 'android') {
            return sanitized
                .replace('://localhost', '://10.0.2.2')
                .replace('://127.0.0.1', '://10.0.2.2');
        }
    }

    return sanitized;
};

export const getBackendUrl = () => {
    const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
    if (envUrl) {
        return normalizeBackendUrl(envUrl);
    }

    const host = getHostUri();
    if (host) {
        return `http://${normalizeHostForPlatform(host)}:${BACKEND_PORT}`;
    }

    if (Platform.OS === 'android') {
        return `http://10.0.2.2:${BACKEND_PORT}`;
    }

    return `http://localhost:${BACKEND_PORT}`;
};
