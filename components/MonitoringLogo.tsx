import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

interface MonitoringLogoProps {
  size?: number;
  color?: string;
}

export default function MonitoringLogo({ size = 50, color = '#3B82F6' }: MonitoringLogoProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Network nodes represented as circles */}
      <View style={styles.networkContainer}>
        <View style={[styles.node, styles.node1, { backgroundColor: color }]} />
        <View style={[styles.node, styles.node2, { backgroundColor: color }]} />
        <View style={[styles.node, styles.node3, { backgroundColor: color }]} />
        <View style={[styles.node, styles.node4, { backgroundColor: color }]} />
        <View style={[styles.node, styles.node5, { backgroundColor: color }]} />
        
        {/* Connection lines */}
        <View style={[styles.connection, styles.connection1, { backgroundColor: color }]} />
        <View style={[styles.connection, styles.connection2, { backgroundColor: color }]} />
        <View style={[styles.connection, styles.connection3, { backgroundColor: color }]} />
        <View style={[styles.connection, styles.connection4, { backgroundColor: color }]} />
      </View>
      
      {/* Magnifying glass */}
      <View style={styles.magnifyingGlass}>
        <View style={[styles.glassCircle, { borderColor: color }]}>
          <View style={styles.redDot} />
        </View>
        <View style={[styles.glassHandle, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  networkContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  node: {
    position: 'absolute',
    borderRadius: 3,
    opacity: 0.8,
  },
  node1: {
    width: 6,
    height: 6,
    top: 8,
    left: 8,
  },
  node2: {
    width: 6,
    height: 6,
    top: 8,
    right: 8,
  },
  node3: {
    width: 8,
    height: 8,
    top: '50%',
    left: '50%',
    marginTop: -4,
    marginLeft: -4,
    opacity: 1,
  },
  node4: {
    width: 6,
    height: 6,
    bottom: 8,
    left: 8,
  },
  node5: {
    width: 6,
    height: 6,
    bottom: 8,
    right: 8,
  },
  connection: {
    position: 'absolute',
    height: 1,
    opacity: 0.6,
  },
  connection1: {
    width: 20,
    top: '50%',
    left: '20%',
    transform: [{ rotate: '45deg' }],
  },
  connection2: {
    width: 20,
    top: '50%',
    right: '20%',
    transform: [{ rotate: '-45deg' }],
  },
  connection3: {
    width: 20,
    bottom: '50%',
    left: '20%',
    transform: [{ rotate: '-45deg' }],
  },
  connection4: {
    width: 20,
    bottom: '50%',
    right: '20%',
    transform: [{ rotate: '45deg' }],
  },
  magnifyingGlass: {
    position: 'absolute',
    bottom: 5,
    right: 5,
  },
  glassCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  redDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EF4444',
  },
  glassHandle: {
    position: 'absolute',
    width: 2,
    height: 8,
    bottom: -6,
    right: -6,
    transform: [{ rotate: '45deg' }],
  },
});
