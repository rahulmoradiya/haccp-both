import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { getAuth } from 'firebase/auth';
import { collectionGroup, doc, getDoc, getDocs, getFirestore } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Image, StyleSheet, Text, View } from 'react-native';
import { app } from '../../firebase';
import { useAuth } from '../_layout';

export default function ProfileScreen() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { logout } = useAuth();

  useEffect(() => {
    const fetchProfile = async () => {
      const auth = getAuth(app);
      const user = auth.currentUser;
      if (user) {
        setUserInfo({
          uid: user.uid,
          email: user.email,
          name: user.displayName,
          photo: user.photoURL,
        });
        const db = getFirestore(app);

        // 1. Find the user's companyCode using a collection group query
        const usersSnap = await getDocs(collectionGroup(db, 'users'));
        const userDoc = usersSnap.docs.find(doc => doc.data().uid === user.uid);
        if (userDoc) {
          const data = userDoc.data();
          const companyCode = data.companyCode;

          // 2. Fetch the user's full profile from the correct path
          const companyUserDocRef = doc(db, 'companies', companyCode, 'users', user.uid);
          const companyUserSnap = await getDoc(companyUserDocRef);
          if (companyUserSnap.exists()) {
            setProfileData(companyUserSnap.data());
          } else {
            setProfileData({});
          }
        } else {
          setProfileData({});
        }
      }
      setLoading(false);
    };
    fetchProfile();
  }, []);

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  }

  if (!userInfo) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">Profile</ThemedText>
        <Text style={styles.error}>No user is logged in.</Text>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Profile</ThemedText>
      {userInfo.photo ? (
        <Image source={{ uri: userInfo.photo }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder} />
      )}
      <ThemedText type="defaultSemiBold" style={styles.name}>{userInfo.name || 'No Name'}</ThemedText>
      <ThemedText style={styles.email}>{userInfo.email}</ThemedText>
      <ThemedText style={styles.role}>Role: {profileData?.role || 'Not set'}</ThemedText>
      <ThemedText style={styles.role}>
        Department: {profileData?.departmentName || 'Not set'}
      </ThemedText>
      <ThemedText style={styles.role}>
        Responsibilities: {Array.isArray(profileData?.responsibilities) ? profileData.responsibilities.join(', ') : 'Not set'}
      </ThemedText>
      <View style={{ marginTop: 24, width: '100%' }}>
        <Button title="Logout" onPress={logout} color="#d9534f" />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
    backgroundColor: 'transparent',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#ccc',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    backgroundColor: '#eee',
    borderWidth: 2,
    borderColor: '#ccc',
  },
  name: {
    fontSize: 20,
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  role: {
    fontSize: 16,
    color: '#888',
  },
  error: {
    color: 'red',
    marginTop: 20,
  },
}); 