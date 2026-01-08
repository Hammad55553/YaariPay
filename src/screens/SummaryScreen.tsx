import React, { useMemo, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, Animated, Image } from 'react-native';
import { Text, Card, List, IconButton, Avatar, Button } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { RootState } from '../redux/store';
import { Expense } from '../redux/expensesSlice';
import Header from '../components/Header';
import BottomBar from '../components/BottomBar';
import { wp, hp } from '../utils/responsive';
import { getFriendImage } from '../utils/imageMapper';

const SummaryScreen = () => {
    const rawExpenses = useSelector((state: RootState) => state.expenses?.list as Expense[] || []);
    const friends = useSelector((state: RootState) => state.friends?.list || []);
    const user = useSelector((state: RootState) => state.user.user);
    const navigation = useNavigation<any>();

    // Animation
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
        }).start();
    }, []);

    const expenses = useMemo(() => {
        const unique = new Map();
        rawExpenses.forEach(e => unique.set(e.id, e));
        return Array.from(unique.values()).sort((a, b) => b.timestamp - a.timestamp);
    }, [rawExpenses]);

    // Robust Balance Logic Handling Partial Payments
    const balances = useMemo(() => {
        const bal: Record<string, number> = {};
        const normalize = (name: string) => name ? name.trim().toLowerCase() : '';

        friends.forEach(f => bal[normalize(f.name)] = 0);
        // Also ensure current user is tracked if involved under various aliases, 
        // but mostly we want to see what OTHERS owe US or WE owe OTHERS.

        // We will calculate "My Net Balance" relative to friends.
        // A Positive Balance for a Friend means THEY Owe ME.
        // A Negative Balance for a Friend means I Owe THEM.

        const myNameNorm = normalize(user?.displayName || '');

        expenses.forEach(e => {
            const splitCount = e.splitAmong.length;
            if (splitCount === 0) return;
            const perPersonShare = e.totalAmount / splitCount;

            const payers = Object.keys(e.paidBy).map(n => normalize(n));

            // Determine who paid how much
            const paidAmounts: Record<string, number> = {};
            Object.entries(e.paidBy).forEach(([name, amount]) => {
                paidAmounts[normalize(name)] = amount as number;
            });

            // Iterate through every participant (Splitters)
            e.splitAmong.forEach((personName: string) => {
                const pNorm = normalize(personName);

                // If I am not involved in this expense at all, skip
                // Actually summary should probably show global states, but let's focus on User-Centric summary

                // We are calculating: How much does 'pNorm' owe 'payers'?

                payers.forEach(payerName => {
                    if (pNorm === payerName) return; // Owes self -> Ignore

                    // Case 1: I am the Payer. 'personName' owes Me.
                    if (payerName === myNameNorm) {
                        // Friend 'pNorm' owes Me 'share'
                        if (bal[pNorm] === undefined) bal[pNorm] = 0;

                        // Check Settlements
                        const isSettled = e.settledBy?.some((s: string) => normalize(s) === pNorm);

                        if (!isSettled) {
                            // Initial Debt
                            // If there are multiple payers, logic is complex. Assuming proportional or single payer for simplicity.
                            // If single payer: owes full share.
                            if (payers.length === 1) {
                                bal[pNorm] += perPersonShare;

                                // Subtract Partial Payments from Friend to Me
                                if (e.payments) {
                                    const payments = e.payments.filter((p: any) =>
                                        normalize(p.from) === pNorm && normalize(p.to) === myNameNorm
                                    );
                                    const paidSum = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                                    bal[pNorm] -= paidSum;
                                }
                            }
                        }
                    }
                    // Case 2: Friend is Payer. I owe Them.
                    else if (pNorm === myNameNorm) {
                        if (bal[payerName] === undefined) bal[payerName] = 0;

                        const isSettled = e.settledBy?.some((s: string) => normalize(s) === myNameNorm);

                        if (!isSettled) {
                            if (payers.length === 1) {
                                bal[payerName] -= perPersonShare; // I owe them (Negative)

                                // Subtract Partial Payments from Me to Friend
                                if (e.payments) {
                                    const payments = e.payments.filter((p: any) =>
                                        normalize(p.from) === myNameNorm && normalize(p.to) === payerName
                                    );
                                    const paidSum = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                                    bal[payerName] += paidSum; // Adding positive reduces the negative debt
                                }
                            }
                        }
                    }
                });
            });
        });

        return bal;
    }, [expenses, friends, user]);

    return (
        <LinearGradient colors={['#021B1A', '#014942']} style={styles.container}>
            <Header title="Summary & Balances" showBack={true} onBack={() => navigation.goBack()} />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                <Animated.View style={{ opacity: fadeAnim }}>
                    <Text variant="headlineSmall" style={styles.sectionTitle}>NET BALANCES</Text>

                    {Object.entries(balances).length === 0 ? (
                        <Text style={styles.emptyText}>No active balances.</Text>
                    ) : (
                        Object.entries(balances)
                            .filter(([_, amount]) => Math.abs(amount) > 1) // Filter negligible amounts
                            .map(([name, amount]) => {
                                const friendObj = friends.find(f => f.name.toLowerCase() === name.toLowerCase());
                                const isPositive = amount >= 0;

                                return (
                                    <Card key={name} style={[styles.balanceCard, { borderLeftColor: isPositive ? '#00E676' : '#FF5252' }]}>
                                        <View style={styles.cardInner}>
                                            <View style={styles.friendInfo}>
                                                <Image
                                                    source={getFriendImage(friendObj?.image || '8.png')}
                                                    style={styles.avatar}
                                                />
                                                <View>
                                                    <Text style={styles.friendName}>
                                                        {friendObj?.name || name.charAt(0).toUpperCase() + name.slice(1)}
                                                    </Text>
                                                    <Text style={[styles.statusText, { color: isPositive ? '#00E676' : '#FF5252' }]}>
                                                        {isPositive ? "You get back" : "You owe"}
                                                    </Text>
                                                </View>
                                            </View>

                                            <Text style={[styles.amountText, { color: isPositive ? '#00E676' : '#FF5252' }]}>
                                                {isPositive ? '+' : ''}{amount.toFixed(0)} <Text style={{ fontSize: 12, color: '#888' }}>PKR</Text>
                                            </Text>
                                        </View>
                                    </Card>
                                );
                            })
                    )}
                </Animated.View>

                <Animated.View style={{ opacity: fadeAnim, marginTop: hp(4) }}>
                    <Text variant="headlineSmall" style={styles.sectionTitle}>RECENT ACTIVITY</Text>

                    {expenses.slice(0, 10).map(e => {
                        // Calculate if Fully Settled
                        const normalize = (name: string) => name ? name.trim().toLowerCase() : '';
                        const payers = Object.keys(e.paidBy).map(normalize);
                        const share = e.totalAmount / e.splitAmong.length;

                        // Check if EVERY splitter has settled
                        const isFullySettled = e.splitAmong.every((personName: string) => {
                            const pNorm = normalize(personName);
                            // If person is a payer/owner, they are considered settled for their own share contexts usually,
                            // unless we strictly track everyone paying everyone. 
                            // In our logic, Payer is Owed. So we check if OTHERS have paid Payer.
                            // If 'personName' is one of the payers, and payers length > 1, it's complex.
                            // Simplified: If person is Payer, they are settled.
                            if (payers.includes(pNorm)) return true;

                            // Check Settlement Flag
                            if (e.settledBy?.some((s: string) => normalize(s) === pNorm)) return true;

                            // Check Payments
                            // We need to see if 'personName' has paid their 'share' to the 'payer(s)'
                            // Assuming single payer for simplicity or sum of payments to any payer
                            const paymentsFromPerson = e.payments?.filter((p: any) => normalize(p.from) === pNorm) || [];
                            const totalPaid = paymentsFromPerson.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

                            return totalPaid >= (share - 1); // Tolerance
                        });

                        return (
                            <Card key={e.id} style={styles.activityCard}>
                                <Card.Content style={{ paddingVertical: 10 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.activityTitle}>{e.description}</Text>
                                            <Text style={styles.activityMeta}>
                                                Paid by {Object.keys(e.paidBy).join(', ')} • {new Date(e.timestamp).toLocaleDateString()}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.activityAmount}>{e.totalAmount}</Text>
                                            <Text style={[styles.activityStatus, {
                                                color: isFullySettled ? '#00E676' : '#FFAB00'
                                            }]}>
                                                {isFullySettled ? 'Settled' : 'Pending'}
                                            </Text>
                                        </View>
                                    </View>
                                </Card.Content>
                            </Card>
                        );
                    })}
                </Animated.View>

            </ScrollView>
            <BottomBar />
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: wp(5), paddingBottom: hp(15) },
    sectionTitle: {
        color: '#B0BEC5',
        fontWeight: 'bold',
        fontSize: wp(4),
        letterSpacing: 1.5,
        marginBottom: hp(2),
        textTransform: 'uppercase'
    },
    emptyText: {
        color: '#666',
        fontStyle: 'italic',
        marginBottom: 20
    },
    balanceCard: {
        marginBottom: hp(1.5),
        backgroundColor: '#1E1E1E',
        borderLeftWidth: 4,
        borderRadius: 12,
        elevation: 4
    },
    cardInner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15
    },
    friendInfo: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    friendName: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16
    },
    statusText: {
        fontSize: 12,
        marginTop: 2
    },
    amountText: {
        fontSize: 18,
        fontWeight: 'bold'
    },
    activityCard: {
        marginBottom: hp(1),
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8
    },
    activityTitle: {
        color: '#E0F2F1',
        fontWeight: 'bold',
        fontSize: 15
    },
    activityMeta: {
        color: '#888',
        fontSize: 12,
        marginTop: 4
    },
    activityAmount: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16
    },
    activityStatus: {
        fontSize: 10,
        marginTop: 2,
        textTransform: 'uppercase',
        fontWeight: 'bold'
    }
});

export default SummaryScreen;
