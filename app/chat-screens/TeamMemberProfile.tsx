import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, Image, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';

type ProfileData = {
  name?: string;
  email?: string;
  role?: string;
  departmentName?: string;
  responsibilities?: string[];
  photoURL?: string;
};

export default function TeamMemberProfile() {
  const { userId, companyCode } = useLocalSearchParams<{ userId: string; companyCode: string }>();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!userId || !companyCode) return;
        const userRef = doc(db, 'companies', companyCode, 'users', userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data() as any;
          setProfile({
            name: data.name || data.email || 'Unknown User',
            email: data.email,
            role: data.role,
            departmentName: data.departmentName,
            responsibilities: Array.isArray(data.responsibilities) ? data.responsibilities : [],
            photoURL: data.photoURL,
          });
        } else {
          setProfile({});
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId, companyCode]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}> 
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          {profile?.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {(profile?.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.name}>{profile?.name || 'Unknown User'}</Text>
          {profile?.email && <Text style={styles.email}>{profile.email}</Text>}
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <Text style={styles.detailItem}>Role: {profile?.role || 'Not set'}</Text>
          <Text style={styles.detailItem}>Department: {profile?.departmentName || 'Not set'}</Text>
        </View>

        {/* Responsibilities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Responsibilities</Text>
          {profile?.responsibilities && profile.responsibilities.length > 0 ? (
            profile.responsibilities.map((r, idx) => (
              <Text key={idx} style={styles.responsibilityItem}>• {r}</Text>
            ))
          ) : (
            <Text style={styles.detailItem}>None listed</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  detailItem: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
  },
  responsibilityItem: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
});


