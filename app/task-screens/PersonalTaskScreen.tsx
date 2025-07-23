import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';

type PersonalTaskScreenRouteProp = {
  params: {
    task: string;
  };
};

export default function PersonalTaskScreen() {
  const route = useRoute<RouteProp<PersonalTaskScreenRouteProp, 'params'>>();
  const task = JSON.parse(route.params.task);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Personal Task</Text>
      <Text style={styles.taskTitle}>{task.title || 'Untitled Task'}</Text>
      <Text style={styles.data}>{JSON.stringify(task, null, 2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  data: {
    fontSize: 14,
    color: '#333',
  },
}); 