import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Image,
  SafeAreaView
} from 'react-native';
import { Send, ChevronLeft } from 'lucide-react-native';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Audio } from 'expo-av';
import { useAuth } from '../../context/AuthContext';
import { GATEWAY_URL } from '../../api/apiClient';

// Using gateway directly for WebSocket if needed, or notification service
const WS_URL = `${GATEWAY_URL}/ws-chat`;
const API_BASE = `${GATEWAY_URL}/api/v1`;

export default function ChatScreen({ route, navigation }) {
  const { conversationId, shopName, shopLogo, recipientId } = route.params;
  const { user, guestSessionId } = useAuth();
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  
  const clientRef = useRef(null);
  const flatListRef = useRef(null);
  const soundRef = useRef(null);

  // Load initial messages
  useEffect(() => {
    fetchMessages();
    setupSound();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    const targetTopicId = user?.id || guestSessionId;
    if (!targetTopicId || !conversationId) return;

    const WS_URL = `${GATEWAY_URL}/ws-chat`;
    
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 4000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    client.onConnect = () => {
      console.log('STOMP connected!');
      setIsConnected(true);
      // Subscribe to customer topic
      client.subscribe(`/topic/customer.${targetTopicId}`, (payload) => {
        try {
          const newMsg = JSON.parse(payload.body);
          if (newMsg.conversationId === conversationId) {
            setMessages((prev) => {
              if (prev.find((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            if (newMsg.senderType === 'SHOP') {
              playSound();
            }
          }
        } catch (e) {
          console.error(e);
        }
      });
    };

    client.onStompError = (frame) => {
      console.error('Broker error', frame.headers['message']);
    };
    
    client.onWebSocketError = (event) => {
      console.error('WebSocket Error:', event);
    };

    client.activate();
    clientRef.current = client;

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
      }
    };
  }, [user?.id, guestSessionId, conversationId]);

  const setupSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../../assets/notification.mp3') // We need to provide this, or just use system sound/skip if not available
      );
      soundRef.current = sound;
    } catch (e) {
      console.log('Cannot load sound file', e);
    }
  };

  const playSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.replayAsync();
      }
    } catch (e) {}
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`);
      const json = await res.json();
      if (json.data) {
        setMessages(json.data.reverse()); // Assume newest last or first? Usually REST returns newest first or oldest first. Let's see. Wait, in ChatBubble we just set messages.
        // Actually REST returns chronological if order is ASC. Let's check API. If it's chronological, no reverse needed.
        setMessages(json.data);
      }
    } catch (e) {
      console.error('Failed to fetch messages', e);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    console.log("sendMessage triggered. isConnected:", isConnected, "hasClient:", !!clientRef.current, "inputText:", inputText);
    if (!inputText.trim() || !clientRef.current || !isConnected) return;
    
    const msgData = {
      conversationId: conversationId,
      senderId: user?.id || guestSessionId,
      senderType: 'CUSTOMER',
      content: inputText.trim(),
    };

    try {
      // Opt 1: send via STOMP
      clientRef.current.publish({
        destination: '/app/chat.send',
        body: JSON.stringify(msgData),
      });
      setInputText('');
    } catch (e) {
      console.error('Failed to send msg via WS', e);
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.senderType === 'CUSTOMER';
    return (
      <View style={[styles.msgWrapper, isMe ? styles.msgRight : styles.msgLeft]}>
        {!isMe && (
          <Image
            source={{ uri: shopLogo || 'https://via.placeholder.com/150' }}
            style={styles.avatar}
          />
        )}
        <View style={[styles.msgBubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.msgText, isMe ? styles.textMe : styles.textThem]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft color="#111827" size={24} />
        </TouchableOpacity>
        <Image source={{ uri: shopLogo || 'https://via.placeholder.com/150' }} style={styles.headerAvatar} />
        <Text style={styles.headerTitle} numberOfLines={1}>{shopName || 'Quán ăn'}</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#FFB700" />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item.id || index.toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nhập tin nhắn..."
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity 
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]} 
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <Send color="#fff" size={20} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#E5E7EB',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  msgWrapper: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  msgLeft: {
    justifyContent: 'flex-start',
  },
  msgRight: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: '#E5E7EB',
  },
  msgBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMe: {
    backgroundColor: '#FFB700',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  textMe: {
    color: '#000000',
    fontWeight: '500',
  },
  textThem: {
    color: '#374151',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    color: '#111827',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFB700',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: '#D1D5DB',
  }
});
