import { create } from 'zustand';
import { getBackendUrl } from '../constants/api';
import { Friend } from '../constants/data';

const BACKEND_URL = getBackendUrl();

interface FriendState {
    friends: Friend[];
    selectedFriends: string[]; // List of Friend IDs

    // Actions
    toggleFriendSelection: (friendId: string) => void;
    addFriend: (friend: Friend) => void;
    removeFriend: (friendId: string) => void;
    setFriends: (friends: Friend[]) => void;
    loadFriends: (userId: string) => Promise<void>;
    resetSelection: () => void;
}

export const useFriendStore = create<FriendState>((set) => ({
    friends: [],
    selectedFriends: [],

    toggleFriendSelection: (friendId) =>
        set((state) => {
            const isSelected = state.selectedFriends.includes(friendId);
            if (isSelected) {
                return { selectedFriends: state.selectedFriends.filter((id) => id !== friendId) };
            } else {
                return { selectedFriends: [...state.selectedFriends, friendId] };
            }
        }),

    addFriend: (friend) =>
        set((state) => ({ friends: [...state.friends, friend] })),

    removeFriend: (friendId) =>
        set((state) => ({
            friends: state.friends.filter((f) => f.id !== friendId),
            selectedFriends: state.selectedFriends.filter((id) => id !== friendId), // Also remove from selection
        })),

    setFriends: (friends) => set({ friends }),

    loadFriends: async (userId) => {
        const response = await fetch(`${BACKEND_URL}/api/v1/friends?user_id=${userId}`);
        if (!response.ok) {
            throw new Error('친구 목록을 불러올 수 없습니다.');
        }
        const data = await response.json();
        const friends: Friend[] = data.map((user: any) => ({
            id: user.id,
            name: user.nickname,
            avatar: user.profile_image || `https://i.pravatar.cc/150?u=${user.id}`,
            status: 'offline',
            location: '',
        }));
        set({ friends });
    },

    resetSelection: () => set({ selectedFriends: [] }),
}));
