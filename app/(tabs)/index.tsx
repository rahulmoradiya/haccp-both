import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../_layout';
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
   limit,
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
  memberCount?: number;
  photoURL?: string; // Add profile picture support
}

export default function ChatScreen() {
  const router = useRouter();
  const currentUser = auth.currentUser;
  const { allUsers, companyCode, isAppDataLoading } = useAuth();
  
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatMessagesCache, setChatMessagesCache] = useState<Record<string, any[]>>({});
  const [messageMatches, setMessageMatches] = useState<Record<string, string>>({});

  // When app context finishes loading, stop spinner if we don't have a company yet
  useEffect(() => {
    if (!isAppDataLoading && (!currentUser || !companyCode)) {
      setLoading(false);
    }
  }, [isAppDataLoading, currentUser, companyCode]);

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
      clearTimeout(timeoutId);
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
        // Build a map keyed by deterministic pair key to dedupe duplicates
        const byPairKey = new Map<string, any>();

        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data() as any;
          const otherParticipant = (data.participants || []).find((p: string) => p !== currentUser.uid);
          if (!otherParticipant) return;

          const pairKey = (data.participantsKey as string) || [currentUser.uid, otherParticipant].sort().join('_');

          const candidate = {
            id: docSnap.id,
            type: 'direct' as const,
            name: (data.participantNames && data.participantNames[otherParticipant]) || 'Unknown User',
            lastMessage: data.lastMessage || '',
            lastMessageTime: data.lastMessageTime,
            lastMessageSender: data.lastMessageSender,
            unreadCount: (data.unreadCount && data.unreadCount[currentUser.uid]) || 0,
            otherUserId: otherParticipant,
            participants: data.participants,
            photoURL: allUsers.find(u => u.uid === otherParticipant)?.photoURL,
          } as any;

          const existing = byPairKey.get(pairKey);
          if (!existing) {
            byPairKey.set(pairKey, candidate);
          } else {
            const a = existing.lastMessageTime?.toMillis?.() || 0;
            const b = candidate.lastMessageTime?.toMillis?.() || 0;
            if (b >= a) byPairKey.set(pairKey, candidate);
          }
        });

        conversations = Array.from(byPairKey.values());
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
            photoURL: data.photoURL,
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
  }, [currentUser, companyCode, allUsers]);

  // Debounced search across chat names, last messages, and recent message history
  useEffect(() => {
    if (!companyCode) return;
    const term = searchQuery.trim().toLowerCase();
    const handler = setTimeout(async () => {
      if (term.length < 2) {
        setMessageMatches({});
        return;
      }

      const nextMatches: Record<string, string> = {};

      // Ensure we have recent messages cached and search within them
      await Promise.all(
        chatItems.map(async (item) => {
          // If name or lastMessage already match, we don't need to fetch messages for snippet, but we could still show lastMessage
          const nameMatch = item.name?.toLowerCase().includes(term);
          const lastMatch = (item.lastMessage || '').toLowerCase().includes(term);
          if (nameMatch || lastMatch) {
            if (lastMatch) nextMatches[item.id] = item.lastMessage;
            return;
          }

          let cached = chatMessagesCache[item.id];
          if (!cached) {
            try {
              const messagesCol = collection(
                db,
                'companies',
                companyCode,
                item.type === 'direct' ? 'conversations' : 'groups',
                item.id,
                'messages'
              );
              const q = query(messagesCol, orderBy('createdAt', 'desc'), limit(50));
              const snap = await getDocs(q);
              cached = snap.docs.map((d) => d.data() as any);
              setChatMessagesCache((prev) => ({ ...prev, [item.id]: cached! }));
            } catch (e) {
              // Ignore fetch failures for search
              cached = [];
            }
          }

          const match = (cached || []).find((m) => (m.text || '').toLowerCase().includes(term));
          if (match && typeof match.text === 'string') {
            nextMatches[item.id] = match.text as string;
          }
        })
      );

      setMessageMatches(nextMatches);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery, chatItems, companyCode]);

  const filteredItems = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return chatItems;
    return chatItems.filter((item) => {
      const nameMatch = item.name?.toLowerCase().includes(term);
      const lastMatch = (item.lastMessage || '').toLowerCase().includes(term);
      const historyMatch = !!messageMatches[item.id];
      return nameMatch || lastMatch || historyMatch;
    });
  }, [chatItems, searchQuery, messageMatches]);

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const messageTime = timestamp.toDate();
    const diffInHours = (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return messageTime.toLocaleDateString();
    }
  };

  const handleChatPress = (item: ChatItem) => {
    if (item.type === 'direct') {
      router.push({
        pathname: '/chat-screens/DetailChatScreen',
        params: {
          chatId: item.id,
          type: 'direct',
          otherUserId: item.otherUserId,
          chatName: item.name,
          companyCode: companyCode,
        },
      });
    } else {
      router.push({
        pathname: '/chat-screens/DetailChatScreen',
        params: {
          chatId: item.id,
          type: 'group',
          chatName: item.name,
          companyCode: companyCode,
        },
      });
    }
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
            params: { companyCode: companyCode ?? '', allUsers: JSON.stringify(allUsers || []) },
          }),
        },
        {
          text: 'Create Group',
          onPress: () => router.push({
            pathname: '/chat-screens/CreateGroup',
            params: { companyCode: companyCode ?? '', allUsers: JSON.stringify(allUsers || []) },
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
        <View style={styles.avatar}>
          {item.photoURL ? (
            <Image source={{ uri: item.photoURL }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>
              {item.type === 'direct' 
                ? item.name.charAt(0).toUpperCase()
                : '👥'
              }
            </Text>
          )}
        </View>
        {(item.unreadCount ?? 0) > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>
              {(item.unreadCount ?? 0) > 99 ? '99+' : (item.unreadCount ?? 0)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName} numberOfLines={1}>
            {item.type === 'group' && typeof item.memberCount === 'number'
              ? `${item.name} (${item.memberCount})`
              : item.name}
          </Text>
          <Text style={styles.chatTime}>
            {formatTime(item.lastMessageTime)}
          </Text>
        </View>
        
        <Text style={styles.lastMessage} numberOfLines={2}>
          {searchQuery.trim()
            ? messageMatches[item.id] || item.lastMessage || 'No messages yet'
            : item.lastMessage || 'No messages yet'}
        </Text>
      </View>
    </TouchableOpacity>
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
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleCreateOptions}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name, message, or history"
          placeholderTextColor="#999"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filteredItems}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        style={styles.chatList}
        contentContainerStyle={styles.chatListContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No chats yet</Text>
            <Text style={styles.emptySubtext}>Start a conversation to begin chatting</Text>
          </View>
        }
      />
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  chatList: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchInput: {
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f1f1f1',
    color: '#000',
  },
  chatListContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  chatItem: {
    flexDirection: 'row',
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
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
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
});