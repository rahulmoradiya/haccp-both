import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../_layout';
import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { getAuth } from 'firebase/auth';

type PersonalTaskScreenRouteProp = {
  params: {
    task: string;
  };
};

export default function PersonalTaskScreen() {
  const route = useRoute<RouteProp<PersonalTaskScreenRouteProp, 'params'>>();
  const router = useRouter();
  const { allUsers, companyCode } = useAuth();
  const task = JSON.parse(route.params.task);
  const [isCompleted, setIsCompleted] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  // Find the creator's user data
  const creator = allUsers.find(user => user.uid === task.createdBy);

  // Helper function to format date
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  // Helper function to get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return '#f44336';
      case 'medium': return '#ff9800';
      case 'low': return '#4caf50';
      default: return '#ff9800';
    }
  };

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return '#4caf50';
      case 'inactive': return '#9e9e9e';
      case 'completed': return '#2196f3';
      case 'pending': return '#ff9800';
      default: return '#4caf50';
    }
  };

  // Check if task has been completed by current user
  React.useEffect(() => {
    if (!companyCode || !task.id) {
      setIsLoading(false);
      return;
    }

    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    // Check if this task has been completed by the current user
    const completedQuery = query(
      collection(db, 'companies', companyCode, 'personalCollected'),
      where('taskId', '==', task.id || task._id),
      where('userId', '==', currentUser.uid),
      where('actionType', '==', 'task_completed')
    );

    const unsubscribe = onSnapshot(completedQuery, (snapshot) => {
      const hasCompleted = !snapshot.empty;
      setIsCompleted(hasCompleted);
      setIsLoading(false);
    }, (error) => {
      console.error('Error checking task completion status:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [companyCode, task.id]);

  // Handle mark complete action
  const handleMarkComplete = () => {
    Alert.alert(
      'Mark Complete',
      'Are you sure you want to mark this task as complete?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Complete', 
          style: 'default',
          onPress: async () => {
            try {
              const auth = getAuth();
              const currentUser = auth.currentUser;
              if (!currentUser || !companyCode) return;

              // Log the action to personalCollected collection
              await addDoc(collection(db, 'companies', companyCode, 'personalCollected'), {
                actionType: 'task_completed',
                taskId: task.id || task._id,
                userId: currentUser.uid,
                timestamp: serverTimestamp(),
                taskTitle: task.title || 'Untitled Task',
                additionalData: {
                  status: 'completed',
                  priority: task.priority,
                }
              });

              // Update task status to 'completed' in local state
              task.status = 'completed';
              setIsCompleted(true);
              
              Alert.alert('Success', 'Task marked as complete!');
            } catch (error) {
              console.error('Error logging task completion:', error);
              Alert.alert('Error', 'Failed to log task completion.');
            }
          }
        }
      ]
    );
  };



  // Handle creator click to start chat
  const handleCreatorPress = async () => {
    if (!creator || !companyCode) return;
    
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      // Create a unique key for the conversation
      const pairKey = [currentUser.uid, creator.uid].sort().join('_');
      const conversationsRef = collection(db, 'companies', companyCode, 'conversations');

      // Try to find an existing conversation
      const existingQ = query(
        conversationsRef,
        where('participantsKey', '==', pairKey)
      );
      let existingSnap = await getDocs(existingQ);

      let chatId: string;
      if (existingSnap.empty) {
        // Create new conversation
        const conversationData = {
          participants: [currentUser.uid, creator.uid],
          participantsKey: pairKey,
          participantNames: {
            [currentUser.uid]: currentUser.displayName || currentUser.email,
            [creator.uid]: creator.name,
          },
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          lastMessageSender: '',
          unreadCount: {
            [currentUser.uid]: 0,
            [creator.uid]: 0,
          },
          createdAt: serverTimestamp(),
        };
        const newDocRef = await addDoc(conversationsRef, conversationData);
        chatId = newDocRef.id;
      } else {
        chatId = existingSnap.docs[0].id;
      }

      // Navigate to chat
      router.push({
        pathname: '/chat-screens/DetailChatScreen',
        params: {
          chatId,
          type: 'direct',
          otherUserId: creator.uid,
          chatName: creator.name,
          companyCode: companyCode,
        },
      });
    } catch (error) {
      console.error('Error creating/finding conversation:', error);
      Alert.alert('Error', 'Could not start chat. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Your Task', headerBackTitle: '' }} />
      
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Task Header */}
        <View style={styles.header}>
          <Text style={styles.taskTitle}>{task.title || 'Untitled Task'}</Text>
          <View style={styles.badgeContainer}>
            <View style={[styles.badge, { backgroundColor: getPriorityColor(task.priority) }]}>
              <Text style={styles.badgeText}>{task.priority || 'Medium'}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: getStatusColor(task.status) }]}>
              <Text style={styles.badgeText}>{task.status || 'Active'}</Text>
            </View>
          </View>
        </View>

        {/* Task Details */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Description:</Text>
            <Text style={styles.detailValue}>
              {task.description || 'No description provided'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Due Date:</Text>
            <Text style={styles.detailValue}>
              {formatDate(task.dueDate)}
            </Text>
          </View>

          {task.sopDetails && task.sopDetails.length > 0 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>SOP Details:</Text>
              <Text style={styles.detailValue}>
                {task.sopDetails.length} SOP(s) attached
              </Text>
            </View>
          )}

          {creator && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Created By:</Text>
              <TouchableOpacity style={styles.creatorContainer} onPress={handleCreatorPress}>
                <View style={styles.avatarContainer}>
                  {creator.photoURL ? (
                    <Image source={{ uri: creator.photoURL }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>
                      {creator.name ? creator.name.charAt(0).toUpperCase() : 'U'}
                    </Text>
                  )}
                </View>
                <Text style={styles.creatorName}>
                  {creator.name || creator.email || 'Unknown User'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {isLoading ? (
            <View style={[styles.actionButton, styles.loadingButton]}>
              <Text style={styles.actionButtonText}>Loading...</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={[
                styles.actionButton, 
                isCompleted && styles.completedButton
              ]} 
              onPress={handleMarkComplete}
              disabled={isCompleted}
            >
              <Text style={[
                styles.actionButtonText,
                isCompleted && styles.completedButtonText
              ]}>
                {isCompleted ? 'Completed' : 'Mark Complete'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  taskTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  detailRow: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  actionContainer: {
    marginHorizontal: 16,
    marginBottom: 20,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  completedButton: {
    backgroundColor: '#4caf50',
  },
  completedButtonText: {
    color: '#fff',
  },
  loadingButton: {
    backgroundColor: '#9e9e9e',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1976D2',
  },
  secondaryButtonText: {
    color: '#1976D2',
  },
  debugContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  creatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  creatorName: {
    fontSize: 16,
    color: '#1976D2',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});