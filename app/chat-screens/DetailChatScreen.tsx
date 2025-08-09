import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { auth, db } from '../../firebase';
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  limit,
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { uploadFile, validateFileType, formatFileSize } from '../../utils/fileUpload';

interface Attachment {
  type: 'image' | 'document';
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: any;
  attachments?: Attachment[];
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

export default function DetailChatScreen() {
  const router = useRouter();
  const { chatId, type, chatName, companyCode, otherUserId } = useLocalSearchParams<{
    chatId: string;
    type: 'direct' | 'group';
    chatName: string;
    companyCode: string;
    otherUserId?: string;
  }>();
  const currentUser = auth.currentUser;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  const MESSAGES_PER_PAGE = 20;

  // Load initial messages with pagination
  const loadInitialMessages = async () => {
    if (!chatId || !companyCode) return;

    try {
      const messagesRef = collection(db, 'companies', companyCode, type === 'direct' ? 'conversations' : 'groups', chatId, 'messages');
      const messagesQuery = query(
        messagesRef, 
        orderBy('timestamp', 'desc'), 
        limit(MESSAGES_PER_PAGE)
      );

      const snapshot = await getDocs(messagesQuery);
      const messageList: Message[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text || '',
          senderId: data.senderId,
          senderName: data.senderName,
          timestamp: data.timestamp,
          attachments: data.attachments || [],
          status: data.status || 'sent',
        };
      }).reverse(); // Reverse to show oldest first

      setMessages(messageList);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMoreMessages(snapshot.docs.length === MESSAGES_PER_PAGE);
      setLoading(false);

      // Mark messages as read
      markMessagesAsRead();
    } catch (error) {
      console.error('Error loading initial messages:', error);
      setLoading(false);
    }
  };

  // Load older messages
  const loadOlderMessages = async () => {
    if (!chatId || !companyCode || !lastVisible || !hasMoreMessages || loadingOlder) return;

    try {
      setLoadingOlder(true);
      const messagesRef = collection(db, 'companies', companyCode, type === 'direct' ? 'conversations' : 'groups', chatId, 'messages');
      const messagesQuery = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        startAfter(lastVisible),
        limit(MESSAGES_PER_PAGE)
      );

      const snapshot = await getDocs(messagesQuery);
      const olderMessages: Message[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text || '',
          senderId: data.senderId,
          senderName: data.senderName,
          timestamp: data.timestamp,
          attachments: data.attachments || [],
          status: data.status || 'sent',
        };
      }).reverse();

      setMessages(prev => [...olderMessages, ...prev]);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1] || lastVisible);
      setHasMoreMessages(snapshot.docs.length === MESSAGES_PER_PAGE);
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setLoadingOlder(false);
    }
  };

  // Listen to new messages (real-time)
  useEffect(() => {
    if (!chatId || !companyCode) return;

    // Load initial messages
    loadInitialMessages();

    // Set up real-time listener for new messages only
    const messagesRef = collection(db, 'companies', companyCode, type === 'direct' ? 'conversations' : 'groups', chatId, 'messages');
    const realtimeQuery = query(
      messagesRef,
      orderBy('timestamp', 'desc'),
      limit(5) // Only listen to the most recent messages
    );

    const unsubscribe = onSnapshot(realtimeQuery, (snapshot) => {
      if (messages.length === 0) return; // Skip if initial load hasn't completed

      const newMessages: Message[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const message = {
          id: doc.id,
          text: data.text || '',
          senderId: data.senderId,
          senderName: data.senderName,
          timestamp: data.timestamp,
          attachments: data.attachments || [],
          status: data.status || 'sent',
        };

        // Only add if it's not already in our messages
        if (!messages.find(m => m.id === message.id)) {
          newMessages.push(message);
        }
      });

      if (newMessages.length > 0) {
        setMessages(prev => [...prev, ...newMessages.reverse()]);
        markMessagesAsRead();
      }
    });

    return () => unsubscribe();
  }, [chatId, companyCode, type]);

  // Mark messages as read
  const markMessagesAsRead = async () => {
    if (!currentUser || !chatId || !companyCode) return;

    try {
      const chatRef = doc(db, 'companies', companyCode, type === 'direct' ? 'conversations' : 'groups', chatId);
      await updateDoc(chatRef, {
        [`unreadCount.${currentUser.uid}`]: 0,
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Typing indicator functions
  const setTypingStatus = async (typing: boolean) => {
    if (!currentUser || !chatId || !companyCode) return;

    try {
      const typingRef = doc(db, 'companies', companyCode, 'typing', `${chatId}_${currentUser.uid}`);
      
      if (typing) {
        await setDoc(typingRef, {
          chatId,
          userId: currentUser.uid,
          userName: currentUser.displayName || currentUser.email,
          timestamp: serverTimestamp(),
        });
      } else {
        await deleteDoc(typingRef);
      }
    } catch (error) {
      console.error('Error setting typing status:', error);
    }
  };

  // Listen to typing indicators
  useEffect(() => {
    if (!chatId || !companyCode || !currentUser) return;

    const typingRef = collection(db, 'companies', companyCode, 'typing');
    const typingQuery = query(typingRef);

    const unsubscribe = onSnapshot(typingQuery, (snapshot) => {
      const typingUsers = snapshot.docs
        .map(doc => doc.data())
        .filter(data => 
          data.chatId === chatId && 
          data.userId !== currentUser.uid &&
          data.timestamp && 
          // Only consider recent typing (within 5 seconds)
          Date.now() - data.timestamp.toMillis() < 5000
        );

      setOtherUserTyping(typingUsers.length > 0);
    });

    return () => unsubscribe();
  }, [chatId, companyCode, currentUser]);

  // Handle text input changes for typing indicator
  const handleTextChange = (text: string) => {
    setNewMessage(text);
    
    if (!isTyping && text.length > 0) {
      setIsTyping(true);
      setTypingStatus(true);
      
      // Clear typing status after 3 seconds of no typing
      setTimeout(() => {
        setIsTyping(false);
        setTypingStatus(false);
      }, 3000);
    }
  };

  // Date separator helper
  const formatDateSeparator = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const messageDate = new Date(date);
    
    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString();
    }
  };

  const shouldShowDateSeparator = (currentMessage: Message, previousMessage?: Message): boolean => {
    if (!currentMessage.timestamp) return false;
    if (!previousMessage || !previousMessage.timestamp) return true;
    
    const currentDate = currentMessage.timestamp.toDate();
    const previousDate = previousMessage.timestamp.toDate();
    
    return currentDate.toDateString() !== previousDate.toDateString();
  };

  const sendMessage = async (attachments?: Attachment[]) => {
    if ((!newMessage.trim() && !attachments?.length) || !currentUser || !chatId || !companyCode) return;

    try {
      const messagesRef = collection(db, 'companies', companyCode, type === 'direct' ? 'conversations' : 'groups', chatId, 'messages');
      
      const messageData: any = {
        text: newMessage.trim(),
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        timestamp: serverTimestamp(),
        status: 'sent',
      };

      if (attachments?.length) {
        messageData.attachments = attachments;
      }

      const added = await addDoc(messagesRef, messageData);

      // Update conversation/group with last message
      const chatRef = doc(db, 'companies', companyCode, type === 'direct' ? 'conversations' : 'groups', chatId);
      const lastMessageText = newMessage.trim() || (attachments?.length ? 
        `📎 ${attachments.length} attachment${attachments.length > 1 ? 's' : ''}` : '');
      
      await updateDoc(chatRef, {
        lastMessage: lastMessageText,
        lastMessageTime: serverTimestamp(),
        lastMessageSender: currentUser.uid,
      });
      
      setNewMessage('');
      // Clear typing status
      setIsTyping(false);
      setTypingStatus(false);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

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
      if (!currentUser || !chatId || !companyCode) return;

      // Generate temporary message ID for upload path
      const tempMessageId = Date.now().toString();
      
      const uploadResult = await uploadFile(
        uri,
        fileName,
        mimeType,
        companyCode,
        type === 'direct' ? 'conversations' : 'groups',
        chatId,
        tempMessageId
      );

      const attachment: Attachment = {
        type: mimeType.startsWith('image/') ? 'image' : 'document',
        url: uploadResult.downloadURL,
        name: uploadResult.fileName,
        size: uploadResult.fileSize,
        mimeType: uploadResult.mimeType,
      };

      // Send message with attachment
      await sendMessage([attachment]);

    } catch (error) {
      console.error('Error uploading file:', error);
      Alert.alert('Upload Error', 'Failed to upload file. Please try again.');
    }
  };

  const renderAttachment = (attachment: Attachment, isOwnMessage: boolean) => {
    if (attachment.type === 'image') {
      return (
        <TouchableOpacity key={attachment.url} style={styles.attachmentContainer}>
          <Image 
            source={{ uri: attachment.url }} 
            style={styles.attachmentImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      );
    } else {
      return (
        <TouchableOpacity 
          key={attachment.url} 
          style={[styles.documentContainer, isOwnMessage && styles.ownDocumentContainer]}
        >
          <View style={styles.documentIcon}>
            <Text style={styles.documentIconText}>📄</Text>
          </View>
          <View style={styles.documentInfo}>
            <Text style={[styles.documentName, isOwnMessage && styles.ownDocumentName]} numberOfLines={1}>
              {attachment.name}
            </Text>
            <Text style={[styles.documentSize, isOwnMessage && styles.ownDocumentSize]}>
              {formatFileSize(attachment.size)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwnMessage = item.senderId === currentUser?.uid;
    const hasText = item.text && item.text.trim().length > 0;
    const hasAttachments = item.attachments && item.attachments.length > 0;
    const previousMessage = index > 0 ? messages[index - 1] : undefined;
    const showDateSeparator = shouldShowDateSeparator(item, previousMessage);
    
    return (
      <View>
        {/* Date separator */}
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>
              {formatDateSeparator(item.timestamp?.toDate())}
            </Text>
          </View>
        )}
        
        {/* Message bubble */}
        <View style={[styles.messageContainer, isOwnMessage && styles.ownMessageContainer]}>
          <View style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}>
            {!isOwnMessage && (
              <Text style={styles.senderName}>{item.senderName}</Text>
            )}
            
            {/* Render attachments */}
            {hasAttachments && (
              <View style={styles.attachmentsContainer}>
                {item.attachments!.map((attachment) => renderAttachment(attachment, isOwnMessage))}
              </View>
            )}
            
            {/* Render text if present */}
            {hasText && (
              <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
                {item.text}
              </Text>
            )}
            
            <View style={styles.messageFooter}>
              <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
                {item.timestamp?.toDate().toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </Text>
              {isOwnMessage && item.status === 'sending' && (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" style={styles.sendingIndicator} />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        {type === 'direct' && otherUserId ? (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/chat-screens/TeamMemberProfile',
                params: { userId: otherUserId as string, companyCode: companyCode as string },
              })
            }
            style={{ flex: 1 }}
          >
            <Text style={styles.chatTitle}>{chatName}</Text>
          </TouchableOpacity>
        ) : type === 'group' ? (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/chat-screens/GroupProfile',
                params: { groupId: chatId as string, companyCode: companyCode as string },
              })
            }
            style={{ flex: 1 }}
          >
            <Text style={styles.chatTitle}>{chatName}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.chatTitle}>{chatName}</Text>
        )}
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          inverted={false}
          onEndReached={loadOlderMessages}
          onEndReachedThreshold={0.1}
          ListHeaderComponent={
            hasMoreMessages && loadingOlder ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.loadingMoreText}>Loading older messages...</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          }
          ListFooterComponent={
            otherUserTyping ? (
              <View style={styles.typingContainer}>
                <View style={styles.typingBubble}>
                  <View style={styles.typingIndicator}>
                    <Text style={styles.typingDot}>•</Text>
                    <Text style={styles.typingDot}>•</Text>
                    <Text style={styles.typingDot}>•</Text>
                  </View>
                  <Text style={styles.typingText}>typing...</Text>
                </View>
              </View>
            ) : null
          }
        />

        <View style={styles.inputContainer}>
          <TouchableOpacity 
            style={styles.attachButton}
            onPress={handleAttachmentPress}
            disabled={uploading}
          >
            <Text style={styles.attachButtonText}>+</Text>
          </TouchableOpacity>
          
          <TextInput
            style={styles.messageInput}
            placeholder="Type a message..."
            value={newMessage}
            onChangeText={handleTextChange}
            multiline
            editable={!uploading}
          />
          
          <TouchableOpacity 
            style={[styles.sendButton, (!newMessage.trim() || uploading) && styles.sendButtonDisabled]}
            onPress={() => sendMessage()}
            disabled={!newMessage.trim() || uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
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
  },
  backButton: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginRight: 12,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  headerSpacer: {
    width: 24,
  },
  content: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageContainer: {
    marginVertical: 4,
    alignItems: 'flex-start',
  },
  ownMessageContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: '80%',
  },
  ownMessageBubble: {
    backgroundColor: '#007AFF',
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 16,
    color: '#000',
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'flex-end',
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  attachButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  // Attachment styles
  attachmentsContainer: {
    marginBottom: 8,
  },
  attachmentContainer: {
    marginBottom: 4,
  },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
    maxWidth: 250,
  },
  ownDocumentContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  documentIcon: {
    marginRight: 8,
  },
  documentIconText: {
    fontSize: 24,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  ownDocumentName: {
    color: '#fff',
  },
  documentSize: {
    fontSize: 12,
    color: '#666',
  },
  ownDocumentSize: {
    color: 'rgba(255,255,255,0.8)',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  sendingIndicator: {
    marginLeft: 4,
  },
  // Date separator styles
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorText: {
    backgroundColor: '#f0f0f0',
    color: '#666',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  // Typing indicator styles
  typingContainer: {
    alignItems: 'flex-start',
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  typingBubble: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingIndicator: {
    flexDirection: 'row',
    marginRight: 4,
  },
  typingDot: {
    fontSize: 16,
    color: '#666',
    marginHorizontal: 1,
  },
  typingText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  // Loading more messages styles
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
});
