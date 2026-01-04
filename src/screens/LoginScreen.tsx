import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import auth from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { wp, hp } from '../utils/responsive';

const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigation = useNavigation<any>();

    const handleLogin = async () => {
        if (!email || !password) {
            setError('Please fill in all fields');
            return;
        }
        try {
            setLoading(true);
            setError('');
            await auth().signInWithEmailAndPassword(email, password);
            // Redux state will update via onAuthStateChanged in AppNavigator
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text variant="headlineMedium" style={styles.title}>Welcome Back!</Text>

            <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                style={styles.input}
                autoCapitalize="none"
                textColor="#FFF"
                theme={{ colors: { primary: '#00FFFF', background: '#222', placeholder: '#888' } }}
            />

            <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                secureTextEntry
                style={styles.input}
                textColor="#FFF"
                theme={{ colors: { primary: '#00FFFF', background: '#222', placeholder: '#888' } }}
            />

            {error ? <HelperText type="error" visible={!!error}>{error}</HelperText> : null}

            <Button
                mode="contained"
                onPress={handleLogin}
                loading={loading}
                buttonColor="#00FFFF"
                textColor="#000"
                style={styles.button}
            >
                Sign In
            </Button>

            <Button
                mode="text"
                onPress={() => navigation.navigate('Signup')}
                textColor="#00FFFF"
                style={{ marginTop: 10 }}
            >
                Don't have an account? Sign Up
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
        color: '#00FFFF',
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

export default LoginScreen;
