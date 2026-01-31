import { create } from 'zustand';

export interface User {
    id: string; // our backend user_id
    kakao_id?: string;
    nickname: string;
    avatar?: string;
}

interface AuthState {
    user: User | null;
    accessToken: string | null; // Kakao Access Token
    isAuthenticated: boolean;
    login: (user: User, token: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    login: (user, token) => set({ user, accessToken: token, isAuthenticated: true }),
    logout: () => set({ user: null, accessToken: null, isAuthenticated: false }),
}));
