import React, { useMemo } from 'react';
import { View, StyleSheet, Image, ScrollView, Linking } from 'react-native';
import { Text, Card, List, Button, IconButton, Modal, Portal, TextInput } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../redux/store';
// Add user import for selectors if missing, or use existing useSelector logic
// (RootState already imported)
import { toggleSettlement } from '../redux/expensesSlice';
import { getFirestore, doc, getDoc, updateDoc, collection } from '@react-native-firebase/firestore';
import { wp, hp } from '../utils/responsive';
import Header from '../components/Header';
import { getFriendImage } from '../utils/imageMapper';
import { useNavigation, useRoute } from '@react-navigation/native';

// Reuse color logic locally or import? Importing logic would be cleaner but for now copying the palette for consistency
const getNeonColor = (id: string, index: number) => {
    const colors = [
        '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF', '#FFA500',
        '#800080', '#008080', '#FFC0CB', '#FF1493', '#00FF7F', '#FFD700', '#ADFF2F',
        '#FF4500', '#DA70D6', '#1E90FF', '#FF69B4', '#8A2BE2', '#32CD32',
    ];
    return colors[index % colors.length] || '#00E5FF';
};

const FriendDetailScreen = () => {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const dispatch = useDispatch();
    const { friendId, index } = route.params; // Expect index to be passed for color consistency

    const friend = useSelector((state: RootState) =>
        state.friends.list.find(f => f.id === friendId)
    );
    const expenses = useSelector((state: RootState) => state.expenses.list);
    const user = useSelector((state: RootState) => state.user.user);

    // Modal State
    const [modalVisible, setModalVisible] = React.useState(false);
    const [selectedExpense, setSelectedExpense] = React.useState<any>(null);
    const [requestAmount, setRequestAmount] = React.useState('');
    const [requestNote, setRequestNote] = React.useState('');

    // Detail View State
    const [detailVisible, setDetailVisible] = React.useState(false);
    const [detailExpense, setDetailExpense] = React.useState<any>(null);

    const handleOpenRequestModel = (expense: any, share: number) => {
        setSelectedExpense(expense);
        setRequestAmount(share.toFixed(0));
        setRequestNote('');
        setModalVisible(true);
    };

    const handleSendRequest = async () => {
        if (!selectedExpense) return;
        try {
            const db = getFirestore();
            const e = selectedExpense;
            const myName = user?.displayName;
            if (!myName || !friend) return;

            const expenseRef = doc(db, 'expenses', e.id);

            // Add to pending
            const currentPending = e.pendingSettlements || [];
            if (!currentPending.includes(myName)) {
                await updateDoc(expenseRef, { pendingSettlements: [...currentPending, myName] });

                const notifRef = collection(db, 'notifications');
                await notifRef.add({
                    type: 'settlement_request',
                    fromUser: myName,
                    toUser: friend.name,
                    expenseId: e.id,
                    expenseDescription: e.description,
                    amount: parseFloat(requestAmount) || 0,
                    note: requestNote,
                    timestamp: Date.now()
                });
            }
            setModalVisible(false);
        } catch (err) {
            console.error(err);
        }
    };

    if (!friend) {
        return <View style={styles.container}><Text>Friend not found</Text></View>;
    }

    const neonColor = getNeonColor(friendId, index || 0);

    const relatedExpenses = useMemo(() => {
        const relevant = expenses.filter(e =>
            e.paidBy[friend.name] !== undefined || e.splitAmong.includes(friend.name)
        );
        // Deduplicate by ID to prevent "duplicate key" errors from existing bad data
        const uniqueMap = new Map();
        relevant.forEach(item => uniqueMap.set(item.id, item));
        return Array.from(uniqueMap.values());
    }, [expenses, friend]);

    const { totalPaid, totalShare, netBalance, debtBreakdown, totalBorrowed, totalRepaidByMe } = useMemo(() => {
        let tPaid = 0;
        let tShare = 0;
        let tBorrowed = 0;
        let tRepaidByMe = 0;

        const debts: Record<string, number> = {}; // +ve means Recovers from X, -ve means Owes to X

        expenses.forEach(e => {
            // 1. If FRIEND paid, who owes them?
            const friendPaidAmount = e.paidBy[friend.name] || 0;
            // NOTE: We generally consider 'Total Paid' as historical fact, so likely keep it.
            // However, Net Balance (Recover/Pay) should reflect settlements.
            if (friendPaidAmount > 0) {
                tPaid += friendPaidAmount;
            }

            const splitCount = e.splitAmong.length;
            const share = e.totalAmount / splitCount;

            // 2. If FRIEND consumed (is in split), did he pay enough?
            if (e.splitAmong.includes(friend.name)) {
                // Share count remains as historical fact usually.
                tShare += share;

                // --- NEW LOGIC for Loan/Repaid ---
                // If I am in split, and I AM NOT the payer (or I paid less than full, simplified here: assume one payer for now or split equally)
                // We check if I owe someone.

                // Simpler approach for "Loan":
                // If I am in split, I "borrowed" (incurred debt) = my Share.
                // (Strictly speaking, if I paid for myself, it's not a loan, but let's assume "Loan" = "My Share of expenses paid by others")

                // Check who paid. If I didn't pay 100% of my share, I borrowed.
                const myPaymentOnThis = e.paidBy[friend.name] || 0;
                if (myPaymentOnThis < share) {
                    // I owe the difference
                    const borrowedOnThis = share - myPaymentOnThis;
                    tBorrowed += borrowedOnThis;

                    // Check if I settled this specific expense
                    if (e.settledBy?.includes(friend.name)) {
                        tRepaidByMe += borrowedOnThis;
                    }
                }
            }

            // --- Debt Breakdown Logic (Net Impact) ---

            // If the current friend (friend.name) is part of the split
            if (e.splitAmong.includes(friend.name)) {
                // Has friend.name settled this expense?
                const amISettled = e.settledBy?.includes(friend.name);

                if (!amISettled) {
                    // Calculate how much the current friend owes to each payer for this expense
                    const totalBill = e.totalAmount;
                    Object.entries(e.paidBy).forEach(([payerName, amountPaid]) => {
                        if (payerName !== friend.name) {
                            // Fraction of the bill this payer handled
                            const weight = amountPaid / totalBill;
                            // The current friend's share of the expense, multiplied by the payer's weight
                            const myDebtToHim = share * weight;
                            // Add to debts: negative means current friend owes payerName
                            debts[payerName] = (debts[payerName] || 0) - myDebtToHim;
                        }
                    });
                }
            }

            // If the current friend (friend.name) paid for this expense
            if (friendPaidAmount > 0) {
                // Calculate how much each other person in the split owes to the current friend
                const totalBill = e.totalAmount;
                const myWeight = friendPaidAmount / totalBill; // Weight of current friend's payment

                e.splitAmong.forEach(person => {
                    if (person !== friend.name) {
                        // Has 'person' settled their debt for this expense?
                        const isPersonSettled = e.settledBy?.includes(person);

                        if (!isPersonSettled) {
                            // Their share of the expense, multiplied by the current friend's payment weight
                            const theirShare = e.totalAmount / splitCount;
                            const theyOweMe = theirShare * myWeight;
                            // Add to debts: positive means person owes current friend
                            debts[person] = (debts[person] || 0) + theyOweMe;
                        }
                    }
                });
            }
        });

        // Round debts to 2 decimal places to avoid floating point inaccuracies
        let net = 0;
        for (const person in debts) {
            debts[person] = parseFloat(debts[person].toFixed(2));
            net += debts[person];
        }

        return {
            totalPaid: tPaid,
            totalShare: tShare,
            netBalance: net,
            debtBreakdown: debts,
            totalBorrowed: tBorrowed,
            totalRepaidByMe: tRepaidByMe
        };
    }, [expenses, friend]);

    const balanceText = netBalance >= 0 ? 'Total To Recover' : 'Total To Pay';
    const balanceColor = netBalance >= 0 ? '#4CAF50' : '#FF5252';

    const imageSource = getFriendImage(friend.image);

    const phone = friend.phone || '03001234567';
    const makeCall = () => Linking.openURL(`tel:${phone}`);
    const sendSMS = () => Linking.openURL(`sms:${phone}`);
    const openWhatsApp = () => {
        const msg = encodeURIComponent('Hey! Checking our expenses in Yaaripay App.');
        Linking.openURL(`whatsapp://send?text=${msg}&phone=${phone}`).catch(() =>
            Linking.openURL(`https://wa.me/${phone}?text=${msg}`)
        );
    };

    return (
        <View style={styles.container}>
            <Header title={`Profile ${friend.name}`} />
            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Hero Profile Section */}
                <View style={[styles.heroContainer, { borderColor: neonColor }]}>
                    <Image source={imageSource} style={styles.heroImage} />
                </View>

                {/* Simple Name Display */}
                <Text style={[styles.nameText, { color: '#FFF' }]}>
                    {friend.name}
                </Text>

                {/* Actions */}
                <View style={styles.actionRow}>
                    <IconButton icon="whatsapp" iconColor="#25D366" size={30} onPress={openWhatsApp} />
                    <IconButton icon="phone" iconColor={neonColor} size={30} onPress={makeCall} />
                    <IconButton icon="message-text" iconColor="#70B2B2" size={30} onPress={sendSMS} />
                </View>

                {/* Balance Sheet / Breakdown */}
                <Card style={[styles.statCard, { borderLeftColor: balanceColor, borderWidth: 1, borderColor: '#333' }]}>
                    <Card.Content>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                            <View>
                                <Text style={{ color: '#AAA' }}>Paid: {totalPaid.toFixed(0)}</Text>
                            </View>
                            <View>
                                <Text style={{ color: '#AAA', textAlign: 'right' }}>Share: {totalShare.toFixed(0)}</Text>
                            </View>
                        </View>

                        {/* Loan Overview Section */}
                        <View style={{ marginBottom: 20, padding: 10, backgroundColor: '#252525', borderRadius: 8 }}>
                            <Text variant="titleMedium" style={{ color: '#FFF', marginBottom: 10, fontWeight: 'bold' }}>Loan Overview</Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                <Text style={{ color: '#BBB' }}>Total Borrowed:</Text>
                                <Text style={{ color: '#FF5252', fontWeight: 'bold' }}>{totalBorrowed.toFixed(0)}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                <Text style={{ color: '#BBB' }}>Total Repaid:</Text>
                                <Text style={{ color: '#4CAF50', fontWeight: 'bold' }}>{totalRepaidByMe.toFixed(0)}</Text>
                            </View>
                            <View style={{ marginTop: 5, borderTopWidth: 1, borderTopColor: '#444', paddingTop: 5, flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#FFF' }}>Outstanding:</Text>
                                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{(totalBorrowed - totalRepaidByMe).toFixed(0)}</Text>
                            </View>
                        </View>

                        <Text variant="titleMedium" style={{ color: '#FFF', marginBottom: 10, fontWeight: 'bold' }}>Balance Sheet</Text>

                        {Object.entries(debtBreakdown).map(([person, amount]) => {
                            if (Math.abs(amount) < 1) return null; // Ignore negligible amounts
                            const isPositive = amount > 0;
                            const color = isPositive ? '#4CAF50' : '#FF5252';
                            return (
                                <View key={person} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, paddingBottom: 5, borderBottomWidth: 0.5, borderBottomColor: '#333' }}>
                                    <Text style={{ color: '#FFF' }}>{person}</Text>
                                    <Text style={{ color: color, fontWeight: 'bold' }}>
                                        {isPositive ? `Lene hain ${amount.toFixed(0)}` : `Dene hain ${Math.abs(amount).toFixed(0)}`}
                                    </Text>
                                </View>
                            );
                        })}

                        {Object.keys(debtBreakdown).length === 0 && (
                            <Text style={{ color: '#666', fontStyle: 'italic' }}>No outstanding debts.</Text>
                        )}

                        <View style={{ marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#555' }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Net Position</Text>
                                <Text style={{ color: balanceColor, fontWeight: 'bold' }}>{netBalance >= 0 ? '+' : '-'}{Math.abs(netBalance).toFixed(0)}</Text>
                            </View>
                        </View>
                    </Card.Content>
                </Card>

                <Button
                    mode="contained"
                    icon="cash-plus"
                    buttonColor={neonColor}
                    textColor="#000"
                    style={{ marginVertical: hp(2) }}
                    onPress={() => navigation.navigate('AddExpense', { friendId: friend.id })}
                >
                    Add Expense for {friend.name}
                </Button>

                {/* History */}
                <Text variant="titleLarge" style={[styles.sectionTitle, { color: neonColor }]}>History</Text>
                {relatedExpenses.map(e => {
                    const paid = e.paidBy[friend.name] || 0;
                    const share = e.totalAmount / e.splitAmong.length;
                    const isPayer = paid > 0;

                    const isSettled = e.settledBy?.includes(friend.name) || false;
                    const statusText = isPayer ? 'Owner' : (isSettled ? 'Paid' : 'Unpaid');
                    const statusColor = isPayer ? '#4CAF50' : (isSettled ? '#4CAF50' : '#FF5252');

                    const date = new Date(e.timestamp).toLocaleDateString();
                    const time = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                        <Card key={e.id} style={[styles.historyCard, { borderLeftColor: neonColor }]}>
                            <Card.Content>
                                <View style={styles.historyHeader}>
                                    <View>
                                        <Text variant="titleMedium" style={{ fontWeight: 'bold', color: '#FFF' }}>{e.description}</Text>
                                        <Text variant="labelSmall" style={{ color: '#888' }}>Total: {e.totalAmount} • {date} {time}</Text>
                                    </View>
                                    <View>
                                        <Text variant="headlineSmall" style={{ color: neonColor, fontWeight: 'bold', textAlign: 'right' }}>
                                            {share.toFixed(0)}
                                        </Text>
                                        <Text style={{ color: statusColor, fontWeight: 'bold', textAlign: 'right', fontSize: 12 }}>
                                            {statusText.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.historyStats}>
                                    <Text style={{ color: '#AAA', alignSelf: 'center' }}>Per Person Share</Text>
                                </View>

                                <View style={styles.historyActions}>

                                    {(() => {
                                        const myName = user?.displayName;
                                        const payerName = Object.keys(e.paidBy)[0]; // Assume single payer
                                        const amIPayer = payerName === myName;

                                        // Robust comparison
                                        const cleanPayer = payerName?.trim();
                                        const cleanFriend = friend.name?.trim();
                                        const cleanMe = myName?.trim();

                                        const isFriendPayer = cleanPayer === cleanFriend;
                                        const isInSplit = e.splitAmong.some((name: string) => name.trim() === cleanMe);

                                        // Case 1: Friend PAID, I OWED. (I am Debtor).
                                        // "jis ny dane hn pasie" (The one who owes money) -> Can Request Status Update.
                                        const shouldShowRequest = isFriendPayer && isInSplit && myName && !amIPayer;

                                        if (shouldShowRequest) {
                                            const isSettled = e.settledBy?.includes(myName);
                                            const isPending = e.pendingSettlements?.includes(myName);

                                            if (isSettled) return <Button mode="text" disabled textColor="#4CAF50">Paid</Button>;

                                            return (
                                                <Button
                                                    mode={isPending ? "outlined" : "contained"}
                                                    compact
                                                    disabled={isPending}
                                                    buttonColor={isPending ? undefined : neonColor}
                                                    textColor={isPending ? '#AAA' : '#000'}
                                                    style={{ borderColor: neonColor, marginRight: 8 }}
                                                    onPress={() => handleOpenRequestModel(e, share)}
                                                >
                                                    {isPending ? "Request Sent" : "Request Status Update"}
                                                </Button>

                                            );
                                        } else if (isFriendPayer && !amIPayer) {
                                            return (
                                                <Text style={{ fontSize: 10, color: '#FFD700', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                                                    DEBUG: Me='{myName}', Payer='{payerName}', InSplit={isInSplit ? 'Yes' : 'No'}, Friend='{friend.name}'
                                                </Text>
                                            );
                                        }
                                        // "reqest ka button owner k pass nhi ho ga" (Owner won't have request button).
                                        // "owner approve kr k stats paid kre de ga" (Owner approves and marks paid).
                                        if (amIPayer && e.splitAmong.includes(friend.name)) {
                                            if (friend.name === myName) return null;
                                            const isSettled = e.settledBy?.includes(friend.name);
                                            const hasPendingRequest = e.pendingSettlements?.includes(friend.name);

                                            return (
                                                <Button
                                                    mode={isSettled ? "contained" : "outlined"}
                                                    compact
                                                    buttonColor={isSettled ? '#4CAF50' : undefined}
                                                    textColor={isSettled ? '#FFF' : neonColor}
                                                    style={{ borderColor: neonColor, marginRight: 8 }}
                                                    onPress={async () => {
                                                        dispatch(toggleSettlement({ expenseId: e.id, friendName: friend.name }));

                                                        try {
                                                            const db = getFirestore();
                                                            const expenseRef = doc(db, 'expenses', e.id);
                                                            const snapshot = await getDoc(expenseRef);
                                                            const currentData = snapshot.data();

                                                            if (currentData) {
                                                                let currentSettledBy = currentData?.settledBy || [];
                                                                // Toggle logic
                                                                if (currentSettledBy.includes(friend.name)) {
                                                                    currentSettledBy = currentSettledBy.filter((n: string) => n !== friend.name);
                                                                } else {
                                                                    currentSettledBy.push(friend.name);
                                                                    // If we mark paid, resolve pending request automatically
                                                                    if (currentData.pendingSettlements?.includes(friend.name)) {
                                                                        const newPending = currentData.pendingSettlements.filter((n: string) => n !== friend.name);
                                                                        await updateDoc(expenseRef, { pendingSettlements: newPending });
                                                                    }
                                                                }
                                                                await updateDoc(expenseRef, { settledBy: currentSettledBy });
                                                            }
                                                        } catch (err) { console.error(err); }
                                                    }}
                                                >
                                                    {isSettled ? "Mark Unpaid" : "Mark Paid"}
                                                </Button>
                                            );
                                        }

                                        // Default fallthrough for others
                                        return null;
                                    })()}
                                    <Button
                                        mode="contained-tonal"
                                        compact
                                        icon="information-variant"
                                        labelStyle={{ fontSize: 10 }}
                                        style={{ marginHorizontal: 4 }}
                                        onPress={() => {
                                            setDetailExpense(e);
                                            setDetailVisible(true);
                                        }}
                                    >
                                        Details
                                    </Button>
                                    <Button
                                        mode="text"
                                        compact
                                        textColor="#FF5252"
                                        onPress={() => Linking.openURL('https://chat.whatsapp.com/Jl9OYSTqoMd9MBZ1BuzsQA')}
                                    >
                                        Dispute
                                    </Button>
                                </View>
                            </Card.Content>
                        </Card>
                    );
                })}

                {/* Detail Modal */}
                <Portal>
                    <Modal visible={detailVisible} onDismiss={() => setDetailVisible(false)} contentContainerStyle={{ backgroundColor: '#1E1E1E', padding: 20, margin: 20, borderRadius: 10 }}>
                        {detailExpense && (
                            <>
                                <Text variant="titleLarge" style={{ color: '#FFF', fontWeight: 'bold', marginBottom: 5 }}>{detailExpense.description}</Text>
                                <Text style={{ color: '#888', marginBottom: 15 }}>
                                    {new Date(detailExpense.timestamp).toLocaleDateString()} at {new Date(detailExpense.timestamp).toLocaleTimeString()}
                                </Text>

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, padding: 10, backgroundColor: '#2C2C2C', borderRadius: 8 }}>
                                    <Text style={{ color: '#FFF' }}>Total Amount</Text>
                                    <Text style={{ color: neonColor, fontWeight: 'bold', fontSize: 16 }}>RS {detailExpense.totalAmount}</Text>
                                </View>

                                <Text style={{ color: '#FFF', marginBottom: 8, fontWeight: 'bold' }}>Paid By:</Text>
                                {Object.entries(detailExpense.paidBy).map(([name, amount]: any) => (
                                    <View key={name} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                        <Text style={{ color: '#BBB' }}>{name}</Text>
                                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>RS {amount}</Text>
                                    </View>
                                ))}

                                <Text style={{ color: '#FFF', marginTop: 15, marginBottom: 8, fontWeight: 'bold' }}>Split Among:</Text>
                                {detailExpense.splitAmong.map((person: string) => {
                                    const amount = (detailExpense.totalAmount / detailExpense.splitAmong.length).toFixed(0);
                                    const isSettled = detailExpense.settledBy?.includes(person);
                                    const isPayer = Object.keys(detailExpense.paidBy).includes(person);

                                    return (
                                        <View key={person} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                            <Text style={{ color: '#BBB' }}>{person}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={{ color: '#FFF', fontWeight: 'bold', marginRight: 8 }}>RS {amount}</Text>
                                                <Text style={{ fontSize: 10, color: (isPayer || isSettled) ? '#4CAF50' : '#FF5252' }}>
                                                    {isPayer ? 'PAID' : (isSettled ? 'SETTLED' : 'PENDING')}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                })}

                                <Button mode="contained" onPress={() => setDetailVisible(false)} style={{ marginTop: 20, alignSelf: 'center' }} buttonColor={neonColor} textColor="#000">
                                    Close
                                </Button>
                            </>
                        )}
                    </Modal>
                </Portal>

                {/* Request Settlement Modal */}
                <Portal>
                    <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={{ backgroundColor: '#1E1E1E', padding: 20, margin: 20, borderRadius: 10 }}>
                        <Text variant="titleLarge" style={{ color: '#FFF', marginBottom: 15, fontWeight: 'bold' }}>Request Status Update</Text>
                        <TextInput
                            label="Amount Paid"
                            mode="outlined"
                            keyboardType="numeric"
                            value={requestAmount}
                            onChangeText={setRequestAmount}
                            style={{ marginBottom: 10, backgroundColor: '#2C2C2C' }}
                            textColor="#FFF"
                        />
                        <TextInput
                            label="Note (How? e.g. EasyPaisa)"
                            mode="outlined"
                            value={requestNote}
                            onChangeText={setRequestNote}
                            placeholder="e.g. Sent via EasyPaisa Trx ID..."
                            placeholderTextColor="#666"
                            multiline
                            style={{ marginBottom: 20, backgroundColor: '#2C2C2C' }}
                            textColor="#FFF"
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                            <Button onPress={() => setModalVisible(false)} textColor="#888" style={{ marginRight: 10 }}>Cancel</Button>
                            <Button
                                mode="contained"
                                buttonColor={neonColor}
                                textColor="#000"
                                onPress={handleSendRequest}
                            >
                                Send Request
                            </Button>
                        </View>
                    </Modal>
                </Portal>

            </ScrollView>
        </View >
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' }, // Dark theme for details
    scrollContent: { padding: wp(5), paddingBottom: hp(10) },
    heroContainer: {
        width: wp(40),
        height: wp(40),
        alignSelf: 'center',
        borderRadius: wp(20),
        borderWidth: 3,
        overflow: 'hidden',
        marginBottom: hp(2),
        marginTop: hp(2),
    },
    heroImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    // Removed crazy nameTag styles
    nameText: {
        fontWeight: 'bold',
        fontSize: wp(6),
        textAlign: 'center',
        marginBottom: hp(3),
        letterSpacing: 1,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: hp(3),
        gap: wp(4),
    },
    statCard: {
        marginBottom: hp(2),
        backgroundColor: '#1E1E1E',
        borderLeftWidth: 4,
        borderRadius: 8,
    },
    sectionTitle: {
        fontWeight: 'bold',
        marginBottom: hp(1.5),
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: hp(1),
    },
    historyCard: {
        backgroundColor: '#1E1E1E',
        marginBottom: hp(1.5),
        borderLeftWidth: 4,
        borderRadius: 8,
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: hp(1),
    },
    historyStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: hp(1.5),
        paddingBottom: hp(1),
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#333',
    },
    historyActions: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
    }
});

export default FriendDetailScreen;
