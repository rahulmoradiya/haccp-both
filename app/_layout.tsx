import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { createContext, useContext, useState, useEffect } from 'react';
import 'react-native-reanimated';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from '../firebase';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

import { useColorScheme } from '@/hooks/useColorScheme';
import LoginScreen from './login';

// App-wide context for auth and preloaded data
type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

type AppContextType = {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  currentUser: AppUser | null;
  companyCode: string | null;
  allUsers: Array<{ uid: string; name: string; email: string; role?: string; departmentName?: string; photoURL?: string; isOnline?: boolean }>; // unfiltered
  reloadUsers: () => Promise<void>;
  isAppDataLoading: boolean;
};

const AuthContext = createContext<AppContextType>({
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
  currentUser: null,
  companyCode: null,
  allUsers: [],
  reloadUsers: async () => {},
  isAppDataLoading: true,
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
  const [isAppDataLoading, setIsAppDataLoading] = useState(true);
  const [companyCode, setCompanyCode] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<AppContextType['allUsers']>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAuthenticated(!!user);
      setIsLoading(false);
      setIsAppDataLoading(true);
      if (user) {
        setCurrentUser({ uid: user.uid, email: user.email, displayName: user.displayName });
        try {
          // 1) Try to get companyCode from root users mapping
          let company: string | null = null;
          try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            company = userDoc.exists() ? (userDoc.data() as any).companyCode : null;
          } catch {}

          // 2) Fallback: scan companies to find membership
          if (!company) {
            const companiesSnap = await getDocs(collection(db, 'companies'));
            for (const companyDoc of companiesSnap.docs) {
              const usersCol = await getDocs(collection(db, 'companies', companyDoc.id, 'users'));
              const found = usersCol.docs.find((ud) => {
                const data = ud.data() as any;
                return ud.id === user.uid || data.uid === user.uid || data.email === user.email;
              });
              if (found) {
                company = companyDoc.id;
                // we already fetched users for this company
                const users = usersCol.docs.map((d) => {
                  const data = d.data() as any;
                  return {
                    uid: data.uid || d.id,
                    name: data.name || data.email || 'Unknown User',
                    email: data.email,
                    role: data.role,
                    departmentName: data.departmentName,
                    photoURL: data.photoURL,
                    isOnline: data.isOnline ?? false,
                  };
                });
                setAllUsers(users);
                break;
              }
            }
          }

          setCompanyCode(company ?? null);

          // 3) If company found but users not yet loaded (e.g., from root path), load users
          if (company && allUsers.length === 0) {
            const usersSnap = await getDocs(collection(db, 'companies', company, 'users'));
            const users = usersSnap.docs.map((d) => {
              const data = d.data() as any;
              return {
                uid: data.uid || d.id,
                name: data.name || data.email || 'Unknown User',
                email: data.email,
                role: data.role,
                departmentName: data.departmentName,
                photoURL: data.photoURL,
                isOnline: data.isOnline ?? false,
              };
            });
            setAllUsers(users);
          }
        } catch (e) {
          console.error('Failed to preload users on login:', e);
          setAllUsers([]);
        } finally {
          setIsAppDataLoading(false);
        }
      } else {
        // signed out
        setCurrentUser(null);
        setCompanyCode(null);
        setAllUsers([]);
        setIsAppDataLoading(false);
      }
      console.log('Auth state changed:', !!user);
    });

    return () => unsubscribe();
  }, [auth]);

  const reloadUsers = async () => {
    if (!currentUser || !companyCode) return;
    try {
      setIsAppDataLoading(true);
      const usersSnap = await getDocs(collection(db, 'companies', companyCode, 'users'));
      const users = usersSnap.docs.map((d) => {
        const data = d.data() as any;
        return {
          uid: data.uid,
          name: data.name || data.email || 'Unknown User',
          email: data.email,
          role: data.role,
          departmentName: data.departmentName,
          photoURL: data.photoURL,
          isOnline: data.isOnline ?? false,
        };
      });
      setAllUsers(users);
    } finally {
      setIsAppDataLoading(false);
    }
  };

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
    <AuthContext.Provider value={{ isAuthenticated, login, logout, currentUser, companyCode, allUsers, reloadUsers, isAppDataLoading }}>
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
