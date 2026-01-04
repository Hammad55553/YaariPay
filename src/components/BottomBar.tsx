import React from 'react';
import { View, StyleSheet } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { wp, hp } from '../utils/responsive';

export const BottomBar = () => {
    const navigation = useNavigation<any>();
    const route = useRoute();

    const getIconColor = (routeName: string) =>
        route.name === routeName ? '#016B61' : '#70B2B2';

    return (
        <View style={styles.container}>
            <IconButton
                icon="account-group"
                iconColor={getIconColor('Friends')}
                size={wp(7)}
                onPress={() => navigation.navigate('Friends')}
            />
            <IconButton
                icon="plus-circle"
                iconColor={getIconColor('AddExpense')}
                size={wp(10)}
                style={styles.addButton}
                onPress={() => navigation.navigate('AddExpense')}
            />
            {/* Notifications Tab */}
            <IconButton
                icon="bell"
                iconColor={getIconColor('Notifications')}
                size={wp(7)}
                onPress={() => navigation.navigate('Notifications')}
            />
            {/* Profile Tab */}
            <IconButton
                icon="account"
                iconColor={getIconColor('Profile')}
                size={wp(7)}
                onPress={() => navigation.navigate('Profile')}
            />
            <IconButton
                icon="chart-pie"
                iconColor={getIconColor('Summary')}
                size={wp(7)}
                onPress={() => navigation.navigate('Summary')}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingVertical: hp(0.5),
        borderTopWidth: 1,
        borderTopColor: '#9ECFD4',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    addButton: {
        marginBottom: hp(1.8), // Float effect
        backgroundColor: '#E5E9C5',
    }
});

export default BottomBar;


