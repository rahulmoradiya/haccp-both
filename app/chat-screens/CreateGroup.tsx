import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { auth, db } from '../../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

interface User {
  uid: string;
  name: string;
  email: string;
  role?: string;
  department?: string;
}

export default function CreateGroupScreen() {
  const router = useRouter();
  const { companyCode } = useLocalSearchParams();
  const currentUser = auth.currentUser;

  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [companyCode]);

  const fetchUsers = async () => {
    if (!companyCode || !currentUser) return;

    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('companyCode', '==', companyCode)
      );

      const snapshot = await getDocs(usersQuery);
      const usersList = snapshot.docs
        .map(doc => ({
          uid: doc.id,
          ...doc.data()
        } as User))
        .filter(user => user.uid !== currentUser.uid);

      setUsers(usersList);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (selectedUsers.size === 0) {
      Alert.alert('Error', 'Please select at least one member');
      return;
    }

    if (!currentUser || !companyCode) return;

    setCreating(true);

    try {
      const members = [currentUser.uid, ...Array.from(selectedUsers)];
      const memberNames: { [key: string]: string } = {};
      
      // Add current user
      memberNames[currentUser.uid] = currentUser.displayName || currentUser.email || 'Unknown';
      
      // Add selected users
      users.forEach(user => {
        if (selectedUsers.has(user.uid)) {
          memberNames[user.uid] = user.name;
        }
      });

      // Create group document
      const groupData = {
        name: groupName.trim(),
        description: groupDescription.trim(),
        members,
        memberNames,
        admins: [currentUser.uid],
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        lastMessage: `${memberNames[currentUser.uid]} created the group`,
        lastMessageTime: serverTimestamp(),
        lastMessageSender: 'system',
        unreadCount: Object.fromEntries(members.map(id => [id, 0])),
      };

      const groupRef = await addDoc(
        collection(db, 'companies', companyCode as string, 'groups'),
        groupData
      );

      // Add system message about group creation
      await addDoc(
        collection(db, 'companies', companyCode as string, 'groups', groupRef.id, 'messages'),
        {
          text: `${memberNames[currentUser.uid]} created the group`,
          senderId: 'system',
          senderName: 'System',
          timestamp: serverTimestamp(),
          type: 'system',
        }
      );

      // Navigate to the new group chat
      router.replace({
        pathname: '/chat-screens/GroupChat',
        params: {
          groupId: groupRef.id,
          groupName: groupName,
          companyCode: companyCode,
        },
      });

    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const renderUser = ({ item }: { item: User }) => {
    const isSelected = selectedUsers.has(item.uid);
    
    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => toggleUserSelection(item.uid)}
      >
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{item.name}</Text>
            <Text style={styles.userRole}>
              {item.role && item.department
                ? `${item.role} • ${item.department}`
                : item.role || item.department || item.email
              }
            </Text>
          </View>
        </View>
        
        <View style={[
          styles.checkbox,
          isSelected && styles.checkedBox
        ]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Group</Text>
        <TouchableOpacity
          style={[styles.createButton, { opacity: groupName.trim() && selectedUsers.size > 0 ? 1 : 0.5 }]}
          onPress={createGroup}
          disabled={!groupName.trim() || selectedUsers.size === 0 || creating}
        >
          <Text style={styles.createButtonText}>
            {creating ? 'Creating...' : 'Create'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Group Info */}
      <View style={styles.groupInfoContainer}>
        <TextInput
          style={styles.groupNameInput}
          placeholder="Group name"
          value={groupName}
          onChangeText={setGroupName}
          maxLength={50}
        />
        <TextInput
          style={styles.groupDescriptionInput}
          placeholder="Group description (optional)"
          value={groupDescription}
          onChangeText={setGroupDescription}
          maxLength={200}
          multiline
        />
      </View>

      {/* Members Selection */}
      <View style={styles.membersContainer}>
        <Text style={styles.sectionTitle}>
          Add Members ({selectedUsers.size} selected)
        </Text>
        
        <FlatList
          data={users}
          keyExtractor={(item) => item.uid}
          renderItem={renderUser}
          style={styles.usersList}
          showsVerticalScrollIndicator={false}
        />
      </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  createButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  createButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  groupInfoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 8,
    borderBottomColor: '#f8f8f8',
  },
  groupNameInput: {
    fontSize: 18,
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 12,
    marginBottom: 12,
  },
  groupDescriptionInput: {
    fontSize: 16,
    color: '#666',
    paddingVertical: 8,
    minHeight: 40,
  },
  membersContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    paddingVertical: 16,
  },
  usersList: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
  },
  userRole: {
    fontSize: 14,
    color: '#666',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});