import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, Portal, Modal, Checkbox, Avatar, Chip } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import LinearGradient from 'react-native-linear-gradient';

import { useNavigation } from '@react-navigation/native';
import Header from '../components/Header';
import { wp, hp } from '../utils/responsive';
import { getFirestore, collection, doc, setDoc } from '@react-native-firebase/firestore';
import { getFriendImage } from '../utils/imageMapper';

const AddExpenseScreen = () => {
    const navigation = useNavigation();
    const dispatch = useDispatch();
    const friends = useSelector((state: RootState) => state.friends.list);

    const [description, setDescription] = useState('');
    const [totalAmount, setTotalAmount] = useState('');

    // Paid Logic
    const [paidBy, setPaidBy] = useState<Record<string, number>>({});
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedPayer, setSelectedPayer] = useState<string>('');
    const [payerAmount, setPayerAmount] = useState('');

    // Split Logic
    const [splitAmong, setSplitAmong] = useState<string[]>(friends.map(f => f.name)); // Default all

    const handleAddPayer = () => {
        if (!selectedPayer || !payerAmount) return;
        setPaidBy(prev => ({
            ...prev,
            [selectedPayer]: parseFloat(payerAmount)
        }));
        setSelectedPayer('');
        setPayerAmount('');
        setModalVisible(false);
    };

    const currentTotalPaid = Object.values(paidBy).reduce((sum, val) => sum + val, 0);

    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!description || currentTotalPaid === 0 || loading) return;

        setLoading(true);
        const expenseData = {
            id: Date.now().toString(),
            description,
            totalAmount: currentTotalPaid,
            paidBy,
            splitAmong,
            timestamp: Date.now(),
            settledBy: []
        };

        try {
            // Write to Firestore
            const db = getFirestore();
            await setDoc(doc(db, 'expenses', expenseData.id), expenseData);

            // Listener in AppNavigator will update the state automatically (Single Source of Truth)
            navigation.goBack();
        } catch (error) {
            console.error("Error adding expense to Firestore: ", error);
            setLoading(false);
        }
    };

    const toggleSplit = (name: string) => {
        setSplitAmong(prev =>
            prev.includes(name)
                ? prev.filter(n => n !== name)
                : [...prev, name]
        );
    };

    return (
        <LinearGradient colors={['#021B1A', '#014942']} style={styles.container}>
            <Header title="Add Expense" showBack onBack={() => navigation.goBack()} />
            <ScrollView contentContainerStyle={styles.content}>

                <TextInput
                    label="Description (e.g. Dinner)"
                    value={description}
                    onChangeText={setDescription}
                    style={styles.input}
                    mode="flat"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    textColor="#272b2bff"
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                    theme={{ colors: { primary: '#016B61', background: '#1E1E1E', placeholder: '#888' } }}
                />

                {/* Who Paid Trigger Card */}
                <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.paymentTriggerCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Avatar.Icon size={40} icon="cash-multiple" style={{ backgroundColor: '#016B61' }} color="white" />
                        <View style={{ marginLeft: wp(3) }}>
                            <Text variant="titleMedium" style={{ color: '#E0F2F1', fontWeight: 'bold' }}>Who Paid?</Text>
                            <Text variant="bodySmall" style={{ color: '#aaa' }}>
                                Total: {currentTotalPaid} • {Object.keys(paidBy).length > 0 ? `Paid by ${Object.keys(paidBy)[0]} ${Object.keys(paidBy).length > 1 ? `+${Object.keys(paidBy).length - 1}` : ''}` : 'Select Payer'}
                            </Text>
                        </View>
                    </View>
                    <Avatar.Icon size={24} icon="chevron-right" style={{ backgroundColor: 'transparent' }} color="#aaa" />
                </TouchableOpacity>

                {/* Split Section */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Split Among ({splitAmong.length})</Text>
                    <Text variant="bodySmall" style={{ color: '#aaa', marginBottom: hp(2) }}>
                        Per person: {splitAmong.length > 0 ? (currentTotalPaid / splitAmong.length).toFixed(1) : 0}
                    </Text>
                    <View style={styles.listContainer}>
                        {friends.map(f => {
                            const isSelected = splitAmong.includes(f.name);
                            return (
                                <TouchableOpacity key={f.id}
                                    style={styles.friendRow}
                                    onPress={() => toggleSplit(f.name)}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Avatar.Image
                                            size={40}
                                            source={getFriendImage(f.image)}
                                        />
                                        <Text style={{ color: '#E0F2F1', marginLeft: wp(3), fontSize: 16 }}>{f.name}</Text>
                                    </View>
                                    <Checkbox
                                        status={isSelected ? 'checked' : 'unchecked'}
                                        onPress={() => toggleSplit(f.name)}
                                        color="#E0F2F1"
                                        uncheckedColor="#E0F2F1"
                                    />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <Button mode="contained" onPress={handleSave} loading={loading} disabled={loading} style={styles.saveBtn} textColor="#FFF">
                    Save Expense
                </Button>
            </ScrollView>

            {/* Payer Bottom Sheet */}
            <Portal>
                <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.bottomSheet}>
                    <View style={styles.sheetHeader}>
                        <Text variant="titleLarge" style={{ color: '#E0F2F1', fontWeight: 'bold' }}>Select Payer</Text>
                        <TouchableOpacity onPress={() => setModalVisible(false)}>
                            <Avatar.Icon size={30} icon="close" style={{ backgroundColor: '#333' }} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* Current Payers List */}
                    <View style={{ marginBottom: hp(2) }}>
                        {Object.entries(paidBy).map(([name, amount]) => (
                            <View key={name} style={styles.payerRow}>
                                <Text style={{ color: '#E0F2F1', flex: 1 }}>{name}</Text>
                                <Text style={{ color: '#016B61', fontWeight: 'bold', marginRight: 10 }}>{amount}</Text>
                                <TouchableOpacity onPress={() => {
                                    const newPaid = { ...paidBy };
                                    delete newPaid[name];
                                    setPaidBy(newPaid);
                                }}>
                                    <Avatar.Icon size={20} icon="close-circle" style={{ backgroundColor: 'transparent' }} color="#FF5252" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>

                    <Text variant="titleMedium" style={{ marginBottom: hp(1), color: '#aaa' }}>Add Payment</Text>
                    <ScrollView horizontal style={{ marginBottom: hp(2) }} showsHorizontalScrollIndicator={false}>
                        {friends.map(f => (
                            <TouchableOpacity key={f.id}
                                onPress={() => setSelectedPayer(f.name)}
                                style={{ alignItems: 'center', marginRight: wp(4), opacity: selectedPayer === f.name ? 1 : 0.5 }}
                            >
                                <Avatar.Image
                                    size={50}
                                    source={getFriendImage(f.image)}
                                />
                                <Text style={{ color: '#E0F2F1', marginTop: 4, fontWeight: selectedPayer === f.name ? 'bold' : 'normal' }}>{f.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TextInput
                            label="Amount"
                            keyboardType="numeric"
                            value={payerAmount}
                            onChangeText={setPayerAmount}
                            mode="flat"
                            textColor="#272b2bff"
                            underlineColor="transparent"
                            activeUnderlineColor="transparent"
                            theme={{ colors: { primary: '#016B61', background: '#333', placeholder: '#888' } }}
                            style={[styles.modalInput, { flex: 1, marginRight: wp(2) }]}
                        />
                        <Button mode="contained" onPress={handleAddPayer} style={{ borderRadius: wp(2), height: 50, justifyContent: 'center' }} buttonColor="#016B61" textColor="#FFF">
                            Add
                        </Button>
                    </View>
                </Modal>
            </Portal>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: wp(4) },
    input: {
        marginBottom: hp(2.5),
        borderRadius: wp(2),
        borderTopLeftRadius: wp(2),
        borderTopRightRadius: wp(2),
    },
    section: {
        marginBottom: hp(2.5),
        backgroundColor: 'rgba(255, 255, 255, 0.05)', // Translucent dark
        padding: wp(4),
        borderRadius: wp(2),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    sectionTitle: {
        marginBottom: hp(1),
        fontWeight: 'bold',
        color: '#E0F2F1', // Light Teal
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
    listContainer: { gap: hp(1.5) },
    paymentTriggerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: wp(4),
        borderRadius: wp(2),
        marginBottom: hp(2.5),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    bottomSheet: {
        backgroundColor: '#1E1E1E',
        padding: wp(5),
        margin: 0,
        marginBottom: 0,
        borderTopLeftRadius: wp(5),
        borderTopRightRadius: wp(5),
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: hp(2),
    },
    payerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#333',
        padding: wp(3),
        borderRadius: wp(2),
        marginBottom: hp(1),
    },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: wp(3),
        borderRadius: wp(2),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    amountBadge: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: '#016B61',
        borderRadius: 10,
        paddingHorizontal: 4,
        borderWidth: 1,
        borderColor: '#fff'
    },
    saveBtn: {
        marginTop: hp(2.5),
        backgroundColor: '#016B61',
        paddingVertical: hp(0.5),
        borderRadius: wp(2),
    },
    modalInput: {
        borderRadius: wp(2),
        borderTopLeftRadius: wp(2),
        borderTopRightRadius: wp(2),
    },
    friendSelect: {
        padding: wp(2),
        borderWidth: 1,
        borderColor: '#016B61',
        borderRadius: 20,
        margin: wp(1),
    },
    friendSelected: {
        backgroundColor: '#016B61',
    }
});

export default AddExpenseScreen;
