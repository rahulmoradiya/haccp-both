import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '../../firebase';

export default function HomeScreen() {
  const [titles, setTitles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // TODO: Replace with dynamic companyCode if needed
  const companyCode = 'dcfd1b0a';
  const docId = '3ZrWUH4ZeLpDJ8tPiPLa';

  useEffect(() => {
    const fetchChecklistTitles = async () => {
      setLoading(true);
      setError('');
      try {
        const db = getFirestore(app);
        const ref = doc(db, 'companies', companyCode, 'checklistCreation', docId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const checklist = Array.isArray(data.checklist) ? data.checklist : [];
          setTitles(checklist.map((item: any) => item.title || ''));
        } else {
          setError('Document not found');
        }
      } catch (e) {
        setError('Error fetching checklist document');
      } finally {
        setLoading(false);
      }
    };
    fetchChecklistTitles();
  }, [companyCode, docId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Test</Text>
      {loading && <ActivityIndicator size="large" color="#1976D2" style={{ marginTop: 24 }} />}
      {error ? <Text style={{ color: 'red', marginTop: 16 }}>{error}</Text> : null}
      <FlatList
        data={titles}
        keyExtractor={(_, idx) => idx.toString()}
        renderItem={({ item }) => (
          <Text style={styles.item}>{item}</Text>
        )}
        style={{ marginTop: 24, width: '100%' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  item: {
    fontSize: 18,
    color: '#333',
    paddingVertical: 8,
    textAlign: 'center',
  },
});
