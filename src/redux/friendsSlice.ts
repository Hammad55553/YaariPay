import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Friend model
export interface Friend {
    id: string;
    name: string;
    image: string | number;
    balance: number;
    phone?: string;
    description?: string;
}

// Slice state
interface FriendsState {
    list: Friend[];
}

const initialState: FriendsState = {
    list: [],
};

const friendsSlice = createSlice({
    name: 'friends',
    initialState,
    reducers: {
        addFriend: (state, action: PayloadAction<Friend>) => {
            state.list.push(action.payload);
        },
        setFriends: (state, action: PayloadAction<Friend[]>) => {
            state.list = action.payload;
        },
    },
});

export const { addFriend, setFriends } = friendsSlice.actions;
export default friendsSlice.reducer;
