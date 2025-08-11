import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Alert, Pressable, TextInput, Modal } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { getFirestore, doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { app } from '../../firebase';
import { Stack, useRouter } from 'expo-router';

// Route type
type ChecklistTaskScreenRouteProp = {
  params: {
    task: string;
  };
};

// Define a type for checklist items
type ChecklistItem = { title: string };

export default function ChecklistTaskScreen() {
  const route = useRoute<RouteProp<ChecklistTaskScreenRouteProp, 'params'>>();
  const task = JSON.parse(route.params.task);
  console.log('ChecklistTaskScreen task:', task);
  const db = getFirestore(app);
  const [linkedItem, setLinkedItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const [editingDeviationIdx, setEditingDeviationIdx] = useState<number | null>(null);
  const [companyCode, setCompanyCode] = useState<string | null>(null);

  // For demo: use checklist array from task or linkedItem, or fallback to mock data
  const checklist: ChecklistItem[] =
    (task.checklist && Array.isArray(task.checklist) && task.checklist.length > 0)
      ? task.checklist
      : (linkedItem && Array.isArray(linkedItem.checklist) && linkedItem.checklist.length > 0)
        ? linkedItem.checklist
        : [
            { title: 'No illness' },
            { title: 'No jewellery' },
            { title: 'Clean Attire' },
            { title: 'Employee Loacker and Storage' },
            { title: 'Wash hands after using washroom' },
            { title: 'No use to tobacco, eat in production are' },
            { title: 'Cleaned and sanitized utensils' },
            { title: 'Procedure of appropriate cleaning, separation, scheduling' },
            { title: 'Proper disposal of dry and wet waste' },
          ];

  // Instead of boolean, use 'completed' | 'not completed' | null for each item
  type ItemStatus = 'completed' | 'not_completed' | null;
  const [checked, setChecked] = useState<ItemStatus[]>(() => checklist.map(() => null));
  const [deviations, setDeviations] = useState<string[]>(() => checklist.map(() => ''));

  // Get company code from current user
  useEffect(() => {
    const fetchCompanyCode = async () => {
      console.log('=== FETCHING COMPANY CODE ===');
      const user = require('firebase/auth').getAuth(app).currentUser;
      console.log('Current user:', user?.uid);
      
      if (user) {
        try {
          console.log('Fetching companies collection...');
          const companiesSnap = await getDocs(collection(db, 'companies'));
          console.log('Number of companies found:', companiesSnap.docs.length);
          
          for (const companyDoc of companiesSnap.docs) {
            console.log('Checking company:', companyDoc.id);
            const usersCol = await getDocs(collection(db, 'companies', companyDoc.id, 'users'));
            console.log('Users in company', companyDoc.id, ':', usersCol.docs.length);
            
            const userDoc = usersCol.docs.find(doc => doc.data().uid === user.uid);
            if (userDoc) {
              setCompanyCode(companyDoc.id);
              console.log('✅ Found company code:', companyDoc.id);
              break;
            }
          }
        } catch (error) {
          console.error('❌ Error fetching company code:', error);
          setError('Failed to fetch company information');
        }
      } else {
        console.log('❌ No user logged in');
        setError('No user logged in');
      }
    };
    fetchCompanyCode();
  }, []);

  // Fetch linked item when companyCode is available
  useEffect(() => {
    if (companyCode) {
      fetchLinkedItem();
    }
  }, [companyCode]);

  const fetchLinkedItem = async () => {
    console.log('=== DEBUGGING FETCH ===');
    console.log('companyCode (from state):', companyCode);
    console.log('task.linkedItemId:', task.linkedItemId);
    console.log('Full task object:', task);
    
    if (!companyCode || !task.linkedItemId) {
      console.log('Missing companyCode or linkedItemId - skipping fetch');
      return;
    }
      
    setLoading(true);
    setError('');
    try {
      const ref = doc(db, 'companies', companyCode, 'checklistCreation', task.linkedItemId);
      console.log('Firebase path:', `companies/${companyCode}/checklistCreation/${task.linkedItemId}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setLinkedItem(data);
        console.log('✅ Fetched linkedItem:', data);
        console.log('Linked item instructionSOPs:', data.instructionSOPs);
      } else {
        console.log('❌ Document does not exist');
        setError('Linked item not found');
      }
    } catch (e) {
      console.log('❌ Firebase error:', e);
      setError('Error fetching linked item: ' + e);
    } finally {
      setLoading(false);
    }
  };

  // Add loading and error states
  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Checklist Task', headerBackTitle: '' }} />
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#1976D2" />
          <Text style={{ marginTop: 16, color: '#666' }}>Loading checklist...</Text>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Checklist Task', headerBackTitle: '' }} />
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: 'red', textAlign: 'center', marginBottom: 16 }}>{error}</Text>
          <Text style={{ color: '#666', textAlign: 'center' }}>Task: {JSON.stringify(task, null, 2)}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Checklist Task', headerBackTitle: '' }} />
    <View style={styles.container}>
        <View style={styles.titleRow}>
      <Text style={styles.taskTitle}>{linkedItem?.title || task.title || 'Untitled Task'}</Text>
      <Text style={{ fontSize: 12, color: '#666' }}>Debug: {linkedItem ? 'LinkedItem loaded' : 'Using fallback'}</Text>
          <Pressable
            onPress={() => {
              if (!companyCode) {
                Alert.alert('Error', 'Company information not available. Please try again.');
                return;
              }
              
              // Force use the correct SOP ID from Firebase
              const sopId = 'sH1NHwrn4Q55qHNJDNc8'; // Always use the correct SOP ID
              
              router.push({
                pathname: '/task-screens/SOPDetailScreen',
                params: { companyCode: companyCode, sopId: sopId },
              });
            }}
            style={styles.sopButton}
          >
            <Text style={styles.sopButtonText}>SOP</Text>
          </Pressable>
        </View>
        {loading && <ActivityIndicator size="small" color="#2196F3" style={{ marginBottom: 10 }} />}
        {error ? (
          <Text style={{ color: 'red', marginBottom: 10 }}>{error}</Text>
        ) : linkedItem ? (
          <View style={styles.linkedItemBox}>
            <Text style={styles.linkedItemTitle}>Linked Item: {linkedItem.title || 'No Title'}</Text>
            {linkedItem.description && <Text style={styles.linkedItemDesc}>{linkedItem.description}</Text>}
          </View>
        ) : null}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
          {checklist.map((item: ChecklistItem, idx: number) => (
            (() => { console.log('Checklist item', idx, item); })(),
            <View key={idx} style={styles.checklistCard}>
              <View style={styles.checklistItem}>
                <View
                  style={[styles.bullet,
                    checked[idx] === 'completed' ? styles.bulletGreen :
                    checked[idx] === 'not_completed' ? styles.bulletRed :
                    styles.bulletYellow
                  ]}
                />
                <Text style={styles.checklistText}>{item.title}</Text>
                <View style={styles.buttonRow}>
                  {/* Cross button */}
                  <TouchableOpacity
                    style={[styles.crossCircle, checked[idx] === 'not_completed' && styles.crossCircleChecked]}
                    activeOpacity={0.7}
                    onPress={() => setChecked(prev => prev.map((v, i) => i === idx ? (v === 'not_completed' ? null : 'not_completed') : v))}
                  >
                    {checked[idx] === 'not_completed' && <Text style={styles.crossMark}>✗</Text>}
                  </TouchableOpacity>
                  {/* Checkmark button */}
                  <TouchableOpacity
                    style={[styles.checkCircle, checked[idx] === 'completed' && styles.checkCircleChecked]}
                    activeOpacity={0.7}
                    onPress={() => setChecked(prev => prev.map((v, i) => i === idx ? (v === 'completed' ? null : 'completed') : v))}
                  >
                    {checked[idx] === 'completed' && <Text style={styles.checkMark}>✓</Text>}
                  </TouchableOpacity>
                </View>
              </View>
              {/* Deviation input if cross is selected */}
              {checked[idx] === 'not_completed' && (
                <View style={styles.deviationBox}>
                  <Text style={styles.deviationLabel}>Deviation:</Text>
                  {editingDeviationIdx === idx || !deviations[idx] ? (
                    <>
                      <TextInput
                        style={styles.deviationInput}
                        placeholder="Enter reason for deviation..."
                        value={deviations[idx]}
                        onChangeText={text => setDeviations(prev => prev.map((v, i) => i === idx ? text : v))}
                        multiline
                      />
                      <View style={{ flexDirection: 'row', marginTop: 6 }}>
                        <TouchableOpacity
                          style={styles.saveButton}
                          onPress={() => setEditingDeviationIdx(null)}
                        >
                          <Text style={styles.saveButtonText}>Save</Text>
                        </TouchableOpacity>
                        {deviations[idx] && (
                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => setDeviations(prev => prev.map((v, i) => i === idx ? '' : v))}
                          >
                            <Text style={styles.deleteButtonText}>Delete</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <Text style={styles.deviationComment}>{deviations[idx]}</Text>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => setEditingDeviationIdx(idx)}
                      >
                        <Text style={styles.editButtonText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => setDeviations(prev => prev.map((v, i) => i === idx ? '' : v))}
                      >
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}
          <TouchableOpacity
            style={styles.submitButton}
            activeOpacity={0.8}
            onPress={() => Alert.alert('Report Submitted', 'Your checklist report has been submitted!')}
          >
            <Text style={styles.submitButtonText}>Submit Report</Text>
          </TouchableOpacity>
        </ScrollView>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  linkedItemBox: {
    backgroundColor: '#F3F7FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  linkedItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 4,
  },
  linkedItemDesc: {
    fontSize: 14,
    color: '#555',
  },
  checklistCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
    borderRadius: 16,
  },
  bullet: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 18,
  },
  bulletYellow: {
    backgroundColor: '#FFD600',
  },
  bulletGreen: {
    backgroundColor: '#4CAF50',
  },
  bulletRed: {
    backgroundColor: '#F44336',
  },
  checklistText: {
    flex: 1,
    fontSize: 17,
    color: '#222',
    fontWeight: '500',
    marginRight: 10,
  },
  checkCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginLeft: 8,
    marginRight: 4,
  },
  checkCircleChecked: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  checkMark: {
    color: '#4CAF50',
    fontSize: 22,
    fontWeight: 'bold',
  },
  crossCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginLeft: 4,
  },
  crossCircleChecked: {
    borderColor: '#F44336',
    backgroundColor: '#FFEBEE',
  },
  crossMark: {
    color: '#F44336',
    fontSize: 22,
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 8,
  },
  submitButton: {
    marginTop: 16,
    marginBottom: 32,
    backgroundColor: '#1976D2',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sopButton: {
    backgroundColor: '#1976D2',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginLeft: 12,
  },
  sopButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 1,
  },
  deviationBox: {
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 10,
  },
  deviationLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 4,
  },
  deviationInput: {
    minHeight: 36,
    fontSize: 15,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F44336',
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: '#222',
  },
  deviationComment: {
    fontSize: 15,
    color: '#F44336',
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  editButton: {
    backgroundColor: '#1976D2',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  deleteButton: {
    backgroundColor: '#F44336',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },

}); 