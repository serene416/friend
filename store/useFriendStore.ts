import { create } from 'zustand';
import { Friend, MOCK_FRIENDS } from '../constants/data';

interface FriendState {
    friends: Friend[];
    selectedFriends: string[]; // List of Friend IDs

    // Actions
    toggleFriendSelection: (friendId: string) => void;
    addFriend: (friend: Friend) => void;
    removeFriend: (friendId: string) => void;
    resetSelection: () => void;
}

export const useFriendStore = create<FriendState>((set) => ({
    friends: MOCK_FRIENDS,
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

    resetSelection: () => set({ selectedFriends: [] }),
}));
