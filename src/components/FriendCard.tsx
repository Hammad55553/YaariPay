import React from 'react';
import { View, Image, StyleSheet, Linking } from 'react-native';
import { Text, Card, IconButton, TouchableRipple } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { wp, hp } from '../utils/responsive';
import { getFriendImage } from '../utils/imageMapper';

interface FriendCardProps {
    item: {
        id: string;
        name: string;
        image: any;
        phone?: string;
    };
    index: number;
}

const FriendCard = ({ item, index }: FriendCardProps) => {
    const navigation = useNavigation<any>();

    const phone = item.phone || '03036629101';

    const openWhatsApp = async () => {
        const msg = encodeURIComponent('Hi! Checking our expenses in Yaaripay App.');
        const directUrl = `whatsapp://send?text=${msg}&phone=${phone}`;
        const webUrl = `https://wa.me/${phone}?text=${msg}`;
        try {
            const supported = await Linking.canOpenURL(directUrl);
            if (supported) {
                await Linking.openURL(directUrl);
            } else {
                await Linking.openURL(webUrl);
            }
        } catch (e) {
            await Linking.openURL(webUrl);
        }
    };

    const makeCall = () => Linking.openURL(`tel:${phone}`);
    const sendSMS = () => Linking.openURL(`sms:${phone}`);

    const imageSource = getFriendImage(item.image);

    // Fixed Theme Color
    const neonColor = '#00E676'; // Consistent Neon Green/Teal matches App Theme

    return (
        <Card style={styles.gridCard} mode="outlined">
            <TouchableRipple
                onPress={() => navigation.navigate('FriendDetail', { friendId: item.id, index })}
                rippleColor={neonColor}
                borderless={false}
            >
                <View>
                    <View style={styles.imageWrap}>
                        <Image
                            source={imageSource}
                            style={styles.coverImage}
                            onError={(e) => console.log('Image Error:', item.name, e.nativeEvent.error)}
                        />
                    </View>
                    <View style={[styles.nameWrap, { borderColor: neonColor, shadowColor: neonColor }]}>
                        <Text variant="titleSmall" style={[styles.nameText, { color: neonColor, textShadowColor: neonColor }]} numberOfLines={1}>
                            {item.name}
                        </Text>
                    </View>
                </View>
            </TouchableRipple>
            <View style={styles.actionsRow}>
                <IconButton icon="whatsapp" iconColor="#25D366" size={wp(5)} onPress={openWhatsApp} />
                <IconButton icon="phone" iconColor={neonColor} size={wp(5)} onPress={makeCall} />
                <IconButton icon="message-text" iconColor="#70B2B2" size={wp(5)} onPress={sendSMS} />
            </View>
        </Card>
    );
};

const styles = StyleSheet.create({
    gridCard: {
        width: wp(44), // Reduced width to allow spacing
        marginBottom: hp(1.5),
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#fff',
        elevation: 0,
        shadowColor: 'transparent',
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#9ECFD4',
    },
    imageWrap: {
        width: '100%',
        aspectRatio: 1.1,
        backgroundColor: '#E5E9C5',
    },
    coverImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    nameWrap: {
        paddingVertical: hp(0.5),
        paddingHorizontal: wp(2),
        backgroundColor: '#000000', // Deep black
        borderRadius: 8,
        marginHorizontal: wp(2),
        marginTop: -hp(1.8), // Aggressive overlap
        alignSelf: 'center',
        minWidth: wp(28),
        borderWidth: 2,
        transform: [{ rotate: '-3deg' }], // Crazy tilt
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
        elevation: 10,
        zIndex: 10,
    },
    nameText: {
        textAlign: 'center',
        fontWeight: '900',
        fontSize: wp(2.8), // Reduced font size
        textTransform: 'uppercase',
        letterSpacing: 2,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: wp(2),
        paddingBottom: hp(1),
    },
});

export default FriendCard;
