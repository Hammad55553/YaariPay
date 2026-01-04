import React from 'react';
import { Appbar } from 'react-native-paper';
import { StyleSheet } from 'react-native';

interface HeaderProps {
    title: string;
    subtitle?: string;
    showBack?: boolean;
    onBack?: () => void;
}

const Header = ({ title, subtitle, showBack, onBack }: HeaderProps) => {
    return (
        <Appbar.Header style={styles.header}>
            {showBack && <Appbar.BackAction onPress={onBack} color="#FFFFFF" />}
            <Appbar.Content
                title={title}
                subtitle={subtitle}
                titleStyle={styles.title}
                subtitleStyle={styles.subtitle}
            />
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
    }
});

export default Header;
