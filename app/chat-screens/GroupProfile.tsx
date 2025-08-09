import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, Image, TouchableOpacity, FlatList, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db, storage } from '../../firebase';
import { doc, getDoc, updateDoc, getDocs, collection } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

type GroupData = {
  name?: string;
  photoURL?: string;
  members?: string[];
};

export default function GroupProfile() {
  const router = useRouter();
  const { groupId, companyCode } = useLocalSearchParams<{ groupId: string; companyCode: string }>();
  const [group, setGroup] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [members, setMembers] = useState<Array<{ uid: string; name: string; role?: string; photoURL?: string }>>([]);

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        if (!groupId || !companyCode) return;
        const groupRef = doc(db, 'companies', companyCode, 'groups', groupId);
        const snap = await getDoc(groupRef);
        if (snap.exists()) {
          const data = snap.data() as any;
          setGroup({ name: data.name, photoURL: data.photoURL, members: data.members || [] });
          // Load member details
          const memberUids: string[] = Array.isArray(data.members) ? data.members : [];
          if (memberUids.length > 0) {
            const usersCol = collection(db, 'companies', companyCode, 'users');
            const usersSnap = await getDocs(usersCol);
            const details = usersSnap.docs
              .map(d => ({ uid: d.id, ...(d.data() as any) }))
              .filter(u => memberUids.includes(u.uid))
              .map(u => ({ uid: u.uid, name: u.name || u.email || 'Unknown User', role: u.role, photoURL: u.photoURL }));
            setMembers(details);
          } else {
            setMembers([]);
          }
        } else {
          setGroup({});
        }
      } finally {
        setLoading(false);
      }
    };
    fetchGroup();
  }, [groupId, companyCode]);

  const pickGroupPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library permission is required');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      if (!groupId || !companyCode) return;

      setSaving(true);
      const asset = result.assets[0];
      const fileName = `group_${groupId}_${Date.now()}.jpg`;
      const storagePath = `companies/${companyCode}/group-photos/${fileName}`;
      const storageRef = ref(storage, storagePath);
      const res = await fetch(asset.uri);
      const blob = await res.blob();
      await uploadBytes(storageRef, blob, { contentType: asset.mimeType || 'image/jpeg' });
      const downloadURL = await getDownloadURL(storageRef);

      const groupRef = doc(db, 'companies', companyCode, 'groups', groupId);
      await updateDoc(groupRef, { photoURL: downloadURL });
      setGroup(prev => ({ ...(prev || {}), photoURL: downloadURL }));
    } catch (e) {
      console.error('Failed to upload group photo:', e);
      Alert.alert('Error', 'Failed to upload group photo');
    } finally {
      setSaving(false);
    }
  };

  const startEditName = () => {
    setNewName(group?.name || '');
    setEditingName(true);
  };

  const saveGroupName = async () => {
    try {
      if (!newName.trim() || !groupId || !companyCode) {
        setEditingName(false);
        return;
      }
      setSaving(true);
      const groupRef = doc(db, 'companies', companyCode, 'groups', groupId);
      await updateDoc(groupRef, { name: newName.trim() });
      setGroup(prev => ({ ...(prev || {}), name: newName.trim() }));
    } catch (e) {
      console.error('Failed to update group name:', e);
      Alert.alert('Error', 'Failed to update group name');
    } finally {
      setSaving(false);
      setEditingName(false);
    }
  };

  const renderMember = ({ item }: { item: { uid: string; name: string; role?: string; photoURL?: string } }) => (
    <TouchableOpacity
      style={styles.memberItem}
      onPress={() => router.push({ pathname: '/chat-screens/TeamMemberProfile', params: { userId: item.uid, companyCode: companyCode as string } })}
    >
      <View style={styles.memberAvatar}>
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={styles.memberAvatarImg} />
        ) : (
          <Text style={styles.memberAvatarInitial}>{item.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.memberName}>{item.name}</Text>
      </View>
      {item.role ? (
        <View style={styles.roleTag}><Text style={styles.roleTagText}>{item.role}</Text></View>
      ) : null}
    </TouchableOpacity>
  );

  if (loading || !group) {
    return (
      <SafeAreaView style={styles.container}> 
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Group Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.groupHeader}>
        <TouchableOpacity onPress={pickGroupPhoto} disabled={saving}>
          {group.photoURL ? (
            <Image source={{ uri: group.photoURL }} style={styles.groupPhoto} />
          ) : (
            <View style={styles.groupPhotoPlaceholder}>
              <Text style={styles.groupPhotoText}>📷</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          {editingName ? (
            <View>
              <TextInput
                style={styles.nameInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="Group name"
              />
              <View style={styles.nameButtons}>
                <TouchableOpacity onPress={() => setEditingName(false)} style={styles.smallButton}>
                  <Text style={styles.smallButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveGroupName} style={[styles.smallButton, styles.saveButton]} disabled={saving}>
                  <Text style={[styles.smallButtonText, { color: '#fff' }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.groupName}>{group.name || 'Unnamed Group'}</Text>
              <TouchableOpacity onPress={startEditName} disabled={saving}>
                <Text style={styles.editLink}>Edit name</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Members</Text>
      <FlatList
        data={members}
        keyExtractor={(m) => m.uid}
        renderItem={renderMember}
        ListEmptyComponent={<Text style={styles.emptyText}>No members</Text>}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: { fontSize: 24, fontWeight: 'bold', color: '#007AFF', marginRight: 12 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#000', flex: 1 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  groupPhoto: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#eee' },
  groupPhotoPlaceholder: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center',
  },
  groupPhotoText: { fontSize: 24 },
  groupName: { fontSize: 20, fontWeight: '700', color: '#000' },
  editLink: { marginTop: 4, color: '#007AFF' },
  sectionTitle: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, fontWeight: '600', color: '#333' },
  memberItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  memberAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  memberAvatarInitial: { fontSize: 16, color: '#555', fontWeight: '600' },
  memberName: { fontSize: 16, color: '#000' },
  roleTag: { backgroundColor: '#eef3ff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  roleTagText: { color: '#3366ff', fontSize: 12, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#666', padding: 16 },
  nameInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff' },
  nameButtons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  smallButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f0f0f0' },
  saveButton: { backgroundColor: '#007AFF' },
  smallButtonText: { color: '#333', fontSize: 14 },
});


