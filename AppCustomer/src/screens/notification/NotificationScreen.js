import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Platform,
} from 'react-native';
import { ChevronLeft, Bell, CheckCheck, ShoppingBag, Info, AlertCircle } from 'lucide-react-native';
import { useNotification } from '../../context/NotificationContext';
import moment from 'moment';
import 'moment/locale/vi';

moment.locale('vi');

export default function NotificationScreen({ navigation }) {
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotification();

  const [activeTab, setActiveTab] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchNotifications(), fetchUnreadCount()]);
    setRefreshing(false);
  };

  const filteredNotifications =
    activeTab === 'unread'
      ? notifications.filter((n) => !n.readAt && n.status !== 'READ')
      : notifications;

  const handleNotificationPress = (item) => {
    const isUnread = !item.readAt && item.status !== 'READ';
    if (isUnread) {
      markAsRead(item.id);
    }
    if (item.referenceId) {
      navigation.navigate('OrderDetail', { orderId: item.referenceId });
    }
  };

  const renderItem = ({ item }) => {
    const isUnread = !item.readAt && item.status !== 'READ';
    const isOrder = item.notificationType === 'ORDER_STATUS';

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleNotificationPress(item)}
        style={[styles.itemCard, isUnread && styles.itemCardUnread]}
      >
        <View style={[styles.iconBox, isOrder ? styles.orderBox : styles.infoBox]}>
          {isOrder ? (
            <ShoppingBag size={20} color="#D97706" />
          ) : (
            <Info size={20} color="#2563EB" />
          )}
        </View>

        <View style={styles.contentBox}>
          <View style={styles.rowBetween}>
            <Text style={[styles.title, isUnread && styles.titleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.timeText}>
              {item.createdAt ? moment(item.createdAt).fromNow() : ''}
            </Text>
          </View>

          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>

          {item.referenceId && (
            <Text style={styles.orderRef}>Chi tiết đơn #{item.referenceId} →</Text>
          )}
        </View>

        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Thông báo</Text>

        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={markAllAsRead}
            style={styles.markAllButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <CheckCheck size={16} color="#D97706" />
            <Text style={styles.markAllText}>Đọc hết</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => setActiveTab('all')}
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            Tất cả ({notifications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('unread')}
          style={[styles.tab, activeTab === 'unread' && styles.activeTab]}
        >
          <Text style={[styles.tabText, activeTab === 'unread' && styles.activeTabText]}>
            Chưa đọc ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#D97706']}
            tintColor="#D97706"
          />
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <Bell size={40} color="#9CA3AF" />
              </View>
              <Text style={styles.emptyTitle}>Chưa có thông báo nào</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'unread'
                  ? 'Bạn đã đọc toàn bộ thông báo rồi!'
                  : 'Các thông tin về đơn hàng và ưu đãi sẽ xuất hiện ở đây.'}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    padding: 6,
    marginLeft: -6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#D97706',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#D97706',
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  itemCardUnread: {
    backgroundColor: '#FFFDF7',
    borderColor: '#FDE68A',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  orderBox: {
    backgroundColor: '#FEF3C7',
  },
  infoBox: {
    backgroundColor: '#DBEAFE',
  },
  contentBox: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    marginRight: 6,
  },
  titleUnread: {
    fontWeight: '800',
    color: '#111827',
  },
  timeText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  body: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
  },
  orderRef: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
    marginTop: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D97706',
    marginLeft: 6,
    marginTop: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
});
