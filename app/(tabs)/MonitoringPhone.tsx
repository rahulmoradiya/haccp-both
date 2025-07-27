import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, SafeAreaView, TouchableOpacity, Modal, Pressable, ScrollView, Platform } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { collection, getDocs, query, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app } from '../../firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

// Initialize Firebase
const db = getFirestore(app);
const auth = getAuth(app);

// Define task interface
interface Task {
  id: string;
  title?: string;
  description?: string;
  dueDate?: string;
  frequency?: string;
  assignedTo?: string;
  completed?: boolean;
  type: 'detailed' | 'checklist' | 'teamMember';
  [key: string]: any;
}

export default function MonitoringPhone() {
  const router = useRouter();
  const insets = useSafeAreaInsets ? useSafeAreaInsets() : { bottom: 0 };
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [companyCode, setCompanyCode] = useState<string | null>(null);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [filteredTeamTasksCount, setFilteredTeamTasksCount] = useState<number>(0);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarTaskCounts, setCalendarTaskCounts] = useState<{ [date: string]: number }>({});
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filteredTasks, setFilteredTasks] = useState<Task[] | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterFrequencies, setFilterFrequencies] = useState<string[]>([]);
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null);

  // Helper: frequency options
  const frequencyOptions = [
    { label: 'Daily', value: 'once a day' },
    { label: 'Weekly', value: 'once a week' },
    { label: 'Monthly', value: 'once a month' },
    { label: 'Yearly', value: 'once a year' },
    { label: 'One-Time', value: 'one-time' },
    { label: 'For You', value: 'for-you' },
  ];

  // Get company code from current user
  useEffect(() => {
    const fetchCompanyCode = async () => {
      const user = auth.currentUser;
      if (user) {
        setUserUid(user.uid); // Save UID for debug
        try {
          const companiesSnap = await getDocs(collection(db, 'companies'));
          for (const companyDoc of companiesSnap.docs) {
            const usersCol = await getDocs(collection(db, 'companies', companyDoc.id, 'users'));
            const userDoc = usersCol.docs.find(doc => doc.data().uid === user.uid);
            if (userDoc) {
              setCompanyCode(companyDoc.id);
              break;
            }
          }
        } catch (error) {
          console.error('Error fetching company code:', error);
          setError('Failed to fetch company information');
        }
      }
    };
    fetchCompanyCode();
  }, []);

  // Fetch tasks from Firebase collections
  useEffect(() => {
    if (companyCode) {
      fetchTasks();
    }
    // On mount, select today's date
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayString = `${yyyy}-${mm}-${dd}`;
    setSelectedDate(todayString);
    setFilteredTasks(getTasksForDate(todayString));
    setCalendarMonth(today);
  }, [companyCode]);

  const fetchTasks = async () => {
    if (!companyCode) return;
    
    setLoading(true);
    setError('');
    
    try {
      const allTasks: Task[] = [];
      let filteredTeamTasks = 0;
      let userRoles: string[] = [];
      const user = auth.currentUser;
      // Fetch user roles from profile
      if (user) {
        const userProfileRef = collection(db, 'companies', companyCode, 'users');
        const userProfileSnap = await getDocs(userProfileRef);
        const userDoc = userProfileSnap.docs.find(doc => doc.data().uid === user.uid);
        if (userDoc) {
          const data = userDoc.data();
          // Union of responsibilities array and role string
          if (Array.isArray(data.responsibilities)) {
            userRoles = [...data.responsibilities];
          }
          if (typeof data.role === 'string' && data.role.trim() !== '') {
            if (!userRoles.includes(data.role)) {
              userRoles.push(data.role);
            }
          }
          setUserRoles(userRoles);
          if (data.name || data.displayName) {
            setUserDisplayName(data.name || data.displayName);
          } else if (user.displayName) {
            setUserDisplayName(user.displayName);
          } else {
            setUserDisplayName('You');
          }
          if (data.phoneNumber || user.phoneNumber) {
            setUserPhone(data.phoneNumber || user.phoneNumber);
          } else {
            setUserPhone(null);
          }
          console.log('User roles (union):', userRoles);
        }
      }
      // Fetch detailed monitoring tasks
      const detailedQuery = query(
        collection(db, 'companies', companyCode, 'detailedMonitoring')
      );
      const detailedSnapshot = await getDocs(detailedQuery);
      detailedSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Filter by assignedRoles
        if (Array.isArray(data.assignedRoles) && userRoles.some(role => data.assignedRoles.includes(role))) {
        allTasks.push({
          id: doc.id,
            ...data,
          type: 'detailed'
        } as Task);
        }
        console.log('Detailed task', doc.id, 'assignedRoles:', data.assignedRoles);
      });
      // Fetch checklist monitoring tasks
      const checklistQuery = query(
        collection(db, 'companies', companyCode, 'checklistMonitoring')
      );
      const checklistSnapshot = await getDocs(checklistQuery);
      checklistSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Filter by assignedRoles
        if (Array.isArray(data.assignedRoles) && userRoles.some(role => data.assignedRoles.includes(role))) {
        allTasks.push({
          id: doc.id,
            ...data,
          type: 'checklist'
        } as Task);
        }
        console.log('Checklist task', doc.id, 'assignedRoles:', data.assignedRoles);
      });

      // Fetch team member tasks
      const teamMemberQuery = query(
        collection(db, 'companies', companyCode, 'teamMemberTasks')
      );
      const teamMemberSnapshot = await getDocs(teamMemberQuery);
      console.log('Current user UID:', user?.uid);
      console.log('Company code used for query:', companyCode);
      teamMemberSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log('teamMemberTask doc id:', doc.id, 'assignedUserIds:', data.assignedUserIds);
        // Only include if assignedUserIds contains the current user's UID
        if (user && Array.isArray(data.assignedUserIds) && data.assignedUserIds.includes(user.uid)) {
        allTasks.push({
          id: doc.id,
            ...data,
          type: 'teamMember'
        } as Task);
          filteredTeamTasks++;
        }
      });
      setFilteredTeamTasksCount(filteredTeamTasks);
      console.log('Filtered teamMemberTasks count:', filteredTeamTasks);

      setTasks(allTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setError('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  const renderTask = ({ item }: { item: Task }) => {
    let screen = '';
    if (item.type === 'detailed') screen = '/task-screens/DetailTaskScreen';
    else if (item.type === 'checklist') screen = '/task-screens/ChecklistTaskScreen';
    else if (item.type === 'teamMember') screen = '/task-screens/PersonalTaskScreen';
    return (
      <TouchableOpacity
        style={styles.taskCard}
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: screen, params: { task: JSON.stringify(item) } })}
      >
      <View style={styles.taskHeader}>
        <Text style={styles.taskTitle}>{item.title || 'Untitled Task'}</Text>
        <View style={[styles.taskTypeBadge, { backgroundColor: getTaskTypeColor(item.type) }]}>
            <Text style={styles.taskTypeText}>
              {item.type === 'teamMember'
                ? `${userDisplayName || 'You'}${userPhone ? ` (${userPhone})` : ''}`
                : item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </Text>
          </View>
        </View>
      {item.description && (
        <Text style={styles.taskDescription}>{item.description}</Text>
      )}
      <View style={styles.taskDetails}>
        {item.dueDate && (
          <Text style={styles.taskDetail}>📅 Due: {formatDate(item.dueDate)}</Text>
        )}
        {item.frequency && (
          <Text style={styles.taskDetail}>🔄 Frequency: {item.frequency}</Text>
        )}
        {item.assignedTo && (
          <Text style={styles.taskDetail}>👤 Assigned: {item.assignedTo}</Text>
        )}
      </View>
      <View style={styles.taskStatus}>
        <Text style={[styles.statusText, { color: item.completed ? '#4CAF50' : '#FF9800' }]}>
          {item.completed ? '✅ Completed' : '⏳ Pending'}
        </Text>
      </View>
      </TouchableOpacity>
  );
  };

  const getTaskTypeColor = (type: string) => {
    switch (type) {
      case 'detailed': return '#2196F3';
      case 'checklist': return '#4CAF50';
      case 'teamMember': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Helper: get all days in a month
  const getDaysInMonth = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  // Calculate task counts for the calendar
  useEffect(() => {
    if (!tasks.length) return;
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const days = getDaysInMonth(year, month);
    const counts: { [date: string]: number } = {};
    days.forEach(day => {
      const dateString = day.toISOString().split('T')[0];
      counts[dateString] = getTasksForDate(dateString).length;
    });
    setCalendarTaskCounts(counts);
  }, [tasks, calendarMonth]);

  // Helper to get tasks for a specific date
  const getTasksForDate = (dateString: string) => {
    return tasks.filter(task => {
      if (!task.dueDate) return false;
      // For teamMemberTasks, treat as one-time tasks on dueDate
      if (task.type === 'teamMember') {
        return dateString === task.dueDate;
      }
      if (!task.frequency) return false;
      const freq = (task.frequency || '').toLowerCase();
      const due = new Date(task.dueDate);
      const day = new Date(dateString);
      if (freq === 'once a day') {
        return day >= due;
      } else if (freq === 'once a week') {
        return day >= due && day.getDay() === due.getDay();
      } else if (freq === 'once a month') {
        return day.getDate() === due.getDate();
      } else if (freq === 'once a year') {
        return day.getDate() === due.getDate() && day.getMonth() === due.getMonth();
      } else if ([
        'one-time task', 'one time task', 'one-time', 'one time'
      ].includes(freq)) {
        return dateString === task.dueDate;
      }
      return false;
    });
  };

  // Helper to get frequency label
  const getFrequencyLabel = (freq: string) => {
    freq = freq.toLowerCase();
    if (freq === 'once a day') return 'Daily';
    if (freq === 'once a week') return 'Weekly';
    if (freq === 'once a month') return 'Monthly';
    if (freq === 'once a year') return 'Yearly';
    if ([
      'one-time task', 'one time task', 'one-time', 'one time'
    ].includes(freq)) return 'One-Time';
    return freq;
  };

  // Filter tasks by selected frequencies
  const getFilteredTasks = () => {
    let base = filteredTasks !== null ? filteredTasks : tasks;
    if (filterFrequencies.length === 0) return base;
    // If 'for-you' is selected, show only teamMemberTasks assigned to the current user
    if (filterFrequencies.includes('for-you')) {
      return base.filter(task => task.type === 'teamMember');
    }
    return base.filter(task => {
      const freq = (task.frequency || '').toLowerCase();
      if (filterFrequencies.includes('once a day') && freq === 'once a day') return true;
      if (filterFrequencies.includes('once a week') && freq === 'once a week') return true;
      if (filterFrequencies.includes('once a month') && freq === 'once a month') return true;
      if (filterFrequencies.includes('once a year') && freq === 'once a year') return true;
      if (filterFrequencies.includes('one-time') && [
        'one-time task', 'one time task', 'one-time', 'one time'
      ].includes(freq)) return true;
      return false;
    });
  };

  // Calendar UI
  const renderCalendar = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const days = getDaysInMonth(year, month);
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={() => setCalendarMonth(new Date(year, month - 1, 1))}>
            <Text style={styles.calendarNav}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.calendarMonth}>{monthNames[month]} {year}</Text>
          <TouchableOpacity onPress={() => setCalendarMonth(new Date(year, month + 1, 1))}>
            <Text style={styles.calendarNav}>{'>'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.calendarDaysRow}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <Text key={day} style={styles.calendarDayHeader}>{day}</Text>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {/* Empty slots for first week */}
          {Array(firstDayOfWeek).fill(null).map((_, idx) => (
            <View key={'empty-' + idx} style={styles.calendarCell} />
          ))}
          {/* Days */}
          {days.map(day => {
            const dateString = day.toISOString().split('T')[0];
            const isSelected = selectedDate === dateString;
            return (
              <TouchableOpacity
                key={dateString}
                style={[styles.calendarCell, isSelected && styles.calendarCellSelected]}
                onPress={() => handleDateSelect(dateString)}
              >
                <Text style={[styles.calendarDate, isSelected && styles.calendarDateSelected]}>{day.getDate()}</Text>
                {calendarTaskCounts[dateString] > 0 && (
                  <View style={styles.calendarTaskCount}>
                    <Text style={styles.calendarTaskCountText}>{calendarTaskCounts[dateString]}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // When a date is selected, filter tasks for that date
  const handleDateSelect = (dateString: string) => {
    setSelectedDate(dateString);
    setModalVisible(true);
    setFilteredTasks(getTasksForDate(dateString));
  };
  // When modal is closed, reset filteredTasks
  const handleModalClose = () => {
    setModalVisible(false);
    setFilteredTasks(null);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading tasks...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Text style={styles.screenTitle}>Monitoring Hub</Text>
      <TouchableOpacity onPress={() => setShowCalendar(!showCalendar)} style={styles.calendarToggle}>
        <Text style={styles.calendarToggleText}>{showCalendar ? 'Hide Calendar' : 'Show Calendar'}</Text>
      </TouchableOpacity>
      {showCalendar && renderCalendar()}
      {/* Floating Filter FAB (inside SafeArea) */}
      <View pointerEvents="box-none" style={[styles.fabContainer, { bottom: (insets.bottom || 0) + 72 }]}> 
        <TouchableOpacity style={styles.fab} onPress={() => setFilterModalVisible(true)}>
          <MaterialIcons name="filter-list" size={32} color="#fff" />
        </TouchableOpacity>
      </View>
      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModalContent}>
            <Text style={styles.modalTitle}>Filter by Frequency</Text>
            <ScrollView style={{ width: '100%' }}>
              {frequencyOptions.map(opt => (
                <TouchableOpacity
                  key={opt.label}
                  style={styles.filterOption}
                  onPress={() => {
                    setFilterFrequencies(prev =>
                      prev.includes(opt.value)
                        ? prev.filter(f => f !== opt.value)
                        : [...prev, opt.value]
                    );
                  }}
                >
                  <View style={styles.checkbox}>
                    {filterFrequencies.includes(opt.value) && <View style={styles.checkboxChecked} />}
                  </View>
                  <Text style={styles.filterOptionText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', marginTop: 16, justifyContent: 'space-between', width: '100%' }}>
              <Pressable style={styles.modalCloseButton} onPress={() => setFilterModalVisible(false)}>
                <Text style={styles.modalCloseButtonText}>Apply</Text>
              </Pressable>
              <Pressable style={[styles.modalCloseButton, { backgroundColor: '#f44336' }]} onPress={() => { setFilterFrequencies([]); setFilterModalVisible(false); }}>
                <Text style={styles.modalCloseButtonText}>Clear Filter</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      
      <FlatList
        data={getFilteredTasks()}
        renderItem={renderTask}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.taskList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No tasks found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subHeader: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  taskList: {
    paddingBottom: 20,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  taskTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  taskTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  taskDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  taskDetails: {
    marginBottom: 12,
  },
  taskDetail: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  taskStatus: {
    alignItems: 'flex-start',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  calendarToggle: {
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarToggleText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  calendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calendarMonth: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  calendarNav: {
    fontSize: 20,
    color: '#2196F3',
    fontWeight: 'bold',
    paddingHorizontal: 12,
  },
  calendarDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  calendarDayHeader: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
    color: '#888',
    fontSize: 13,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  calendarCellSelected: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  calendarDate: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  calendarDateSelected: {
    color: '#1976D2',
    fontWeight: 'bold',
  },
  calendarTaskCount: {
    marginTop: 2,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  calendarTaskCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxHeight: '70%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#2196F3',
  },
  modalTaskItem: {
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  modalTaskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalTaskType: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  modalCloseButton: {
    marginTop: 16,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  modalCloseButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  filterButton: {
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 24,
    alignSelf: 'center',
  },
  filterButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  fabContainer: {
    position: 'absolute',
    right: 24,
    zIndex: 100,
    width: 56,
    height: 56,
    // bottom is set dynamically
  },
  fab: {
    position: 'absolute',
    backgroundColor: '#2196F3',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    // zIndex handled by container
  },
  filterModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxHeight: '70%',
    alignItems: 'center',
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterOptionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    width: 12,
    height: 12,
    backgroundColor: '#2196F3',
    borderRadius: 3,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
});
