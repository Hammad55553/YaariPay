import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { wp, hp } from '../utils/responsive';

// Animated Icon Component
const AnimatedTab = ({ icon, label, isActive, onPress, isSpecial = false }: any) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(0.6)).current; // Default dim opacity

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: isActive ? 1.2 : 1,
                useNativeDriver: true,
                friction: 5,
            }),
            Animated.timing(opacityAnim, {
                toValue: isActive ? 1 : 0.6,
                duration: 200,
                useNativeDriver: true,
            })
        ]).start();
    }, [isActive]);

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={[styles.tabContainer, isSpecial && styles.specialTabContainer]}
        >
            <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: isSpecial ? 1 : opacityAnim, alignItems: 'center' }}>
                <IconButton
                    icon={icon}
                    iconColor={isSpecial ? '#000' : (isActive ? '#00E676' : '#B0BEC5')}
                    size={isSpecial ? wp(8) : wp(6.5)}
                    style={isSpecial ? {} : { margin: 0 }}
                />

            </Animated.View>
            {isActive && !isSpecial && (
                <Animated.View style={[styles.activeDot, { opacity: opacityAnim }]} />
            )}
        </TouchableOpacity>
    );
};

export const BottomBar = () => {
    const navigation = useNavigation<any>();
    const route = useRoute();
    const insets = useSafeAreaInsets();

    const currentRoute = route.name;

    return (
        <View style={styles.wrapper}>
            <LinearGradient
                colors={['#0E2826', '#011F1C']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.floatingContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}
            >
                <AnimatedTab
                    icon="home"
                    isActive={currentRoute === 'FriendList' || currentRoute === 'Friends'}
                    onPress={() => navigation.navigate('Friends')}
                />

                <AnimatedTab
                    icon="chart-pie"
                    isActive={currentRoute === 'Summary'}
                    onPress={() => navigation.navigate('Summary')}
                />

                {/* Special Middle Button */}
                <View style={styles.middleButtonWrapper}>
                    <LinearGradient
                        colors={['#00E676', '#00C853']}
                        style={styles.addButtonGradient}
                    >
                        <AnimatedTab
                            icon="plus"
                            isSpecial={true}
                            isActive={currentRoute === 'AddExpense'}
                            onPress={() => navigation.navigate('AddExpense')}
                        />
                    </LinearGradient>
                </View>
                <AnimatedTab
                    icon="message-text-outline"
                    isActive={currentRoute === 'Chat'}
                    onPress={() => navigation.navigate('Chat')}
                />
                <AnimatedTab
                    icon="account"
                    isActive={currentRoute === 'Profile'}
                    onPress={() => navigation.navigate('Profile')}
                />



            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        elevation: 0,
    },
    floatingContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        width: '100%',
        height: 'auto', // Allow height to grow with padding
        paddingTop: 10,
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)'
    },
    tabContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: wp(12),
        height: '100%',
    },
    specialTabContainer: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center'
    },
    middleButtonWrapper: {
        top: -hp(2.5), // Float upwards
        width: wp(16),
        height: wp(16),
        borderRadius: wp(8),
        elevation: 8,
        shadowColor: '#00E676',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    addButtonGradient: {
        width: '100%',
        height: '100%',
        borderRadius: wp(8),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#021B1A'
    },
    activeDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#00E676',
        position: 'absolute',
        bottom: 8
    }
});

export default BottomBar;
