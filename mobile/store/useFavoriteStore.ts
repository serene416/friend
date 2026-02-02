import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface FavoriteState {
    favorites: string[]; // List of Activity IDs
    toggleFavorite: (id: string) => void;
    isFavorite: (id: string) => boolean;
}

export const useFavoriteStore = create<FavoriteState>()(
    persist(
        (set, get) => ({
            favorites: [],
            toggleFavorite: (id) => set((state) => {
                const isFav = state.favorites.includes(id);
                return {
                    favorites: isFav
                        ? state.favorites.filter((favId) => favId !== id)
                        : [...state.favorites, id],
                };
            }),
            isFavorite: (id) => get().favorites.includes(id),
        }),
        {
            name: 'favorite-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
