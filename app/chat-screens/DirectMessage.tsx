import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { auth, db } from '../../firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import FilePicker from '../../components/FilePicker';
import MessageAttachment from '../../components/MessageAttachment';
import { uploadFile } from '../../utils/fileUpload';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: any;
  type: 'text' | 'image' | 'document';
  attachments?: any[];
}

export default function DirectMessageScreen() {
  const router = useRouter();
  const { otherUserId, otherUserName, companyCode } = useLocalSearchParams();
  const currentUser = auth.currentUser;

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const conversationId = [currentUser?.uid, otherUserId].sort().join('_');

  useEffect(() => {
    if (!currentUser || !companyCode) return;

    const messagesQuery = query(
      collection(db, 'companies', companyCode as string, 'conversations', conversationId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));

      setMessages(messagesList);
      
      // Scroll to bottom when new messages arrive
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return unsubscribe;
  }, [currentUser, companyCode, conversationId]);

  const createConversation = async () => {
    if (!currentUser || !companyCode) return;

    const conversationRef = doc(db, 'companies', companyCode as string, 'conversations', conversationId);
    
    await setDoc(conversationRef, {
      participants: [currentUser.uid, otherUserId],
      participantNames: {
        [currentUser.uid]: currentUser.displayName || currentUser.email,
        [otherUserId as string]: otherUserName,
      },
      createdAt: serverTimestamp(),
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      unreadCount: {
        [currentUser.uid]: 0,
        [otherUserId as string]: 0,
      },
    }, { merge: true });
  };

  const sendMessage = async (attachments?: any[]) => {
    if ((!newMessage.trim() && !attachments) || !currentUser || !companyCode) return;

    try {
      // Create conversation if it doesn't exist
      await createConversation();

      // Add message
      const messagesRef = collection(db, 'companies', companyCode as string, 'conversations', conversationId, 'messages');
      
      const messageData: any = {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        timestamp: serverTimestamp(),
      };

      if (attachments && attachments.length > 0) {
        messageData.type = attachments[0].type;
        messageData.text = newMessage.trim() || `Shared ${attachments.length} file(s)`;
        messageData.attachments = attachments;
      } else {
        messageData.type = 'text';
        messageData.text = newMessage.trim();
      }

      await addDoc(messagesRef, messageData);

      // Update conversation metadata
      const conversationRef = doc(db, 'companies', companyCode as string, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        lastMessage: messageData.text,
        lastMessageTime: serverTimestamp(),
        lastMessageSender: currentUser.uid,
        [`unreadCount.${otherUserId}`]: messages.length + 1
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleFileSelected = async (file: {
    uri: string;
    name: string;
    mimeType: string;
    size: number;
  }) => {
    if (!currentUser || !companyCode) return;

    setUploading(true);
    
    try {
      // Generate message ID for file naming
      const messageId = Date.now().toString();
      
      // Upload file
      const uploadResult = await uploadFile(
        file.uri,
        file.name,
        file.mimeType,
        companyCode as string,
        'conversations',
        conversationId,
        messageId
      );

      // Create attachment object
      const attachment = {
        type: file.mimeType.startsWith('image/') ? 'image' : 'document',
        fileName: file.name,
        fileSize: file.size,
        downloadURL: uploadResult.downloadURL,
        storagePath: uploadResult.storagePath,
        mimeType: file.mimeType,
      };

      // Send message with attachment
      await sendMessage([attachment]);

    } catch (error) {
      console.error('Error uploading file:', error);
      Alert.alert('Error', 'Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate();
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isCurrentUser = item.senderId === currentUser?.uid;
    
    return (
      <View style={[
        styles.messageContainer,
        isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage
      ]}>
        {!isCurrentUser && (
          <Text style={styles.senderName}>{item.senderName}</Text>
        )}
        
        {/* Render attachments */}
        {item.attachments && item.attachments.map((attachment, index) => (
          <MessageAttachment
            key={index}
            attachment={attachment}
            isCurrentUser={isCurrentUser}
          />
        ))}
        
        {/* Render text if present */}
        {item.text && (
          <Text style={[
            styles.messageText,
            isCurrentUser ? styles.currentUserText : styles.otherUserText
          ]}>
            {item.text}
          </Text>
        )}
        
        <Text style={[
          styles.messageTime,
          isCurrentUser ? styles.currentUserTime : styles.otherUserTime
        ]}>
          {formatTime(item.timestamp)}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{otherUserName}</Text>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView 
        style={styles.messagesContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <FilePicker 
            onFileSelected={handleFileSelected}
            disabled={uploading}
          />
          <TextInput
            style={styles.textInput}
            placeholder={uploading ? 'Uploading...' : `Message ${otherUserName}...`}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
            editable={!uploading}
          />
          <TouchableOpacity
            style={[styles.sendButton, { opacity: (newMessage.trim() && !uploading) ? 1 : 0.5 }]}
            onPress={() => sendMessage()}
            disabled={!newMessage.trim() || uploading}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#007AFF',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  currentUserMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    padding: 12,
  },
  otherUserMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 12,
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  currentUserText: {
    color: '#fff',
  },
  otherUserText: {
    color: '#000',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  currentUserTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  otherUserTime: {
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 100,
    marginHorizontal: 8,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});