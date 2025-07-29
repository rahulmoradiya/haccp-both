import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Linking, Alert, Image, Dimensions, Modal } from 'react-native';
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

const { width, height } = Dimensions.get('window');

export default function SOPDetailScreen() {
  const route = useRoute<RouteProp<SOPDetailScreenRouteProp, 'params'>>();
  const { companyCode, sopId } = route.params;
  console.log('SOPDetailScreen params:', { companyCode, sopId });
  const db = getFirestore(app);
  const [sop, setSop] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageModalVisible, setImageModalVisible] = useState(false);

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

  const handleFileDownload = async (fileUrl: string, fileName: string) => {
    try {
      const supported = await Linking.canOpenURL(fileUrl);
      if (supported) {
        await Linking.openURL(fileUrl);
      } else {
        Alert.alert('Error', 'Cannot open this file type');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open file');
    }
  };

  const isImageFile = (fileName: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const lowerFileName = fileName.toLowerCase();
    return imageExtensions.some(ext => lowerFileName.endsWith(ext));
  };

  const getFileIcon = (fileName: string) => {
    const lowerFileName = fileName.toLowerCase();
    if (lowerFileName.endsWith('.pdf')) return '📄';
    if (lowerFileName.endsWith('.doc') || lowerFileName.endsWith('.docx')) return '📝';
    if (lowerFileName.endsWith('.xls') || lowerFileName.endsWith('.xlsx')) return '📊';
    if (lowerFileName.endsWith('.ppt') || lowerFileName.endsWith('.pptx')) return '📈';
    if (lowerFileName.endsWith('.txt')) return '📄';
    if (isImageFile(fileName)) return '🖼️';
    return '📎';
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'SOP Details' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976D2" />
          <Text style={styles.loadingText}>Loading SOP...</Text>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: 'SOP Details' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Error Loading SOP</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => window.location.reload()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'SOP Details' }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {sop ? (
          <>
            {/* Header Section */}
            <View style={styles.headerCard}>
              <Text style={styles.title}>{sop.title || 'Untitled SOP'}</Text>
              <View style={styles.versionContainer}>
                <Text style={styles.version}>Version: {sop.version || 'N/A'}</Text>
                {sop.department && sop.department.trim() !== '' && (
                  <View style={styles.departmentBadge}>
                    <Text style={styles.departmentText}>{sop.department}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Description Section */}
            {sop.description && sop.description.trim() !== '' && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.description}>{sop.description}</Text>
              </View>
            )}

            {/* File Attachment Section */}
            {sop.fileUrl && sop.fileUrl.trim() !== '' && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Attachments</Text>
                
                {/* Image Preview for Image Files */}
                {isImageFile(sop.fileName || '') && (
                  <View style={styles.imageContainer}>
                    <TouchableOpacity 
                      onPress={() => setImageModalVisible(true)}
                      style={styles.imageTouchable}
                      activeOpacity={0.8}
                    >
                      <Image 
                        source={{ uri: sop.fileUrl }}
                        style={styles.imagePreview}
                        resizeMode="cover"
                        onError={(error) => console.log('Image loading error:', error)}
                        onLoad={() => console.log('Image loaded successfully')}
                      />
                      <View style={styles.imageOverlay}>
                        <Text style={styles.tapToViewText}>Tap to view full screen</Text>
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.imageCaption}>
                      {sop.fileName || 'SOP Image'}
                    </Text>
                  </View>
                )}

                {/* File Download Button for Non-Image Files */}
                {!isImageFile(sop.fileName || '') && (
                  <TouchableOpacity 
                    style={styles.fileButton}
                    onPress={() => handleFileDownload(sop.fileUrl, sop.fileName || 'SOP File')}
                  >
                    <Text style={styles.fileIcon}>{getFileIcon(sop.fileName || '')}</Text>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileName}>{sop.fileName || 'SOP Document'}</Text>
                      <Text style={styles.fileSubtext}>Tap to download</Text>
                    </View>
                    <Text style={styles.downloadIcon}>⬇️</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Metadata Section */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Details</Text>
              
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Created:</Text>
                <Text style={styles.metadataValue}>{formatDate(sop.createdAt)}</Text>
              </View>

              {sop.assignedRoles && sop.assignedRoles.length > 0 && (
                <View style={styles.metadataRow}>
                  <Text style={styles.metadataLabel}>Assigned Roles:</Text>
                  <View style={styles.tagsContainer}>
                    {sop.assignedRoles.map((role: string, index: number) => (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>{role}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {sop.assignedUsers && sop.assignedUsers.length > 0 && (
                <View style={styles.metadataRow}>
                  <Text style={styles.metadataLabel}>Assigned Users:</Text>
                  <View style={styles.tagsContainer}>
                    {sop.assignedUsers.map((user: string, index: number) => (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>{user}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Full Screen Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalCloseButton}
            onPress={() => setImageModalVisible(false)}
            activeOpacity={0.7}
          >
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.fullScreenImageContainer}
            onPress={() => setImageModalVisible(false)}
            activeOpacity={1}
          >
            <Image 
              source={{ uri: sop?.fileUrl }}
              style={styles.fullScreenImage}
              resizeMode="contain"
              onError={(error) => {
                console.log('Full screen image error:', error);
                Alert.alert('Error', 'Failed to load image in full screen');
              }}
            />
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  headerCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 12,
  },
  versionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  version: {
    fontSize: 16,
    color: '#666',
  },
  departmentBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  departmentText: {
    color: '#1976D2',
    fontWeight: '600',
    fontSize: 14,
  },
  sectionCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  imageContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  imageTouchable: {
    width: width - 72, // Account for container padding
    height: 200,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    position: 'relative',
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  tapToViewText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  imageCaption: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  fileIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  fileSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  downloadIcon: {
    fontSize: 18,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  metadataLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    width: 120,
    marginRight: 12,
  },
  metadataValue: {
    fontSize: 16,
    color: '#555',
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  tag: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  tagText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  fullScreenImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
    maxWidth: width,
    maxHeight: height,
  },
}); 