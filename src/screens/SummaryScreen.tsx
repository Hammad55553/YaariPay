import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, List } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { Expense } from '../redux/expensesSlice';
import Header from '../components/Header';
import BottomBar from '../components/BottomBar';
import { wp, hp } from '../utils/responsive';

const SummaryScreen = () => {
    const rawExpenses = useSelector((state: RootState) => state.expenses?.list as Expense[] || []);
    const friends = useSelector((state: RootState) => state.friends?.list || []);

    const expenses = useMemo(() => {
        const unique = new Map();
        rawExpenses.forEach(e => unique.set(e.id, e));
        return Array.from(unique.values()).sort((a, b) => b.timestamp - a.timestamp);
    }, [rawExpenses]);

    const balances = useMemo(() => {
        const bal: Record<string, number> = {};
        friends.forEach(f => bal[f.name] = 0);

        expenses.forEach(e => {
            const perPerson = e.totalAmount / e.splitAmong.length;

            // Credit payers
            Object.entries(e.paidBy).forEach(([name, amount]) => {
                if (bal[name] !== undefined) bal[name] += amount as number;
            });

            // Debit splitters
            e.splitAmong.forEach((name: string) => {
                // Check if this person has settled (paid back) their share
                const isSettled = e.settledBy?.includes(name);

                if (!isSettled && bal[name] !== undefined) {
                    bal[name] -= perPerson;
                }
            });
        });

        return bal;
    }, [expenses, friends]);

    return (
        <View style={styles.container}>
            <Header title="Summary & Balances" />
            <ScrollView contentContainerStyle={styles.content}>
                <Text variant="headlineSmall" style={styles.title}>Net Balances</Text>

                {Object.entries(balances).map(([name, amount]) => (
                    <Card key={name} style={[styles.card, { borderLeftColor: amount >= 0 ? '#4CAF50' : '#F44336' }]}>
                        <Card.Title
                            title={name}
                            subtitle={amount >= 0 ? "Gets back" : "Owes"}
                            right={(props) => (
                                <Text {...props} style={{
                                    fontSize: wp(4.5),
                                    fontWeight: 'bold',
                                    color: amount >= 0 ? '#4CAF50' : '#F44336',
                                    marginRight: wp(4)
                                }}>
                                    {Math.abs(amount).toFixed(1)}
                                </Text>
                            )}
                        />
                    </Card>
                ))}

                <Text variant="titleMedium" style={[styles.title, { marginTop: hp(3) }]}>Recent Expenses</Text>
                {expenses.map(e => (
                    <List.Item
                        key={e.id}
                        title={e.description}
                        description={`Total: ${e.totalAmount} | Paid by: ${Object.keys(e.paidBy).join(', ')}`}
                        left={props => <List.Icon {...props} icon="receipt" />}
                    />
                ))}

            </ScrollView>
            <BottomBar />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { padding: wp(4), paddingBottom: hp(15) },
    title: { fontWeight: 'bold', marginBottom: hp(1.5), color: '#016B61', fontSize: wp(5) },
    card: { marginBottom: hp(1.5), backgroundColor: '#fff', borderLeftWidth: wp(1.5), elevation: 2 },
});

export default SummaryScreen;
