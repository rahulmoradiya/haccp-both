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
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { auth, db } from '../../firebase';
import { useAuth } from '../_layout';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface User {
  uid: string;
  name: string;
  email: string;
  role?: string;
  department?: string;
  isOnline?: boolean;
  photoURL?: string;
}

export default function CreateGroup() {
  const router = useRouter();
  const { companyCode: companyCodeFromParams, allUsers: allUsersParam } = useLocalSearchParams<{ companyCode: string; allUsers?: string }>();
  const currentUser = auth.currentUser;
  const { companyCode, allUsers } = useAuth();
  
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  // Use preloaded allUsers from context; no Firestore reads here
  useEffect(() => {
    let source = allUsers as any[];
    if ((!source || source.length === 0) && allUsersParam) {
      try { source = JSON.parse(allUsersParam); } catch {}
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

  const toggleUserSelection = (user: User) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(selected => selected.uid === user.uid);
      if (isSelected) {
        return prev.filter(selected => selected.uid !== user.uid);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleCreateGroup = async () => {
    if (!currentUser || !companyCode) return;
    
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select at least one user');
      return;
    }

    setCreating(true);

    try {
      const effectiveCompanyCode = (companyCode as string) || (companyCodeFromParams as string);
      if (!effectiveCompanyCode) return;

      const groupsRef = collection(db, 'companies', effectiveCompanyCode, 'groups');
      
      // Create group data
      const groupData = {
        name: groupName.trim(),
        members: [currentUser.uid, ...selectedUsers.map(user => user.uid)],
        memberNames: {
          [currentUser.uid]: currentUser.displayName || currentUser.email,
          ...selectedUsers.reduce((acc, user) => {
            acc[user.uid] = user.name;
            return acc;
          }, {} as Record<string, string>),
        },
        createdBy: currentUser.uid,
        lastMessage: '',
        lastMessageTime: serverTimestamp(),
        lastMessageSender: '',
        unreadCount: {
          [currentUser.uid]: 0,
          ...selectedUsers.reduce((acc, user) => {
            acc[user.uid] = 0;
            return acc;
          }, {} as Record<string, number>),
        },
        createdAt: serverTimestamp(),
      };

      const newDocRef = doc(groupsRef);
      await setDoc(newDocRef, groupData);
      
      // Navigate to group chat
      router.push({
        pathname: '/chat-screens/DetailChatScreen',
        params: {
          chatId: newDocRef.id,
          type: 'group',
          chatName: groupName.trim(),
          companyCode: effectiveCompanyCode,
        },
      });
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const isSelected = selectedUsers.some(user => user.uid === item.uid);
    
    return (
      <TouchableOpacity
        style={[styles.userItem, isSelected && styles.selectedUserItem]}
        onPress={() => toggleUserSelection(item)}
      >
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, isSelected && styles.selectedAvatar]}>
            <Text style={styles.avatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          {isSelected && <View style={styles.checkmark} />}
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
  };

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
        <Text style={styles.title}>Create Group</Text>
        <TouchableOpacity 
          style={[styles.createButton, selectedUsers.length === 0 && styles.createButtonDisabled]}
          onPress={handleCreateGroup}
          disabled={selectedUsers.length === 0 || creating}
        >
          <Text style={styles.createButtonText}>
            {creating ? 'Creating...' : 'Create'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.groupNameContainer}>
        <TextInput
          style={styles.groupNameInput}
          placeholder="Enter group name..."
          value={groupName}
          onChangeText={setGroupName}
        />
      </View>

      <View style={styles.selectedUsersContainer}>
        <Text style={styles.selectedUsersTitle}>
          Selected Users ({selectedUsers.length})
        </Text>
        {selectedUsers.length > 0 && (
          <FlatList
            data={selectedUsers}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.selectedUserChip}>
                <Text style={styles.selectedUserChipText}>
                  {item.name}
                </Text>
                <TouchableOpacity
                  onPress={() => toggleUserSelection(item)}
                  style={styles.removeUserButton}
                >
                  <Text style={styles.removeUserButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            )}
            keyExtractor={(item) => item.uid}
            style={styles.selectedUsersList}
          />
        )}
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
    justifyContent: 'space-between',
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
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createButtonDisabled: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  groupNameContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  groupNameInput: {
    height: 40,
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  selectedUsersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selectedUsersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  selectedUsersList: {
    maxHeight: 60,
  },
  selectedUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  selectedUserChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  removeUserButton: {
    marginLeft: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeUserButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
  selectedUserItem: {
    backgroundColor: '#f0f8ff',
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
  selectedAvatar: {
    backgroundColor: '#34C759',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  checkmark: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
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
