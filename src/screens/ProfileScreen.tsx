import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, Button, Card, Divider } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import auth from '@react-native-firebase/auth';
import { RootState } from '../redux/store';
import { logout } from '../redux/userSlice';
import { wp, hp } from '../utils/responsive';
import BottomBar from '../components/BottomBar';
import { getFriendImage } from '../utils/imageMapper';

const ProfileScreen = () => {
    const user = useSelector((state: RootState) => state.user.user);
    const friends = useSelector((state: RootState) => state.friends.list);
    const expenses = useSelector((state: RootState) => state.expenses.list);
    const dispatch = useDispatch();

    // Find the friend object that matches the logged-in user's name
    // Case-insensitive match for robustness
    const linkedProfile = friends.find(f =>
        f.name.trim().toLowerCase() === user?.displayName?.trim().toLowerCase()
    );

    // Calculate My Net Balance
    const myStats = React.useMemo(() => {
        const myName = user?.displayName;
        if (!myName) return { toReceive: 0, toPay: 0, net: 0 };

        let receive = 0;
        let pay = 0;

        expenses.forEach(e => {
            const splitCount = e.splitAmong.length;
            if (splitCount === 0) return;
            const perPersonShare = e.totalAmount / splitCount;

            // Iterate through all "borrowers" (beneficiaries of the purchase)
            e.splitAmong.forEach(borrowerName => {
                // If this person has settled, their debt is cleared. Skip them.
                if (e.settledBy?.includes(borrowerName)) return;

                // Calculate how much this borrower owes to each payer
                Object.entries(e.paidBy).forEach(([payerName, amountPaid]) => {
                    const payerWeight = amountPaid / e.totalAmount;
                    const debtAmount = perPersonShare * payerWeight;

                    if (borrowerName === myName && payerName !== myName) {
                        // I am the borrower, someone else paid. I owe them.
                        pay += debtAmount;
                    }

                    if (payerName === myName && borrowerName !== myName) {
                        // I paid, someone else borrowed. They owe me.
                        receive += debtAmount;
                    }
                });
            });
        });

        return {
            net: receive - pay,
            toReceive: receive,
            toPay: pay
        };
    }, [expenses, user]);

    const handleLogout = async () => {
        try {
            await auth().signOut();
            dispatch(logout()); // Clear Redux state
            // Navigation will automatically switch to AuthStack because of onAuthStateChanged in AppNavigator
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Text variant="headlineMedium" style={styles.title}>My Profile</Text>

                <Card style={styles.profileCard}>
                    <Card.Content style={styles.cardContent}>
                        <View style={[styles.avatarContainer, linkedProfile ? { borderWidth: 0 } : {}]}>
                            {linkedProfile?.image ? (
                                <Image
                                    source={getFriendImage(linkedProfile.image)}
                                    style={styles.avatarImage}
                                    resizeMode="cover"
                                />
                            ) : (
                                <Text style={styles.avatarText}>
                                    {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                                </Text>
                            )}
                        </View>

                        <Text style={styles.name}>{linkedProfile ? linkedProfile.name : (user?.displayName || 'User')}</Text>
                        <Text style={styles.email}>{user?.email}</Text>

                        <Divider style={styles.divider} />

                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Member Status:</Text>
                            <Text style={[styles.value, { color: linkedProfile ? '#4CAF50' : '#FF5252' }]}>
                                {linkedProfile ? 'Verified Member' : 'Guest / New'}
                            </Text>
                        </View>
                    </Card.Content>
                </Card>

                {/* Stats Card */}
                <Card style={styles.statsCard}>
                    <Card.Title title="My Standing" titleStyle={{ color: '#FFF' }} />
                    <Card.Content style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                                +{myStats.toReceive.toFixed(0)}
                            </Text>
                            <Text style={styles.statLabel}>To Take (Lane)</Text>
                        </View>
                        <View style={styles.verticalDivider} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: '#FF5252' }]}>
                                -{myStats.toPay.toFixed(0)}
                            </Text>
                            <Text style={styles.statLabel}>To Give (Dane)</Text>
                        </View>
                    </Card.Content>
                </Card>

                <Button
                    mode="contained"
                    onPress={handleLogout}
                    style={styles.logoutButton}
                    buttonColor="#FF5252"
                    textColor="#FFF"
                    icon="logout"
                >
                    Logout
                </Button>
            </View>
            <BottomBar />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    content: {
        flex: 1,
        padding: wp(5),
        paddingTop: hp(8),
    },
    title: {
        color: '#FFF',
        textAlign: 'center',
        marginBottom: hp(4),
        fontWeight: 'bold',
    },
    profileCard: {
        backgroundColor: '#1E1E1E',
        borderRadius: 20,
        elevation: 5,
        marginBottom: hp(5),
    },
    cardContent: {
        alignItems: 'center',
        paddingVertical: hp(4),
    },
    avatarContainer: {
        width: wp(30),
        height: wp(30),
        borderRadius: wp(15),
        backgroundColor: '#00FFFF', // Cyan neon fallback
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: hp(2),
        borderWidth: 2,
        borderColor: '#FFF',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarText: {
        fontSize: wp(10),
        fontWeight: 'bold',
        color: '#000',
    },
    name: {
        fontSize: wp(6),
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: hp(0.5),
    },
    email: {
        fontSize: wp(4),
        color: '#AAA',
        marginBottom: hp(3),
    },
    divider: {
        width: '100%',
        backgroundColor: '#333',
        height: 1,
        marginBottom: hp(3),
    },
    infoRow: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        paddingHorizontal: wp(5),
    },
    label: {
        color: '#888',
        fontSize: wp(3.5),
    },
    value: {
        color: '#CCC',
        fontSize: wp(3.5),
        width: wp(50),
        textAlign: 'right',
    },
    logoutButton: {
        borderRadius: 12,
        paddingVertical: hp(0.5),
    },
    statsCard: {
        backgroundColor: '#1E1E1E',
        borderRadius: 20,
        marginBottom: hp(3),
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: hp(1),
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: wp(6),
        fontWeight: 'bold',
        marginBottom: 4,
    },
    statLabel: {
        color: '#888',
        fontSize: wp(3.5),
    },
    verticalDivider: {
        width: 1,
        height: '80%',
        backgroundColor: '#333',
    }
});

export default ProfileScreen;
