import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { createContext, useContext, useState, useEffect } from 'react';
import 'react-native-reanimated';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from '../firebase';

import { useColorScheme } from '@/hooks/useColorScheme';
import LoginScreen from './login';

// Simple Auth Context
const AuthContext = createContext({
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setIsLoading(false);
      console.log('Auth state changed:', !!user);
    });

    return () => unsubscribe();
  }, [auth]);

  const login = () => {
    // This will be called after successful login
    // The actual authentication is handled in the login screen
  };
  
  const logout = async () => {
    try {
      await auth.signOut();
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!loaded || isLoading) {
    // Show loading screen while fonts are loading or auth state is being determined
    return null;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {isAuthenticated ? (
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
        ) : (
          <LoginScreen />
        )}
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthContext.Provider>
  );
}
