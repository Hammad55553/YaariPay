import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, TextInput, KeyboardAvoidingView, Platform, Image, LayoutAnimation, UIManager, TouchableOpacity, ScrollView, BackHandler } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text, IconButton, Portal, Modal } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, where, arrayUnion, writeBatch, doc } from '@react-native-firebase/firestore';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { RootState } from '../redux/store';
import Header from '../components/Header';
import { wp, hp } from '../utils/responsive';
import { getFriendImage } from '../utils/imageMapper';


if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ChatScreen = () => {
    const navigation = useNavigation<any>();
    const user = useSelector((state: RootState) => state.user.user);
    const [userMap, setUserMap] = useState<{ [key: string]: any }>({});

    // Selection & Info Modal State
    const [selectedMessage, setSelectedMessage] = useState<any>(null);
    const [infoVisible, setInfoVisible] = useState(false);

    const [messages, setMessages] = useState<any[]>([]);
    const [text, setText] = useState('');
    const [onlineCount, setOnlineCount] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    // Fetch Online Users Count
    useEffect(() => {
        const db = getFirestore();
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('isOnline', '==', true));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setOnlineCount(snapshot.size);
        });

        return () => unsubscribe();
    }, []);

    // Fetch All Users for mapping
    useEffect(() => {
        const db = getFirestore();
        const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
            const map: { [key: string]: any } = {};
            snapshot.forEach((doc: any) => {
                map[doc.id] = doc.data();
            });
            setUserMap(map);
        });
        return () => unsubscribe();
    }, []);

    // Fetch Messages
    useEffect(() => {
        const db = getFirestore();
        const messagesRef = collection(db, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const msgs = snapshot.docs.map((doc: any) => ({
                _id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
            }));

            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setMessages(msgs);

            // Read Receipts Logic
            if (user?.uid && msgs.length > 0) {
                const batch = writeBatch(db);
                let hasUpdates = false;

                snapshot.docs.forEach((d: any) => {
                    const data = d.data();
                    if (data.user?._id !== user.uid) {
                        const readBy = data.readBy || [];
                        if (!readBy.includes(user.uid)) {
                            batch.update(doc(db, 'messages', d.id), {
                                readBy: arrayUnion(user.uid),
                                deliveredTo: arrayUnion(user.uid)
                            });
                            hasUpdates = true;
                        }
                    }
                });

                if (hasUpdates) {
                    try {
                        await batch.commit();
                    } catch (err) {
                        console.error("Error batch updating read status:", err);
                    }
                }
            }
        });

        return () => unsubscribe();
    }, [user?.uid]);

    // Handle Back Press to deselect
    useEffect(() => {
        const backAction = () => {
            if (selectedMessage) {
                setSelectedMessage(null);
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener(
            "hardwareBackPress",
            backAction
        );

        return () => backHandler.remove();
    }, [selectedMessage]);

    const sendMessage = async () => {
        if (!text.trim()) return;

        try {
            const db = getFirestore();
            await addDoc(collection(db, 'messages'), {
                text: text.trim(),
                createdAt: serverTimestamp(),
                user: {
                    _id: user?.uid,
                    name: user?.displayName || 'User',
                },
                readBy: [user?.uid],
                deliveredTo: [user?.uid],
            });

            setText('');
        } catch (error) {
            console.error("Error sending message: ", error);
        }
    };

    const handleLongPress = (item: any) => {
        // Only allow selecting own messages for Info
        if (item.user._id === user?.uid) {
            setSelectedMessage(item);
        }
    };

    const handlePressMessage = () => {
        if (selectedMessage) {
            setSelectedMessage(null);
        }
    };

    const renderTick = (item: any) => {
        if (item.user._id !== user?.uid) return null;
        const readBy = item.readBy || [];
        const deliveredTo = item.deliveredTo || [];
        const seenByOthers = readBy.length > 1;
        const deliveredToOthers = deliveredTo.length > 1;

        if (seenByOthers) {
            return <MaterialCommunityIcons name="check-all" size={16} color="#34B7F1" style={styles.tick} />;
        } else if (deliveredToOthers) {
            return <MaterialCommunityIcons name="check-all" size={16} color="rgba(255,255,255,0.6)" style={styles.tick} />;
        } else {
            return <MaterialCommunityIcons name="check" size={16} color="rgba(255,255,255,0.6)" style={styles.tick} />;
        }
    };

    const renderItem = ({ item }: any) => {
        const isMyMessage = item.user._id === user?.uid;
        const align = isMyMessage ? 'flex-end' : 'flex-start';
        const time = item.createdAt ? item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const isSelected = selectedMessage?._id === item._id;

        return (
            <TouchableOpacity
                activeOpacity={1}
                onLongPress={() => handleLongPress(item)}
                onPress={handlePressMessage}
                style={[
                    styles.messageRow,
                    { justifyContent: align },
                    isSelected && styles.selectedRow // Highlight row
                ]}
            >
                {!isMyMessage && (
                    <Image
                        source={getFriendImage(item.user.name)}
                        style={styles.avatar}
                    />
                )}

                {isMyMessage ? (
                    <LinearGradient
                        colors={isSelected ? ['#00BFA5', '#00BFA5'] : ['#00E676', '#00C853']} // Slight color change on selection
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={[styles.bubble, { borderBottomRightRadius: 0 }]}
                    >
                        <Text style={[styles.messageText, { color: '#000' }]}>{item.text}</Text>
                        <View style={styles.metaContainer}>
                            <Text style={[styles.timeText, { color: 'rgba(0,0,0,0.6)' }]}>{time}</Text>
                            {renderTick(item)}
                        </View>
                    </LinearGradient>
                ) : (
                    <View style={[styles.bubble, styles.receivedBubble]}>
                        <Text style={styles.senderName}>{item.user.name}</Text>
                        <Text style={[styles.messageText, { color: '#FFF' }]}>{item.text}</Text>
                        <Text style={[styles.timeText, { color: 'rgba(255,255,255,0.5)' }]}>{time}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <LinearGradient colors={['#021B1A', '#014942']} style={styles.container}>
            <Header
                title={selectedMessage ? "1 Selected" : `Yaari Chat (${onlineCount})`}
                showBack={true}
                onBack={() => {
                    if (selectedMessage) setSelectedMessage(null);
                    else navigation.goBack();
                }}
                rightIcon={selectedMessage ? "information" : undefined}
                onRightPress={() => setInfoVisible(true)}
            />

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderItem}
                keyExtractor={item => item._id}
                inverted
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                style={styles.keyboardContainer}
            >
                {!selectedMessage && (
                    <View style={styles.inputWrapper}>
                        <TextInput
                            value={text}
                            onChangeText={setText}
                            placeholder="Type a message..."
                            placeholderTextColor="#aaa"
                            style={styles.input}
                        />
                        <IconButton
                            icon="send"
                            iconColor={text.trim() ? "#00E676" : "#555"}
                            size={28}
                            onPress={sendMessage}
                            disabled={!text.trim()}
                            style={styles.sendButton}
                        />
                    </View>
                )}
            </KeyboardAvoidingView>

            {/* Bottom Sheet Modal */}
            <Portal>
                <Modal
                    visible={infoVisible}
                    onDismiss={() => setInfoVisible(false)}
                    contentContainerStyle={styles.bottomSheetModal}
                >
                    {selectedMessage && (
                        <View style={{ flex: 1 }}>
                            <View style={styles.modalDragHandle} />
                            <Text style={styles.modalHeader}>Message Info</Text>

                            <View style={[styles.bubble, { alignSelf: 'flex-end', backgroundColor: '#00E676', marginBottom: 20, marginRight: 20 }]}>
                                <Text style={[styles.messageText, { color: '#000' }]}>{selectedMessage.text}</Text>
                                <View style={styles.metaContainer}>
                                    <Text style={[styles.timeText, { color: 'rgba(0,0,0,0.6)' }]}>
                                        {selectedMessage.createdAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                    <MaterialCommunityIcons name="check-all" size={16} color="#34B7F1" style={styles.tick} />
                                </View>
                            </View>

                            <ScrollView style={{ flex: 1 }}>
                                <Text style={styles.sectionHeader}>Read By</Text>
                                {(selectedMessage.readBy || []).filter((uid: string) => uid !== user?.uid).map((uid: string) => (
                                    <View key={uid} style={styles.userRow}>
                                        <Image source={getFriendImage(userMap[uid]?.name || 'User')} style={styles.smallAvatar} />
                                        <View>
                                            <Text style={styles.userName}>{userMap[uid]?.name || 'Unknown'}</Text>
                                            {/* Could add read time here if available in future */}
                                        </View>
                                        <MaterialCommunityIcons name="check-all" size={16} color="#34B7F1" style={{ marginLeft: 'auto' }} />
                                    </View>
                                ))}
                                {(!selectedMessage.readBy || selectedMessage.readBy.filter((uid: string) => uid !== user?.uid).length === 0) && (
                                    <Text style={styles.emptyText}>No one yet</Text>
                                )}

                                <Text style={styles.sectionHeader}>Delivered To</Text>
                                {(selectedMessage.deliveredTo || [])
                                    .filter((uid: string) => uid !== user?.uid && !(selectedMessage.readBy || []).includes(uid))
                                    .map((uid: string) => (
                                        <View key={uid} style={styles.userRow}>
                                            <Image source={getFriendImage(userMap[uid]?.name || 'User')} style={styles.smallAvatar} />
                                            <Text style={styles.userName}>{userMap[uid]?.name || 'Unknown'}</Text>
                                            <MaterialCommunityIcons name="check-all" size={16} color="#aaa" style={{ marginLeft: 'auto' }} />
                                        </View>
                                    ))}
                                {(!selectedMessage.deliveredTo || selectedMessage.deliveredTo.filter((uid: string) => uid !== user?.uid && !(selectedMessage.readBy || []).includes(uid)).length === 0) && (
                                    <Text style={styles.emptyText}>No one else</Text>
                                )}
                            </ScrollView>
                        </View>
                    )}
                </Modal>
            </Portal>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    listContent: { paddingHorizontal: wp(4), paddingBottom: hp(2) },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 10,
        alignItems: 'flex-end',
        marginVertical: 4,
        paddingHorizontal: 4, // Padding for selection highlight
        paddingVertical: 2,
        borderRadius: 4
    },
    selectedRow: {
        backgroundColor: 'rgba(0, 230, 118, 0.2)' // Highlight color
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    bubble: {
        maxWidth: '75%',
        padding: 12,
        borderRadius: 20,
        elevation: 2
    },
    receivedBubble: {
        backgroundColor: '#2C2C2C',
        borderBottomLeftRadius: 0,
        borderWidth: 1,
        borderColor: '#333'
    },
    senderName: {
        fontSize: 10,
        color: '#00E676',
        marginBottom: 2,
        fontWeight: 'bold'
    },
    messageText: {
        fontSize: 16,
    },
    metaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-end',
        marginTop: 4,
        gap: 4
    },
    timeText: {
        fontSize: 10,
    },
    tick: {
        marginLeft: 2
    },
    keyboardContainer: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 10
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '90%',
        backgroundColor: '#1E1E1E',
        borderRadius: 30,
        paddingHorizontal: 15,
        paddingVertical: 5,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#333'
    },
    input: {
        flex: 1,
        color: '#FFF',
        fontSize: 16,
        maxHeight: 100
    },
    sendButton: {
        margin: 0,
    },
    // Modal Styles (Bottom Sheet)
    bottomSheetModal: {
        backgroundColor: '#121212',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        height: '60%', // Takes up bottom 60% of screen
        marginTop: 'auto', // Pushes it to the bottom
        justifyContent: 'flex-start'
    },
    modalDragHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#444',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20
    },
    modalHeader: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 20
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#00E676', // Deep Teal Green
        marginTop: 20,
        marginBottom: 10,
        paddingLeft: 10
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        paddingHorizontal: 10
    },
    smallAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 15
    },
    userName: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '500'
    },
    emptyText: {
        color: '#666',
        fontSize: 14,
        marginLeft: 10,
        fontStyle: 'italic'
    }
});

export default ChatScreen;
