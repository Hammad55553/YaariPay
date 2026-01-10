import React, { useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import FriendsScreen from '../screens/FriendsScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import SummaryScreen from '../screens/SummaryScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import FriendDetailScreen from '../screens/FriendDetailScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ChatScreen from '../screens/ChatScreen';
import { useSelector, useDispatch } from 'react-redux';
import { getAuth } from '@react-native-firebase/auth';
import { setUser } from '../redux/userSlice';
import { setExpenses } from '../redux/expensesSlice';
import { setFriends } from '../redux/friendsSlice';
import { RootState } from '../redux/store';
import { ActivityIndicator, View } from 'react-native';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
// We will stick to the default export for the instance for now as it is safest with RNFirebase v15+, 
// but we will use the methods that avoid the specific deprecation warnings if possible, 
// or simply acknowledge that 'collection()' usually refers to the Modular API. 
// However, since the error explicitly said "Method called was `collection`. Please use `collection()` instead", 
// it strongly suggests migrating to: 
// import { collection, onSnapshot, query, orderBy, doc, writeBatch } from '@react-native-firebase/firestore';
// Let's try to switch to that.
import { getFirestore, collection, onSnapshot, query, orderBy, doc, writeBatch, getDoc, updateDoc, setDoc, serverTimestamp } from '@react-native-firebase/firestore';
import { getFriendPhone } from '../utils/phoneMapper';
import { AppState } from 'react-native';
import useFCM from '../hooks/useFCM';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { isAuthenticated, loading } = useSelector((state: RootState) => state.user);
  const dispatch = useDispatch();

  useFCM();

  /* Inline Presence Logic */
  const appState = React.useRef(AppState.currentState);
  useEffect(() => {
    if (!isAuthenticated || !getAuth().currentUser?.uid) return;
    const uid = getAuth().currentUser?.uid;
    const db = getFirestore();
    const userRef = doc(db, 'users', uid!);

    const setOnline = async () => {
      try {
        await setDoc(userRef, {
          isOnline: true,
          lastSeen: serverTimestamp(),
          name: getAuth().currentUser?.displayName || 'User',
          email: getAuth().currentUser?.email
        }, { merge: true });
      } catch (error) {
        console.error("Error setting online:", error);
      }
    };

    const setOffline = async () => {
      try {
        await updateDoc(userRef, {
          isOnline: false,
          lastSeen: serverTimestamp()
        });
      } catch (error) {
        console.error("Error setting offline:", error);
      }
    };

    setOnline();

    const subscription = AppState.addEventListener('change', (nextAppState: any) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        setOnline();
      } else if (nextAppState.match(/inactive|background/)) {
        setOffline();
      }
      appState.current = nextAppState;
    });

    return () => {
      setOffline();
      subscription.remove();
    };
  }, [isAuthenticated]);
  /* End Inline Presence Logic */

  // Firebase Auth Listener
  useEffect(() => {
    const subscriber = getAuth().onAuthStateChanged(async (user) => {
      if (user) {
        let displayName = user.displayName;

        // Fallback: If Auth profile has no name, check Firestore 'users' collection
        if (!displayName) {
          try {
            const db = getFirestore();
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              if (userData && userData.name) {
                displayName = userData.name;
                // Self-healing: Update Auth profile for next time
                user.updateProfile({ displayName: userData.name }).catch(console.error);
              }
            }
          } catch (err) {
            console.error("Error fetching user profile fallback:", err);
          }
        }

        dispatch(setUser({ uid: user.uid, email: user.email, displayName: displayName }));
      } else {
        dispatch(setUser(null));
      }
    });
    return subscriber; // unsubscribe on unmount
  }, []);

  // Firestore Expenses Listener
  // Firestore Expenses Listener
  useEffect(() => {
    if (isAuthenticated) {
      const db = getFirestore();
      const expensesRef = collection(db, 'expenses');
      const q = query(expensesRef, orderBy('timestamp', 'desc'));

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const expensesArr: any[] = [];
        if (querySnapshot) {
          querySnapshot.forEach((documentSnapshot: any) => {
            expensesArr.push({
              ...documentSnapshot.data(),
              id: documentSnapshot.id,
            });
          });
        }
        dispatch(setExpenses(expensesArr));
      }, (error: any) => {
        if (error.code === 'firestore/permission-denied') {
          console.log("Permission denied. Keeping local state or showing error.");
        }
        console.error("Firestore expenses sync error:", error);
      });

      return () => unsubscribe();
    }
  }, [isAuthenticated]);

  // Firestore Friends Listener & Seeding
  // Firestore Friends Listener & Seeding
  useEffect(() => {
    if (!isAuthenticated) return;

    const db = getFirestore();
    const friendsRef = collection(db, 'friends');

    const unsubscribe = onSnapshot(friendsRef, async (querySnapshot) => {
      if (!querySnapshot || querySnapshot.empty) {
        console.log("Seeding initial friends...");
        const initialFriends = [
          { id: '1', name: 'Abdullah', image: 'Abdullah', balance: 0 },
          { id: '2', name: 'Ahtasham', image: 'Ahtasham', balance: 0 },
          { id: '3', name: 'Sufyan', image: 'Sufyan', balance: 0 },
          { id: '4', name: 'Abubakar', image: 'Abubakar', balance: 0 },
          { id: '5', name: 'Ans', image: 'Ans', balance: 0 },
          { id: '6', name: 'Bilal', image: 'Bilal', balance: 0 },
          { id: '7', name: 'Hammad', image: 'Hammad', balance: 0 },
        ];

        const batch = writeBatch(db);
        initialFriends.forEach(friend => {
          const docRef = doc(db, 'friends', friend.id);
          batch.set(docRef, friend);
        });
        await batch.commit();
        return;
      }

      const friendsList: any[] = [];
      querySnapshot.forEach((d: any) => {
        const data = d.data();
        const friendId = d.id;

        // Sync Phone Logic
        const expectedPhone = getFriendPhone(data.name);
        if (expectedPhone && data.phone !== expectedPhone) {
          console.log(`Syncing phone for ${data.name} (${friendId})`);
          // Update Firestore document
          updateDoc(doc(db, 'friends', friendId), { phone: expectedPhone })
            .catch(err => console.error("Error syncing phone:", err));
        }

        friendsList.push({ id: friendId, ...data });
      });

      // Shuffle friends list randomly
      friendsList.sort(() => 0.5 - Math.random());
      dispatch(setFriends(friendsList));
    }, (error: any) => {
      if (error.code === 'firestore/permission-denied') {
        console.log("Permission denied for friends sync.");
      }
      console.error("Firestore friends sync error", error);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
        <ActivityIndicator size="large" color="#00FFFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          // Main App Stack
          <>
            <Stack.Screen name="Friends" component={FriendsScreen} />
            <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
            <Stack.Screen name="Summary" component={SummaryScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="FriendDetail" component={FriendDetailScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
          </>
        ) : (
          // Auth Stack
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;