import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { getFirestore, getDocs, collection } from 'firebase/firestore';
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
  
  // Temperature state
  const [temperature, setTemperature] = useState<string>('');
  const [temperatureUnit, setTemperatureUnit] = useState<'°C' | '°F'>('°C');
  
  // Amount state
  const [amount, setAmount] = useState<string>('');
  const [amountUnit, setAmountUnit] = useState<string>('units');
  
  // Text state
  const [textInput, setTextInput] = useState<string>('');
  
  // Numeric Value state
  const [numericValue, setNumericValue] = useState<string>('');
  
  // Multiple Answers state
  const [multipleAnswers, setMultipleAnswers] = useState<{[key: string]: boolean}>({
    'Option 1': false,
    'Option 2': false,
    'Option 3': false,
  });
  
  // One Answer state
  const [oneAnswer, setOneAnswer] = useState<string>('');
  
  // Product state
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  
  // Location state
  const [location, setLocation] = useState<string>('');
  
  // Media state
  const [mediaAttachments, setMediaAttachments] = useState<string[]>([]);
  
  const db = getFirestore(app);

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

  const toggleMultipleAnswer = (option: string) => {
    setMultipleAnswers(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  const addMediaAttachment = () => {
    Alert.alert('Media Attachment', 'Camera/Gallery functionality would be implemented here');
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

        {/* Temperature Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🌡️ Temperature</Text>
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.temperatureInput}
              placeholder="Enter temperature..."
              value={temperature}
              onChangeText={setTemperature}
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
            <View style={styles.unitContainer}>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  temperatureUnit === '°C' && styles.unitButtonActive
                ]}
                onPress={() => setTemperatureUnit('°C')}
              >
                <Text style={[
                  styles.unitButtonText,
                  temperatureUnit === '°C' && styles.unitButtonTextActive
                ]}>°C</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  temperatureUnit === '°F' && styles.unitButtonActive
                ]}
                onPress={() => setTemperatureUnit('°F')}
              >
                <Text style={[
                  styles.unitButtonText,
                  temperatureUnit === '°F' && styles.unitButtonTextActive
                ]}>°F</Text>
              </TouchableOpacity>
            </View>
          </View>
          {temperature && (
            <Text style={styles.valueDisplay}>
              Current Value: {temperature} {temperatureUnit}
            </Text>
          )}
        </View>

        {/* Amount Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📊 Amount</Text>
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.amountInput}
              placeholder="Enter amount..."
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
            <TextInput
              style={styles.unitInput}
              placeholder="units"
              value={amountUnit}
              onChangeText={setAmountUnit}
              placeholderTextColor="#999"
            />
          </View>
          {amount && (
            <Text style={styles.valueDisplay}>
              Current Value: {amount} {amountUnit}
            </Text>
          )}
        </View>

        {/* Text Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📝 Text</Text>
          </View>
          <TextInput
            style={styles.textInput}
            placeholder="Enter text here..."
            value={textInput}
            onChangeText={setTextInput}
            multiline
            numberOfLines={4}
            placeholderTextColor="#999"
          />
          {textInput && (
            <Text style={styles.valueDisplay}>
              Current Value: {textInput.length > 50 ? textInput.substring(0, 50) + '...' : textInput}
            </Text>
          )}
        </View>

        {/* Numeric Value Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🔢 Numeric Value</Text>
          </View>
          <TextInput
            style={styles.numericInput}
            placeholder="Enter numeric value..."
            value={numericValue}
            onChangeText={setNumericValue}
            keyboardType="numeric"
            placeholderTextColor="#999"
          />
          {numericValue && (
            <Text style={styles.valueDisplay}>
              Current Value: {numericValue}
            </Text>
          )}
        </View>

        {/* Multiple Answers Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>✅ Multiple Answers</Text>
          </View>
          {Object.keys(multipleAnswers).map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.checkboxContainer}
              onPress={() => toggleMultipleAnswer(option)}
            >
              <View style={[
                styles.checkbox,
                multipleAnswers[option] && styles.checkboxChecked
              ]}>
                {multipleAnswers[option] && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>{option}</Text>
            </TouchableOpacity>
          ))}
          {Object.values(multipleAnswers).some(Boolean) && (
            <Text style={styles.valueDisplay}>
              Selected: {Object.keys(multipleAnswers).filter(key => multipleAnswers[key]).join(', ')}
            </Text>
          )}
        </View>

        {/* One Answer Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>☑️ One Answer</Text>
          </View>
          {['Option A', 'Option B', 'Option C'].map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.radioContainer}
              onPress={() => setOneAnswer(option)}
            >
              <View style={[
                styles.radio,
                oneAnswer === option && styles.radioChecked
              ]}>
                {oneAnswer === option && <View style={styles.radioDot} />}
              </View>
              <Text style={styles.radioLabel}>{option}</Text>
            </TouchableOpacity>
          ))}
          {oneAnswer && (
            <Text style={styles.valueDisplay}>
              Selected: {oneAnswer}
            </Text>
          )}
        </View>

        {/* Product Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🏷️ Product</Text>
          </View>
          <TouchableOpacity
            style={styles.productSelector}
            onPress={() => Alert.alert('Product Selection', 'Product picker would be implemented here')}
          >
            <Text style={selectedProduct ? styles.productText : styles.productPlaceholder}>
              {selectedProduct || 'Select a product...'}
            </Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
          {selectedProduct && (
            <Text style={styles.valueDisplay}>
              Selected: {selectedProduct}
            </Text>
          )}
        </View>

        {/* Location Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📍 Location</Text>
          </View>
          <TextInput
            style={styles.locationInput}
            placeholder="Enter location..."
            value={location}
            onChangeText={setLocation}
            placeholderTextColor="#999"
          />
          {location && (
            <Text style={styles.valueDisplay}>
              Current Value: {location}
            </Text>
          )}
        </View>

        {/* Media Attachment Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📎 Media Attachment</Text>
          </View>
          <TouchableOpacity
            style={styles.mediaButton}
            onPress={addMediaAttachment}
          >
            <Text style={styles.mediaButtonText}>📷 Add Photo/Video</Text>
          </TouchableOpacity>
          {mediaAttachments.length > 0 && (
            <View style={styles.mediaList}>
              <Text style={styles.valueDisplay}>
                Attachments: {mediaAttachments.length} file(s)
              </Text>
            </View>
          )}
        </View>

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
}); 