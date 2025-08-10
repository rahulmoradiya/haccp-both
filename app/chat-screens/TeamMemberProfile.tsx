import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, Image, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db, auth } from '../../firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

type ProfileData = {
  name?: string;
  email?: string;
  role?: string;
  departmentName?: string;
  responsibilities?: string[];
  photoURL?: string;
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

export default function TeamMemberProfile() {
  const { userId, companyCode } = useLocalSearchParams<{ userId: string; companyCode: string }>();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharedMedia, setSharedMedia] = useState<SharedMediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!userId || !companyCode) return;
        const userRef = doc(db, 'companies', companyCode, 'users', userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data() as any;
          setProfile({
            name: data.name || data.email || 'Unknown User',
            email: data.email,
            role: data.role,
            departmentName: data.departmentName,
            responsibilities: Array.isArray(data.responsibilities) ? data.responsibilities : [],
            photoURL: data.photoURL,
          });
        } else {
          setProfile({});
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId, companyCode]);

  // Fetch shared media after profile is loaded
  useEffect(() => {
    if (profile && !loading) {
      fetchSharedMedia();
    }
  }, [profile, loading]);

  // Fetch shared media from conversations
  const fetchSharedMedia = async () => {
    try {
      if (!userId || !companyCode) return;
      
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      setMediaLoading(true);
      const mediaItems: SharedMediaItem[] = [];

      // Find the conversation between current user and profile user
      const conversationsRef = collection(db, 'companies', companyCode, 'conversations');
      const conversationsQuery = query(
        conversationsRef,
        where('participants', 'array-contains', currentUser.uid)
      );
      
      const conversationsSnap = await getDocs(conversationsQuery);
      
      for (const convDoc of conversationsSnap.docs) {
        const convData = convDoc.data();
        const participants = convData.participants || [];
        
        // Check if this conversation includes the profile user
        if (participants.includes(userId)) {
          // Fetch messages from this conversation
          const messagesRef = collection(db, 'companies', companyCode, 'conversations', convDoc.id, 'messages');
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
        }
      }
      
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

  // Helper function to get file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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

  if (loading) {
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
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          {profile?.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {(profile?.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.name}>{profile?.name || 'Unknown User'}</Text>
          {profile?.email && <Text style={styles.email}>{profile.email}</Text>}
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <Text style={styles.detailItem}>Role: {profile?.role || 'Not set'}</Text>
          <Text style={styles.detailItem}>Department: {profile?.departmentName || 'Not set'}</Text>
        </View>

        {/* Responsibilities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Responsibilities</Text>
          {profile?.responsibilities && profile.responsibilities.length > 0 ? (
            profile.responsibilities.map((r, idx) => (
              <Text key={idx} style={styles.responsibilityItem}>• {r}</Text>
            ))
          ) : (
            <Text style={styles.detailItem}>None listed</Text>
          )}
        </View>

        {/* Shared Media */}
        <View style={styles.section}>
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
              ListHeaderComponent={
                <Text style={styles.mediaCountText}>
                  {sharedMedia.length} item{sharedMedia.length !== 1 ? 's' : ''} shared
                </Text>
              }
            />
          ) : (
            <Text style={styles.detailItem}>No shared media found</Text>
          )}
        </View>
      </ScrollView>
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
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    position: 'absolute',
    left: 10,
    top: 10,
    zIndex: 1,
  },
  backButtonText: {
    fontSize: 24,
    color: '#007AFF',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  detailItem: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
  },
  responsibilityItem: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  mediaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 8,
  },
  mediaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mediaThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  documentIcon: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  documentIconText: {
    fontSize: 24,
    color: '#fff',
  },
  linkIcon: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  linkIconText: {
    fontSize: 24,
    color: '#fff',
  },
  mediaInfo: {
    flex: 1,
  },
  mediaName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  mediaMeta: {
    fontSize: 12,
    color: '#666',
  },
  mediaLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  mediaLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  mediaCountText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
});


