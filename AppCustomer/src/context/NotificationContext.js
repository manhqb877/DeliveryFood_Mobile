import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';
import { useAuth } from './AuthContext';
import { notificationApi } from '../api/notificationApi';
import { GATEWAY_URL } from '../api/apiClient';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeToast, setActiveToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const soundRef = useRef(null);
  const clientRef = useRef(null);

  // Setup sound
  useEffect(() => {
    let soundObj = null;
    const loadAudio = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/notification.mp3')
        );
        soundObj = sound;
        soundRef.current = sound;
      } catch (e) {
        // audio asset might not exist yet, that's fine
      }
    };
    loadAudio();
    return () => {
      if (soundObj) {
        soundObj.unloadAsync();
      }
    };
  }, []);

  const playNotificationSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.replayAsync();
      }
    } catch (_) {}
  };

  const dismissToast = useCallback(() => {
    setActiveToast(null);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
  }, []);

  const showToast = useCallback(
    ({ title, message, referenceId = null, notificationType = 'ORDER_STATUS' }) => {
      dismissToast();
      setActiveToast({ title, message, referenceId, notificationType });
      toastTimeoutRef.current = setTimeout(() => {
        dismissToast();
      }, 4500);
    },
    [dismissToast]
  );

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await notificationApi.getUnreadCount(user.id);
      if (res && res.data !== undefined) {
        setUnreadCount(Number(res.data) || 0);
      }
    } catch (e) {
      console.log('Error fetching unread notification count', e);
    }
  }, [user?.id]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await notificationApi.getNotifications(user.id);
      if (res && Array.isArray(res.data)) {
        setNotifications(res.data);
      }
    } catch (e) {
      console.log('Error fetching notifications list', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const markAsRead = useCallback(async (id) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'READ', readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.log('Error marking notification as read', e);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    try {
      await notificationApi.markAllAsRead(user.id);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, status: 'READ', readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (e) {
      console.log('Error marking all notifications as read', e);
    }
  }, [user?.id]);

  // Initial load
  useEffect(() => {
    if (user?.id) {
      fetchUnreadCount();
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user?.id, fetchUnreadCount, fetchNotifications]);

  // Real-time WebSocket connection
  useEffect(() => {
    if (!user?.id) return;

    const wsUrl = `${GATEWAY_URL}/ws-chat`;
    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      reconnectDelay: 4000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    const handleIncoming = (payload) => {
      try {
        const item = JSON.parse(payload.body);
        if (!item || !item.id) return;

        playNotificationSound();
        showToast({
          title: item.title,
          message: item.body,
          referenceId: item.referenceId,
          notificationType: item.notificationType,
        });

        setNotifications((prev) => {
          if (prev.some((n) => n.id === item.id)) return prev;
          return [item, ...prev];
        });
        setUnreadCount((prev) => prev + 1);
      } catch (err) {
        console.error('Error handling notification socket message', err);
      }
    };

    client.onConnect = () => {
      client.subscribe(`/topic/notifications.${user.id}`, handleIncoming);
      client.subscribe(`/topic/notifications.customer.${user.id}`, handleIncoming);
    };

    client.activate();
    clientRef.current = client;

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
      }
    };
  }, [user?.id, showToast]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        activeToast,
        showToast,
        dismissToast,
        markAsRead,
        markAllAsRead,
        fetchNotifications,
        fetchUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
