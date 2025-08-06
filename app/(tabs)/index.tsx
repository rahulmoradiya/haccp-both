import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { auth, db } from '../../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

interface ChatItem {
  id: string;
  type: 'direct' | 'group';
  name: string;
  lastMessage: string;
  lastMessageTime: any;
  lastMessageSender?: string;
  unreadCount?: number;
  participants?: string[];
  members?: string[];
  otherUserId?: string;
  avatar?: string;
  memberCount?: number;
}

interface User {
  uid: string;
  name: string;
  email: string;
  role?: string;
  department?: string;
  isOnline?: boolean;
}

export default function ChatScreen() {
  const router = useRouter();
  const currentUser = auth.currentUser;
  
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [companyCode, setCompanyCode] = useState<string | null>(null);

  // Get company code from user profile
  useEffect(() => {
    const fetchCompanyCode = async () => {
      if (!currentUser) {
        console.log('No current user available');
        return;
      }

      console.log('Fetching company code for user:', currentUser.uid);
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('User data:', userData);
          setCompanyCode(userData.companyCode);
          console.log('Company code set:', userData.companyCode);
        } else {
          console.log('User document does not exist');
          setLoading(false); // Stop loading if no user doc
        }
      } catch (error) {
        console.error('Error fetching company code:', error);
        setLoading(false); // Stop loading on error
      }
    };

    fetchCompanyCode();
  }, [currentUser]);

  // Fetch conversations and groups
  useEffect(() => {
    if (!currentUser || !companyCode) {
      console.log('Missing currentUser or companyCode:', { 
        hasUser: !!currentUser, 
        companyCode 
      });
      return;
    }

    console.log('Setting up chat listeners for company:', companyCode);
    const unsubscribers: (() => void)[] = [];
    let conversations: ChatItem[] = [];
    let groups: ChatItem[] = [];

    // Add timeout fallback
    const timeoutId = setTimeout(() => {
      console.log('Timeout reached, stopping loading...');
      setLoading(false);
    }, 10000); // 10 second timeout

    const updateChatItems = () => {
      clearTimeout(timeoutId); // Clear timeout when we get data
      const allChats = [...conversations, ...groups];
      allChats.sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return b.lastMessageTime.toMillis() - a.lastMessageTime.toMillis();
      });
      console.log('Total chat items:', allChats.length);
      setChatItems(allChats);
      setLoading(false);
    };

    // Listen to direct conversations
    const conversationsQuery = query(
      collection(db, 'companies', companyCode, 'conversations'),
      where('participants', 'array-contains', currentUser.uid)
    );

    const conversationsUnsubscribe = onSnapshot(
      conversationsQuery, 
      (snapshot) => {
        console.log('Conversations snapshot received, docs:', snapshot.docs.length);
        conversations = snapshot.docs.map(doc => {
          const data = doc.data();
          const otherParticipant = data.participants?.find((p: string) => p !== currentUser.uid);
          
          return {
            id: doc.id,
            type: 'direct' as const,
            name: data.participantNames?.[otherParticipant] || 'Unknown User',
            lastMessage: data.lastMessage || '',
            lastMessageTime: data.lastMessageTime,
            lastMessageSender: data.lastMessageSender,
            unreadCount: data.unreadCount?.[currentUser.uid] || 0,
            otherUserId: otherParticipant,
            participants: data.participants,
          };
        });
        updateChatItems();
      },
      (error) => {
        console.error('Error in conversations listener:', error);
        setLoading(false);
      }
    );

    // Listen to groups
    const groupsQuery = query(
      collection(db, 'companies', companyCode, 'groups'),
      where('members', 'array-contains', currentUser.uid)
    );

    const groupsUnsubscribe = onSnapshot(
      groupsQuery, 
      (groupSnapshot) => {
        console.log('Groups snapshot received, docs:', groupSnapshot.docs.length);
        groups = groupSnapshot.docs.map(doc => {
          const data = doc.data();
          
          return {
            id: doc.id,
            type: 'group' as const,
            name: data.name || 'Unnamed Group',
            lastMessage: data.lastMessage || '',
            lastMessageTime: data.lastMessageTime,
            lastMessageSender: data.lastMessageSender,
            unreadCount: data.unreadCount?.[currentUser.uid] || 0,
            members: data.members,
            memberCount: data.members?.length || 0,
          };
        });
        updateChatItems();
      },
      (error) => {
        console.error('Error in groups listener:', error);
        setLoading(false);
      }
    );

    unsubscribers.push(conversationsUnsubscribe, groupsUnsubscribe);

    return () => {
      clearTimeout(timeoutId);
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [currentUser, companyCode]);

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate();
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const handleChatPress = (item: ChatItem) => {
    if (item.type === 'direct') {
      router.push({
        pathname: '/chat-screens/DirectMessage',
        params: {
          otherUserId: item.otherUserId,
          otherUserName: item.name,
          companyCode: companyCode,
        },
      });
    } else {
      router.push({
        pathname: '/chat-screens/GroupChat',
        params: {
          groupId: item.id,
          groupName: item.name,
          companyCode: companyCode,
        },
      });
    }
  };

  const handleSearchUsers = () => {
    router.push({
      pathname: '/chat-screens/SearchUsers',
      params: { companyCode: companyCode },
    });
  };

  const handleCreateOptions = () => {
    Alert.alert(
      'Start New Chat',
      'What would you like to do?',
      [
        {
          text: 'Direct Message',
          onPress: () => router.push({
            pathname: '/chat-screens/SearchUsers',
            params: { companyCode: companyCode },
          }),
        },
        {
          text: 'Create Group',
          onPress: () => router.push({
            pathname: '/chat-screens/CreateGroup',
            params: { companyCode: companyCode },
          }),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const renderChatItem = ({ item }: { item: ChatItem }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => handleChatPress(item)}
    >
      <View style={styles.avatarContainer}>
        {item.type === 'direct' ? (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        ) : (
          <View style={[styles.avatar, styles.groupAvatar]}>
            <Text style={styles.avatarText}>👥</Text>
          </View>
        )}
        {item.unreadCount && item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>
              {item.unreadCount > 99 ? '99+' : item.unreadCount}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName} numberOfLines={1}>
            {item.name}
            {item.type === 'group' && item.memberCount && (
              <Text style={styles.memberCount}> ({item.memberCount})</Text>
            )}
          </Text>
          <Text style={styles.chatTime}>
            {formatTime(item.lastMessageTime)}
          </Text>
        </View>
        
        <Text style={styles.lastMessage} numberOfLines={2}>
          {item.lastMessage || 'No messages yet'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const filteredChats = chatItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading chats...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleSearchUsers}
          >
            <Text style={styles.headerButtonText}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleCreateOptions}
          >
            <Text style={styles.headerButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search chats..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Chat List */}
      {filteredChats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No chats yet</Text>
          <Text style={styles.emptySubtext}>
            Start a conversation by tapping the + button
          </Text>
          <TouchableOpacity
            style={styles.startChatButton}
            onPress={handleCreateOptions}
          >
            <Text style={styles.startChatButtonText}>Start Chatting</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          style={styles.chatList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: {
    height: 40,
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupAvatar: {
    backgroundColor: '#34C759',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  memberCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'normal',
  },
  chatTime: {
    fontSize: 12,
    color: '#666',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  startChatButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  startChatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});