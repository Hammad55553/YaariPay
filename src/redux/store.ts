import { configureStore } from '@reduxjs/toolkit';
import friendsReducer from './friendsSlice';
import expenseReducer from './expensesSlice';
import notificationReducer from './notificationsSlice';
import userReducer from './userSlice';

const store = configureStore({
    reducer: {
        friends: friendsReducer,
        expenses: expenseReducer,
        notifications: notificationReducer,
        user: userReducer,
    },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
