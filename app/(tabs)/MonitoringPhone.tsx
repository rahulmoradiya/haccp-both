import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, collectionGroup, getDocs, getFirestore, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { app } from '../../firebase';

function formatDate(date: string | Date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}
function formatDateTimeDisplay(date: string | Date) {
  const d = new Date(date);
  return d.toLocaleString();
}

// Define a type for tasks to avoid linter errors
interface TaskType {
  id: string;
  title?: string;
  description?: string;
  dueDate?: string;
  reminder?: string;
  assignedTo?: string;
  assignedUsers?: string[];
  completed?: boolean;
  createdBy?: string;
  type?: string;
  [key: string]: any;
}

export default function ExploreScreen() {
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', dueDate: '', reminder: '' });
  const [creating, setCreating] = useState(false);
  const [companyCode, setCompanyCode] = useState<string | null>(null);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'detail' | 'checklist' | 'personal' | 'assigned'>('personal');
  const [assignedTasks, setAssignedTasks] = useState<TaskType[]>([]); // will be set by filtering tasks
  const [calendarExpanded, setCalendarExpanded] = useState(false);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const auth = getAuth(app);
        const user = auth.currentUser;
        if (!user) {
          setError('No user logged in');
          setLoading(false);
          return;
        }
        setUserUid(user.uid);
        const db = getFirestore(app);
        // Find the user's companyCode using a collection group query
        const usersSnap = await getDocs(collectionGroup(db, 'users'));
        const userDoc = usersSnap.docs.find(doc => doc.data().uid === user.uid);
        if (!userDoc) {
          setError('User profile not found');
          setLoading(false);
          return;
        }
        const _companyCode = userDoc.data().companyCode;
        setCompanyCode(_companyCode);
        if (!_companyCode) {
          setError('Company code not found');
          setLoading(false);
          return;
        }
        // Fetch all tasks for the company
        const tasksRef = collection(db, 'companies', _companyCode, 'tasks');
        const querySnap = await getDocs(tasksRef);
        const tasksList: TaskType[] = querySnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() })) as TaskType[];
        setTasks(tasksList);
        // Filter assigned tasks using assignedUsers array
        const assignedTasksList = tasksList.filter(
          task => Array.isArray(task.assignedUsers) && user.uid && task.assignedUsers.includes(user.uid)
        );
        setAssignedTasks(assignedTasksList);
      } catch (e) {
        setError('Failed to fetch tasks');
      }
      setLoading(false);
    };
    fetchTasks();
  }, [creating]);

  const handleCreateTask = async () => {
    if (!companyCode || !userUid) return;
    if (!newTask.title) return;
    setCreating(true);
    try {
      const db = getFirestore(app);
      const tasksRef = collection(db, 'companies', companyCode, 'tasks');
      await addDoc(tasksRef, {
        title: newTask.title,
        description: newTask.description,
        dueDate: newTask.dueDate ? new Date(newTask.dueDate).toISOString() : '',
        reminder: newTask.reminder ? new Date(newTask.reminder).toISOString() : '',
        assignedTo: userUid,
        completed: false,
        createdAt: serverTimestamp(),
      });
      setNewTask({ title: '', description: '', dueDate: '', reminder: '' });
      setModalVisible(false);
    } catch (e) {
      alert('Failed to create task');
    }
    setCreating(false);
  };

  // Mark dates with tasks
  const markedDates = tasks.reduce((acc, task) => {
    if (task.dueDate) {
      const date = formatDate(task.dueDate);
      acc[date] = {
        marked: true,
        dotColor: task.completed ? '#4CAF50' : '#007bff',
        selected: date === selectedDate,
        selectedColor: '#007bff',
      };
    }
    return acc;
  }, {} as any);
  // Always mark the selected date
  if (!markedDates[selectedDate]) {
    markedDates[selectedDate] = { selected: true, selectedColor: '#007bff' };
  }

  // Filter tasks based on selected filter
  let filteredTasks: TaskType[] = [];
  if (selectedFilter === 'personal') {
    filteredTasks = tasks.filter(
      task =>
        (Array.isArray(task.assignedUsers) && userUid && task.assignedUsers.includes(userUid)) ||
        (typeof task.assignedTo === 'string' && task.assignedTo === userUid)
    );
  } else if (selectedFilter === 'detail') {
    filteredTasks = tasks.filter(task => task.type === 'detail');
  } else if (selectedFilter === 'checklist') {
    filteredTasks = tasks.filter(task => task.type === 'checklist');
  } else if (selectedFilter === 'assigned') {
    filteredTasks = assignedTasks;
  }

  // Filter tasks for the selected date
  const tasksForSelectedDate = tasks.filter(
    t => t.dueDate && formatDate(t.dueDate) === selectedDate
  );

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  }

  // Always show all tasks' titles below the calendar
  return (
    <ThemedView style={styles.container}>
      <View>
        <Calendar
          style={[styles.calendar, !calendarExpanded && styles.calendarCollapsed]}
          markedDates={markedDates}
          onDayPress={day => setSelectedDate(day.dateString)}
          theme={{
            selectedDayBackgroundColor: '#007bff',
            todayTextColor: '#007bff',
            arrowColor: '#007bff',
          }}
          hideExtraDays={!calendarExpanded}
          // When collapsed, limit to one row (week view)
          // When expanded, show full month
          // The Calendar component doesn't have a built-in week view, so we simulate it by limiting height and hiding extra days
        />
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setCalendarExpanded(expanded => !expanded)}
        >
          <Text style={styles.expandButtonText}>
            {calendarExpanded ? 'Collapse Calendar' : 'Expand Calendar'}
          </Text>
        </TouchableOpacity>
      </View>
      <ThemedText type="title" style={styles.title}>All Task Titles</ThemedText>
      <FlatList
        data={tasks}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <Text style={{ fontSize: 18, marginVertical: 6 }}>{item.title}</Text>
        )}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : filteredTasks.length === 0 ? (
        <Text style={styles.empty}>No tasks found.</Text>
      ) : (
        <FlatList
          data={filteredTasks.filter(
            t => t.dueDate && formatDate(t.dueDate) === selectedDate
          )}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={[styles.taskCard, item.completed ? styles.completedCard : styles.pendingCard]}>
              <View style={styles.cardHeader}>
                <Text style={styles.taskTitle}>{item.title}</Text>
                <View style={[styles.statusDot, item.completed ? styles.completedDot : styles.pendingDot]} />
              </View>
              <Text style={styles.taskDesc}>{item.description}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.taskMeta}>Due: {item.dueDate ? new Date(item.dueDate).toLocaleString() : 'N/A'}</Text>
                <Text style={styles.taskMeta}>{item.completed ? 'Completed' : 'Pending'}</Text>
              </View>
            </View>
          )}
        />
      )}
      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.fabIcon}>＋</Text>
      </TouchableOpacity>
      {/* Modal for creating a new task */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Task</Text>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter task title"
              value={newTask.title}
              onChangeText={text => setNewTask({ ...newTask, title: text })}
            />
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter description (optional)"
              value={newTask.description}
              onChangeText={text => setNewTask({ ...newTask, description: text })}
            />
            <Text style={styles.inputLabel}>Due Date</Text>
            <TouchableOpacity
              style={[styles.input, styles.inputWithIcon]}
              onPress={() => setShowDueDatePicker(true)}
            >
              <Text style={{ color: newTask.dueDate ? '#222' : '#888', flex: 1 }}>
                {newTask.dueDate ? formatDateTimeDisplay(newTask.dueDate) : 'Select due date & time'}
              </Text>
              <Ionicons name="calendar-outline" size={22} color="#007bff" style={styles.inputIcon} />
            </TouchableOpacity>
            {showDueDatePicker && (
              <DateTimePicker
                value={newTask.dueDate ? new Date(newTask.dueDate) : new Date()}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowDueDatePicker(false);
                  if (selectedDate) {
                    setNewTask({ ...newTask, dueDate: selectedDate.toISOString() });
                  }
                }}
              />
            )}
            <Text style={styles.inputLabel}>Reminder</Text>
            <TouchableOpacity
              style={[styles.input, styles.inputWithIcon]}
              onPress={() => setShowReminderPicker(true)}
            >
              <Text style={{ color: newTask.reminder ? '#222' : '#888', flex: 1 }}>
                {newTask.reminder ? formatDateTimeDisplay(newTask.reminder) : 'Select reminder (optional)'}
              </Text>
              <Ionicons name="time-outline" size={22} color="#007bff" style={styles.inputIcon} />
            </TouchableOpacity>
            {showReminderPicker && (
              <DateTimePicker
                value={newTask.reminder ? new Date(newTask.reminder) : new Date()}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowReminderPicker(false);
                  if (selectedDate) {
                    setNewTask({ ...newTask, reminder: selectedDate.toISOString() });
                  }
                }}
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#ccc' }]}
                onPress={() => setModalVisible(false)}
                disabled={creating}
              >
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#007bff' }]}
                onPress={handleCreateTask}
                disabled={creating || !newTask.title}
              >
                <Text style={{ color: '#fff' }}>{creating ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 160,
    backgroundColor: '#f7f7f7',
  },
  title: {
    marginTop: 16,
    marginBottom: 8,
  },
  calendar: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    elevation: 2,
  },
  calendarCollapsed: {
    height: 60, // Show only one week row
    minHeight: 60,
    maxHeight: 60,
  },
  expandButton: {
    alignSelf: 'flex-end',
    marginBottom: 4,
    marginTop: -4,
    paddingHorizontal: 10,
    paddingVertical: 2,
    backgroundColor: '#eaf1fb',
    borderRadius: 8,
  },
  expandButtonText: {
    color: '#007bff',
    fontWeight: '600',
    fontSize: 13,
  },
  error: {
    color: 'red',
    marginTop: 20,
  },
  empty: {
    color: '#888',
    marginTop: 20,
    textAlign: 'center',
  },
  taskCard: {
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    backgroundColor: '#fff',
  },
  completedCard: {
    borderLeftWidth: 6,
    borderLeftColor: '#4CAF50',
    opacity: 0.7,
  },
  pendingCard: {
    borderLeftWidth: 6,
    borderLeftColor: '#007bff',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: 8,
  },
  completedDot: {
    backgroundColor: '#4CAF50',
  },
  pendingDot: {
    backgroundColor: '#007bff',
  },
  taskTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#222',
  },
  taskDesc: {
    fontSize: 15,
    color: '#555',
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  taskMeta: {
    fontSize: 13,
    color: '#888',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 80, // moved higher above the tab bar
    backgroundColor: '#007bff',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#007bff',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabIcon: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: Platform.OS === 'ios' ? 2 : 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '92%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'stretch',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 18,
    textAlign: 'center',
    color: '#007bff',
  },
  inputLabel: {
    fontSize: 14,
    color: '#007bff',
    marginBottom: 4,
    marginTop: 8,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 8,
    marginLeft: 8,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  inputIcon: {
    marginLeft: 8,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007bff',
    marginBottom: 8,
    marginTop: 8,
  },
});
