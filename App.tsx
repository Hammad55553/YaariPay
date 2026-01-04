import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { Provider as ReduxProvider } from 'react-redux';
import store from './src/redux/store';
import { StatusBar } from 'react-native';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#016B61', // deep teal
    secondary: '#70B2B2',
    tertiary: '#9ECFD4',
    background: '#E5E9C5',
    surface: '#FFFFFF',
    surfaceVariant: '#9ECFD4',
    outline: '#9ECFD4',
  },
};

const App = () => {
  return (
    <ReduxProvider store={store}>
      <StatusBar barStyle="light-content" backgroundColor="#016B61" />
      <PaperProvider theme={theme}>
        <AppNavigator />
      </PaperProvider>
    </ReduxProvider>
  );
};

export default App;
