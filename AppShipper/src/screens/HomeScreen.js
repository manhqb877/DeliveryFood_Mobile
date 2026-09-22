import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Switch, RefreshControl, Alert, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useShipper } from '../context/ShipperContext';
import apiClient from '../lib/apiClient';
import { startBackgroundTracking, stopBackgroundTracking } from '../lib/backgroundLocation';

const GPS_INTERVAL_MS = 8000;

function formatCurrency(n) {
  return n ? n.toLocaleString('vi-VN') + 'đ' : '0đ';
}

function statusColor(s) {
  const map = { PENDING: '#F59E0B', ASSIGNED: '#3B82F6', GOING_PICKUP: '#8B5CF6', PICKED_UP: '#10B981', DELIVERING: '#10B981' };
  return map[s] || '#6B7280';
}

function statusLabel(s) {
  const map = { PENDING: 'Chờ nhận', ASSIGNED: 'Đã nhận', GOING_PICKUP: 'Đang đến lấy', PICKED_UP: 'Đã lấy hàng', DELIVERING: 'Đang giao' };
  return map[s] || s;
}

export default function HomeScreen({ navigation }) {
  const { shipper, logout } = useShipper();
  const [isOnline, setIsOnline] = useState(false);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('AVAILABLE'); // 'AVAILABLE' | 'ACTIVE'
  const gpsRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation khi online
  useEffect(() => {
    if (!isOnline) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isOnline]);

  const fetchDeliveries = useCallback(async () => {
    try {
      const [available, active] = await Promise.all([
        apiClient.get('/tracking/deliveries/available').catch(() => []),
        apiClient.get(`/tracking/shippers/${shipper?.id}/deliveries/active`).catch(() => []),
      ]);
      const availList = Array.isArray(available) ? available : [];
      const activeList = Array.isArray(active) ? active : [];
      const activeIds = new Set(activeList.map(d => d.id));
      const merged = [...activeList.map(d => ({ ...d, _mine: true })), ...availList.filter(d => !activeIds.has(d.id))];
      setDeliveries(merged);
    } catch (e) {
      console.warn('[Home] fetchDeliveries error', e?.message);
    }
  }, [shipper?.id]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const filteredDeliveries = deliveries.filter(d => {
    if (selectedTab === 'AVAILABLE') return !d._mine;
    if (selectedTab === 'ACTIVE') return d._mine;
    return true;
  });

  // GPS broadcast khi online
  useEffect(() => {
    if (isOnline && shipper?.id) {
      const broadcast = async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          await apiClient.patch(`/tracking/shippers/${shipper.id}/location`, {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            headingDeg: loc.coords.heading,
            speedMs: loc.coords.speed,
            isOnline: true,
          });
        } catch (_) {}
      };
      broadcast();
      gpsRef.current = setInterval(broadcast, GPS_INTERVAL_MS);
    } else {
      if (gpsRef.current) { clearInterval(gpsRef.current); gpsRef.current = null; }
    }
    return () => { if (gpsRef.current) clearInterval(gpsRef.current); };
  }, [isOnline, shipper?.id]);

  const handleToggleOnline = async (val) => {
    if (val) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Cần quyền GPS', 'Hãy cấp quyền định vị để nhận đơn');
        return;
      }
      await startBackgroundTracking(shipper?.id);
    } else {
      await stopBackgroundTracking();
    }
    setIsOnline(val);
  };

  const handleAccept = async (delivery) => {
    try {
      await apiClient.post(`/tracking/deliveries/${delivery.id}/accept?shipperId=${shipper?.id}`);
      Alert.alert('✅ Nhận đơn thành công!', 'Hãy đến lấy hàng tại quán', [
        { text: 'Xem bản đồ', onPress: () => navigation.navigate('OrderDetail', { delivery }) },
        { text: 'Để sau' },
      ]);
      fetchDeliveries();
    } catch (e) {
      Alert.alert('Lỗi', e?.response?.data?.message || 'Không thể nhận đơn');
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, item._mine && styles.cardMine]}
      onPress={() => navigation.navigate('OrderDetail', { delivery: item })}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '20', borderColor: statusColor(item.status) }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} />
          <Text style={[styles.statusText, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
        </View>
        <Text style={styles.orderId}>{item.orderCode ? item.orderCode : `Mã đơn: #${String(item.orderId || item.id).slice(-8).toUpperCase()}`}</Text>
      </View>

      {/* Route */}
      <View style={styles.routeBox}>
        <View style={styles.routeRow}>
          <Text style={styles.routeIcon}>🏪</Text>
          <Text style={styles.routeAddr} numberOfLines={1}>{item.pickupAddress || 'Địa chỉ quán'}</Text>
        </View>
        <View style={styles.routeDash} />
        <View style={styles.routeRow}>
          <Text style={styles.routeIcon}>📍</Text>
          <Text style={styles.routeAddr} numberOfLines={1}>{item.deliveryAddress || 'Địa chỉ khách'}</Text>
        </View>
      </View>

      {/* Meta */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>COD</Text>
          <Text style={[styles.metaValue, { color: '#F59E0B' }]}>{formatCurrency(item.codAmount)}</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Khoảng cách</Text>
          <Text style={styles.metaValue}>{item.estimatedDistanceM ? `${(item.estimatedDistanceM / 1000).toFixed(1)} km` : '--'}</Text>
        </View>
        {!item._mine && (
          <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item)}>
            <Text style={styles.acceptBtnText}>Nhận đơn</Text>
          </TouchableOpacity>
        )}
        {item._mine && (
          <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: '#10B981' }]}
            onPress={() => navigation.navigate('OrderDetail', { delivery: item })}>
            <Text style={styles.acceptBtnText}>Tiếp tục →</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FACC15" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Xin chào, {shipper?.fullName?.split(' ').pop() || 'Shipper'} 👋</Text>
          <Text style={styles.subGreeting}>{deliveries.length} đơn đang chờ</Text>
        </View>
        <View style={styles.headerRight}>
          <Animated.View style={[styles.onlineDot, { transform: [{ scale: isOnline ? pulseAnim : 1 }], backgroundColor: isOnline ? '#22C55E' : '#9CA3AF' }]} />
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            trackColor={{ false: '#374151', true: '#BBF7D0' }}
            thumbColor={isOnline ? '#22C55E' : '#9CA3AF'}
          />
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={{ color: '#fff', fontSize: 12 }}>Thoát</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tabBtn, selectedTab === 'AVAILABLE' && styles.tabBtnActive]} onPress={() => setSelectedTab('AVAILABLE')}>
          <Text style={[styles.tabText, selectedTab === 'AVAILABLE' && styles.tabTextActive]}>Chưa nhận</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, selectedTab === 'ACTIVE' && styles.tabBtnActive]} onPress={() => setSelectedTab('ACTIVE')}>
          <Text style={[styles.tabText, selectedTab === 'ACTIVE' && styles.tabTextActive]}>Đã nhận</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredDeliveries}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchDeliveries(); setRefreshing(false); }} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{isOnline ? '⏳' : '😴'}</Text>
            <Text style={styles.emptyText}>{isOnline ? 'Chưa có đơn hàng mới' : 'Bật nhận đơn để bắt đầu'}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#FACC15', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  greeting: { fontSize: 18, fontWeight: '700', color: '#111827' },
  subGreeting: { fontSize: 13, color: 'rgba(0,0,0,0.7)', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },
  logoutBtn: { backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#E5E7EB', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#111827' },
  tabText: { fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#FACC15' },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  cardMine: { borderLeftWidth: 4, borderLeftColor: '#3B82F6' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  orderId: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  routeBox: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginBottom: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeIcon: { fontSize: 16 },
  routeAddr: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '500' },
  routeDash: { height: 1, borderStyle: 'dashed', borderWidth: 0.5, borderColor: '#CBD5E1', marginVertical: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metaItem: { flex: 1 },
  metaLabel: { fontSize: 11, color: '#9CA3AF' },
  metaValue: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  metaDivider: { width: 1, height: 28, backgroundColor: '#E5E7EB' },
  acceptBtn: { backgroundColor: '#111827', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#9CA3AF', fontWeight: '500' },
});
