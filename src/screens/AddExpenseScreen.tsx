import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, Portal, Modal, Checkbox, Avatar, Chip } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../redux/store';

import { useNavigation } from '@react-navigation/native';
import Header from '../components/Header';
import { wp, hp } from '../utils/responsive';
import { getFirestore, collection, doc, setDoc } from '@react-native-firebase/firestore';

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
        <View style={styles.container}>
            <Header title="Add Expense" showBack onBack={() => navigation.goBack()} />
            <ScrollView contentContainerStyle={styles.content}>

                <TextInput
                    label="Description (e.g. Dinner)"
                    value={description}
                    onChangeText={setDescription}
                    style={styles.input}
                    mode="outlined"
                />

                {/* Paid By Section */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Who Paid? (Total: {currentTotalPaid})</Text>
                    <View style={styles.chipRow}>
                        {Object.entries(paidBy).map(([name, amount]) => (
                            <Chip key={name} onClose={() => {
                                const newPaid = { ...paidBy };
                                delete newPaid[name];
                                setPaidBy(newPaid);
                            }} style={styles.chip}>
                                {name}: {amount}
                            </Chip>
                        ))}
                        <Chip icon="plus" onPress={() => setModalVisible(true)} style={styles.addChip}>Add Payer</Chip>
                    </View>
                </View>

                {/* Split Section */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Split Among ({splitAmong.length})</Text>
                    <Text variant="bodySmall" style={{ color: '#666', marginBottom: hp(1) }}>
                        Per person: {splitAmong.length > 0 ? (currentTotalPaid / splitAmong.length).toFixed(1) : 0}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {friends.map(f => (
                            <TouchableOpacity key={f.id}
                                style={[styles.friendSelect, splitAmong.includes(f.name) && styles.friendSelected]}
                                onPress={() => toggleSplit(f.name)}
                            >
                                <Text style={{ color: splitAmong.includes(f.name) ? '#fff' : '#000' }}>{f.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <Button mode="contained" onPress={handleSave} loading={loading} disabled={loading} style={styles.saveBtn}>
                    Save Expense
                </Button>
            </ScrollView>

            {/* Payer Modal */}
            <Portal>
                <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modal}>
                    <Text variant="titleLarge" style={{ marginBottom: hp(1) }}>Select Payer</Text>
                    <ScrollView horizontal style={{ marginBottom: hp(1) }}>
                        {friends.map(f => (
                            <Chip key={f.id}
                                selected={selectedPayer === f.name}
                                onPress={() => setSelectedPayer(f.name)}
                                style={{ marginRight: wp(1.5) }}
                            >
                                {f.name}
                            </Chip>
                        ))}
                    </ScrollView>
                    <TextInput
                        label="Amount"
                        keyboardType="numeric"
                        value={payerAmount}
                        onChangeText={setPayerAmount}
                    />
                    <Button mode="contained" onPress={handleAddPayer} style={{ marginTop: hp(1) }}>
                        Add Amount
                    </Button>
                </Modal>
            </Portal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { padding: wp(4) },
    input: { marginBottom: hp(2.5), backgroundColor: '#fff' },
    section: { marginBottom: hp(2.5), backgroundColor: '#fff', padding: wp(4), borderRadius: 10 },
    sectionTitle: { marginBottom: hp(1), fontWeight: 'bold', color: '#016B61' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: wp(2) },
    chip: { backgroundColor: '#E0F2F1' },
    addChip: { backgroundColor: '#B2DFDB' },
    saveBtn: { marginTop: hp(2.5), backgroundColor: '#016B61', paddingVertical: hp(0.5) },
    modal: { backgroundColor: 'white', padding: wp(5), margin: wp(5), borderRadius: 10 },
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
