
import { useEffect } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { getMessaging, AuthorizationStatus } from '@react-native-firebase/messaging';
import { getFirestore, doc, updateDoc } from '@react-native-firebase/firestore';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import Toast from 'react-native-toast-message';

const useFCM = () => {
    const user = useSelector((state: RootState) => state.user.user);

    // Log Token Immediately on App Start
    useEffect(() => {
        getMessaging().getToken().then(token => {
            console.log("🔥 APP START FCM TOKEN:", token);
        }).catch(err => {
            console.log("❌ Error getting FCM token on start:", err);
        });

        // Subscribe to General Chat Topic for "Free" Broadcasts
        getMessaging().subscribeToTopic('general')
            .then(() => console.log('Subscribed to topic "general"'))
            .catch(err => console.error('Error subscribing to topic:', err));
    }, []);

    useEffect(() => {
        const requestUserPermission = async () => {
            if (Platform.OS === 'android' && Platform.Version >= 33) {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
                );
                if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                    getFCMToken();
                }
            } else {
                const authStatus = await getMessaging().requestPermission();
                const enabled =
                    authStatus === AuthorizationStatus.AUTHORIZED ||
                    authStatus === AuthorizationStatus.PROVISIONAL;

                if (enabled) {
                    getFCMToken();
                }
            }
        };

        const getFCMToken = async () => {
            try {
                const token = await getMessaging().getToken();
                console.log("FCM Token:", token); // DEBUG LOG
                if (user?.uid && token) {
                    saveTokenToDatabase(token);
                }
            } catch (error) {
                console.error("Error getting FCM token:", error);
            }
        };



        const saveTokenToDatabase = async (token: string) => {
            if (!user?.uid) return;
            const db = getFirestore();
            try {
                await updateDoc(doc(db, 'users', user.uid), {
                    fcmToken: token,
                });
            } catch (error) {
                console.error("Error saving FCM token:", error);
            }
        };

        requestUserPermission();

        // Listen for token refresh
        const unsubscribeTokenRefresh = getMessaging().onTokenRefresh(token => {
            if (user?.uid) {
                saveTokenToDatabase(token);
            }
        });

        // Foreground Message Handler
        const unsubscribeOnMessage = getMessaging().onMessage(async remoteMessage => {
            console.log("Foreground Message:", remoteMessage);

            // Backup Alert to verify reception
            Alert.alert(
                remoteMessage.notification?.title || 'New Notification',
                remoteMessage.notification?.body || 'You have a new message'
            );

            Toast.show({
                type: 'info',
                text1: remoteMessage.notification?.title || 'New Message',
                text2: remoteMessage.notification?.body || '',
                position: 'top',
                visibilityTime: 4000,
            });
        });

        return () => {
            unsubscribeTokenRefresh();
            unsubscribeOnMessage();
        };

    }, [user?.uid]);
};

export default useFCM;
