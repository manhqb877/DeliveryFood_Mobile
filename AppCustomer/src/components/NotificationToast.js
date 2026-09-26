import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Bell, ShoppingBag, X } from 'lucide-react-native';
import { useNotification } from '../context/NotificationContext';
import { useNavigation } from '@react-navigation/native';

export default function NotificationToast() {
  const { activeToast, dismissToast } = useNotification();
  let navigation = null;
  try {
    navigation = useNavigation();
  } catch (_) {}

  if (!activeToast) return null;

  const isOrder = activeToast.notificationType === 'ORDER_STATUS';

  const handlePress = () => {
    const refId = activeToast.referenceId;
    dismissToast();
    if (refId && navigation) {
      navigation.navigate('OrderDetail', { orderId: refId });
    } else if (navigation) {
      navigation.navigate('Notifications');
    }
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        style={styles.toast}
      >
        <View style={[styles.iconContainer, isOrder ? styles.orderIcon : styles.infoIcon]}>
          {isOrder ? (
            <ShoppingBag size={20} color="#D97706" />
          ) : (
            <Bell size={20} color="#2563EB" />
          )}
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {activeToast.title}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {activeToast.message}
          </Text>
          {activeToast.referenceId ? (
            <Text style={styles.actionText}>Chạm để xem chi tiết đơn hàng →</Text>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={dismissToast}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 50,
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  orderIcon: {
    backgroundColor: '#FEF3C7',
  },
  infoIcon: {
    backgroundColor: '#DBEAFE',
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  message: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
    lineHeight: 16,
  },
  actionText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '700',
    marginTop: 4,
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
  },
});
