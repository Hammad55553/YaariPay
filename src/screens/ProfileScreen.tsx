import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, StyleSheet, Image, ScrollView, Animated, Dimensions, Modal } from 'react-native';
import { Text, Button, Card, Divider, Icon, IconButton, Portal } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import LinearGradient from 'react-native-linear-gradient';
import { RootState } from '../redux/store';
import { logout } from '../redux/userSlice';
import { wp, hp } from '../utils/responsive';
import BottomBar from '../components/BottomBar';
import { getFriendImage } from '../utils/imageMapper';

const { width } = Dimensions.get('window');

const ProfileScreen = () => {
    const user = useSelector((state: RootState) => state.user.user);
    const friends = useSelector((state: RootState) => state.friends.list);
    const expenses = useSelector((state: RootState) => state.expenses.list);
    const dispatch = useDispatch();

    const navigation = useNavigation<any>();

    // Animation Values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const headerScale = useRef(new Animated.Value(0.9)).current;

    // Modal State
    const [breakdownVisible, setBreakdownVisible] = useState(false);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
            }),
            Animated.spring(headerScale, {
                toValue: 1,
                tension: 40,
                friction: 7,
                useNativeDriver: true,
            })
        ]).start();
    }, []);

    // Find the friend object that matches the logged-in user's name
    const linkedProfile = friends.find(f =>
        f.name.trim().toLowerCase() === user?.displayName?.trim().toLowerCase()
    );

    // Calculate My Net Balance & Breakdown
    const myStats = useMemo(() => {
        const myName = user?.displayName;
        if (!myName) return { toReceive: 0, toPay: 0, net: 0, loan: 0, repaid: 0, breakdown: {} };

        const normalize = (name: string) => name ? name.trim().toLowerCase() : '';
        const myNameNorm = normalize(myName);

        let receive = 0;
        let pay = 0;
        let loan = 0;
        let repaid = 0;
        const breakdown: Record<string, number> = {};

        expenses.forEach(e => {
            const splitCount = e.splitAmong.length;
            if (splitCount === 0) return;
            const perPersonShare = e.totalAmount / splitCount;

            // 1. Calculate Net Position for this expense for everyone involved
            const expenseBalances: Record<string, number> = {};
            const participants = new Set([...e.splitAmong, ...Object.keys(e.paidBy)]);

            participants.forEach(p => {
                const pNorm = normalize(p);
                const paidAmt = Object.entries(e.paidBy).find(([name]) => normalize(name) === pNorm)?.[1] || 0;
                const isBorrower = e.splitAmong.some(name => normalize(name) === pNorm);
                const share = isBorrower ? perPersonShare : 0;
                expenseBalances[pNorm] = paidAmt - share;
            });

            // 2. Identify Creditors (Surplus) and Debtors (Deficit)
            const creditors: { name: string, amount: number }[] = [];
            const debtors: { name: string, amount: number }[] = [];
            let totalSurplus = 0;

            Object.entries(expenseBalances).forEach(([name, balance]) => {
                if (balance > 0.01) { // Floating point tolerance
                    creditors.push({ name, amount: balance });
                    totalSurplus += balance;
                } else if (balance < -0.01) {
                    debtors.push({ name, amount: Math.abs(balance) });
                }
            });

            // 3. Match Debtors to Creditors
            debtors.forEach(debtor => {
                const debtorName = debtor.name; // This is normalized key
                // Find original name for display if possible
                const originalDebtorName = e.splitAmong.find(n => normalize(n) === debtorName) || debtorName;
                const isSettled = e.settledBy?.some(s => normalize(s) === debtorName);

                // For each creditor, calculate how much this debtor owes them
                creditors.forEach(creditor => {
                    const creditorName = creditor.name; // Normalized
                    const originalCreditorName = Object.keys(e.paidBy).find(n => normalize(n) === creditorName) || creditorName;

                    const weight = creditor.amount / totalSurplus;
                    let amountOwed = debtor.amount * weight;

                    // CHECK FOR PARTIAL PAYMENTS
                    if (!isSettled && e.payments) {
                        const payments = e.payments.filter((p: any) =>
                            normalize(p.from) === debtorName && normalize(p.to) === creditorName
                        );
                        const paidSum = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                        amountOwed = Math.max(0, amountOwed - paidSum);
                    }

                    // Interaction Involving ME

                    // CASE A: I am the Debtor (I owe money)
                    if (debtorName === myNameNorm && creditorName !== myNameNorm) {
                        loan += amountOwed;
                        if (!isSettled) {
                            pay += amountOwed;
                            // I owe Creditor
                            // Only add if amountOwed > 0
                            if (amountOwed > 0.01) {
                                breakdown[originalCreditorName] = (breakdown[originalCreditorName] || 0) - amountOwed;
                            }
                        } else {
                            if (e.settledBy?.some(s => normalize(s) === myNameNorm)) {
                                repaid += amountOwed;
                            }
                        }
                    }

                    // CASE B: I am the Creditor (Someone owes me)
                    if (creditorName === myNameNorm && debtorName !== myNameNorm) {
                        // Debtor owes Me
                        if (!isSettled) {
                            receive += amountOwed;
                            if (amountOwed > 0.01) {
                                breakdown[originalDebtorName] = (breakdown[originalDebtorName] || 0) + amountOwed;
                            }
                        }
                    }
                });
            });
        });

        // Round Breakdown values and Filter tiny amounts
        Object.keys(breakdown).forEach(key => {
            breakdown[key] = Math.round(breakdown[key]);
            if (Math.abs(breakdown[key]) < 1) delete breakdown[key];
        });

        return {
            net: receive - pay,
            toReceive: receive,
            toPay: pay,
            loan: loan,
            repaid: repaid,
            breakdown: breakdown
        };
    }, [expenses, user]);

    const handleLogout = async () => {
        try {
            await auth().signOut();
            dispatch(logout());
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    const neonColor = '#00FFFF'; // Cyan for current user

    return (
        <LinearGradient colors={['#021B1A', '#014942']} style={styles.mainContainer}>
            {/* Back Button */}
            <IconButton
                icon="chevron-left"
                iconColor="#FFF"
                size={30}
                style={styles.backButton}
                onPress={() => navigation.goBack()}
            />

            {/* Curved Header Background */}
            <View style={styles.headerBackgroundContainer}>
                {/* <LinearGradient
                    colors={['#004D40', '#00251a']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.headerGradient}
                /> */}
            </View>


            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Header Title */}
                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                    <Text variant="headlineSmall" style={styles.appTitle}>YAARIPAY PROFILE</Text>
                </Animated.View>

                {/* Profile Hero Section */}
                <Animated.View style={[styles.profileSection, { opacity: fadeAnim, transform: [{ scale: headerScale }] }]}>
                    <View style={[styles.avatarContainer, { borderColor: neonColor }]}>
                        {linkedProfile?.image ? (
                            <Image
                                source={getFriendImage(linkedProfile.image)}
                                style={styles.avatarImage}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={{ flex: 1, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={styles.avatarText}>
                                    {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                                </Text>
                            </View>
                        )}
                        <View style={styles.onlineIndicator} />
                    </View>

                    <Text style={styles.name}>{linkedProfile ? linkedProfile.name : (user?.displayName || 'User')}</Text>
                    <Text style={styles.email}>{user?.email}</Text>

                    <View style={[styles.badge, { backgroundColor: linkedProfile ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 82, 82, 0.15)', borderColor: linkedProfile ? '#4CAF50' : '#FF5252' }]}>
                        <Icon source="check-decagram" size={14} color={linkedProfile ? '#4CAF50' : '#FF5252'} />
                        <Text style={[styles.badgeText, { color: linkedProfile ? '#4CAF50' : '#FF5252' }]}>
                            {linkedProfile ? ' VERIFIED MEMBER' : ' GUEST / NEW'}
                        </Text>
                    </View>
                </Animated.View>

                {/* Stats Card */}
                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                    <Card style={styles.statsCard}>
                        <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} style={styles.cardGradient}>
                            <Card.Content>
                                <View style={styles.statsHeader}>
                                    <View>
                                        <Text variant="labelMedium" style={{ color: '#B0BEC5', letterSpacing: 1 }}>NET STANDING</Text>
                                        <Text variant="headlineMedium" style={{ color: myStats.net >= 0 ? '#4CAF50' : '#FF5252', fontWeight: 'bold' }}>
                                            {myStats.net >= 0 ? '+' : ''}{myStats.net.toFixed(0)} <Text style={{ fontSize: 14, color: '#888' }}>PKR</Text>
                                        </Text>
                                    </View>
                                    <Icon source="wallet" size={40} color={myStats.net >= 0 ? '#4CAF50' : '#FF5252'} />
                                </View>

                                <Divider style={styles.divider} />

                                <View style={styles.statsRow}>
                                    <View style={styles.statItem}>
                                        <View style={[styles.iconBox, { backgroundColor: 'rgba(76, 175, 80, 0.2)' }]}>
                                            <Icon source="arrow-bottom-left" size={20} color="#4CAF50" />
                                        </View>
                                        <View>
                                            <Text style={styles.statLabel}>To Collect</Text>
                                            <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                                                +{myStats.toReceive.toFixed(0)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.verticalDivider} />

                                    <View style={styles.statItem}>
                                        <View style={[styles.iconBox, { backgroundColor: 'rgba(255, 82, 82, 0.2)' }]}>
                                            <Icon source="arrow-top-right" size={20} color="#FF5252" />
                                        </View>
                                        <View>
                                            <Text style={styles.statLabel}>To Pay</Text>
                                            <Text style={[styles.statValue, { color: '#FF5252' }]}>
                                                -{myStats.toPay.toFixed(0)}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* View Details Button */}
                                <Button
                                    mode="outlined"
                                    onPress={() => setBreakdownVisible(true)}
                                    style={{ marginTop: 15, borderColor: 'rgba(255,255,255,0.2)' }}
                                    textColor="#E0F2F1"
                                    icon="format-list-bulleted"
                                >
                                    See Full Breakdown
                                </Button>
                            </Card.Content>
                        </LinearGradient>
                    </Card>
                </Animated.View>

                {/* Mini Loan Overview */}
                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], marginTop: 10 }}>
                    <View style={styles.loanContainer}>
                        <Text style={styles.sectionHeader}>LIFETIME SUMMARY</Text>
                        <View style={styles.loanRowWrapper}>
                            <View style={styles.loanItem}>
                                <Text style={styles.loanLabel}>Total Borrowed</Text>
                                <Text style={styles.loanValue}>{myStats.loan.toFixed(0)}</Text>
                            </View>
                            <View style={styles.loanItem}>
                                <Text style={styles.loanLabel}>Total Repaid</Text>
                                <Text style={[styles.loanValue, { color: '#4CAF50' }]}>{myStats.repaid.toFixed(0)}</Text>
                            </View>
                            <View style={styles.loanItem}>
                                <Text style={styles.loanLabel}>Repayment Rate</Text>
                                <Text style={[styles.loanValue, { color: neonColor }]}>
                                    {myStats.loan > 0 ? ((myStats.repaid / myStats.loan) * 100).toFixed(0) : 100}%
                                </Text>
                            </View>
                        </View>
                    </View>
                </Animated.View>

                {/* Actions */}
                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], marginTop: hp(4), width: '100%' }}>
                    <Button
                        mode="contained"
                        onPress={handleLogout}
                        style={styles.logoutButton}
                        contentStyle={{ paddingVertical: 8 }}
                        buttonColor="#D32F2F"
                        textColor="#FFF"
                        icon="logout"
                    >
                        Secure Logout
                    </Button>
                    <Text style={styles.versionText}>Yaaripay v0.0.1 • Deep Teal Premium</Text>
                </Animated.View>

                {/* Breakdown Modal */}
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={breakdownVisible}
                    onRequestClose={() => setBreakdownVisible(false)}
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                        <View style={styles.modalContainer}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <Text variant="headlineSmall" style={{ color: '#E0F2F1', fontWeight: 'bold' }}>
                                    Debt Breakdown
                                </Text>
                                <IconButton
                                    icon="close"
                                    iconColor="#B0BEC5"
                                    size={24}
                                    onPress={() => setBreakdownVisible(false)}
                                />
                            </View>

                            {Object.keys(myStats.breakdown).length === 0 ? (
                                <Text style={{ color: '#888', textAlign: 'center', marginBottom: 20 }}>No outstanding debts. You are clear!</Text>
                            ) : (
                                <ScrollView style={{ maxHeight: hp(50) }}>
                                    {Object.entries(myStats.breakdown).map(([name, amount]) => {
                                        const isPositive = amount > 0;
                                        return (
                                            <View key={name} style={styles.breakdownRow}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Image
                                                        source={getFriendImage(friends.find(f => f.name === name)?.image || '8.png')}
                                                        style={{ width: 30, height: 30, borderRadius: 15, marginRight: 10 }}
                                                    />
                                                    <Text style={{ color: '#FFF', fontSize: 16 }}>{name}</Text>
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={{ color: isPositive ? '#4CAF50' : '#FF5252', fontWeight: 'bold', fontSize: 16 }}>
                                                        {isPositive ? '+' : ''}{amount.toFixed(0)}
                                                    </Text>
                                                    <Text style={{ color: '#aaa', fontSize: 10 }}>
                                                        {isPositive ? 'Lene Hain' : 'Dene Hain'}
                                                    </Text>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </ScrollView>
                            )}
                        </View>
                    </View>
                </Modal>

            </ScrollView>
            <BottomBar />
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
    },
    backButton: {
        position: 'absolute',
        top: hp(2),
        left: wp(2),
        zIndex: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 20,
    },
    headerBackgroundContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: hp(35),
        borderBottomLeftRadius: wp(10), // The curve
        borderBottomRightRadius: wp(10), // The curve
        overflow: 'hidden',
        zIndex: 0,
    },
    headerGradient: {
        flex: 1,
    },
    content: {
        padding: wp(5),
        paddingTop: hp(6),
        paddingBottom: hp(15),
        alignItems: 'center',
        zIndex: 1,
    },
    appTitle: {
        color: 'rgba(255,255,255,0.7)',
        fontWeight: 'bold',
        marginBottom: hp(3),
        letterSpacing: 2,
        fontSize: wp(4),
    },
    profileSection: {
        alignItems: 'center',
        marginBottom: hp(3),
    },
    avatarContainer: {
        width: wp(38),
        height: wp(38),
        borderRadius: wp(19),
        borderWidth: 3,
        overflow: 'hidden',
        marginBottom: hp(2),
        elevation: 15,
        shadowColor: '#00FFFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 25,
        backgroundColor: '#1E1E1E',
        position: 'relative',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarText: {
        fontSize: wp(14),
        fontWeight: 'bold',
        color: '#FFF',
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 15,
        right: 15,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#00E676',
        borderWidth: 2,
        borderColor: '#1E1E1E'
    },
    name: {
        fontSize: wp(8),
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: hp(0.5),
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 5,
    },
    email: {
        fontSize: wp(4),
        color: '#B0BEC5',
        marginBottom: hp(2),
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        gap: 5,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    statsCard: {
        width: width * 0.9,
        backgroundColor: '#1E1E1E',
        borderRadius: 24,
        marginBottom: hp(2),
        overflow: 'hidden', // Include gradient
        elevation: 4,
    },
    cardGradient: {
        padding: 5,
    },
    statsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: hp(2),
    },
    divider: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginBottom: hp(2),
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    statValue: {
        fontSize: wp(5),
        fontWeight: 'bold',
    },
    statLabel: {
        color: '#90A4AE',
        fontSize: wp(3),
        textTransform: 'uppercase',
    },
    verticalDivider: {
        width: 1,
        height: '80%',
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 10,
    },
    loanContainer: {
        width: width * 0.9,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    sectionHeader: {
        color: '#546E7A',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1.5,
        marginBottom: 15,
    },
    loanRowWrapper: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    loanItem: {
        alignItems: 'center',
    },
    loanLabel: {
        color: '#90A4AE',
        fontSize: 12,
        marginBottom: 4,
    },
    loanValue: {
        color: '#E0F2F1',
        fontWeight: 'bold',
        fontSize: 16,
    },
    logoutButton: {
        width: '100%',
        borderRadius: 12,
        marginBottom: hp(3),
        elevation: 4,
    },
    versionText: {
        color: '#444',
        fontSize: 10,
        alignSelf: 'center',
    },
    modalContainer: {
        backgroundColor: '#1E1E1E',
        padding: 20,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        width: '100%',
        paddingBottom: hp(5), // Add padding for bottom safe area visual comfort
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)'
    }
});

export default ProfileScreen;
