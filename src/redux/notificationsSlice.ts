import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Notification {
    id: string;
    message: string;
    timestamp: number;
    read: boolean;
}

interface NotificationState {
    list: Notification[];
    unreadChatCount: number;
}

const initialState: NotificationState = {
    list: [],
    unreadChatCount: 0,
};

const notificationSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        setUnreadChatCount: (state, action: PayloadAction<number>) => {
            state.unreadChatCount = action.payload;
        },
        addNotification: (state, action: PayloadAction<Notification>) => {
            state.list.unshift(action.payload);
        },
        setNotifications: (state, action: PayloadAction<Notification[]>) => {
            state.list = action.payload;
        },
        markAsRead: (state, action: PayloadAction<string>) => {
            const notification = state.list.find(n => n.id === action.payload);
            if (notification) {
                notification.read = true;
            }
        },
    },
});

export const { addNotification, markAsRead, setUnreadChatCount, setNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;
