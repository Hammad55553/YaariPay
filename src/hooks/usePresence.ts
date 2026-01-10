import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getFirestore, doc, updateDoc, serverTimestamp, setDoc } from '@react-native-firebase/firestore';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';

const usePresence = () => {
    const user = useSelector((state: RootState) => state.user.user);
    const appState = useRef(AppState.currentState);

    useEffect(() => {
        if (!user?.uid) return;

        const db = getFirestore();
        const userRef = doc(db, 'users', user.uid);

        const setOnline = async () => {
            try {
                await setDoc(userRef, {
                    isOnline: true,
                    lastSeen: serverTimestamp(),
                    name: user.displayName || 'User', // Ensure basic info is there
                    email: user.email
                }, { merge: true });
            } catch (error) {
                console.error("Error setting online status:", error);
            }
        };

        const setOffline = async () => {
            try {
                await updateDoc(userRef, {
                    isOnline: false,
                    lastSeen: serverTimestamp()
                });
            } catch (error) {
                console.error("Error setting offline status:", error);
            }
        };

        // Set online on mount
        setOnline();

        // Handle AppState changes
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (
                appState.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                setOnline();
            } else if (nextAppState.match(/inactive|background/)) {
                setOffline();
            }
            appState.current = nextAppState;
        });

        // Cleanup on unmount (or logout)
        return () => {
            setOffline();
            subscription.remove();
        };

    }, [user?.uid]);
};

export default usePresence;
