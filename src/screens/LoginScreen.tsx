import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import auth from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';
import { wp, hp } from '../utils/responsive';

const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigation = useNavigation<any>();

    const handleLogin = async () => {
        if (!email || !password) {
            Toast.show({
                type: 'error',
                text1: 'Missing Fields',
                text2: 'Please fill in both email and password',
            });
            return;
        }
        try {
            setLoading(true);
            await auth().signInWithEmailAndPassword(email, password);
            // Redux state will update via onAuthStateChanged
        } catch (e: any) {
            let msg = e.message;
            if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
                msg = 'Invalid email or password.';
            } else if (e.code === 'auth/invalid-email') {
                msg = 'Invalid email format.';
            }

            Toast.show({
                type: 'error',
                text1: 'Login Failed',
                text2: msg,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient colors={['#021B1A', '#014942']} style={styles.container}>
            <View style={styles.headerContainer}>
                <Text variant="displaySmall" style={styles.title}>Welcome Back!</Text>
                <Text variant="bodyLarge" style={styles.subtitle}>Sign in to continue managing your expenses.</Text>
            </View>

            <View style={styles.formContainer}>
                <TextInput
                    label="Email"
                    value={email}
                    onChangeText={(text) => setEmail(text.trim())}
                    mode="flat"
                    style={styles.input}
                    autoCapitalize="none"
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
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                    theme={{ colors: { primary: '#016B61', background: '#1E1E1E', placeholder: '#888' } }}
                    left={<TextInput.Icon icon="lock" color="#016B61" />}
                    right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} onPress={() => setShowPassword(!showPassword)} color="#016B61" />}
                />

                <View style={{ alignItems: 'flex-end', marginBottom: 10 }}>
                    <Button
                        mode="text"
                        onPress={() => navigation.navigate('ForgotPassword')}
                        textColor="#70B2B2"
                        compact
                    >
                        Forgot Password?
                    </Button>
                </View>

                <Button
                    mode="contained"
                    onPress={handleLogin}
                    loading={loading}
                    buttonColor="#016B61"
                    textColor="#FFF"
                    contentStyle={{ height: hp(6.5) }}
                    style={styles.button}
                    labelStyle={{ fontSize: wp(4), fontWeight: 'bold' }}
                >
                    Sign In
                </Button>

                <Button
                    mode="text"
                    onPress={() => navigation.navigate('Signup')}
                    textColor="#70B2B2"
                    style={{ marginTop: 20 }}
                >
                    Don't have an account? Sign Up
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
        color: '#E0F2F1',
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
        // backgroundColor: '#1E1E1E', // Explicit darker background for inputs
    },
    button: {
        marginTop: hp(2),
        borderRadius: wp(2),
    }
});

export default LoginScreen;
