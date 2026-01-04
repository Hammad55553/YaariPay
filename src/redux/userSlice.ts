import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UserState {
    user: any | null; // Firebase User object
    isAuthenticated: boolean;
    loading: boolean;
}

const initialState: UserState = {
    user: null,
    isAuthenticated: false,
    loading: true,
};

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<any>) => {
            state.user = action.payload;
            state.isAuthenticated = !!action.payload;
            state.loading = false;
        },
        logout: (state) => {
            state.user = null;
            state.isAuthenticated = false;
            state.loading = false;
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        }
    },
});

export const { setUser, logout, setLoading } = userSlice.actions;
export default userSlice.reducer;
