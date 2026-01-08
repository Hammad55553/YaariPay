import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Expense {
    id: string;
    description: string;
    totalAmount: number;
    paidBy: Record<string, number>; // { 'Abdullah': 100, 'Sufyan': 40 }
    splitAmong: string[]; // ['Abdullah', 'Sufyan', 'Abubakr', ...]
    settledBy?: string[]; // Names of people who have paid back their share
    pendingSettlements?: string[]; // Names of people who requested settlement (waiting for approval)
    payments?: { from: string, to: string, amount: number, timestamp: number }[];
    timestamp: number;
}

interface ExpenseState {
    list: Expense[];
}

const initialState: ExpenseState = {
    list: [],
};

const expenseSlice = createSlice({
    name: 'expenses',
    initialState,
    reducers: {
        addExpense: (state, action: PayloadAction<Expense>) => {
            state.list.unshift({ ...action.payload, settledBy: [] }); // Add new expense to top
        },
        deleteExpense: (state, action: PayloadAction<string>) => {
            state.list = state.list.filter(e => e.id !== action.payload);
        },
        toggleSettlement: (state, action: PayloadAction<{ expenseId: string, friendName: string }>) => {
            const expense = state.list.find(e => e.id === action.payload.expenseId);
            if (expense) {
                if (!expense.settledBy) expense.settledBy = [];
                const index = expense.settledBy.indexOf(action.payload.friendName);
                if (index > -1) {
                    expense.settledBy.splice(index, 1); // Mark as Unpaid
                } else {
                    expense.settledBy.push(action.payload.friendName); // Mark as Paid
                }
            }
        },
        setExpenses: (state, action: PayloadAction<Expense[]>) => {
            state.list = action.payload;
        },
    },
});

export const { addExpense, deleteExpense, toggleSettlement, setExpenses } = expenseSlice.actions;
export default expenseSlice.reducer;
