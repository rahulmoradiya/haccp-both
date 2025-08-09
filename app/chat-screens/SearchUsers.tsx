import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { auth } from '../../firebase';
import { useAuth } from '../_layout';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

interface User {
  uid: string;
  name: string;
  email: string;
  role?: string;
  department?: string;
  isOnline?: boolean;
  photoURL?: string;
}

export default function SearchUsers() {
  const router = useRouter();
  const { companyCode: companyCodeFromParams, allUsers: allUsersParam } = useLocalSearchParams<{ companyCode: string; allUsers?: string }>();
  const currentUser = auth.currentUser;
  const { companyCode, allUsers } = useAuth();
  
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Use preloaded allUsers from context; no Firestore reads here
  useEffect(() => {
    // Prefer context allUsers; fallback to param if provided
    let source = allUsers as any[];
    if ((!source || source.length === 0) && allUsersParam) {
      try {
        source = JSON.parse(allUsersParam);
      } catch {}
    }

    const list = (source || []).filter((u: any) => u.uid !== currentUser?.uid).map((u: any) => ({
      uid: u.uid,
      name: u.name,
      email: u.email,
      role: u.role,
      department: (u as any).departmentName || u.department,
      isOnline: u.isOnline,
      photoURL: u.photoURL,
    }));
    setUsers(list);
    setFilteredUsers(list);
    setLoading(false);
  }, [allUsers, allUsersParam, currentUser]);

  // Filter users based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.department && user.department.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const handleUserPress = async (selectedUser: User) => {
    if (!currentUser || !companyCode) return;

    try {
      // Use company code from context or params
      const effectiveCompanyCode = (companyCode as string) || (companyCodeFromParams as string);
      if (!effectiveCompanyCode) return;

      const pairKey = [currentUser.uid, selectedUser.uid].sort().join('_');
      const conversationsRef = collection(db, 'companies', effectiveCompanyCode, 'conversations');

      // Try to find an existing conversation using pairKey or participants
      const existingQ = query(
        conversationsRef,
        where('participantsKey', '==', pairKey)
      );
      let existingSnap = await getDocs(existingQ);

      let chatId: string | null = null;
      if (existingSnap.empty) {
        // Fallback for older docs without participantsKey
        const legacyQ = query(
          conversationsRef,
          where('participants', 'array-contains', currentUser.uid)
        );
        const legacySnap = await getDocs(legacyQ);
        const found = legacySnap.docs.find(d => {
          const parts = (d.data() as any).participants || [];
          return parts.includes(selectedUser.uid) && parts.includes(currentUser.uid);
        });
        if (found) chatId = found.id;
      } else {
        chatId = existingSnap.docs[0].id;
      }

      if (!chatId) {
        const conversationData = {
          participants: [currentUser.uid, selectedUser.uid],
          participantsKey: pairKey,
          participantNames: {
            [currentUser.uid]: currentUser.displayName || currentUser.email,
            [selectedUser.uid]: selectedUser.name,
          },
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          lastMessageSender: '',
          unreadCount: {
            [currentUser.uid]: 0,
            [selectedUser.uid]: 0,
          },
          createdAt: serverTimestamp(),
        };
        const newDocRef = await addDoc(conversationsRef, conversationData);
        chatId = newDocRef.id;
        console.log('Conversation created:', effectiveCompanyCode, chatId, conversationData);
      }

      router.push({
        pathname: '/chat-screens/DetailChatScreen',
        params: {
          chatId,
          type: 'direct',
          otherUserId: selectedUser.uid,
          chatName: selectedUser.name,
          companyCode: effectiveCompanyCode,
        },
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleUserPress(item)}
    >
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        {item.isOnline && <View style={styles.onlineIndicator} />}
      </View>

      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.userEmail} numberOfLines={1}>
          {item.email}
        </Text>
        {item.department && (
          <Text style={styles.userDepartment} numberOfLines={1}>
            {item.department}
          </Text>
        )}
      </View>

      <View style={styles.userRole}>
        <Text style={styles.roleText}>
          {item.role || 'User'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading users...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select User</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.uid}
        style={styles.userList}
        contentContainerStyle={styles.userListContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No users found' : 'No users available'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'No other users in this company'}
            </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    height: 40,
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  userList: {
    flex: 1,
  },
  userListContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userDepartment: {
    fontSize: 12,
    color: '#999',
  },
  userRole: {
    marginLeft: 8,
  },
  roleText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
});
