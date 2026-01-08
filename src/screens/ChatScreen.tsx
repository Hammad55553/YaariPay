import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, TextInput, KeyboardAvoidingView, Platform, Image, LayoutAnimation, UIManager } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text, IconButton } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from '@react-native-firebase/firestore';
import LinearGradient from 'react-native-linear-gradient';
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
    const [messages, setMessages] = useState<any[]>([]);
    const [text, setText] = useState('');
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        const db = getFirestore();
        const messagesRef = collection(db, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map((doc: any) => ({
                _id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
            }));
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, []);

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
                }
            });
            setText('');
        } catch (error) {
            console.error("Error sending message: ", error);
        }
    };

    const renderItem = ({ item }: any) => {
        const isMyMessage = item.user._id === user?.uid;
        const align = isMyMessage ? 'flex-end' : 'flex-start';
        const time = item.createdAt ? item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        return (
            <View style={[styles.messageRow, { justifyContent: align }]}>
                {!isMyMessage && (
                    <Image
                        source={getFriendImage(item.user.name)}
                        style={styles.avatar}
                    />
                )}

                {isMyMessage ? (
                    <LinearGradient
                        colors={['#00E676', '#00C853']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={[styles.bubble, { borderBottomRightRadius: 0 }]}
                    >
                        <Text style={[styles.messageText, { color: '#000' }]}>{item.text}</Text>
                        <Text style={[styles.timeText, { color: 'rgba(0,0,0,0.6)' }]}>{time}</Text>
                    </LinearGradient>
                ) : (
                    <View style={[styles.bubble, styles.receivedBubble]}>
                        <Text style={styles.senderName}>{item.user.name}</Text>
                        <Text style={[styles.messageText, { color: '#FFF' }]}>{item.text}</Text>
                        <Text style={[styles.timeText, { color: 'rgba(255,255,255,0.5)' }]}>{time}</Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <LinearGradient colors={['#021B1A', '#014942']} style={styles.container}>
            <Header
                title="Yaari Chat 💬"
                showBack={true}
                onBack={() => navigation.goBack()}
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
            </KeyboardAvoidingView>
            {/* BottomBar removed */}
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
        marginVertical: 4
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
    timeText: {
        fontSize: 10,
        alignSelf: 'flex-end',
        marginTop: 4
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
    }
});

export default ChatScreen;
