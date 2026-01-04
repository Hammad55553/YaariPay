import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import auth from '@react-native-firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { setUser } from '../redux/userSlice';
import { wp, hp } from '../utils/responsive';

const SignupScreen = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigation = useNavigation<any>();
    const dispatch = useDispatch();

    const handleSignup = async () => {
        if (!email || !password || !name) {
            setError('Please fill in all fields');
            return;
        }
        try {
            setLoading(true);
            setError('');
            const userCredential = await auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Update displayName
            await user?.updateProfile({
                displayName: name,
            });



            // Reload user to get fresh token/data (optional but good practice)
            await user?.reload();
            const updatedUser = auth().currentUser;

            // Manually update Redux because onAuthStateChanged might have fired before updateProfile
            if (updatedUser) {
                dispatch(setUser({
                    uid: updatedUser.uid,
                    email: updatedUser.email,
                    displayName: updatedUser.displayName, // Should now be 'name'
                }));
            }

            // Store user data in Firestore
            const db = getFirestore();
            await setDoc(doc(db, 'users', user?.uid), {
                name: name,
                email: email,
                uid: user?.uid,
                createdAt: serverTimestamp(),
            });

            // Redux state will update via onAuthStateChanged in AppNavigator
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text variant="headlineMedium" style={styles.title}>Create Account</Text>

            <TextInput
                label="Name"
                value={name}
                onChangeText={setName}
                mode="outlined"
                style={styles.input}
                textColor="#FFF"
                theme={{ colors: { primary: '#FF00FF', background: '#222', placeholder: '#888' } }}
            />

            <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                style={styles.input}
                autoCapitalize="none"
                textColor="#FFF"
                theme={{ colors: { primary: '#FF00FF', background: '#222', placeholder: '#888' } }}
            />

            <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                secureTextEntry
                style={styles.input}
                textColor="#FFF"
                theme={{ colors: { primary: '#FF00FF', background: '#222', placeholder: '#888' } }}
            />

            {error ? <HelperText type="error" visible={!!error}>{error}</HelperText> : null}

            <Button
                mode="contained"
                onPress={handleSignup}
                loading={loading}
                buttonColor="#FF00FF"
                textColor="#FFF"
                style={styles.button}
            >
                Sign Up
            </Button>

            <Button
                mode="text"
                onPress={() => navigation.navigate('Login')}
                textColor="#FF00FF"
                style={{ marginTop: 10 }}
            >
                Already have an account? Login
            </Button>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
        justifyContent: 'center',
        padding: wp(5),
    },
    title: {
        color: '#FF00FF',
        textAlign: 'center',
        marginBottom: hp(4),
        fontWeight: 'bold',
    },
    input: {
        marginBottom: hp(2),
    },
    button: {
        marginTop: hp(2),
    }
});

export default SignupScreen;
