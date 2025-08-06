import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { formatFileSize } from '../utils/fileUpload';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface Attachment {
  type: 'image' | 'document';
  fileName: string;
  fileSize: number;
  downloadURL: string;
  mimeType: string;
  thumbnailURL?: string;
}

interface MessageAttachmentProps {
  attachment: Attachment;
  isCurrentUser: boolean;
}

export default function MessageAttachment({ attachment, isCurrentUser }: MessageAttachmentProps) {
  const downloadFile = async () => {
    try {
      const fileUri = FileSystem.documentDirectory + attachment.fileName;
      
      // Download the file
      const { uri } = await FileSystem.downloadAsync(attachment.downloadURL, fileUri);
      
      // Share or open the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Success', 'File downloaded to device');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      Alert.alert('Error', 'Failed to download file');
    }
  };

  const openFile = async () => {
    try {
      const supported = await Linking.canOpenURL(attachment.downloadURL);
      if (supported) {
        await Linking.openURL(attachment.downloadURL);
      } else {
        downloadFile();
      }
    } catch (error) {
      console.error('Error opening file:', error);
      downloadFile();
    }
  };

  if (attachment.type === 'image') {
    return (
      <TouchableOpacity 
        style={[
          styles.imageContainer,
          isCurrentUser ? styles.currentUserAttachment : styles.otherUserAttachment
        ]}
        onPress={openFile}
      >
        <Image
          source={{ uri: attachment.downloadURL }}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={styles.imageOverlay}>
          <Text style={styles.fileName}>{attachment.fileName}</Text>
          <Text style={styles.fileSize}>{formatFileSize(attachment.fileSize)}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Document attachment
  const getDocumentIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return '📊';
    if (mimeType.includes('text')) return '📃';
    return '📎';
  };

  return (
    <TouchableOpacity
      style={[
        styles.documentContainer,
        isCurrentUser ? styles.currentUserAttachment : styles.otherUserAttachment
      ]}
      onPress={downloadFile}
    >
      <View style={styles.documentInfo}>
        <Text style={styles.documentIcon}>{getDocumentIcon(attachment.mimeType)}</Text>
        <View style={styles.documentDetails}>
          <Text style={[
            styles.documentName,
            isCurrentUser ? styles.currentUserText : styles.otherUserText
          ]} numberOfLines={1}>
            {attachment.fileName}
          </Text>
          <Text style={[
            styles.documentSize,
            isCurrentUser ? styles.currentUserSubtext : styles.otherUserSubtext
          ]}>
            {formatFileSize(attachment.fileSize)}
          </Text>
        </View>
      </View>
      <View style={[
        styles.downloadButton,
        isCurrentUser ? styles.currentUserDownloadButton : styles.otherUserDownloadButton
      ]}>
        <Text style={[
          styles.downloadText,
          isCurrentUser ? styles.currentUserText : styles.otherUserText
        ]}>⬇</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 4,
    maxWidth: 250,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 200,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
  },
  fileName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  fileSize: {
    color: '#fff',
    fontSize: 10,
    opacity: 0.8,
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginVertical: 4,
    maxWidth: 280,
  },
  currentUserAttachment: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  otherUserAttachment: {
    backgroundColor: '#f0f0f0',
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  documentIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  documentDetails: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  documentSize: {
    fontSize: 12,
  },
  downloadButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  currentUserDownloadButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  otherUserDownloadButton: {
    backgroundColor: '#e0e0e0',
  },
  downloadText: {
    fontSize: 16,
  },
  currentUserText: {
    color: '#fff',
  },
  otherUserText: {
    color: '#333',
  },
  currentUserSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  otherUserSubtext: {
    color: '#666',
  },
});