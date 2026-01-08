import { StyleSheet, View } from 'react-native';
import { Appbar, Badge } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';

interface HeaderProps {
    title: string;
    subtitle?: string;
    showBack?: boolean;
    onBack?: () => void;
    showNotification?: boolean;
}

const Header = ({ title, subtitle, showBack, onBack, showNotification }: HeaderProps) => {
    const navigation = useNavigation<any>();
    const notifications = useSelector((state: RootState) => state.notifications.list);

    // Count unread notifications
    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <Appbar.Header style={styles.header}>
            {showBack && <Appbar.Action icon="chevron-left" onPress={onBack} color="#E0F2F1" size={30} />}
            <Appbar.Content
                title={title}
                subtitle={subtitle}
                titleStyle={styles.title}
                subtitleStyle={styles.subtitle}
            />
            {showNotification && (
                <View style={styles.notificationContainer}>
                    <Appbar.Action
                        icon="bell"
                        onPress={() => navigation.navigate('Notifications')}
                        color="#E0F2F1"
                    />
                    {unreadCount > 0 && (
                        <Badge style={styles.badge} size={18}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </Badge>
                    )}
                </View>
            )}
        </Appbar.Header>
    );
};

const styles = StyleSheet.create({
    header: {
        backgroundColor: '#016B61',
    },
    title: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    subtitle: {
        color: '#E5E9C5',
    },
    notificationContainer: {
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#FF5252',
    }
});

export default Header;
