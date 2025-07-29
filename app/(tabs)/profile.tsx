import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { getAuth } from 'firebase/auth';
import { collectionGroup, doc, getDoc, getDocs, getFirestore } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Image, StyleSheet, Text, View, ScrollView } from 'react-native';
import { app } from '../../firebase';
import { useAuth } from '../_layout';

export default function ProfileScreen() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
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

          // 3. Fetch company information
          const companyProfileRef = doc(db, 'companies', companyCode, 'companyProfile', 'profile');
          const companyProfileSnap = await getDoc(companyProfileRef);
          if (companyProfileSnap.exists()) {
            setCompanyInfo(companyProfileSnap.data());
          } else {
            setCompanyInfo({});
          }
        } else {
          setProfileData({});
          setCompanyInfo({});
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
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.container}>
        <ThemedText type="title" style={styles.pageTitle}>Profile</ThemedText>
        
        {/* User Avatar and Basic Info */}
        <View style={styles.userSection}>
          {userInfo.photo ? (
            <Image source={{ uri: userInfo.photo }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <ThemedText style={styles.avatarText}>
                {userInfo.name ? userInfo.name.charAt(0).toUpperCase() : 'U'}
              </ThemedText>
            </View>
          )}
          <ThemedText type="defaultSemiBold" style={styles.name}>
            {userInfo.name || 'No Name'}
          </ThemedText>
          <ThemedText style={styles.email}>{userInfo.email}</ThemedText>
        </View>

        {/* User Details */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>User Details</ThemedText>
          <ThemedText style={styles.detailItem}>
            Role: {profileData?.role || 'Not set'}
          </ThemedText>
          <ThemedText style={styles.detailItem}>
            Department: {profileData?.departmentName || 'Not set'}
          </ThemedText>
          <ThemedText style={styles.detailItem}>
            Responsibilities: {Array.isArray(profileData?.responsibilities) ? profileData.responsibilities.join(', ') : 'Not set'}
          </ThemedText>
        </View>

        {/* Company Information */}
        {companyInfo && Object.keys(companyInfo).length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Company Information</ThemedText>
              {/* Company Logo */}
              {companyInfo.logoUrl && (
                <Image source={{ uri: companyInfo.logoUrl }} style={styles.companyLogo} />
              )}
            </View>
            
            {companyInfo.name && (
              <ThemedText style={styles.detailItem}>
                Company: {companyInfo.name}
              </ThemedText>
            )}
            {companyInfo.address && (
              <ThemedText style={styles.detailItem}>
                Address: {companyInfo.address}
              </ThemedText>
            )}
            {companyInfo.country && (
              <ThemedText style={styles.detailItem}>
                Country: {companyInfo.country}
              </ThemedText>
            )}
            {companyInfo.email && (
              <ThemedText style={styles.detailItem}>
                Company Email: {companyInfo.email}
              </ThemedText>
            )}
            {companyInfo.regNumber && (
              <ThemedText style={styles.detailItem}>
                Registration: {companyInfo.regNumber}
              </ThemedText>
            )}
            {companyInfo.vat && (
              <ThemedText style={styles.detailItem}>
                VAT: {companyInfo.vat}
              </ThemedText>
            )}
            {companyInfo.language && (
              <ThemedText style={styles.detailItem}>
                Language: {companyInfo.language}
              </ThemedText>
            )}
          </View>
        )}

        <View style={{ marginTop: 24, width: '100%' }}>
          <Button title="Logout" onPress={logout} color="#d9534f" />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#1976d2',
  },
  container: {
    flex: 1,
    padding: 20,
    gap: 16,
    backgroundColor: '#1976d2',
  },
  pageTitle: {
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
  },
  userSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  section: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 0,
    color: '#333',
    flex: 1,
  },
  detailItem: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    lineHeight: 22,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: 'white',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    backgroundColor: 'white',
    borderWidth: 3,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    color: '#1976d2',
    fontWeight: 'bold',
  },
  name: {
    fontSize: 24,
    marginBottom: 4,
    color: 'white',
    fontWeight: 'bold',
  },
  email: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  error: {
    color: 'red',
    marginTop: 20,
  },
  companyLogo: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
    borderRadius: 6,
  },
}); 