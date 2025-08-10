import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, Image, TouchableOpacity, FlatList, Alert, TextInput, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db, storage, auth } from '../../firebase';
import { doc, getDoc, updateDoc, getDocs, collection, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

type GroupData = {
  name?: string;
  photoURL?: string;
  members?: string[];
};

type SharedMediaItem = {
  id: string;
  type: 'image' | 'document' | 'link';
  url: string;
  name: string;
  timestamp: any;
  senderName: string;
  messageId: string;
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
  const [sharedMedia, setSharedMedia] = useState<SharedMediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        if (!groupId || !companyCode) {
          console.error('Missing required parameters:', { groupId, companyCode });
          Alert.alert('Error', 'Missing group or company information');
          return;
        }
        
        console.log('Fetching group data for:', { groupId, companyCode });
        const groupRef = doc(db, 'companies', companyCode, 'groups', groupId);
        const snap = await getDoc(groupRef);
        
        if (snap.exists()) {
          const data = snap.data() as any;
          console.log('Group data loaded:', data);
          setGroup({ name: data.name, photoURL: data.photoURL, members: data.members || [] });
          
          // Load member details
          const memberUids: string[] = Array.isArray(data.members) ? data.members : [];
          if (memberUids.length > 0) {
            console.log('Loading member details for:', memberUids);
            const usersCol = collection(db, 'companies', companyCode, 'users');
            const usersSnap = await getDocs(usersCol);
            const details = usersSnap.docs
              .map(d => ({ uid: d.id, ...(d.data() as any) }))
              .filter(u => memberUids.includes(u.uid))
              .map(u => ({ uid: u.uid, name: u.name || u.email || 'Unknown User', role: u.role, photoURL: u.photoURL }));
            console.log('Member details loaded:', details);
            setMembers(details);
          } else {
            setMembers([]);
          }
        } else {
          console.error('Group not found');
          Alert.alert('Error', 'Group not found');
          setGroup({});
        }
      } catch (e: any) {
        console.error('Failed to fetch group:', e);
        console.error('Error code:', e.code);
        console.error('Error message:', e.message);
        
        let errorMessage = 'Failed to load group data';
        if (e.code === 'permission-denied') {
          errorMessage = 'Permission denied. You may not have access to this group.';
        } else if (e.code === 'not-found') {
          errorMessage = 'Group not found.';
        } else if (e.message) {
          errorMessage = `Load failed: ${e.message}`;
        }
        
        Alert.alert('Error', errorMessage);
        setGroup({});
      } finally {
        setLoading(false);
      }
    };
    fetchGroup();
  }, [groupId, companyCode]);

  // Fetch shared media after group data is loaded
  useEffect(() => {
    if (group && !loading) {
      fetchSharedMedia();
    }
  }, [group, loading]);

  // Fetch shared media from group chat
  const fetchSharedMedia = async () => {
    try {
      if (!groupId || !companyCode) return;
      
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      setMediaLoading(true);
      const mediaItems: SharedMediaItem[] = [];

      // Fetch messages from the group chat
      const messagesRef = collection(db, 'companies', companyCode, 'groups', groupId, 'messages');
      const messagesQuery = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        limit(100) // Limit to recent messages for performance
      );
      
      const messagesSnap = await getDocs(messagesQuery);
      
      messagesSnap.docs.forEach(msgDoc => {
        const msgData = msgDoc.data();
        
        // Check for attachments
        if (msgData.attachments && Array.isArray(msgData.attachments)) {
          msgData.attachments.forEach((attachment: any, index: number) => {
            if (attachment.type === 'image' || attachment.type === 'document') {
              mediaItems.push({
                id: `${msgDoc.id}_attachment_${index}`,
                type: attachment.type,
                url: attachment.downloadURL || attachment.url,
                name: attachment.fileName || attachment.name || 'Unknown file',
                timestamp: msgData.timestamp,
                senderName: msgData.senderName || 'Unknown',
                messageId: msgDoc.id,
              });
            }
          });
        }
        
        // Check for links in text messages
        const text = msgData.text || '';
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const links = text.match(urlRegex);
        
        if (links) {
          links.forEach((link: string, index: number) => {
            mediaItems.push({
              id: `${msgDoc.id}_link_${index}`,
              type: 'link',
              url: link,
              name: link.length > 50 ? link.substring(0, 50) + '...' : link,
              timestamp: msgData.timestamp,
              senderName: msgData.senderName || 'Unknown',
              messageId: msgDoc.id,
            });
          });
        }
      });
      
      // Sort by timestamp (newest first) and limit to 50 items
      const sortedMedia = mediaItems
        .sort((a, b) => b.timestamp?.toMillis() - a.timestamp?.toMillis())
        .slice(0, 50);
      
      setSharedMedia(sortedMedia);
    } catch (error) {
      console.error('Error fetching shared media:', error);
    } finally {
      setMediaLoading(false);
    }
  };

  // Delete group function
  const deleteGroup = async () => {
    try {
      if (!groupId || !companyCode) {
        Alert.alert('Error', 'Missing group or company information');
        return;
      }

      setSaving(true);
      console.log('Deleting group:', groupId);

      // Delete the group document
      const groupRef = doc(db, 'companies', companyCode, 'groups', groupId);
      await deleteDoc(groupRef);

      Alert.alert('Success', 'Group deleted successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      console.error('Failed to delete group:', e);
      console.error('Error code:', e.code);
      console.error('Error message:', e.message);
      
      let errorMessage = 'Failed to delete group';
      if (e.code === 'permission-denied') {
        errorMessage = 'Permission denied. You may not have permission to delete this group.';
      } else if (e.code === 'unavailable') {
        errorMessage = 'Service unavailable. Please check your internet connection.';
      } else if (e.message) {
        errorMessage = `Delete failed: ${e.message}`;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  // Render shared media item
  const renderMediaItem = ({ item }: { item: SharedMediaItem }) => (
    <TouchableOpacity style={styles.mediaItem}>
      <View style={styles.mediaIcon}>
        {item.type === 'image' ? (
          <Image source={{ uri: item.url }} style={styles.mediaThumbnail} />
        ) : item.type === 'document' ? (
          <View style={styles.documentIcon}>
            <Text style={styles.documentIconText}>📄</Text>
          </View>
        ) : (
          <View style={styles.linkIcon}>
            <Text style={styles.linkIconText}>🔗</Text>
          </View>
        )}
      </View>
      <View style={styles.mediaInfo}>
        <Text style={styles.mediaName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.mediaMeta}>
          {item.senderName} • {formatTimestamp(item.timestamp)}
        </Text>
      </View>
    </TouchableOpacity>
  );

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
      if (!groupId || !companyCode) {
        Alert.alert('Error', 'Missing group or company information');
        return;
      }

      setSaving(true);
      const asset = result.assets[0];
      console.log('Uploading image:', asset.uri, 'Size:', asset.fileSize);
      
      const fileName = `group_${groupId}_${Date.now()}.jpg`;
      const storagePath = `companies/${companyCode}/group-photos/${fileName}`;
      const storageRef = ref(storage, storagePath);
      
      // Fetch the image and convert to blob
      const res = await fetch(asset.uri);
      if (!res.ok) {
        throw new Error(`Failed to fetch image: ${res.status}`);
      }
      
      const blob = await res.blob();
      console.log('Blob size:', blob.size, 'bytes');
      
      // Upload to Firebase Storage
      const uploadResult = await uploadBytes(storageRef, blob, { 
        contentType: asset.mimeType || 'image/jpeg' 
      });
      console.log('Upload successful:', uploadResult);
      
      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      console.log('Download URL:', downloadURL);

      // Update Firestore document
      const groupRef = doc(db, 'companies', companyCode, 'groups', groupId);
      await updateDoc(groupRef, { photoURL: downloadURL });
      setGroup(prev => ({ ...(prev || {}), photoURL: downloadURL }));
      
      Alert.alert('Success', 'Group photo updated successfully');
    } catch (e: any) {
      console.error('Failed to upload group photo:', e);
      console.error('Error code:', e.code);
      console.error('Error message:', e.message);
      
      let errorMessage = 'Failed to upload group photo';
      if (e.code === 'storage/unauthorized') {
        errorMessage = 'Permission denied. Please check your Firebase Storage rules.';
      } else if (e.code === 'storage/quota-exceeded') {
        errorMessage = 'Storage quota exceeded. Please try a smaller image.';
      } else if (e.code === 'storage/unauthenticated') {
        errorMessage = 'Authentication required. Please log in again.';
      } else if (e.message) {
        errorMessage = `Upload failed: ${e.message}`;
      }
      
      Alert.alert('Error', errorMessage);
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
      const trimmedName = newName.trim();
      if (!trimmedName) {
        Alert.alert('Error', 'Group name cannot be empty');
        return;
      }
      
      if (trimmedName.length > 50) {
        Alert.alert('Error', 'Group name must be 50 characters or less');
        return;
      }
      
      if (!groupId || !companyCode) {
        Alert.alert('Error', 'Missing group or company information');
        setEditingName(false);
        return;
      }
      
      setSaving(true);
      console.log('Updating group name to:', trimmedName);
      
      const groupRef = doc(db, 'companies', companyCode, 'groups', groupId);
      await updateDoc(groupRef, { name: trimmedName });
      setGroup(prev => ({ ...(prev || {}), name: trimmedName }));
      
      Alert.alert('Success', 'Group name updated successfully');
    } catch (e: any) {
      console.error('Failed to update group name:', e);
      console.error('Error code:', e.code);
      console.error('Error message:', e.message);
      
      let errorMessage = 'Failed to update group name';
      if (e.code === 'permission-denied') {
        errorMessage = 'Permission denied. You may not have permission to edit this group.';
      } else if (e.code === 'unavailable') {
        errorMessage = 'Service unavailable. Please check your internet connection.';
      } else if (e.message) {
        errorMessage = `Update failed: ${e.message}`;
      }
      
      Alert.alert('Error', errorMessage);
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

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.groupHeader}>
          <TouchableOpacity onPress={pickGroupPhoto} disabled={saving}>
            {group.photoURL ? (
              <Image source={{ uri: group.photoURL }} style={styles.groupPhoto} />
            ) : (
              <View style={styles.groupPhotoPlaceholder}>
                {saving ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Text style={styles.groupPhotoText}>📷</Text>
                )}
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
                  autoFocus
                  maxLength={50}
                  editable={!saving}
                />
                <View style={styles.nameButtons}>
                  <TouchableOpacity onPress={() => setEditingName(false)} style={styles.smallButton} disabled={saving}>
                    <Text style={styles.smallButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveGroupName} style={[styles.smallButton, styles.saveButton]} disabled={saving}>
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={[styles.smallButtonText, { color: '#fff' }]}>Save</Text>
                    )}
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
          scrollEnabled={false}
        />

        {/* Shared Media Section */}
        <Text style={styles.sectionTitle}>Shared Media</Text>
        {mediaLoading ? (
          <View style={styles.mediaLoadingContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.mediaLoadingText}>Loading shared media...</Text>
          </View>
        ) : sharedMedia.length > 0 ? (
          <FlatList
            data={sharedMedia}
            renderItem={renderMediaItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            ListHeaderComponent={
              <Text style={styles.mediaCountText}>
                {sharedMedia.length} item{sharedMedia.length !== 1 ? 's' : ''} shared
              </Text>
            }
          />
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            <Text style={styles.emptyText}>No shared media found</Text>
          </View>
        )}

        {/* Delete Group Button */}
        <View style={styles.deleteSection}>
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={() => {
              Alert.alert(
                'Delete Group',
                'Are you sure you want to delete this group? This action cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Delete', 
                    style: 'destructive',
                    onPress: deleteGroup
                  }
                ]
              );
            }}
          >
            <Text style={styles.deleteButtonText}>Delete Group</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  mediaItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 12 },
  mediaIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  mediaThumbnail: { width: '100%', height: '100%', borderRadius: 12 },
  documentIcon: { width: '100%', height: '100%', borderRadius: 12, backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' },
  documentIconText: { fontSize: 24, color: '#555' },
  linkIcon: { width: '100%', height: '100%', borderRadius: 12, backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' },
  linkIconText: { fontSize: 24, color: '#555' },
  mediaInfo: { flex: 1 },
  mediaName: { fontSize: 16, color: '#000', fontWeight: '600' },
  mediaMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  mediaLoadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  mediaLoadingText: { marginLeft: 10, color: '#666', fontSize: 14 },
  mediaCountText: { fontSize: 14, color: '#666', marginBottom: 10 },
  deleteSection: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  deleteButton: { backgroundColor: '#ff4444', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  scrollContent: { flex: 1 },
});


