import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '../../firebase';
import { Stack } from 'expo-router';

type SOPDetailScreenRouteProp = {
  params: {
    companyCode: string;
    sopId: string;
  };
};

export default function SOPDetailScreen() {
  const route = useRoute<RouteProp<SOPDetailScreenRouteProp, 'params'>>();
  const { companyCode, sopId } = route.params;
  console.log('SOPDetailScreen params:', { companyCode, sopId });
  const db = getFirestore(app);
  const [sop, setSop] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSOP = async () => {
      setLoading(true);
      setError('');
      try {
        const ref = doc(db, 'companies', companyCode, 'sops', sopId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setSop(snap.data());
          console.log('Fetched SOP:', snap.data());
        } else {
          setError('SOP not found');
        }
      } catch (e) {
        setError('Error fetching SOP');
      } finally {
        setLoading(false);
      }
    };
    fetchSOP();
  }, [companyCode, sopId]);

  return (
    <>
      <Stack.Screen options={{ title: 'SOP Details' }} />
      <View style={styles.container}>
        {loading && <ActivityIndicator size="large" color="#1976D2" style={{ marginBottom: 16 }} />}
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : sop ? (
          <>
            <Text style={styles.title}>{sop.title || 'Untitled SOP'}</Text>
            <Text style={styles.version}>Version: {sop.version || 'N/A'}</Text>
            {sop.description && <Text style={styles.desc}>{sop.description}</Text>}
          </>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1976D2',
  },
  version: {
    fontSize: 16,
    color: '#555',
    marginBottom: 16,
  },
  desc: {
    fontSize: 16,
    color: '#222',
    marginTop: 8,
  },
  error: {
    color: '#F44336',
    fontSize: 16,
    marginTop: 20,
  },
}); 