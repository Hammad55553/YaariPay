import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BaseToast, ErrorToast } from 'react-native-toast-message';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export const toastConfig = {
    // Custom 'info' toast
    info: ({ text1, text2 }: any) => (
        <LinearGradient
            colors={['#021B1A', '#014942']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.toastContainer}
        >
            <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="bell-ring-outline" size={24} color="#00E676" />
            </View>
            <View style={styles.textContainer}>
                <Text style={styles.title} numberOfLines={1}>{text1}</Text>
                <Text style={styles.message} numberOfLines={2}>{text2}</Text>
            </View>
        </LinearGradient>
    ),

    // Standard Success (styled)
    success: (props: any) => (
        <BaseToast
            {...props}
            style={{ borderLeftColor: '#00E676', backgroundColor: '#1E1E1E' }}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            text1Style={{ fontSize: 15, fontWeight: 'bold', color: '#FFF' }}
            text2Style={{ fontSize: 13, color: '#CCC' }}
        />
    ),

    // Standard Error (styled)
    error: (props: any) => (
        <ErrorToast
            {...props}
            style={{ borderLeftColor: '#FF5252', backgroundColor: '#1E1E1E' }}
            text1Style={{ fontSize: 15, fontWeight: 'bold', color: '#FFF' }}
            text2Style={{ fontSize: 13, color: '#FF5252' }}
        />
    )
};

const styles = StyleSheet.create({
    toastContainer: {
        height: 60,
        width: '90%',
        borderRadius: 15,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        elevation: 10,
        shadowColor: '#00E676',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        borderWidth: 1,
        borderColor: 'rgba(0, 230, 118, 0.3)'
    },
    iconContainer: {
        marginRight: 10
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center'
    },
    title: {
        color: '#00E676',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 2
    },
    message: {
        color: '#FFFFFF',
        fontSize: 12,
        opacity: 0.9
    }
});
