import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Alert, Pressable, TextInput, Modal, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteProp, useRoute } from '@react-navigation/native';
import { getFirestore, doc, getDoc, getDocs, collection, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app } from '../../firebase';
import { Stack, useRouter } from 'expo-router';

// Route type
type ChecklistTaskScreenRouteProp = {
  params: {
    task: string;
    selectedDate?: string;
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
  const [hasChanges, setHasChanges] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
  
  // Task completion state
  const [isTaskCompleted, setIsTaskCompleted] = useState(false);
  const [completedBy, setCompletedBy] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [isCheckingCompletion, setIsCheckingCompletion] = useState(true);
  
  // User profile state
  const [completedByUser, setCompletedByUser] = useState<{ name: string; photoURL: string } | null>(null);

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

  // Function to fetch user profile data
  const fetchUserProfile = async (userId: string) => {
    if (!companyCode) {
      console.log('❌ No companyCode available for fetching user profile');
      return null;
    }
    
    console.log('🔍 Fetching user profile for:', userId, 'in company:', companyCode);
    
    try {
      const userRef = doc(db, 'companies', companyCode, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        console.log('✅ User data found:', userData);
        return {
          name: userData.name || userData.displayName || 'Unknown User',
          photoURL: userData.photoURL || null,
        };
      } else {
        console.log('❌ User document does not exist for ID:', userId);
      }
    } catch (error) {
      console.error('❌ Error fetching user profile:', error);
    }
    return null;
  };

  // Fetch linked item when companyCode is available
  useEffect(() => {
    if (companyCode) {
      fetchLinkedItem();
    }
  }, [companyCode]);

  // Check if task is already completed for the specific date
  useEffect(() => {
    const checkTaskCompletion = async () => {
      if (!companyCode) return;
      
      try {
        const taskId = task.id || task._id;
        // Use the date passed from the navigation params, or default to today
        const targetDate = route.params?.selectedDate || new Date().toISOString().split('T')[0];
        
        const checklistCollectedRef = collection(db, 'companies', companyCode, 'checklistCollected');
        // Check for completion on the specific date
        const completionQuery = query(
          checklistCollectedRef, 
          where('taskId', '==', taskId),
          where('completionDate', '==', targetDate)
        );
        const completionSnapshot = await getDocs(completionQuery);
        
        if (!completionSnapshot.empty) {
          const completionData = completionSnapshot.docs[0].data() as any;
          setIsTaskCompleted(true);
          setCompletedBy(completionData.completedBy);
          setCompletedAt(completionData.completedAt?.toDate?.()?.toISOString() || completionData.completedAt);
          
          // Fetch user profile data
          if (completionData.completedBy) {
            console.log('👤 Fetching profile for completedBy:', completionData.completedBy);
            const userProfile = await fetchUserProfile(completionData.completedBy);
            console.log('👤 User profile result:', userProfile);
            setCompletedByUser(userProfile);
          } else {
            console.log('❌ No completedBy field in completion data');
          }
          
          // Load the completed data into the form
          if (completionData.checklistItems) {
            const completedChecked = completionData.checklistItems.map((item: any) => item.status);
            const completedDeviations = completionData.checklistItems.map((item: any) => item.deviation || '');
            
            // Ensure arrays match checklist length
            const adjustedChecked = [...completedChecked];
            const adjustedDeviations = [...completedDeviations];
            
            while (adjustedChecked.length < checklist.length) {
              adjustedChecked.push(null);
            }
            while (adjustedDeviations.length < checklist.length) {
              adjustedDeviations.push('');
            }
            
            setChecked(adjustedChecked.slice(0, checklist.length));
            setDeviations(adjustedDeviations.slice(0, checklist.length));
          }
          
          console.log('Checklist task already completed for date:', targetDate, 'by:', completionData.completedBy);
        } else {
          console.log('Checklist task not completed for target date:', targetDate);
        }
      } catch (error) {
        console.error('Error checking task completion:', error);
      } finally {
        setIsCheckingCompletion(false);
      }
    };
    
    checkTaskCompletion();
  }, [companyCode, task.id]);

  // Load draft from AsyncStorage when component mounts
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const taskId = task.id || task._id;
        const draftKey = `draft_${taskId}`;
        const savedDraft = await AsyncStorage.getItem(draftKey);
        
        if (savedDraft) {
          const draftData = JSON.parse(savedDraft);
          const savedChecked = draftData.checked || [];
          const savedDeviations = draftData.deviations || [];
          
          // Ensure arrays match checklist length
          const adjustedChecked = [...savedChecked];
          const adjustedDeviations = [...savedDeviations];
          
          while (adjustedChecked.length < checklist.length) {
            adjustedChecked.push(null);
          }
          while (adjustedDeviations.length < checklist.length) {
            adjustedDeviations.push('');
          }
          
          setChecked(adjustedChecked.slice(0, checklist.length));
          setDeviations(adjustedDeviations.slice(0, checklist.length));
          console.log('Draft loaded with adjusted arrays:', {
            originalChecked: savedChecked,
            adjustedChecked: adjustedChecked.slice(0, checklist.length),
            checklistLength: checklist.length
          });
        }
      } catch (error) {
        console.error('Error loading draft:', error);
      } finally {
        setIsLoadingDraft(false);
      }
    };
    
    loadDraft();
  }, [task.id]);

  // Sync arrays when checklist changes
  useEffect(() => {
    console.log('Checklist changed, syncing arrays. Checklist length:', checklist.length, 'Checked length:', checked.length);
    if (checked.length !== checklist.length || deviations.length !== checklist.length) {
      console.log('Array length mismatch detected, adjusting arrays');
      
      // Adjust checked array
      const newChecked = [...checked];
      while (newChecked.length < checklist.length) {
        newChecked.push(null);
      }
      setChecked(newChecked.slice(0, checklist.length));
      
      // Adjust deviations array
      const newDeviations = [...deviations];
      while (newDeviations.length < checklist.length) {
        newDeviations.push('');
      }
      setDeviations(newDeviations.slice(0, checklist.length));
    }
  }, [checklist.length]);

  // Check for changes in checklist
  useEffect(() => {
    const hasAnyChanges = checked.some(status => status !== null) || deviations.some(deviation => deviation.trim() !== '');
    setHasChanges(hasAnyChanges);
  }, [checked, deviations]);

  // Save draft function
  const saveDraft = async () => {
    try {
      const taskId = task.id || task._id;
      const draftKey = `draft_${taskId}`;
      const draftData = {
        taskId: taskId,
        checked: checked,
        deviations: deviations,
        timestamp: new Date().toISOString(),
      };
      
      await AsyncStorage.setItem(draftKey, JSON.stringify(draftData));
      console.log('Draft saved to AsyncStorage:', draftData);
      setDraftSaved(true);
      
      // Show success message
      Alert.alert('Success', 'Draft saved successfully!');
      
      // Reset the saved indicator after 3 seconds
      setTimeout(() => setDraftSaved(false), 3000);
    } catch (error) {
      console.error('Error saving draft:', error);
      Alert.alert('Error', 'Failed to save draft. Please try again.');
    }
  };

  // Clear draft when task is completed
  const clearDraft = async () => {
    try {
      const taskId = task.id || task._id;
      const draftKey = `draft_${taskId}`;
      await AsyncStorage.removeItem(draftKey);
      console.log('Draft cleared for task:', taskId);
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  };

  // Submit checklist report to Firebase
  const submitReport = async () => {
    try {
      if (!companyCode) {
        Alert.alert('Error', 'Company information not available. Please try again.');
        return;
      }

      const auth = require('firebase/auth').getAuth(app);
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'User not authenticated. Please log in again.');
        return;
      }

      // Validate that all checklist items have been completed
      console.log('Checklist length:', checklist.length);
      console.log('Checked array length:', checked.length);
      console.log('Checklist status:', checked);
      
      // Ensure checked array matches checklist length
      let currentChecked = [...checked];
      if (currentChecked.length !== checklist.length) {
        console.log('Array length mismatch, adjusting checked array');
        // Adjust array length to match checklist
        while (currentChecked.length < checklist.length) {
          currentChecked.push(null);
        }
        currentChecked = currentChecked.slice(0, checklist.length);
        // Update state for future use, but continue with submission using adjusted array
        setChecked(currentChecked);
      }
      
      const incompleteItems = currentChecked.filter(status => status === null);
      console.log('Incomplete items count:', incompleteItems.length);
      
      if (incompleteItems.length > 0) {
        Alert.alert(
          'Incomplete Checklist', 
          `Please complete all checklist items before submitting the report. (${incompleteItems.length} items remaining)`,
          [{ text: 'OK' }]
        );
        return;
      }

      // Prepare the report data with completion date
      const targetDate = route.params?.selectedDate || new Date().toISOString().split('T')[0]; // Use selected date or today
      const reportData = {
        taskId: task.id || task._id,
        taskTitle: task.title || 'Untitled Task',
        taskType: 'checklist',
        checklistItems: checklist.map((item, index) => ({
          title: item.title,
          status: currentChecked[index],
          deviation: deviations[index] || null,
        })),
        completedBy: currentUser.uid,
        completedAt: serverTimestamp(),
        completionDate: targetDate, // Add the specific date for this completion
        companyCode: companyCode,
        linkedItemId: task.linkedItemId || null,
        linkedItemTitle: linkedItem?.title || null,
        totalItems: checklist.length,
        completedItems: currentChecked.filter(status => status === 'completed').length,
        notCompletedItems: currentChecked.filter(status => status === 'not_completed').length,
        hasDeviations: deviations.some(deviation => deviation.trim() !== ''),
        deviations: deviations.filter(deviation => deviation.trim() !== ''),
      };

      // Save to checklistCollected collection
      const checklistCollectedRef = collection(db, 'companies', companyCode, 'checklistCollected');
      const docRef = await addDoc(checklistCollectedRef, reportData);
      
      console.log('Checklist report submitted successfully:', docRef.id);
      
      // Clear the draft
      await clearDraft();
      
      // Show success message and navigate back
      Alert.alert(
        'Success', 
        'Checklist report submitted successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]
      );
      
    } catch (error) {
      console.error('Error submitting checklist report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };

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
        {isLoadingDraft && <ActivityIndicator size="small" color="#ff9800" style={{ marginBottom: 10 }} />}
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
                    onPress={() => !isTaskCompleted && setChecked(prev => prev.map((v, i) => i === idx ? (v === 'not_completed' ? null : 'not_completed') : v))}
                    disabled={isTaskCompleted}
                  >
                    {checked[idx] === 'not_completed' && <Text style={styles.crossMark}>✗</Text>}
                  </TouchableOpacity>
                  {/* Checkmark button */}
                  <TouchableOpacity
                    style={[styles.checkCircle, checked[idx] === 'completed' && styles.checkCircleChecked]}
                    activeOpacity={0.7}
                    onPress={() => !isTaskCompleted && setChecked(prev => prev.map((v, i) => i === idx ? (v === 'completed' ? null : 'completed') : v))}
                    disabled={isTaskCompleted}
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
          
          {/* Task Completion Status */}
          {isTaskCompleted && (
            <View style={styles.completionStatusContainer}>
              <View style={styles.completionStatusHeader}>
                <Text style={styles.completionStatusTitle}>✅ Task Completed</Text>
              </View>
              <View style={styles.completionStatusDetails}>
                <View style={styles.userInfoContainer}>
                  {completedByUser?.photoURL ? (
                    <Image 
                      source={{ uri: completedByUser.photoURL }} 
                      style={styles.userAvatar}
                    />
                  ) : (
                    <View style={styles.userAvatarPlaceholder}>
                      <Text style={styles.userAvatarText}>
                        {completedByUser?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.userTextContainer}>
                    <Text style={styles.completionStatusText}>
                      Completed by: {completedByUser?.name || 'Unknown User'}
                    </Text>
                    {completedAt && (
                      <Text style={styles.completionStatusText}>
                        Completed at: {new Date(completedAt).toLocaleString()}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          )}
          
          {/* Save Draft Button */}
          {hasChanges && !isTaskCompleted && (
            <TouchableOpacity
              style={[styles.saveDraftButton, draftSaved && styles.saveDraftButtonSaved]}
              activeOpacity={0.8}
              onPress={saveDraft}
              disabled={draftSaved}
            >
              <Text style={styles.saveDraftButtonText}>
                {draftSaved ? 'Draft Saved!' : 'Save Draft'}
              </Text>
            </TouchableOpacity>
          )}
          
          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isTaskCompleted && styles.completedButton]}
            activeOpacity={0.8}
            onPress={isTaskCompleted ? undefined : submitReport}
            disabled={isTaskCompleted}
          >
            <Text style={[styles.submitButtonText, isTaskCompleted && styles.completedButtonText]}>
              {isTaskCompleted ? 'Task Already Completed' : 'Submit Report'}
            </Text>
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
  saveDraftButton: {
    backgroundColor: '#ff9800',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  saveDraftButtonSaved: {
    backgroundColor: '#4caf50',
  },
  saveDraftButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  completionStatusContainer: {
    backgroundColor: '#e8f5e8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  completionStatusHeader: {
    marginBottom: 8,
  },
  completionStatusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  completionStatusDetails: {
    gap: 4,
  },
  completionStatusText: {
    fontSize: 14,
    color: '#2e7d32',
  },
  completedButton: {
    backgroundColor: '#9e9e9e',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  completedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // User profile styles
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  userTextContainer: {
    flex: 1,
  },

}); 