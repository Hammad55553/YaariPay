import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import auth from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { wp, hp } from '../utils/responsive';
import Toast from 'react-native-toast-message';

const ForgotPasswordScreen = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigation = useNavigation<any>();

    const handleResetPassword = async () => {
        if (!email) {
            setError('Please enter your email address');
            return;
        }
        try {
            setLoading(true);
            setError('');
            await auth().sendPasswordResetEmail(email);
            Toast.show({
                type: 'success',
                text1: 'Reset Email Sent',
                text2: 'Please check your email for reset instructions.',
            });
            setTimeout(() => {
                navigation.goBack();
            }, 2000);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text variant="headlineMedium" style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>Enter your email address and we'll send you a link to reset your password.</Text>

            <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                textColor="#FFF"
                theme={{ colors: { primary: '#00FFFF', background: '#222', placeholder: '#888' } }}
            />

            {error ? <HelperText type="error" visible={!!error}>{error}</HelperText> : null}

            <Button
                mode="contained"
                onPress={handleResetPassword}
                loading={loading}
                buttonColor="#00FFFF"
                textColor="#000"
                style={styles.button}
            >
                Send Reset Link
            </Button>

            <Button
                mode="text"
                onPress={() => navigation.goBack()}
                textColor="#00FFFF"
                style={{ marginTop: 10 }}
            >
                Back to Login
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
        marginBottom: hp(1),
        fontWeight: 'bold',
    },
    subtitle: {
        color: '#BBB',
        textAlign: 'center',
        marginBottom: hp(4),
        fontSize: 14,
    },
    input: {
        marginBottom: hp(2),
    },
    button: {
        marginTop: hp(2),
    }
});

export default ForgotPasswordScreen;
