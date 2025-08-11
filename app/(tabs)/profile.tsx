import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Image, StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { app, db } from '../../firebase';
import { useAuth } from '../_layout';

export default function ProfileScreen() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { logout, companyCode } = useAuth();

  useEffect(() => {
    const fetchProfile = async () => {
      const auth = getAuth(app);
      const user = auth.currentUser;
      try {
        if (user) {
          setUserInfo({
            uid: user.uid,
            email: user.email,
            name: user.displayName,
            photo: user.photoURL,
          });

          if (!companyCode) {
            setProfileData({});
            setCompanyInfo({});
            return;
          }

          // Fetch user's profile under their company
          const companyUserDocRef = doc(db, 'companies', companyCode, 'users', user.uid);
          const companyUserSnap = await getDoc(companyUserDocRef);
          setProfileData(companyUserSnap.exists() ? companyUserSnap.data() : {});

          // Fetch company information
          const companyProfileRef = doc(db, 'companies', companyCode, 'companyProfile', 'profile');
          const companyProfileSnap = await getDoc(companyProfileRef);
          setCompanyInfo(companyProfileSnap.exists() ? companyProfileSnap.data() : {});
        }
      } catch (e) {
        console.error('Failed to load profile:', e);
        setProfileData({});
        setCompanyInfo({});
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [companyCode]);

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
    <SafeAreaView style={styles.safeArea}>
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
              {companyInfo.dateFormat && (
                <ThemedText style={styles.detailItem}>
                  Date Format: {companyInfo.dateFormat}
                </ThemedText>
              )}
              {companyInfo.businessType && (
                <ThemedText style={styles.detailItem}>
                  Business Type: {companyInfo.businessType}
                </ThemedText>
              )}
              {companyInfo.timeZone && (
                <ThemedText style={styles.detailItem}>
                  Time Zone: {companyInfo.timeZone}
                </ThemedText>
              )}
              {companyInfo.totalEmployee && (
                <ThemedText style={styles.detailItem}>
                  Total Employees: {companyInfo.totalEmployee}
                </ThemedText>
              )}
              {companyInfo.volumeUnits && (
                <ThemedText style={styles.detailItem}>
                  Measuring Units: {companyInfo.volumeUnits}
                </ThemedText>
              )}
            </View>
          )}

          {/* Logout Section */}
          <View style={[styles.section, { marginBottom: 70 }]}>
            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
              <ThemedText style={styles.logoutButtonText}>Logout</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1976d2',
  },
  scrollContainer: {
    flex: 1,
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
  logoutButton: {
    backgroundColor: '#d9534f',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 