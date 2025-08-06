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