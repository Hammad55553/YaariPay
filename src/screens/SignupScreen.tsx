import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import auth from '@react-native-firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { setUser } from '../redux/userSlice';
import { wp, hp } from '../utils/responsive';
import Toast from 'react-native-toast-message';

import LinearGradient from 'react-native-linear-gradient';

const SignupScreen = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigation = useNavigation<any>();
    const dispatch = useDispatch();

    const handleSignup = async () => {
        if (!email || !password || !name) {
            Toast.show({
                type: 'error',
                text1: 'Missing Fields',
                text2: 'Please fill in all fields',
            });
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

            // Reload user to get fresh token/data
            await user?.reload();
            const updatedUser = auth().currentUser;

            if (updatedUser) {
                dispatch(setUser({
                    uid: updatedUser.uid,
                    email: updatedUser.email,
                    displayName: updatedUser.displayName,
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

        } catch (e: any) {
            if (e.code === 'auth/invalid-email') {
                Toast.show({
                    type: 'error',
                    text1: 'Invalid Email',
                    text2: 'The email address is failing validation. Please check for spaces or typos.',
                });
            } else if (e.code === 'auth/email-already-in-use') {
                Toast.show({
                    type: 'error',
                    text1: 'Email Taken',
                    text2: 'This email is already in use.',
                });
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Signup Error',
                    text2: e.message,
                });
            }
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient colors={['#021B1A', '#014942']} style={styles.container}>
            <View style={styles.headerContainer}>
                <Text variant="displaySmall" style={styles.title}>Join Yaari Pay</Text>
                <Text variant="bodyLarge" style={styles.subtitle}>Split bills, share expenses, stay friends.</Text>
            </View>

            <View style={styles.formContainer}>
                <TextInput
                    label="Full Name"
                    value={name}
                    onChangeText={setName}
                    mode="flat"
                    style={styles.input}
                    textColor="#272b2bff"
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                    theme={{ colors: { primary: '#016B61', background: '#1E1E1E', placeholder: '#888' } }}
                    left={<TextInput.Icon icon="account" color="#016B61" />}
                />

                <TextInput
                    label="Email Address"
                    value={email}
                    onChangeText={(text) => setEmail(text.trim())}
                    mode="flat"
                    style={styles.input}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    textColor="#272b2bff"
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                    theme={{ colors: { primary: '#016B61', background: '#1E1E1E', placeholder: '#888' } }}
                    left={<TextInput.Icon icon="email" color="#016B61" />}
                />

                <TextInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    mode="flat"
                    secureTextEntry={!showPassword}
                    style={styles.input}
                    textColor="#272b2bff"
                    theme={{ colors: { primary: '#016B61', background: '#1E1E1E', placeholder: '#888', } }}
                    left={<TextInput.Icon icon="lock" color="#016B61" />}
                    right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} onPress={() => setShowPassword(!showPassword)} color="#016B61" />}
                />

                {error ? <HelperText type="error" visible={!!error}>{error}</HelperText> : null}

                <Button
                    mode="contained"
                    onPress={handleSignup}
                    loading={loading}
                    buttonColor="#016B61"
                    textColor="#FFF"
                    contentStyle={{ height: hp(6.5) }} // Responsive height
                    style={styles.button}
                    labelStyle={{ fontSize: wp(4), fontWeight: 'bold' }} // Responsive font size
                >
                    Create Account
                </Button>

                <Button
                    mode="text"
                    onPress={() => navigation.navigate('Login')}
                    textColor="#70B2B2"
                    style={{ marginTop: 20 }}
                >
                    Already have an account? Login
                </Button>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: wp(5),
    },
    headerContainer: {
        marginBottom: hp(5),
        alignItems: 'center',
    },
    title: {
        color: '#E0F2F1', // Whitish-green/Teal
        fontWeight: 'bold',
        marginBottom: hp(1),
    },
    subtitle: {
        color: '#bbb',
        textAlign: 'center',
    },
    formContainer: {
        width: '100%',
    },
    input: {
        marginBottom: hp(2),
        borderRadius: wp(2),
        borderTopLeftRadius: wp(2),
        borderTopRightRadius: wp(2),
    },
    button: {
        marginTop: hp(2),
        borderRadius: wp(2),
    }
});

export default SignupScreen;
