import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Switch, RefreshControl, Alert, StatusBar, Animated,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import {
  Zap, MapPin, Store, Navigation, Clock,
  TrendingUp, LogOut, Package, ArrowRight, DollarSign
} from 'lucide-react-native';
import { useShipper } from '../context/ShipperContext';
import apiClient from '../lib/apiClient';
import { startBackgroundTracking, stopBackgroundTracking } from '../lib/backgroundLocation';

const GPS_INTERVAL_MS = 8000;

function formatCurrency(n) {
  return n ? Number(n).toLocaleString('vi-VN') + 'đ' : '0đ';
}

function statusColor(s) {
  const map = {
    PENDING: '#F59E0B',
    ASSIGNED: '#3B82F6',
    GOING_PICKUP: '#8B5CF6',
    PICKED_UP: '#10B981',
    DELIVERING: '#10B981',
    DELIVERED: '#059669',
  };
  return map[s] || '#64748B';
}

function statusLabel(s) {
  const map = {
    PENDING: 'Chờ nhận',
    ASSIGNED: 'Đã nhận',
    GOING_PICKUP: 'Đến quán',
    PICKED_UP: 'Đã lấy',
    DELIVERING: 'Đang giao',
    DELIVERED: 'Thành công',
  };
  return map[s] || s;
}

// Skeleton loader nhỏ gọn
function OrderSkeletonItem() {
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  return (
    <Animated.View style={[styles.skeletonCard, { opacity: shimmerAnim }]}>
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonBadge} />
        <View style={styles.skeletonCode} />
      </View>
      <View style={styles.skeletonLineGroup}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '60%' }]} />
      </View>
    </Animated.View>
  );
}

export default function HomeScreen({ navigation }) {
  const { shipper, logout } = useShipper();
  const [isOnline, setIsOnline] = useState(false);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('AVAILABLE'); // 'AVAILABLE' | 'ACTIVE'

  const gpsRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isOnline) {
      pulseAnim.setValue(1);
      return;
    }
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [isOnline, pulseAnim]);

  const fetchDeliveries = useCallback(async () => {
    try {
      const [available, active] = await Promise.all([
        apiClient.get('/tracking/deliveries/available').catch(() => []),
        apiClient.get(`/tracking/shippers/${shipper?.id}/deliveries/active`).catch(() => []),
      ]);
      const availList = Array.isArray(available) ? available : [];
      const activeList = Array.isArray(active) ? active : [];
      const activeIds = new Set(activeList.map(d => d.id));
      const merged = [
        ...activeList.map(d => ({ ...d, _mine: true })),
        ...availList.filter(d => !activeIds.has(d.id))
      ];
      setDeliveries(merged);
    } catch (e) {
      console.warn('[Home] fetchDeliveries error', e?.message);
    } finally {
      setLoading(false);
    }
  }, [shipper?.id]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  useFocusEffect(
    useCallback(() => {
      fetchDeliveries();
    }, [fetchDeliveries])
  );

  const availableCount = deliveries.filter(d => !d._mine).length;
  const activeCount = deliveries.filter(d => d._mine).length;

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
        Alert.alert('Cần quyền GPS', 'Hãy cấp quyền định vị để nhận đơn và hiển thị vị trí cho khách');
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
      Alert.alert('Nhận đơn thành công', 'Hãy di chuyển đến quán để lấy thức ăn cho khách', [
        { text: 'Xem bản đồ', onPress: () => navigation.navigate('OrderDetail', { delivery }) },
        { text: 'Để sau' },
      ]);
      fetchDeliveries();
    } catch (e) {
      Alert.alert('Không thể nhận đơn', e?.response?.data?.message || 'Đơn hàng này có thể đã được shipper khác nhận.');
    }
  };

  const renderItem = ({ item }) => {
    const isMine = item._mine;
    const estKm = item.estimatedDistanceM ? (item.estimatedDistanceM / 1000).toFixed(1) : '1.5';
    const estMinutes = Math.round(Number(estKm) * 3 + 10);

    return (
      <TouchableOpacity
        style={[styles.orderCard, isMine && styles.orderCardMine]}
        onPress={() => navigation.navigate('OrderDetail', { delivery: item })}
        activeOpacity={0.88}
      >
        {/* Header thẻ: Mã đơn & Trạng thái */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.orderCode}>
              {item.orderCode ? item.orderCode : `#${String(item.orderId || item.id).slice(-8).toUpperCase()}`}
            </Text>
            <View style={styles.etaBadge}>
              <Clock size={11} color="#64748B" />
              <Text style={styles.etaText}>~{estMinutes}p • {estKm}km</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {item.isMultiShop && (
              <View style={[styles.statusTag, { backgroundColor: '#EDE9FE' }]}>
                <Text style={[styles.statusTagText, { color: '#7C3AED', fontWeight: '800' }]}>
                  ⚡ 2 Quán
                </Text>
              </View>
            )}
            <View style={[styles.statusTag, { backgroundColor: statusColor(item.status) + '15' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} />
              <Text style={[styles.statusTagText, { color: statusColor(item.status) }]}>
                {statusLabel(item.status)}
              </Text>
            </View>
          </View>
        </View>

        {/* Lộ trình A -> B gọn gàng */}
        <View style={styles.routeBox}>
          {/* Quán 1 */}
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: '#2563EB' }]} />
            <View style={styles.routeTexts}>
              <Text style={styles.placeName} numberOfLines={1}>
                {item.shop1Name || item.shopName || item.pickupAddress?.split(',')[0] || 'Điểm lấy 1 (Quán)'}
              </Text>
              <Text style={styles.placeAddr} numberOfLines={1}>
                {item.pickupAddress || 'Địa chỉ lấy món 1'}
              </Text>
            </View>
          </View>

          {/* Quán 2 nếu là đơn ghép 2 shop */}
          {item.isMultiShop && (
            <>
              <View style={styles.routeLine} />
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: '#8B5CF6' }]} />
                <View style={styles.routeTexts}>
                  <Text style={[styles.placeName, { color: '#7C3AED' }]} numberOfLines={1}>
                    {item.shop2Name || 'Điểm lấy 2 (Quán 2)'}
                  </Text>
                  <Text style={styles.placeAddr} numberOfLines={1}>
                    {item.pickup2Address || 'Địa chỉ lấy món 2'}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Đường nối */}
          <View style={styles.routeLine} />

          {/* Khách */}
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: '#EA580C' }]} />
            <View style={styles.routeTexts}>
              <Text style={styles.placeName} numberOfLines={1}>
                {item.customerName || 'Khách hàng'}
              </Text>
              <Text style={styles.placeAddr} numberOfLines={1}>
                {item.deliveryAddress || 'Địa chỉ giao đến'}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer Tài chính & Nút */}
        <View style={styles.cardFooter}>
          <View style={styles.priceCol}>
            <Text style={styles.priceLabel}>Thu hộ COD</Text>
            <Text style={styles.codValue}>{formatCurrency(item.codAmount)}</Text>
          </View>

          <View style={styles.priceDivider} />

          <View style={styles.priceCol}>
            <Text style={styles.priceLabel}>Cước dự kiến</Text>
            <Text style={styles.feeValue}>{formatCurrency(item.shippingFee || 25000)}</Text>
          </View>

          {!isMine ? (
            <TouchableOpacity
              style={styles.btnAction}
              onPress={() => handleAccept(item)}
              activeOpacity={0.8}
            >
              <Text style={styles.btnActionText}>Nhận đơn</Text>
              <ArrowRight size={13} color="#111827" strokeWidth={2.2} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btnAction, { backgroundColor: '#10B981' }]}
              onPress={() => navigation.navigate('OrderDetail', { delivery: item })}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnActionText, { color: '#FFFFFF' }]}>Tiếp tục</Text>
              <ArrowRight size={13} color="#FFFFFF" strokeWidth={2.2} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFB800" />

      {/* Header tài xế tinh gọn */}
      <View style={styles.header}>
        {/* Profile */}
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={{ fontSize: 18 }}>🛵</Text>
            <View style={[styles.onlineIndicator, { backgroundColor: isOnline ? '#10B981' : '#94A3B8' }]} />
          </View>

          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.shipperName} numberOfLines={1}>
              {shipper?.fullName || 'Tài xế'}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.ratingText}>⭐ 4.9</Text>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.plateText}>{shipper?.vehiclePlate || '59P1-999.88'}</Text>
            </View>
          </View>

          <TouchableOpacity onPress={logout} style={styles.logoutBtn} activeOpacity={0.7}>
            <LogOut size={15} color="#475569" />
          </TouchableOpacity>
        </View>

        {/* Thanh Trực tuyến / Ngoại tuyến */}
        <View style={[styles.statusBox, isOnline ? styles.statusBoxOnline : styles.statusBoxOffline]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <Animated.View
              style={[
                styles.dotPulse,
                {
                  backgroundColor: isOnline ? '#10B981' : '#94A3B8',
                  transform: [{ scale: isOnline ? pulseAnim : 1 }],
                },
              ]}
            />
            <View>
              <Text style={[styles.statusTitle, { color: isOnline ? '#065F46' : '#334155' }]}>
                {isOnline ? 'Đang trực tuyến' : 'Đang ngoại tuyến'}
              </Text>
              <Text style={styles.statusSub}>
                {isOnline ? 'Sẵn sàng nhận cuốc xe mới' : 'Gạt nút để bắt đầu nhận đơn'}
              </Text>
            </View>
          </View>

          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            trackColor={{ false: '#CBD5E1', true: '#10B981' }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#CBD5E1"
          />
        </View>

        {/* Widget Thống kê hôm nay */}
        <View style={styles.metricsBox}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Hôm nay</Text>
            <Text style={styles.metricVal}>320.000đ</Text>
          </View>
          <View style={styles.metricSep} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Hoàn thành</Text>
            <Text style={styles.metricVal}>8 đơn</Text>
          </View>
          <View style={styles.metricSep} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Tỉ lệ nhận</Text>
            <Text style={styles.metricVal}>100%</Text>
          </View>
        </View>
      </View>

      {/* Segmented Tabs */}
      <View style={styles.tabSection}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, selectedTab === 'AVAILABLE' && styles.tabItemActive]}
            onPress={() => setSelectedTab('AVAILABLE')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, selectedTab === 'AVAILABLE' && styles.tabTextActive]}>
              Chờ nhận
            </Text>
            {availableCount > 0 && (
              <View style={[styles.badge, selectedTab === 'AVAILABLE' ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.badgeText, selectedTab === 'AVAILABLE' && styles.badgeTextActive]}>
                  {availableCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, selectedTab === 'ACTIVE' && styles.tabItemActive]}
            onPress={() => setSelectedTab('ACTIVE')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, selectedTab === 'ACTIVE' && styles.tabTextActive]}>
              Đang giao của tôi
            </Text>
            {activeCount > 0 && (
              <View style={[styles.badge, { backgroundColor: '#10B981' }]}>
                <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>
                  {activeCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Danh sách đơn hàng */}
      {loading ? (
        <View style={{ padding: 14, gap: 10 }}>
          <OrderSkeletonItem />
          <OrderSkeletonItem />
          <OrderSkeletonItem />
        </View>
      ) : (
        <FlatList
          data={filteredDeliveries}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await fetchDeliveries();
                setRefreshing(false);
              }}
              colors={['#FFB800']}
              tintColor="#FFB800"
            />
          }
          contentContainerStyle={styles.listContent}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>{isOnline ? '⏳' : '🛵'}</Text>
              <Text style={styles.emptyTitle}>
                {isOnline
                  ? (selectedTab === 'AVAILABLE' ? 'Chưa có đơn hàng mới nào' : 'Bạn chưa có đơn đang giao')
                  : 'Bạn đang ngoại tuyến'}
              </Text>
              <Text style={styles.emptySub}>
                {isOnline
                  ? 'Hệ thống đang quét các đơn mới. Đơn sẽ tự động xuất hiện tại đây.'
                  : 'Hãy gạt bật trực tuyến để bắt đầu nhận cuốc xe.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header
  header: {
    backgroundColor: '#FFB800',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  onlineIndicator: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    position: 'absolute',
    bottom: -1,
    right: -1,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  shipperName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  metaDot: {
    fontSize: 11,
    color: '#475569',
  },
  plateText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '500',
  },
  logoutBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Status Switch Box
  statusBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusBoxOnline: {
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  statusBoxOffline: {
    borderLeftWidth: 3,
    borderLeftColor: '#94A3B8',
  },
  dotPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },

  // Metrics Box
  metricsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginTop: 1,
  },
  metricSep: {
    width: 1,
    height: 22,
    backgroundColor: '#F1F5F9',
  },

  // Tab Section
  tabSection: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    padding: 3,
    borderRadius: 12,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    gap: 5,
  },
  tabItemActive: {
    backgroundColor: '#1E293B',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFB800',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  badgeActive: {
    backgroundColor: '#FFB800',
  },
  badgeInactive: {
    backgroundColor: '#94A3B8',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  badgeTextActive: {
    color: '#111827',
  },

  // List & Cards
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 80,
    gap: 10,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  orderCardMine: {
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderCode: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  etaText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Route
  routeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  routeLine: {
    width: 1.5,
    height: 10,
    backgroundColor: '#CBD5E1',
    marginLeft: 3.2,
    marginVertical: 2,
  },
  routeTexts: {
    flex: 1,
  },
  placeName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  placeAddr: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },

  // Footer
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  priceCol: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  codValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EA580C',
    marginTop: 1,
  },
  feeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
    marginTop: 1,
  },
  priceDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 8,
  },
  btnAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFB800',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  btnActionText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
  },

  // Skeleton
  skeletonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  skeletonBadge: {
    width: 80,
    height: 16,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
  },
  skeletonCode: {
    width: 60,
    height: 16,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
  },
  skeletonLineGroup: {
    gap: 6,
  },
  skeletonLine: {
    height: 12,
    width: '100%',
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
  },

  // Empty
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
});
