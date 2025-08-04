import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { getFirestore, getDocs, collection, doc, getDoc } from 'firebase/firestore';
import { app } from '../../firebase';

type DetailTaskScreenRouteProp = {
  params: {
    task: string;
  };
};

export default function DetailTaskScreen() {
  const route = useRoute<RouteProp<DetailTaskScreenRouteProp, 'params'>>();
  const task = JSON.parse(route.params.task);
  const router = useRouter();
  const [companyCode, setCompanyCode] = useState<string | null>(null);
  
  // Media state
  const [mediaAttachments, setMediaAttachments] = useState<string[]>([]);
  
    // Linked Item state
  const [linkedItemData, setLinkedItemData] = useState<any>(null);
  const [linkedItemLoading, setLinkedItemLoading] = useState(false);
  const [linkedItemError, setLinkedItemError] = useState<string | null>(null);

  // Dynamic fields state
  const [dynamicFields, setDynamicFields] = useState<any[]>([]);
  const [dynamicFieldValues, setDynamicFieldValues] = useState<{[key: string]: any}>({});

  const db = getFirestore(app);

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
    }
  }, [companyCode]);

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

  const addMediaAttachment = () => {
    Alert.alert('Media Attachment', 'Camera/Gallery functionality would be implemented here');
  };

  // Function to update a specific field value
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
        return (
          <View key={fieldId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>🌡️ {field.label || 'Temperature'}</Text>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.temperatureInput}
                placeholder="Enter temperature..."
                value={fieldValue.temperature || ''}
                onChangeText={(value) => updateFieldValue(fieldId, {
                  ...fieldValue,
                  temperature: value
                })}
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
              <View style={styles.unitContainer}>
                <TouchableOpacity
                  style={[styles.unitButton, (fieldValue.temperatureUnit || '°C') === '°C' && styles.unitButtonActive]}
                  onPress={() => updateFieldValue(fieldId, {
                    ...fieldValue,
                    temperatureUnit: '°C'
                  })}
                >
                  <Text style={[styles.unitButtonText, (fieldValue.temperatureUnit || '°C') === '°C' && styles.unitButtonTextActive]}>°C</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.unitButton, (fieldValue.temperatureUnit || '°C') === '°F' && styles.unitButtonActive]}
                  onPress={() => updateFieldValue(fieldId, {
                    ...fieldValue,
                    temperatureUnit: '°F'
                  })}
                >
                  <Text style={[styles.unitButtonText, (fieldValue.temperatureUnit || '°C') === '°F' && styles.unitButtonTextActive]}>°F</Text>
                </TouchableOpacity>
              </View>
            </View>
            {fieldValue.temperature && (
              <Text style={styles.valueDisplay}>
                Current Value: {fieldValue.temperature} {fieldValue.temperatureUnit || '°C'}
              </Text>
            )}
          </View>
        );

      case 'amount':
        return (
          <View key={fieldId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>📊 {field.label || 'Amount'}</Text>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.amountInput}
                placeholder="Enter amount..."
                value={fieldValue.amount || ''}
                onChangeText={(value) => updateFieldValue(fieldId, {
                  ...fieldValue,
                  amount: value
                })}
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>
          </View>
        );

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
              />
            </View>
          </View>
        );

      case 'multiple':
        return (
          <View key={fieldId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>☑️ {field.label || 'Multiple Choice'}</Text>
            </View>
            <View style={styles.multipleContainer}>
              {(field.options || []).map((option: string, optionIndex: number) => (
                <TouchableOpacity
                  key={optionIndex}
                  style={[
                    styles.multipleOption,
                    (fieldValue.selectedOptions || {})[option] && styles.multipleOptionSelected
                  ]}
                  onPress={() => {
                    const currentOptions = fieldValue.selectedOptions || {};
                    updateFieldValue(fieldId, {
                      ...fieldValue,
                      selectedOptions: {
                        ...currentOptions,
                        [option]: !currentOptions[option]
                      }
                    });
                  }}
                >
                  <Text style={[
                    styles.multipleOptionText,
                    (fieldValue.selectedOptions || {})[option] && styles.multipleOptionTextSelected
                  ]}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'single':
        return (
          <View key={fieldId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>⭕ {field.label || 'Single Choice'}</Text>
            </View>
            <View style={styles.singleContainer}>
              {(field.options || []).map((option: string, optionIndex: number) => (
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
                  Alert.alert('Media Attachment', 'Camera/Gallery functionality would be implemented here');
                  updateFieldValue(fieldId, {
                    ...fieldValue,
                    mediaAttachments: [...(fieldValue.mediaAttachments || []), 'new_media_url']
                  });
                }}
              >
                <Text style={styles.addMediaButtonText}>+ Add Media</Text>
              </TouchableOpacity>
              {(fieldValue.mediaAttachments || []).map((media: string, mediaIndex: number) => (
                <View key={mediaIndex} style={styles.mediaPreview}>
                  <Text>Media {mediaIndex + 1}</Text>
                </View>
              ))}
            </View>
          </View>
        );

      default:
        return (
          <View key={fieldId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>❓ {field.label || `Unknown Field Type: ${field.type}`}</Text>
            </View>
          </View>
        );
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Detail Task' }} />
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
          {task.linkedItemId && (
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
          )}
        </View>
        </View>

        {/* Dynamic Form Cards */}
        {dynamicFields.map((field, index) => renderDynamicCard(field, index))}

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.submitButton}
          onPress={() => Alert.alert('Submit', 'Data collection completed!')}
        >
          <Text style={styles.submitButtonText}>Submit Data</Text>
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
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
  },
  unitButtonActive: {
    backgroundColor: '#1976D2',
  },
  unitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
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
}); 