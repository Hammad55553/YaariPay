import React, { useMemo } from 'react';
import { View, StyleSheet, Image, ScrollView, Linking } from 'react-native';
import { Text, Card, List, Button, IconButton, Modal, Portal, TextInput, Avatar } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../redux/store';
import LinearGradient from 'react-native-linear-gradient';
// Add user import for selectors if missing, or use existing useSelector logic
// (RootState already imported)
import { toggleSettlement } from '../redux/expensesSlice';
import { getFirestore, doc, getDoc, updateDoc, collection, arrayUnion } from '@react-native-firebase/firestore';
import { wp, hp } from '../utils/responsive';
import Header from '../components/Header';
import { getFriendImage } from '../utils/imageMapper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { sendNotification } from '../utils/FCMService';
import { getAuth } from '@react-native-firebase/auth';

// Reuse color logic locally or import? Importing logic would be cleaner but for now copying the palette for consistency
const getNeonColor = (id: string, index: number) => {
    return '#E0F2F1'; // Fixed Light Teal for everyone
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
    const myName = user?.displayName;

    // Modal State
    const [modalVisible, setModalVisible] = React.useState(false);
    const [selectedExpense, setSelectedExpense] = React.useState<any>(null);
    const [requestAmount, setRequestAmount] = React.useState('');
    const [requestNote, setRequestNote] = React.useState('');

    // Detail View State
    const [detailVisible, setDetailVisible] = React.useState(false);
    const [detailExpense, setDetailExpense] = React.useState<any>(null);

    // Settlement Confirm Modal State
    const [settleModalVisible, setSettleModalVisible] = React.useState(false);
    const [settleExpense, setSettleExpense] = React.useState<any>(null);

    const [settleAmount, setSettleAmount] = React.useState('');
    const [maxSettleAmount, setMaxSettleAmount] = React.useState(0);

    // Calculate how much 'friend' owes 'me' for this specific expense
    const calculateOwedToMe = (expense: any) => {
        if (!expense || !friend || !myName) return 0;

        const normalize = (name: string) => name ? name.trim().toLowerCase() : '';
        const friendName = normalize(friend.name);
        const myNameNorm = normalize(myName);

        // 1. Balances
        const splitCount = expense.splitAmong.length;
        const perPersonShare = expense.totalAmount / splitCount;

        const balances: Record<string, number> = {};
        const participants = new Set([...expense.splitAmong, ...Object.keys(expense.paidBy)]);

        participants.forEach(p => {
            const pNorm = normalize(p);
            const paid = Object.entries(expense.paidBy).find(([n]) => normalize(n) === pNorm)?.[1] as number || 0;
            const isBorrower = expense.splitAmong.some((n: string) => normalize(n) === pNorm);
            balances[pNorm] = paid - (isBorrower ? perPersonShare : 0);
        });

        // 2. Distribute
        const creditors: any[] = [];
        const debtors: any[] = [];
        let totalSurplus = 0;

        Object.entries(balances).forEach(([n, b]) => {
            if (b > 0.01) { creditors.push({ name: n, amount: b }); totalSurplus += b; }
            else if (b < -0.01) { debtors.push({ name: n, amount: Math.abs(b) }); }
        });

        let owedToMe = 0;

        debtors.forEach(d => {
            if (d.name === friendName) {
                creditors.forEach(c => {
                    if (c.name === myNameNorm) {
                        const weight = c.amount / totalSurplus;
                        owedToMe += d.amount * weight;
                    }
                });
            }
        });

        // 3. Subtract existing payments
        if (expense.payments) {
            const paid = expense.payments
                .filter((p: any) => normalize(p.from) === friendName && normalize(p.to) === myNameNorm)
                .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
            owedToMe = Math.max(0, owedToMe - paid);
        }

        return owedToMe;
    };

    const handleOpenSettleModal = (expense: any) => {
        const owed = calculateOwedToMe(expense);
        setSettleExpense(expense);
        setMaxSettleAmount(owed);
        setSettleAmount(owed.toFixed(0));
        setSettleModalVisible(true);
    };

    const handleConfirmSettlement = async () => {
        if (!settleExpense || !friend || !myName) return;
        const e = settleExpense;
        const amount = parseFloat(settleAmount);

        try {
            const db = getFirestore();
            const expenseRef = doc(db, 'expenses', e.id);
            const normalize = (name: string) => name ? name.trim().toLowerCase() : '';

            if (maxSettleAmount <= 0.01) {
                // UNDO LOGIC: REMOVE PAYMENTS (Mark Unpaid)
                // Filter out payments from THIS friend to ME
                const snapshot = await getDoc(expenseRef);
                const data = snapshot.data();
                const currentPayments = data?.payments || [];

                const friendNameNorm = normalize(friend.name);
                const myNameNorm = normalize(myName);

                const newPayments = currentPayments.filter((p: any) =>
                    !(normalize(p.from) === friendNameNorm && normalize(p.to) === myNameNorm)
                );

                await updateDoc(expenseRef, { payments: newPayments });

                // Also clear settledBy if present
                if (data?.settledBy?.includes(friend.name)) {
                    const newSettledBy = data.settledBy.filter((n: string) => n !== friend.name);
                    await updateDoc(expenseRef, { settledBy: newSettledBy });
                }

            } else {
                // PAY LOGIC: ADD PAYMENT
                if (isNaN(amount) || amount <= 0) {
                    // Should potentially show error, but just close for safety
                    setSettleModalVisible(false);
                    return;
                }

                await updateDoc(expenseRef, {
                    payments: arrayUnion({
                        from: friend.name,
                        to: myName,
                        amount: amount,
                        timestamp: Date.now()
                    })
                });

                // Clear pending requests
                const snapshot = await getDoc(expenseRef);
                const data = snapshot.data();
                if (data?.pendingSettlements?.includes(friend.name)) {
                    const newPending = data.pendingSettlements.filter((n: string) => n !== friend.name);
                    await updateDoc(expenseRef, { pendingSettlements: newPending });
                }
            }

            setSettleModalVisible(false);
            setSettleExpense(null);
        } catch (err) { console.error(err); }
    };

    // Mock check helper (removed in real code, just used logic above)


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
                    read: false,
                    timestamp: Date.now()
                });

                // Send FCM Notification
                if (friend.id) {
                    // Note: We need friend's UID to send notification, assuming friend.id IS the UID (which it is in our system)
                    sendNotification(
                        `Settlement Request from ${myName}`,
                        `Please settle: ${e.description} (Amount: ${requestAmount})`,
                        friend.id,
                        'settlement_request'
                    );
                }
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
        const normalize = (name: string) => name ? name.trim().toLowerCase() : '';
        const friendNameNorm = normalize(friend?.name || '');

        let tPaid = 0;
        let tShare = 0;
        let tBorrowed = 0;
        let tRepaidByMe = 0; // Means repaid by "Friend" in this context

        let receive = 0;
        let pay = 0;

        const debts: Record<string, number> = {};

        expenses.forEach(e => {
            // 1. Historical Totals
            const friendPaidAmount = e.paidBy[friend.name] || 0;
            if (friendPaidAmount > 0) tPaid += friendPaidAmount;

            const splitCount = e.splitAmong.length;
            if (splitCount === 0) return;
            const perPersonShare = e.totalAmount / splitCount;

            if (e.splitAmong.includes(friend.name)) {
                tShare += perPersonShare;
            }

            // 2. Surplus / Deficit Logic
            const expenseBalances: Record<string, number> = {};
            const participants = new Set([...e.splitAmong, ...Object.keys(e.paidBy)]);

            participants.forEach(p => {
                const pNorm = normalize(p);
                const paidAmt = Object.entries(e.paidBy).find(([name]) => normalize(name) === pNorm)?.[1] || 0;
                const isBorrower = e.splitAmong.some(name => normalize(name) === pNorm);
                const share = isBorrower ? perPersonShare : 0;
                expenseBalances[pNorm] = paidAmt - share;
            });

            // 3. Identify Creditors and Debtors
            const creditors: { name: string, amount: number }[] = [];
            const debtors: { name: string, amount: number }[] = [];
            let totalSurplus = 0;

            Object.entries(expenseBalances).forEach(([name, balance]) => {
                if (balance > 0.01) {
                    creditors.push({ name, amount: balance });
                    totalSurplus += balance;
                } else if (balance < -0.01) {
                    debtors.push({ name, amount: Math.abs(balance) });
                }
            });

            // 4. Distribute
            debtors.forEach(debtor => {
                const debtorName = debtor.name;
                const originalDebtorName = e.splitAmong.find(n => normalize(n) === debtorName) || debtorName;
                const isFullySettled = e.settledBy?.some(s => normalize(s) === debtorName);

                creditors.forEach(creditor => {
                    const creditorName = creditor.name;
                    const originalCreditorName = Object.keys(e.paidBy).find(n => normalize(n) === creditorName) || creditorName;

                    const weight = creditor.amount / totalSurplus;
                    let amountOwed = debtor.amount * weight;

                    // CHECK FOR PARTIAL PAYMENTS
                    if (!isFullySettled && e.payments) {
                        const payments = e.payments.filter((p: any) =>
                            normalize(p.from) === debtorName && normalize(p.to) === creditorName
                        );
                        const paidSum = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                        amountOwed = Math.max(0, amountOwed - paidSum);
                    }

                    // INTERACTION WITH FOCUS FRIEND

                    // CASE A: Friend is Debtor (Friend owes money)
                    if (debtorName === friendNameNorm && creditorName !== friendNameNorm) {
                        tBorrowed += amountOwed;
                        if (!isFullySettled) {
                            pay += amountOwed;
                            // Friend owes Creditor
                            if (amountOwed > 0.01) {
                                debts[originalCreditorName] = (debts[originalCreditorName] || 0) - amountOwed;
                            }
                        } else {
                            if (e.settledBy?.some(s => normalize(s) === friendNameNorm)) {
                                tRepaidByMe += amountOwed;
                            }
                        }
                    }

                    // CASE B: Friend is Creditor (Someone owes Friend)
                    if (creditorName === friendNameNorm && debtorName !== friendNameNorm) {
                        if (!isFullySettled) {
                            receive += amountOwed;
                            if (amountOwed > 0.01) {
                                debts[originalDebtorName] = (debts[originalDebtorName] || 0) + amountOwed;
                            }
                        }
                    }
                });
            });
        });

        // Round Breakdown values and Filter tiny stuff
        Object.keys(debts).forEach(key => {
            debts[key] = Math.round(debts[key]);
            if (Math.abs(debts[key]) < 1) delete debts[key];
        });

        return {
            totalPaid: tPaid,
            totalShare: tShare,
            netBalance: receive - pay,
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
        <LinearGradient colors={['#021B1A', '#014942']} style={styles.container}>
            <Header title={`Profile ${friend.name}`} showBack onBack={() => navigation.goBack()} />
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

                    const normalize = (name: string) => name ? name.trim().toLowerCase() : '';
                    const payerName = Object.keys(e.paidBy)[0] || '';
                    const payerNorm = normalize(payerName);
                    const friendNorm = normalize(friend.name);

                    let isSettled = e.settledBy?.some((s: string) => normalize(s) === friendNorm) || false;

                    if (!isSettled && !isPayer) {
                        const share = e.totalAmount / e.splitAmong.length;
                        const paymentsToOwner = e.payments?.filter((p: any) =>
                            normalize(p.from) === friendNorm && normalize(p.to) === payerNorm
                        ) || [];
                        const totalPaid = paymentsToOwner.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                        if (totalPaid >= (share - 1)) isSettled = true;
                    }

                    const statusText = isPayer ? 'Owner' : (isSettled ? 'Paid' : 'Unpaid');
                    const statusColor = isPayer ? '#4CAF50' : (isSettled ? '#00E676' : '#FF5252');

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
                                        const normalize = (name: string) => name ? name.trim().toLowerCase() : '';
                                        const cleanFriend = normalize(friend.name);
                                        const cleanMe = normalize(myName || '');

                                        const payers = Object.keys(e.paidBy).map(name => normalize(name));
                                        const isFriendPayer = payers.includes(cleanFriend);
                                        const amIPayer = payers.includes(cleanMe);
                                        const isInSplit = e.splitAmong.some((name: string) => normalize(name) === cleanMe);

                                        // Case 1: Friend PAID (is one of payers), I OWED (am in split).
                                        // Ensure I am NOT a payer (at least for this specific interaction context, checking if I owe friend).
                                        // Ideally, check if net balance on this expense makes me a debtor to friend.
                                        // For simplicity: If Friend Paid, and I am in Split, and I didn't pay (or even if I did, multi-payer logic is complex), show request.
                                        // Strict check: Friend is Payer, I am NOT Payer, I am in Split.
                                        const shouldShowRequest = isFriendPayer && isInSplit && myName && !amIPayer;

                                        if (shouldShowRequest) {
                                            // Check if specific debt to Me is settled
                                            const isSettled = e.settledBy?.some((s: string) => normalize(s) === cleanMe);
                                            const isPending = e.pendingSettlements?.some((s: string) => normalize(s) === cleanMe);

                                            // Also check payments to see if I have paid THIS friend
                                            // Since we are in the "Request" block, we want to know if *I* have paid *Friend*
                                            // payments: {from: Me, to: Friend}
                                            const paymentsToFriend = e.payments?.filter((p: any) =>
                                                normalize(p.from) === cleanMe && normalize(p.to) === cleanFriend
                                            ) || [];

                                            // Calculate my share effectively?
                                            // For now, if settledBy flag is true, we show Paid.
                                            // If payments cover the share?
                                            // Let's stick to the settledBy flag for the disabled "Paid" button state for consistency with history status text,
                                            // BUT we should also disable/show "Paid" if payments exist fully?

                                            // Let's rely on the main isSettled logic calculated earlier for the status text
                                            // The status text earlier used `isSettled` variable (line 477).
                                            // Let's re-calculate a local isEffectivelySettledForMe

                                            let isEffectivelyPaid = isSettled;
                                            if (!isEffectivelyPaid) {
                                                const share = e.totalAmount / e.splitAmong.length;
                                                const totalPaid = paymentsToFriend.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                                                if (totalPaid >= (share - 1)) isEffectivelyPaid = true;
                                            }

                                            if (isEffectivelyPaid) return <Button mode="text" disabled textColor="#4CAF50">Paid</Button>;

                                            return (
                                                <Button
                                                    mode={isPending ? "outlined" : "contained"}
                                                    compact
                                                    disabled={isPending}
                                                    buttonColor={isPending ? undefined : neonColor}
                                                    textColor={isPending ? '#AAA' : '#198b30ff'}
                                                    style={{ borderColor: neonColor, marginRight: 8 }}
                                                    onPress={() => handleOpenRequestModel(e, share)}
                                                >
                                                    {isPending ? "Request Sent" : "tus Update"}
                                                </Button>

                                            );
                                        } else if (isFriendPayer && !amIPayer) {
                                            // Guard for when I am not in split but friend is payer?
                                            return null;
                                        }

                                        // Case 2: I am Payer (Owner). Friend is in split.
                                        if (amIPayer && isInSplit === false) {
                                            // Usually if I am payer, checking if friend ows me.
                                            // Friend IS in split check:
                                            const isFriendInSplit = e.splitAmong.some((n: string) => normalize(n) === cleanFriend);

                                            if (isFriendInSplit) {
                                                // Check if I am looking at myself?
                                                if (cleanFriend === cleanMe) return null;

                                                // Calculate if effectively settled based on payments
                                                // ... (existing logic for mark paid)
                                                // We need to re-verify payment direction: Friend -> Me

                                                let isEffectivelySettled = false;
                                                const share = e.totalAmount / e.splitAmong.length;

                                                // Check payments FROM friend TO me
                                                const paymentsFromFriend = e.payments
                                                    ?.filter((p: any) => normalize(p.from) === cleanFriend && normalize(p.to) === cleanMe) || [];

                                                const paidSum = paymentsFromFriend.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

                                                if (paidSum >= (share - 1)) isEffectivelySettled = true;
                                                if (e.settledBy?.some((s: string) => normalize(s) === cleanFriend)) isEffectivelySettled = true;

                                                return (
                                                    <Button
                                                        mode={isEffectivelySettled ? "contained" : "outlined"}
                                                        compact
                                                        buttonColor={isEffectivelySettled ? '#4CAF50' : undefined}
                                                        textColor={isEffectivelySettled ? '#FFF' : neonColor}
                                                        style={{ borderColor: neonColor, marginRight: 8 }}
                                                        onPress={() => handleOpenSettleModal(e)}
                                                    >
                                                        {isEffectivelySettled ? "Mark Unpaid" : "Mark Paid"}
                                                    </Button>
                                                );
                                            }
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
                    <Modal visible={detailVisible} onDismiss={() => setDetailVisible(false)} contentContainerStyle={styles.modalContainer}>
                        {detailExpense && (
                            <>
                                <Text variant="titleLarge" style={{ color: '#E0F2F1', fontWeight: 'bold', marginBottom: hp(0.5) }}>{detailExpense.description}</Text>
                                <Text style={{ color: '#aaa', marginBottom: hp(2), fontSize: 12 }}>
                                    {new Date(detailExpense.timestamp).toLocaleDateString()} at {new Date(detailExpense.timestamp).toLocaleTimeString()}
                                </Text>

                                <View style={{ marginBottom: hp(2), padding: wp(3), backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: wp(2) }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: '#E0F2F1' }}>Total Amount</Text>
                                        <Text style={{ color: neonColor, fontWeight: 'bold', fontSize: 18 }}>RS {detailExpense.totalAmount}</Text>
                                    </View>
                                </View>

                                <Text style={{ color: '#E0F2F1', marginBottom: hp(1), fontWeight: 'bold', opacity: 0.8 }}>PAID BY</Text>
                                {Object.entries(detailExpense.paidBy).map(([name, amount]: any) => (
                                    <View key={name} style={styles.detailRow}>
                                        <Text style={{ color: '#ccc' }}>{name}</Text>
                                        <Text style={{ color: '#E0F2F1', fontWeight: 'bold' }}>RS {amount}</Text>
                                    </View>
                                ))}

                                <Text style={{ color: '#E0F2F1', marginTop: hp(2), marginBottom: hp(1), fontWeight: 'bold', opacity: 0.8 }}>SPLIT AMONG</Text>
                                {detailExpense.splitAmong.map((person: string) => {
                                    const amount = (detailExpense.totalAmount / detailExpense.splitAmong.length).toFixed(0);
                                    const isSettled = detailExpense.settledBy?.includes(person);
                                    const isPayer = Object.keys(detailExpense.paidBy).includes(person);

                                    return (
                                        <View key={person} style={styles.detailRow}>
                                            <Text style={{ color: '#ccc' }}>{person}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={{ color: '#E0F2F1', fontWeight: 'bold', marginRight: wp(2) }}>RS {amount}</Text>
                                                <Text style={{ fontSize: 10, color: (isPayer || isSettled) ? '#4CAF50' : '#FF5252', fontWeight: 'bold' }}>
                                                    {isPayer ? 'OWNER' : (isSettled ? 'PAID' : 'PENDING')}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                })}

                                <Button mode="contained" onPress={() => setDetailVisible(false)} style={{ marginTop: hp(3), alignSelf: 'stretch' }} buttonColor={neonColor} textColor="#000">
                                    Close
                                </Button>
                            </>
                        )}
                    </Modal>
                </Portal>

                {/* Request Settlement Modal */}
                <Portal>
                    <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modalContainer}>
                        <Text variant="titleLarge" style={{ color: '#E0F2F1', marginBottom: hp(2), fontWeight: 'bold' }}>Request Status Update</Text>
                        <TextInput
                            label="Amount Paid"
                            mode="flat"
                            keyboardType="numeric"
                            value={requestAmount}
                            onChangeText={setRequestAmount}
                            style={styles.modalInput}
                            textColor="#E0F2F1"
                            theme={{ colors: { primary: neonColor, background: '#857c7cff', placeholder: '#888' } }}
                            underlineColor="transparent"
                            activeUnderlineColor="transparent"
                        />
                        <TextInput
                            label="Note (How? e.g. EasyPaisa)"
                            mode="flat"
                            value={requestNote}
                            onChangeText={setRequestNote}
                            placeholder="e.g. Sent via EasyPaisa Trx ID..."
                            placeholderTextColor="#666"
                            multiline
                            style={styles.modalInput}
                            textColor="#E0F2F1"
                            theme={{ colors: { primary: neonColor, background: '#cbaaaaff', placeholder: '#28562fff' } }}
                            underlineColor="transparent"
                            activeUnderlineColor="transparent"
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: hp(1) }}>
                            <Button onPress={() => setModalVisible(false)} textColor="#aaa" style={{ marginRight: 10 }}>Cancel</Button>
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

                {/* Settlement Confirmation Modal */}
                <Portal>
                    <Modal visible={settleModalVisible} onDismiss={() => setSettleModalVisible(false)} contentContainerStyle={styles.modalContainer}>
                        {settleExpense && (() => {
                            const isSettled = settleExpense.settledBy?.includes(friend.name);
                            const amount = (settleExpense.totalAmount / settleExpense.splitAmong.length).toFixed(0);

                            return (
                                <>
                                    {(() => {
                                        const isFullyPaid = maxSettleAmount <= 0.01;
                                        return (
                                            <>
                                                <Text variant="titleLarge" style={{ color: '#E0F2F1', marginBottom: hp(1), fontWeight: 'bold' }}>
                                                    {isFullyPaid ? "Undo Settlement?" : "Confirm Settlement"}
                                                </Text>
                                                <Text style={{ color: '#aaa', marginBottom: hp(2) }}>
                                                    {isFullyPaid
                                                        ? `Mark ${friend.name} as UNPAID? (This will remove all payments from them for this expense)`
                                                        : `Mark payment from ${friend.name} to you.`
                                                    }
                                                </Text>

                                                <View style={{ marginBottom: hp(2), padding: wp(3), backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: wp(2) }}>
                                                    <Text style={{ color: '#E0F2F1', fontSize: 16 }}>
                                                        Expense: <Text style={{ fontWeight: 'bold' }}>{settleExpense.description}</Text>
                                                    </Text>
                                                    <Text style={{ color: '#aaa', marginTop: 5, fontSize: 12 }}>
                                                        {isFullyPaid ? "Currently Fully Paid" : `Total Owed To You: ${maxSettleAmount.toFixed(0)}`}
                                                    </Text>

                                                    {!isFullyPaid && (
                                                        <TextInput
                                                            label="Amount To Settle"
                                                            value={settleAmount}
                                                            onChangeText={setSettleAmount}
                                                            keyboardType="numeric"
                                                            style={{ marginTop: 10, backgroundColor: '#2C2C2C' }}
                                                            textColor="#E0F2F1"
                                                            theme={{ colors: { primary: neonColor, background: '#2C2C2C', placeholder: '#888' } }}
                                                        />
                                                    )}
                                                </View>

                                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: hp(1) }}>
                                                    <Button onPress={() => setSettleModalVisible(false)} textColor="#aaa" style={{ marginRight: 10 }}>Cancel</Button>
                                                    <Button
                                                        mode="contained"
                                                        buttonColor={isFullyPaid ? '#FF5252' : neonColor}
                                                        textColor="#000"
                                                        onPress={handleConfirmSettlement}
                                                    >
                                                        {isFullyPaid ? "Mark Unpaid" : "Confirm Paid"}
                                                    </Button>
                                                </View>
                                            </>
                                        );
                                    })()}
                                </>
                            );
                        })()}
                    </Modal>
                </Portal>

            </ScrollView>
        </LinearGradient >
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: wp(5), paddingBottom: hp(10) },
    heroContainer: {
        width: wp(35),
        height: wp(35),
        alignSelf: 'center',
        borderRadius: wp(20),
        borderWidth: 2,
        overflow: 'hidden',
        marginBottom: hp(2),
        marginTop: hp(2),
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    heroImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    nameText: {
        fontWeight: 'bold',
        fontSize: wp(7),
        textAlign: 'center',
        marginBottom: hp(1),
        letterSpacing: 0.5,
        color: '#E0F2F1',
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: hp(3),
        gap: wp(2),
    },
    statCard: {
        marginBottom: hp(2.5),
        backgroundColor: 'rgba(255, 255, 255, 0.05)', // Glass effect
        borderLeftWidth: 4,
        borderRadius: wp(3),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    sectionTitle: {
        fontWeight: 'bold',
        marginBottom: hp(2),
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginTop: hp(2),
        fontSize: wp(4.5),
        paddingLeft: wp(1),
    },
    historyCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        marginBottom: hp(1.5),
        borderLeftWidth: 4,
        borderRadius: wp(3),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
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
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    historyActions: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 5
    },
    modalContainer: {
        backgroundColor: '#1E1E1E',
        padding: wp(6),
        margin: wp(5),
        borderRadius: wp(4),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        elevation: 5
    },
    modalInput: {
        marginBottom: hp(2),
        backgroundColor: '#2C2C2C',
        borderRadius: wp(1.5)
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: hp(1),
        paddingVertical: hp(0.5),
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255,255,255,0.05)'
    }
});

export default FriendDetailScreen;
