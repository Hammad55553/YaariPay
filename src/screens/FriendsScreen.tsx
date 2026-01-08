import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, Animated } from 'react-native';
import { Text, Button, TextInput, Modal, Portal } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { BottomBar } from '../components/BottomBar';
import Header from '../components/Header';
import { wp, hp } from '../utils/responsive';
import FriendCard from '../components/FriendCard';
import { getFirestore, doc, setDoc } from '@react-native-firebase/firestore';

const FriendsScreen = () => {
    const navigation = useNavigation<any>();
    const friends = useSelector((state: RootState) => state.friends.list);
    const [displayedFriends, setDisplayedFriends] = useState(friends);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useFocusEffect(
        useCallback(() => {
            const shuffled = [...friends].sort(() => Math.random() - 0.5);
            setDisplayedFriends(shuffled);

            // Re-run animation on focus
            fadeAnim.setValue(0);
            slideAnim.setValue(30);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    friction: 6,
                    tension: 40,
                    useNativeDriver: true,
                })
            ]).start();

        }, [friends])
    );

    const [visible, setVisible] = useState(false);
    const [name, setName] = useState('');
    const [image, setImage] = useState<string | null>(null);

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
        <LinearGradient colors={['#021B1A', '#014942']} style={styles.container}>
            <Header title={`👥 Friends (${friends.length})`} showNotification />

            <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                <FlatList
                    data={displayedFriends}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={{ justifyContent: 'space-between' }}
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={false}
                />
            </Animated.View>

            <Button
                mode="contained"
                icon="account-plus"
                style={styles.addButton}
                buttonColor="#00E676"
                textColor="#000"
                labelStyle={{ fontWeight: 'bold' }}
                onPress={() => setVisible(true)}
            >
                Add New
            </Button>

            {/* Local Footer (BottomBar) */}
            <BottomBar />

            {/* Add Friend Modal */}
            <Portal>
                <Modal visible={visible} onDismiss={() => setVisible(false)} contentContainerStyle={styles.modal}>
                    <Text variant="headlineSmall" style={styles.modalTitle}>Add New Friend</Text>
                    <TextInput
                        label="Friend's Name"
                        value={name}
                        onChangeText={setName}
                        mode="outlined"
                        textColor="#FFF"
                        style={styles.input}
                        theme={{
                            colors: {
                                primary: '#00E676',
                                background: '#2C2C2C',
                                text: '#FFF',
                                placeholder: '#888',
                                onSurfaceVariant: '#888'
                            }
                        }}
                    />
                    <TextInput
                        label="Image Name (e.g. 1.png)"
                        value={image || ''}
                        onChangeText={setImage}
                        mode="outlined"
                        textColor="#FFF"
                        style={styles.input}
                        theme={{
                            colors: {
                                primary: '#00E676',
                                background: '#2C2C2C',
                                text: '#FFF',
                                placeholder: '#888',
                                onSurfaceVariant: '#888'
                            }
                        }}
                    />
                    <Button
                        mode="contained"
                        onPress={handleAddFriend}
                        buttonColor="#00E676"
                        textColor="#000"
                        style={{ marginTop: 10 }}
                    >
                        Save Friend
                    </Button>
                </Modal>
            </Portal>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        padding: wp(4),
        paddingBottom: hp(15),
    },
    addButton: {
        position: 'absolute',
        bottom: hp(12),
        right: wp(5),
        borderRadius: 30,
        paddingHorizontal: 16,
        elevation: 6,
        shadowColor: '#00E676',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    modal: {
        backgroundColor: '#1E1E1E',
        padding: wp(6),
        marginHorizontal: wp(5),
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        elevation: 10
    },
    modalTitle: {
        color: '#FFF',
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        letterSpacing: 1
    },
    input: {
        backgroundColor: '#2C2C2C',
        marginBottom: 15,
        fontSize: 16
    }
});

export default FriendsScreen;
