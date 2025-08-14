import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import * as FileSystem from 'expo-file-system';

export interface FileUploadResult {
  downloadURL: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export const uploadFile = async (
  uri: string,
  fileName: string,
  mimeType: string,
  companyCode: string,
  chatType: 'conversations' | 'groups',
  chatId: string,
  messageId: string
): Promise<FileUploadResult> => {
  try {
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(uri);
    const fileSize = fileInfo.size || 0;

    // Validate file size (max 10MB)
    if (fileSize > 10 * 1024 * 1024) {
      throw new Error('File size must be less than 10MB');
    }

    // Determine file category
    const isImage = mimeType.startsWith('image/');
    const category = isImage ? 'images' : 'documents';

    // Create storage path
    const timestamp = Date.now();
    const fileExtension = fileName.split('.').pop() || '';
    const storagePath = `companies/${companyCode}/chat-media/${chatType}/${chatId}/${category}/${messageId}_${timestamp}.${fileExtension}`;

    // Create storage reference
    const storageRef = ref(storage, storagePath);

    // Convert URI to blob
    const response = await fetch(uri);
    const blob = await response.blob();

    // Upload file
    const snapshot = await uploadBytes(storageRef, blob, {
      contentType: mimeType,
    });

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      downloadURL,
      storagePath,
      fileName,
      fileSize,
      mimeType
    };

  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

export const uploadTaskFile = async (
  uri: string,
  fileName: string,
  mimeType: string,
  companyCode: string,
  taskId: string,
  fieldId: string
): Promise<FileUploadResult> => {
  try {
    console.log('🚀 Starting task file upload:', { uri, fileName, mimeType, companyCode, taskId, fieldId });
    
    // Test if storage is properly initialized
    console.log('🔧 Storage object:', storage);
    console.log('🔧 Storage app:', storage.app);
    
    // Check authentication
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    const currentUser = auth.currentUser;
    console.log('👤 Current user:', currentUser?.uid);
    
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(uri);
    const fileSize = fileInfo.size || 0;
    console.log('📁 File info:', { fileSize, exists: fileInfo.exists, uri: fileInfo.uri });

    // Validate file size (max 10MB)
    if (fileSize > 10 * 1024 * 1024) {
      throw new Error('File size must be less than 10MB');
    }

    // Determine file category
    const isImage = mimeType.startsWith('image/');
    const category = isImage ? 'images' : 'documents';

    // Create storage path for task media - using a simple root path for testing
    const timestamp = Date.now();
    const fileExtension = fileName.split('.').pop() || '';
    const storagePath = `test-${timestamp}-${fileName}`;
    console.log('📂 Storage path:', storagePath);

    // Create storage reference
    const storageRef = ref(storage, storagePath);
    console.log('🔗 Storage reference created');
    console.log('🔗 Storage bucket:', storageRef.bucket);
    console.log('🔗 Storage full path:', storageRef.fullPath);

    // Convert URI to blob
    console.log('🔄 Converting URI to blob...');
    const response = await fetch(uri);
    console.log('📡 Fetch response status:', response.status);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();
    console.log('📦 Blob created:', { size: blob.size, type: blob.type });
    if (blob.size === 0) {
      throw new Error('Blob is empty');
    }

    // Upload file
    console.log('⬆️ Starting upload...');
    const snapshot = await uploadBytes(storageRef, blob, {
      contentType: mimeType,
    });
    console.log('✅ Upload successful:', snapshot.metadata);

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('🔗 Download URL obtained:', downloadURL);

    return {
      downloadURL,
      storagePath,
      fileName,
      fileSize,
      mimeType
    };

  } catch (error) {
    console.error('Error uploading task file:', error);
    console.error('Error details:', {
      code: (error as any)?.code,
      message: (error as any)?.message,
      serverResponse: (error as any)?.serverResponse,
      name: (error as any)?.name
    });
    throw error;
  }
};

export const validateFileType = (mimeType: string): boolean => {
  const allowedTypes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ];

  return allowedTypes.includes(mimeType);
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};