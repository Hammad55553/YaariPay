import React, { useState, useCallback } from 'react';
import { View, FlatList, Image, StyleSheet, Linking, Platform } from 'react-native';
import { Text, Button, Card, TextInput, Modal, Portal, IconButton, TouchableRipple } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../redux/store';
import { addFriend } from '../redux/friendsSlice';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BottomBar } from '../components/BottomBar';
import Header from '../components/Header';
import { wp, hp } from '../utils/responsive';
import FriendCard from '../components/FriendCard';
import { getFirestore, doc, setDoc } from '@react-native-firebase/firestore';

const FriendsScreen = () => {
    const navigation = useNavigation<any>();
    const friends = useSelector((state: RootState) => state.friends.list);
    const [displayedFriends, setDisplayedFriends] = useState(friends);

    useFocusEffect(
        useCallback(() => {
            const shuffled = [...friends].sort(() => Math.random() - 0.5);
            setDisplayedFriends(shuffled);
        }, [friends])
    );

    const [visible, setVisible] = useState(false);
    const [name, setName] = useState('');
    const [image, setImage] = useState<string | null>(null);

    const dispatch = useDispatch();

    const handleAddFriend = async () => {
        if (!name.trim()) return;

        try {
            const newFriend = {
                id: Date.now().toString(),
                name,
                image: image || '',
                balance: 0,
            };

            const db = getFirestore();
            await setDoc(doc(db, 'friends', newFriend.id), newFriend);

            // Dispatch is not strictly necessary if listener is fast, but we can leave it or remove it.
            // Let's rely on the listener for consistency.
        } catch (err) {
            console.error("Error adding friend:", err);
        }

        setName('');
        setImage(null);
        setVisible(false);
    };

    const renderItem = ({ item, index }: any) => {
        return <FriendCard item={item} index={index} />;
    };

    return (
        <View style={styles.container}>
            <Header title={`👥 Friends (${friends.length})`} />

            <FlatList
                data={displayedFriends}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={{ justifyContent: 'space-between' }}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            />

            <Button
                mode="contained"
                icon="account-plus"
                style={styles.addButton}
                onPress={() => setVisible(true)}
            >
                Add New
            </Button>

            {/* Local Footer (BottomBar) */}
            <BottomBar />

            {/* Add Friend Modal */}
            <Portal>
                <Modal visible={visible} onDismiss={() => setVisible(false)} contentContainerStyle={styles.modal}>
                    <Text variant="titleLarge">Add Friend</Text>
                    <TextInput
                        label="Name"
                        value={name}
                        onChangeText={setName}
                        style={{ marginVertical: 8 }}
                    />
                    <TextInput
                        label="Image URL (optional)"
                        value={image || ''}
                        onChangeText={setImage}
                        style={{ marginBottom: 12 }}
                    />
                    <Button mode="contained" onPress={handleAddFriend}>
                        Save
                    </Button>
                </Modal>
            </Portal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    contentContainer: {
        padding: wp(4),
        paddingBottom: hp(15),
    },
    // grid card (2 per row) - styles moved to FriendCard component
    addButton: {
        position: 'absolute',
        bottom: hp(12),
        right: wp(5),
        borderRadius: 30,
        paddingHorizontal: 16,
        backgroundColor: '#016B61',
    },
    modal: {
        backgroundColor: '#FFFFFF',
        padding: wp(5),
        marginHorizontal: wp(5),
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#9ECFD4',
    },
});

export default FriendsScreen;
