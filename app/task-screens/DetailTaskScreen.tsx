import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, TextInput, TouchableOpacity, ScrollView, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { getFirestore, getDocs, collection, doc, getDoc, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app } from '../../firebase';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { uploadFile, uploadTaskFile, validateFileType, formatFileSize } from '../../utils/fileUpload';
import { storage } from '../../firebase';

type DetailTaskScreenRouteProp = {
  params: {
    task: string;
    selectedDate?: string;
  };
};

export default function DetailTaskScreen() {
  const route = useRoute<RouteProp<DetailTaskScreenRouteProp, 'params'>>();
  const task = JSON.parse(route.params.task);
  const router = useRouter();
  const [companyCode, setCompanyCode] = useState<string | null>(null);
  
  // Media state
  const [mediaAttachments, setMediaAttachments] = useState<Array<{
    type: 'image' | 'document';
    url: string;
    name: string;
    size: number;
    mimeType: string;
  }>>([]);
  const [uploading, setUploading] = useState(false);
  
  // Linked Item state
  const [linkedItemData, setLinkedItemData] = useState<any>(null);
  const [linkedItemLoading, setLinkedItemLoading] = useState(false);
  const [linkedItemError, setLinkedItemError] = useState<string | null>(null);

  // Dynamic fields state
  const [dynamicFields, setDynamicFields] = useState<any[]>([]);
  const [dynamicFieldValues, setDynamicFieldValues] = useState<{[key: string]: any}>({});
  
  // Draft functionality state
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

  const db = getFirestore(app);

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

  // Function to fetch linked item data
  const fetchLinkedItemData = async () => {
    if (!task.linkedItemId || !companyCode) return;
    
    setLinkedItemLoading(true);
    setLinkedItemError(null);
    
    try {
      const linkedItemRef = doc(db, 'companies', companyCode, 'detailedCreation', task.linkedItemId);
      const linkedItemSnap = await getDoc(linkedItemRef);
      
      if (linkedItemSnap.exists()) {
        console.log('Linked item data:', linkedItemSnap.data());
        setLinkedItemData(linkedItemSnap.data());
      } else {
        console.log('No linked item found with ID:', task.linkedItemId);
        setLinkedItemError('Linked item not found');
      }
    } catch (error) {
      console.error('Error fetching linked item:', error);
      setLinkedItemError('Failed to fetch linked item');
    } finally {
      setLinkedItemLoading(false);
    }
  };

  // Fetch linked item data when companyCode is available
  useEffect(() => {
    if (companyCode && task.linkedItemId) {
      fetchLinkedItemData();
      // No profile-based unit fetching
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
        
        const detailedCollectedRef = collection(db, 'companies', companyCode, 'detailedCollected');
        // Check for completion on the current date
        const completionQuery = query(
          detailedCollectedRef, 
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
          if (completionData.fieldValues) {
            setDynamicFieldValues(completionData.fieldValues);
          }
          if (completionData.mediaAttachments) {
            setMediaAttachments(completionData.mediaAttachments);
          }
          
          console.log('Task already completed for date:', targetDate, 'by:', completionData.completedBy);
        } else {
          console.log('Task not completed for target date:', targetDate);
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
        const draftKey = `detail_draft_${taskId}`;
        const savedDraft = await AsyncStorage.getItem(draftKey);
        
        if (savedDraft) {
          const draftData = JSON.parse(savedDraft);
          setDynamicFieldValues(draftData.fieldValues || {});
          setMediaAttachments(draftData.mediaAttachments || []);
          console.log('Detail task draft loaded:', draftData);
        }
      } catch (error) {
        console.error('Error loading detail task draft:', error);
      } finally {
        setIsLoadingDraft(false);
      }
    };
    
    loadDraft();
  }, [task.id]);

  // Check for changes in form data
  useEffect(() => {
    const hasAnyChanges = Object.keys(dynamicFieldValues).length > 0 || mediaAttachments.length > 0;
    setHasChanges(hasAnyChanges);
  }, [dynamicFieldValues, mediaAttachments]);

  // Get company code from current user
  useEffect(() => {
    const fetchCompanyCode = async () => {
      const user = require('firebase/auth').getAuth(app).currentUser;
      
      if (user) {
        try {
          const companiesSnap = await getDocs(collection(db, 'companies'));
          
          for (const companyDoc of companiesSnap.docs) {
            const usersCol = await getDocs(collection(db, 'companies', companyDoc.id, 'users'));
            const userDoc = usersCol.docs.find(doc => doc.data().uid === user.uid);
            if (userDoc) {
              setCompanyCode(companyDoc.id);
              break;
            }
          }
        } catch (error) {
          console.error('Error fetching company code:', error);
        }
      }
    };
    fetchCompanyCode();
  }, []);

  const handleAttachmentPress = () => {
    Alert.alert(
      'Add Attachment',
      'Choose an option',
      [
        {
          text: 'Camera',
          onPress: () => handleImagePicker('camera'),
        },
        {
          text: 'Photo Library',
          onPress: () => handleImagePicker('library'),
        },
        {
          text: 'Document',
          onPress: () => handleDocumentPicker(),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleImagePicker = async (source: 'camera' | 'library') => {
    try {
      setUploading(true);
      
      // Request permissions
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera permission is required to take photos');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Photo library permission is required');
          return;
        }
      }

      const result = source === 'camera' 
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await handleFileUpload(asset.uri, asset.fileName || 'image.jpg', asset.mimeType || 'image/jpeg');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setUploading(false);
    }
  };

  const handleDocumentPicker = async () => {
    try {
      setUploading(true);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (!validateFileType(asset.mimeType || '')) {
          Alert.alert('Invalid file type', 'Please select a supported file type');
          return;
        }
        await handleFileUpload(asset.uri, asset.name, asset.mimeType || 'application/octet-stream');
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (uri: string, fileName: string, mimeType: string) => {
    try {
      console.log('🎯 DetailTaskScreen: Starting file processing');
      
      // For now, store media locally without uploading to Firebase
      // This allows the functionality to work while we debug the upload issue
      
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const fileSize = fileInfo.exists ? (fileInfo as any).size || 0 : 0;
      
      console.log('🎯 DetailTaskScreen: File info:', { fileSize, exists: fileInfo.exists });

      const attachment: {
        type: 'image' | 'document';
        url: string;
        name: string;
        size: number;
        mimeType: string;
        localUri?: string; // Add local URI for temporary storage
      } = {
        type: mimeType.startsWith('image/') ? 'image' : 'document',
        url: uri, // Use local URI for now
        name: fileName,
        size: fileSize,
        mimeType: mimeType,
        localUri: uri, // Store local URI for later upload
      };

      setMediaAttachments(prev => [...prev, attachment]);
      
      console.log('🎯 DetailTaskScreen: Media added locally:', attachment);
      Alert.alert('Success', 'Media added successfully! (Stored locally)');

    } catch (error) {
      console.error('Error processing file:', error);
      Alert.alert('Error', 'Failed to process file. Please try again.');
    }
  };

  const removeMediaAttachment = (index: number) => {
    setMediaAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Save draft function
  const saveDraft = async () => {
    try {
      const taskId = task.id || task._id;
      const draftKey = `detail_draft_${taskId}`;
      const draftData = {
        taskId: taskId,
        fieldValues: dynamicFieldValues,
        mediaAttachments: mediaAttachments,
        timestamp: new Date().toISOString(),
      };
      
      await AsyncStorage.setItem(draftKey, JSON.stringify(draftData));
      console.log('Detail task draft saved to AsyncStorage:', draftData);
      setDraftSaved(true);
      
      // Show success message
      Alert.alert('Success', 'Draft saved successfully!');
      
      // Reset the saved indicator after 3 seconds
      setTimeout(() => setDraftSaved(false), 3000);
    } catch (error) {
      console.error('Error saving detail task draft:', error);
      Alert.alert('Error', 'Failed to save draft. Please try again.');
    }
  };

  // Clear draft when task is completed
  const clearDraft = async () => {
    try {
      const taskId = task.id || task._id;
      const draftKey = `detail_draft_${taskId}`;
      await AsyncStorage.removeItem(draftKey);
      console.log('Detail task draft cleared for task:', taskId);
    } catch (error) {
      console.error('Error clearing detail task draft:', error);
    }
  };

  // Submit report to Firebase
  const submitReport = async () => {
    if (!companyCode) {
      Alert.alert('Error', 'Company code not available');
      return;
    }

    const auth = getAuth(app);
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      // Prepare report data with completion date
      const targetDate = route.params?.selectedDate || new Date().toISOString().split('T')[0]; // Use selected date or today
      const reportData = {
        taskId: task.id || task._id,
        taskTitle: task.title,
        linkedItemId: task.linkedItemId,
        fieldValues: dynamicFieldValues,
        mediaAttachments: mediaAttachments,
        completedBy: currentUser.uid,
        completedAt: serverTimestamp(),
        completionDate: targetDate, // Add the specific date for this completion
        companyCode: companyCode,
        totalFields: Object.keys(dynamicFieldValues).length,
        hasMediaAttachments: mediaAttachments.length > 0,
        mediaCount: mediaAttachments.length,
      };

      // Save to Firebase
      const detailedCollectedRef = collection(db, 'companies', companyCode, 'detailedCollected');
      await addDoc(detailedCollectedRef, reportData);

      // Clear the draft
      await clearDraft();

      Alert.alert('Success', 'Report submitted successfully!');
      router.back();
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };



  // Function to update a specific field value (no automatic unit conversion)
  const updateFieldValue = (fieldId: string, value: any) => {
    console.log('Updating field:', fieldId, 'with value:', value);
    
    setDynamicFieldValues(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  // Process dynamic fields when linked item data is loaded
  useEffect(() => {
    if (linkedItemData && linkedItemData.fields) {
      console.log('Processing dynamic fields:', linkedItemData.fields);
      setDynamicFields(linkedItemData.fields);
    }
  }, [linkedItemData]);

  // Helper functions for colors
  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return '#f44336';
      case 'medium': return '#ff9800';
      case 'low': return '#4caf50';
      default: return '#ff9800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return '#4caf50';
      case 'inactive': return '#9e9e9e';
      case 'completed': return '#2196f3';
      case 'pending': return '#ff9800';
      default: return '#4caf50';
    }
  };

  // Function to render dynamic cards based on type
  const renderDynamicCard = (field: any, index: number) => {
    const fieldId = `${field.type}_${index}`; // Create unique ID for each field
    const fieldValue = dynamicFieldValues[fieldId] || {};

    switch (field.type) {
      case 'temperature':
        const preferredTempUnit = field.config?.unit || '°C';
        const tempMin = field.config?.min;
        const tempMax = field.config?.max;
        return (
          <View key={fieldId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>🌡️ {field.label || 'Temperature'}</Text>
              {(tempMin !== undefined || tempMax !== undefined) && (
                <Text style={styles.rangeHint}>
                  {tempMin !== undefined && tempMax !== undefined 
                    ? `Range: ${tempMin} - ${tempMax} ${preferredTempUnit}`
                    : tempMin !== undefined 
                      ? `Min: ${tempMin} ${preferredTempUnit}`
                      : `Max: ${tempMax} ${preferredTempUnit}`
                  }
                </Text>
              )}
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.temperatureInput}
                placeholder="Enter temperature..."
                value={fieldValue.temperature || ''}
                onChangeText={(value) => updateFieldValue(fieldId, {
                  ...fieldValue,
                  temperature: value,
                  temperatureUnit: preferredTempUnit
                })}
                keyboardType="numeric"
                placeholderTextColor="#999"
                editable={!isTaskCompleted}
              />
              <View style={styles.unitContainer}>
                <TouchableOpacity
                  style={[styles.unitButton, styles.unitButtonActive]}
                  disabled={true}
                >
                  <Text style={[styles.unitButtonText, styles.unitButtonTextActive]}>{preferredTempUnit}</Text>
                </TouchableOpacity>
              </View>
            </View>
            {fieldValue.temperature && (
              <View style={styles.valueDisplayContainer}>
                <Text style={styles.valueDisplay}>
                  Value: {fieldValue.temperature} {preferredTempUnit}
                </Text>
              </View>
            )}
          </View>
        );

      case 'amount': {
        const category = field?.config?.measurementCategory || 'amount';
        const configuredUnit = field?.config?.unit || '';
        const amountMin = field?.config?.min;
        const amountMax = field?.config?.max;
        const titlePrefix = category === 'temperature' ? '🌡️' : '📊';
        return (
          <View key={fieldId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{titlePrefix} {field.label || (category === 'temperature' ? 'Temperature' : 'Amount')}</Text>
              {(amountMin !== undefined || amountMax !== undefined) && (
                <Text style={styles.rangeHint}>
                  {amountMin !== undefined && amountMax !== undefined 
                    ? `Range: ${amountMin} - ${amountMax} ${configuredUnit}`
                    : amountMin !== undefined 
                      ? `Min: ${amountMin} ${configuredUnit}`
                      : `Max: ${amountMax} ${configuredUnit}`
                  }
                </Text>
              )}
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.amountInput}
                placeholder={category === 'temperature' ? 'Enter temperature...' : 'Enter amount...'}
                value={(category === 'temperature' ? fieldValue.temperature : fieldValue.amount) || ''}
                onChangeText={(value) => updateFieldValue(fieldId, {
                  ...fieldValue,
                  ...(category === 'temperature' ? { temperature: value, temperatureUnit: configuredUnit } : { amount: value, amountUnit: configuredUnit })
                })}
                keyboardType="numeric"
                placeholderTextColor="#999"
                editable={!isTaskCompleted}
              />
              {!!configuredUnit && (
                <View style={styles.unitContainer}>
                  <TouchableOpacity style={[styles.unitButton, styles.unitButtonActive]} disabled>
                    <Text style={[styles.unitButtonText, styles.unitButtonTextActive]}>{configuredUnit}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {(category === 'temperature' ? fieldValue.temperature : fieldValue.amount) && (
              <View style={styles.valueDisplayContainer}>
                <Text style={styles.valueDisplay}>
                  Value: {(category === 'temperature' ? fieldValue.temperature : fieldValue.amount)} {configuredUnit}
                </Text>
              </View>
            )}
          </View>
        );
      }

      case 'numeric': {
        const numericMin = field?.config?.min;
        const numericMax = field?.config?.max;
        const numericUnit = field?.config?.unit || '';
        return (
          <View key={fieldId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>🔢 {field.label || 'Numeric Value'}</Text>
              {(numericMin !== undefined || numericMax !== undefined) && (
                <Text style={styles.rangeHint}>
                  {numericMin !== undefined && numericMax !== undefined 
                    ? `Range: ${numericMin} - ${numericMax} ${numericUnit}`
                    : numericMin !== undefined 
                      ? `Min: ${numericMin} ${numericUnit}`
                      : `Max: ${numericMax} ${numericUnit}`
                  }
                </Text>
              )}
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.numericInput}
                placeholder="Enter value..."
                value={fieldValue.numeric || ''}
                onChangeText={(value) => updateFieldValue(fieldId, {
                  ...fieldValue,
                  numeric: value,
                  numericUnit: numericUnit
                })}
                keyboardType="numeric"
                placeholderTextColor="#999"
                editable={!isTaskCompleted}
              />
              {!!numericUnit && (
                <View style={styles.unitContainer}>
                  <TouchableOpacity style={[styles.unitButton, styles.unitButtonActive]} disabled>
                    <Text style={[styles.unitButtonText, styles.unitButtonTextActive]}>{numericUnit}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {fieldValue.numeric && (
              <View style={styles.valueDisplayContainer}>
                <Text style={styles.valueDisplay}>
                  Value: {fieldValue.numeric} {numericUnit}
                </Text>
              </View>
            )}
          </View>
        );
      }

      case 'text':
        return (
          <View key={fieldId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>📝 {field.label || 'Text'}</Text>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Enter text..."
                value={fieldValue.text || ''}
                onChangeText={(value) => updateFieldValue(fieldId, {
                  ...fieldValue,
                  text: value
                })}
                multiline
                placeholderTextColor="#999"
                editable={!isTaskCompleted}
              />
            </View>
          </View>
        );

      case 'multiple':
      case 'multi':
        const options = field.config?.options || [];
        const selectedOptions = fieldValue.selectedOptions || {};
        const selectedCount = Object.values(selectedOptions).filter(Boolean).length;
        const allSelected = options.length > 0 && selectedCount === options.length;
        const someSelected = selectedCount > 0 && selectedCount < options.length;
        
        return (
          <View key={fieldId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>☑️ {field.label || 'Multiple Choice'}</Text>
              {options.length > 0 && (
                <Text style={styles.selectionCount}>
                  {selectedCount} of {options.length} selected
                </Text>
              )}
            </View>
            {options.length > 1 && (
              <View style={styles.selectAllContainer}>
                <TouchableOpacity
                  style={styles.selectAllButton}
                  onPress={() => {
                    if (isTaskCompleted) return;
                    const newSelectedOptions: {[key: string]: boolean} = {};
                    if (allSelected) {
                      // Deselect all
                      options.forEach((option: string) => newSelectedOptions[option] = false);
                    } else {
                      // Select all
                      options.forEach((option: string) => newSelectedOptions[option] = true);
                    }
                    updateFieldValue(fieldId, {
                      ...fieldValue,
                      selectedOptions: newSelectedOptions
                    });
                  }}
                  disabled={isTaskCompleted}
                >
                  <View style={[
                    styles.checkbox,
                    allSelected ? styles.checkboxChecked : styles.checkboxUnchecked
                  ]}>
                    {allSelected && <Text style={styles.checkmark}>✓</Text>}
                    {someSelected && <Text style={styles.checkmark}>-</Text>}
                  </View>
                  <Text style={styles.selectAllText}>
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.multipleContainer}>
              {options.map((option: string, optionIndex: number) => (
                <TouchableOpacity
                  key={optionIndex}
                  style={[
                    styles.multipleOption,
                    selectedOptions[option] && styles.multipleOptionSelected
                  ]}
                  onPress={() => {
                    if (isTaskCompleted) return;
                    const currentOptions = selectedOptions;
                    updateFieldValue(fieldId, {
                      ...fieldValue,
                      selectedOptions: {
                        ...currentOptions,
                        [option]: !currentOptions[option]
                      }
                    });
                  }}
                  disabled={isTaskCompleted}
                >
                  <View style={[
                    styles.checkbox,
                    selectedOptions[option] ? styles.checkboxChecked : styles.checkboxUnchecked
                  ]}>
                    {selectedOptions[option] && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[
                    styles.multipleOptionText,
                    selectedOptions[option] && styles.multipleOptionTextSelected
                  ]}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedCount > 0 && (
              <View style={styles.valueDisplayContainer}>
                <Text style={styles.valueDisplay}>
                  Selected: {Object.keys(selectedOptions).filter(key => selectedOptions[key]).join(', ')}
                </Text>
              </View>
            )}
          </View>
        );

      case 'single':
        return (
          <View key={fieldId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>⭕ {field.label || 'Single Choice'}</Text>
            </View>
            <View style={styles.singleContainer}>
              {(field.config?.options || []).map((option: string, optionIndex: number) => (
                <TouchableOpacity
                  key={optionIndex}
                  style={[
                    styles.singleOption,
                    fieldValue.selectedOption === option && styles.singleOptionSelected
                  ]}
                  onPress={() => updateFieldValue(fieldId, {
                    ...fieldValue,
                    selectedOption: option
                  })}
                >
                  <Text style={[
                    styles.singleOptionText,
                    fieldValue.selectedOption === option && styles.singleOptionTextSelected
                  ]}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'product':
        return (
          <View key={fieldId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>🏭 {field.label || 'Product'}</Text>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.productInput}
                placeholder="Select product..."
                value={fieldValue.product || ''}
                onChangeText={(value) => updateFieldValue(fieldId, {
                  ...fieldValue,
                  product: value
                })}
                placeholderTextColor="#999"
                editable={!isTaskCompleted}
              />
            </View>
          </View>
        );

      case 'location':
        return (
          <View key={fieldId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>📍 {field.label || 'Location'}</Text>
            </View>
            <View style={styles.locationContainer}>
              <View style={styles.locationDisplay}>
                <Text style={styles.locationText}>
                  {field.config.locationName ? `${field.config.locationName}: ${field.config.locationType}` : 'No location set'}
                </Text>
                <Text style={styles.locationIcon}>📍</Text>
              </View>
            </View>
          </View>
        );

      case 'media':
        return (
          <View key={fieldId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>📷 {field.label || 'Media'}</Text>
            </View>
            <View style={styles.mediaContainer}>
              <TouchableOpacity
                style={styles.addMediaButton}
                onPress={() => {
                  if (isTaskCompleted) return;
                  handleAttachmentPress();
                }}
                disabled={isTaskCompleted || uploading}
              >
                {uploading ? (
                  <Text style={styles.addMediaButtonText}>Uploading...</Text>
                ) : (
                  <Text style={styles.addMediaButtonText}>+ Add Media</Text>
                )}
              </TouchableOpacity>
              
              {/* Display uploaded media attachments */}
              {mediaAttachments.map((attachment, mediaIndex) => (
                <View key={mediaIndex} style={styles.mediaPreview}>
                  {attachment.type === 'image' ? (
                    <View style={styles.mediaItemContainer}>
                      <Image 
                        source={{ uri: attachment.url }} 
                        style={styles.mediaPreviewImage}
                        resizeMode="cover"
                      />
                      <View style={styles.mediaInfo}>
                        <Text style={styles.mediaName} numberOfLines={1}>
                          {attachment.name}
                        </Text>
                        <Text style={styles.mediaSize}>
                          {formatFileSize(attachment.size)}
                        </Text>
                      </View>
                      {!isTaskCompleted && (
                        <TouchableOpacity
                          style={styles.removeMediaButton}
                          onPress={() => removeMediaAttachment(mediaIndex)}
                        >
                          <Text style={styles.removeMediaButtonText}>×</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View style={styles.mediaItemContainer}>
                      <View style={styles.documentIcon}>
                        <Text style={styles.documentIconText}>📄</Text>
                      </View>
                      <View style={styles.mediaInfo}>
                        <Text style={styles.mediaName} numberOfLines={1}>
                          {attachment.name}
                        </Text>
                        <Text style={styles.mediaSize}>
                          {formatFileSize(attachment.size)}
                        </Text>
                      </View>
                      {!isTaskCompleted && (
                        <TouchableOpacity
                          style={styles.removeMediaButton}
                          onPress={() => removeMediaAttachment(mediaIndex)}
                        >
                          <Text style={styles.removeMediaButtonText}>×</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        );

      default:
        console.log('Unknown field type:', field.type, 'Field data:', field);
        return (
          <View key={fieldId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>❓ {field.label || `Unknown Field Type: ${field.type}`}</Text>
            </View>
            <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Type: {field.type} | Options: {JSON.stringify(field.config?.options || [])}
            </Text>
          </View>
        );
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Detail Task', headerBackTitle: '' }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{task.title || 'Untitled Task'}</Text>
          <Pressable
            onPress={() => {
              if (!companyCode) {
                Alert.alert('Error', 'Company information not available. Please try again.');
                return;
              }
              
              const sopId = 'sH1NHwrn4Q55qHNJDNc8';
              
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

        {/* Linked Item Section */}
        {task.linkedItemId && (
          <View style={styles.linkedItemContainer}>
            <View style={styles.taskDetailRow}>
              <Text style={styles.taskDetailLabel}>Linked Item:</Text>
              {linkedItemLoading ? (
                <Text style={styles.linkedItemText}>Loading...</Text>
              ) : linkedItemError ? (
                <Text style={styles.linkedItemError}>{linkedItemError}</Text>
              ) : linkedItemData ? (
                <Text style={styles.linkedItemText}>
                  {linkedItemData.name || linkedItemData.title || 'Unnamed Item'}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Description Section */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>
            {task.description ? task.description : 'Description: No description.'}
          </Text>
        </View>

        {/* Task Details Section */}
        <View style={styles.taskDetailsContainer}>
          <View style={styles.taskDetailRow}>
            <Text style={styles.taskDetailLabel}>Priority:</Text>
            <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) }]}>
              <Text style={styles.priorityText}>{task.priority || 'Medium'}</Text>
            </View>
          </View>
          <View style={styles.taskDetailRow}>
            <Text style={styles.taskDetailLabel}>Status:</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) }]}>
              <Text style={styles.statusText}>{task.status || 'Active'}</Text>
            </View>
          </View>
        </View>

        {/* Dynamic Form Cards */}
        {dynamicFields.map((field, index) => renderDynamicCard(field, index))}

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



        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isTaskCompleted && styles.completedButton]}
          onPress={isTaskCompleted ? undefined : submitReport}
          disabled={isTaskCompleted}
        >
          <Text style={[styles.submitButtonText, isTaskCompleted && styles.completedButtonText]}>
            {isTaskCompleted ? 'Task Already Completed' : 'Submit Report'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
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
  descriptionContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  taskDetailsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  taskDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskDetailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 12,
    minWidth: 70,
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  linkedItemText: {
    fontSize: 16,
    color: '#1976D2',
    fontWeight: '500',
    flex: 1,
  },
  linkedItemError: {
    fontSize: 16,
    color: '#f44336',
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  companyUnitHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  rangeHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  temperatureInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  amountInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  unitInput: {
    width: 80,
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fafafa',
    marginLeft: 12,
  },
  textInput: {
    height: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fafafa',
    textAlignVertical: 'top',
  },
  numericInput: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 18,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  unitContainer: {
    flexDirection: 'row',
    marginLeft: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  unitButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#1976D2',
    borderRadius: 8,
  },
  unitButtonActive: {
    backgroundColor: '#1976D2',
  },
  unitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  unitButtonTextActive: {
    color: '#fff',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
  },
  checkboxUnchecked: {
    backgroundColor: '#fff',
    borderColor: '#ddd',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  radio: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioChecked: {
    borderColor: '#1976D2',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1976D2',
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
  },
  productSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fafafa',
  },
  productText: {
    fontSize: 16,
    color: '#333',
  },
  productPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
  },
  locationInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  mediaButton: {
    height: 48,
    borderWidth: 2,
    borderColor: '#1976D2',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f8ff',
  },
  mediaButtonText: {
    fontSize: 16,
    color: '#1976D2',
    fontWeight: '600',
  },
  mediaList: {
    marginTop: 8,
  },
  valueDisplay: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  multipleContainer: {
    flexDirection: 'column',
    marginTop: 8,
  },
  multipleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  multipleOptionSelected: {
    backgroundColor: '#1976D2',
  },
  multipleOptionText: {
    fontSize: 16,
    color: '#333',
  },
  multipleOptionTextSelected: {
    color: '#fff',
  },
  singleContainer: {
    flexDirection: 'column',
    marginTop: 8,
  },
  singleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  singleOptionSelected: {
    backgroundColor: '#1976D2',
  },
  singleOptionText: {
    fontSize: 16,
    color: '#333',
  },
  singleOptionTextSelected: {
    color: '#fff',
  },
  productInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  mediaContainer: {
    marginTop: 8,
  },
  addMediaButton: {
    height: 48,
    borderWidth: 2,
    borderColor: '#1976D2',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f8ff',
  },
  addMediaButtonText: {
    fontSize: 16,
    color: '#1976D2',
    fontWeight: '600',
  },
  mediaPreview: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  locationContainer: {
    marginTop: 8,
    paddingHorizontal: 12,
  },
  locationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
  },
  locationText: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  locationIcon: {
    fontSize: 18,
    color: '#E53935',
  },
  valueDisplayContainer: {
    marginTop: 8,
  },
  convertedValueDisplay: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  linkedItemContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  linkedItemLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  selectionCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  selectAllContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
  },
  selectAllText: {
    fontSize: 16,
    color: '#1976D2',
    fontWeight: '600',
    marginLeft: 8,
  },
  saveDraftButton: {
    backgroundColor: '#ff9800',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 20,
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
  // Task completion status styles
  completionStatusContainer: {
    backgroundColor: '#e8f5e8',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
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
    color: '#388e3c',
  },
  // Completed button styles
  completedButton: {
    backgroundColor: '#9e9e9e',
  },
  completedButtonText: {
    color: '#fff',
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
  // Media attachment styles
  mediaItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
  },
  mediaPreviewImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 8,
  },
  mediaInfo: {
    flex: 1,
  },
  mediaName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  mediaSize: {
    fontSize: 12,
    color: '#666',
  },
  removeMediaButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  removeMediaButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  documentIcon: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  documentIconText: {
    fontSize: 24,
  },
}); 