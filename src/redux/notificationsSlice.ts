import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Notification {
    id: string;
    message: string;
    timestamp: number;
    read: boolean;
}

interface NotificationState {
    list: Notification[];
}

const initialState: NotificationState = {
    list: [],
};

const notificationSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        addNotification: (state, action: PayloadAction<Notification>) => {
            state.list.unshift(action.payload);
        },
        markAsRead: (state, action: PayloadAction<string>) => {
            const notification = state.list.find(n => n.id === action.payload);
            if (notification) {
                notification.read = true;
            }
        },
    },
});

export const { addNotification, markAsRead } = notificationSlice.actions;
export default notificationSlice.reducer;
