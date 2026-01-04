import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, Button, ActivityIndicator } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { getFirestore, collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, getDoc } from '@react-native-firebase/firestore';
import Header from '../components/Header';
import BottomBar from '../components/BottomBar';
import { wp, hp } from '../utils/responsive';

const NotificationsScreen = () => {
    const user = useSelector((state: RootState) => state.user.user);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.displayName) return;

        const db = getFirestore();
        const q = query(
            collection(db, 'notifications'),
            where('toUser', '==', user.displayName)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            // Sort by timestamp desc locally
            notifs.sort((a: any, b: any) => b.timestamp - a.timestamp);
            setNotifications(notifs);
            setLoading(false);
        }, (err) => {
            console.error("Notifications listener error", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleConfirm = async (notif: any) => {
        try {
            const db = getFirestore();

            // 1. Update Expense
            const expenseRef = doc(db, 'expenses', notif.expenseId);
            const expenseSnap = await getDoc(expenseRef);

            if (expenseSnap.exists()) {
                const data = expenseSnap.data();
                let settledBy = data?.settledBy || [];
                let pendingSettlements = data?.pendingSettlements || [];

                // Move from pending to settled
                if (!settledBy.includes(notif.fromUser)) {
                    settledBy.push(notif.fromUser);
                }
                pendingSettlements = pendingSettlements.filter((n: string) => n !== notif.fromUser);

                await updateDoc(expenseRef, {
                    settledBy,
                    pendingSettlements
                });
            }

            // 2. Delete Notification
            await deleteDoc(doc(db, 'notifications', notif.id));

        } catch (error) {
            console.error("Error confirming settlement:", error);
        }
    };

    const handleReject = async (notif: any) => {
        try {
            const db = getFirestore();
            // Just delete notification and maybe remove from pending?
            // For now, let's just remove from pending so they can request again if needed.
            const expenseRef = doc(db, 'expenses', notif.expenseId);
            const expenseSnap = await getDoc(expenseRef);
            if (expenseSnap.exists()) {
                const data = expenseSnap.data();
                let pendingSettlements = data?.pendingSettlements || [];
                pendingSettlements = pendingSettlements.filter((n: string) => n !== notif.fromUser);
                await updateDoc(expenseRef, { pendingSettlements });
            }

            await deleteDoc(doc(db, 'notifications', notif.id));
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
    }

    return (
        <View style={styles.container}>
            <Header title="Notifications" />
            <View style={styles.content}>
                {notifications.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: '#888', marginTop: 20 }}>No new notifications</Text>
                ) : (
                    <FlatList
                        data={notifications}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <Card style={styles.card}>
                                <Card.Content>
                                    <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Settlement Request</Text>
                                    <Text variant="bodyMedium" style={{ marginVertical: 5 }}>
                                        <Text style={{ fontWeight: 'bold', color: '#016B61' }}>{item.fromUser}</Text> claims to have paid <Text style={{ fontWeight: 'bold' }}>{item.amount}</Text> for:
                                    </Text>
                                    <Text variant="bodyLarge" style={{ fontStyle: 'italic', marginBottom: 10 }}>"{item.expenseDescription}"</Text>

                                    {item.note && (
                                        <View style={{ backgroundColor: '#F0F0F0', padding: 8, borderRadius: 4, marginBottom: 10 }}>
                                            <Text style={{ color: '#555', fontStyle: 'italic' }}>Note: {item.note}</Text>
                                        </View>
                                    )}

                                    <View style={styles.actionRow}>
                                        <Button
                                            mode="contained"
                                            buttonColor="#4CAF50"
                                            onPress={() => handleConfirm(item)}
                                            style={{ flex: 1, marginRight: 8 }}
                                        >
                                            Confirm
                                        </Button>
                                        <Button
                                            mode="outlined"
                                            textColor="#FF5252"
                                            onPress={() => handleReject(item)}
                                            style={{ flex: 1, borderColor: '#FF5252' }}
                                        >
                                            Reject
                                        </Button>
                                    </View>
                                </Card.Content>
                            </Card>
                        )}
                    />
                )}
            </View>
            <BottomBar />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { flex: 1, padding: wp(4), paddingBottom: hp(10) },
    card: { marginBottom: hp(2), backgroundColor: '#FFF' },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }
});

export default NotificationsScreen;
