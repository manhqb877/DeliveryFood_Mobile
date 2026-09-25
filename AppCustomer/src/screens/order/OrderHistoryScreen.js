import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShoppingBasket,
  ChevronRight,
  Store,
  Clock,
  Search,
  X,
  ChevronLeft,
} from 'lucide-react-native';
import { orderApi } from '../../api/orderApi';
import moment from 'moment';

const PAGE_SIZE = 5;

const FILTER_TABS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'PROCESSING', label: 'Đang xử lý' },
  { id: 'DELIVERING', label: 'Đang giao' },
  { id: 'COMPLETED', label: 'Hoàn tất' },
  { id: 'CANCELLED', label: 'Đã hủy' },
];

export default function OrderHistoryScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchOrders = async () => {
    try {
      const data = await orderApi.getOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Lỗi lấy danh sách đơn hàng:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  // Reset trang về 1 khi đổi bộ lọc hoặc tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeFilter]);

  const formatVND = (price) => {
    return Number(price || 0).toLocaleString('vi-VN') + ' đ';
  };

  const getStatusText = (status) => {
    const statusMap = {
      PLACED: 'Chờ xác nhận',
      PENDING: 'Chờ xác nhận',
      CONFIRMED: 'Đang chuẩn bị',
      PREPARING: 'Đang chuẩn bị',
      READY: 'Chờ lấy món',
      READY_FOR_PICKUP: 'Chờ lấy món',
      ASSIGNED: 'Đã có Shipper',
      PICKED_UP: 'Đang giao hàng',
      DELIVERING: 'Đang giao hàng',
      OUT_FOR_DELIVERY: 'Đang giao hàng',
      DELIVERED: 'Đã giao xong',
      COMPLETED: 'Hoàn tất',
      CANCELLED: 'Đã hủy',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    if (['COMPLETED', 'DELIVERED'].includes(status)) return '#10B981';
    if (['CANCELLED'].includes(status)) return '#EF4444';
    if (['DELIVERING', 'PICKED_UP', 'ASSIGNED', 'OUT_FOR_DELIVERY'].includes(status)) return '#2563EB';
    return '#D97706';
  };

  // Lọc đơn hàng theo search query và tab
  const filteredOrders = orders.filter((item) => {
    const status = item.orderStatus || item.status || 'PLACED';
    const orderCode = (item.orderCode || '').toLowerCase();
    const shopName = (item.shopName || '').toLowerCase();
    const query = searchQuery.trim().toLowerCase();

    // Check search query
    const matchSearch =
      !query ||
      orderCode.includes(query) ||
      shopName.includes(query) ||
      (item.items || []).some(
        (i) =>
          (i.productName || i.name || i.itemName || '')
            .toLowerCase()
            .includes(query)
      );

    if (!matchSearch) return false;

    // Check filter tab
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'PROCESSING') {
      return ['PLACED', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'READY_FOR_PICKUP'].includes(status);
    }
    if (activeFilter === 'DELIVERING') {
      return ['ASSIGNED', 'PICKING_UP', 'PICKED_UP', 'DELIVERING', 'OUT_FOR_DELIVERY'].includes(status);
    }
    if (activeFilter === 'COMPLETED') {
      return ['DELIVERED', 'COMPLETED'].includes(status);
    }
    if (activeFilter === 'CANCELLED') {
      return status === 'CANCELLED';
    }
    return true;
  });

  // Phân trang: tối đa 5 đơn / trang
  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE) || 1;
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const renderOrderItem = ({ item }) => {
    const status = item.orderStatus || item.status || 'PLACED';
    const itemCount =
      item.items?.reduce((sum, i) => sum + (i.quantity || 1), 0) ||
      item.items?.length ||
      item.totalItems ||
      1;
    const orderCodeStr = item.orderCode || (item.id ? `#${item.id}` : '#---');
    const orderDate = item.placedAt || item.createdAt;

    return (
      <TouchableOpacity
        style={styles.orderCard}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
      >
        <View style={styles.orderHeader}>
          <View style={styles.shopInfo}>
            <Store size={18} color="#4B5563" style={styles.shopIcon} />
            <Text style={styles.shopName} numberOfLines={1}>
              {item.shopName || (item.shopId ? `Quán #${item.shopId}` : 'Quán ăn')}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(status) + '1A' },
            ]}
          >
            <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
              {getStatusText(status)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.orderBody}>
          <View style={styles.orderMeta}>
            <View style={styles.metaRow}>
              <Clock size={14} color="#6B7280" />
              <Text style={styles.metaText}>
                {orderDate ? moment(orderDate).format('HH:mm - DD/MM/YYYY') : 'Vừa xong'}
              </Text>
            </View>
            <Text style={styles.totalItems}>{itemCount} món</Text>
          </View>
          <Text style={styles.totalPrice}>{formatVND(item.totalAmount)}</Text>
        </View>

        <View style={styles.orderFooter}>
          <Text style={styles.orderId}>Mã đơn: {orderCodeStr}</Text>
          <View style={styles.detailBtn}>
            <Text style={styles.detailBtnText}>Chi tiết</Text>
            <ChevronRight size={16} color="#FFB700" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Đơn Hàng Của Tôi</Text>
      </View>

      {/* Thanh Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo mã đơn, tên quán hoặc món..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <X size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveFilter(tab.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FFB700" />
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <ShoppingBasket size={44} color="#D97706" />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery || activeFilter !== 'ALL'
              ? 'Không tìm thấy đơn hàng phù hợp'
              : 'Chưa có đơn hàng nào'}
          </Text>
          <Text style={styles.emptyDesc}>
            {searchQuery || activeFilter !== 'ALL'
              ? 'Thử thay đổi từ khoá tìm kiếm hoặc chọn bộ lọc trạng thái khác'
              : 'Bạn chưa có đơn đặt hàng nào trong hôm nay. Khám phá các quán ăn ngon ngay!'}
          </Text>
          {searchQuery || activeFilter !== 'ALL' ? (
            <TouchableOpacity
              style={styles.resetFilterBtn}
              onPress={() => {
                setSearchQuery('');
                setActiveFilter('ALL');
              }}
            >
              <Text style={styles.resetFilterBtnText}>Xóa bộ lọc</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.exploreBtn}
              onPress={() => navigation.navigate('Trang chủ')}
            >
              <Text style={styles.exploreBtnText}>KHÁM PHÁ QUÁN NGON</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={paginatedOrders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#FFB700']}
            />
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.paginationCard}>
                <TouchableOpacity
                  style={[
                    styles.pageBtn,
                    currentPage === 1 && styles.pageBtnDisabled,
                  ]}
                  disabled={currentPage === 1}
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft
                    size={16}
                    color={currentPage === 1 ? '#9CA3AF' : '#111827'}
                  />
                  <Text
                    style={[
                      styles.pageBtnText,
                      currentPage === 1 && styles.pageBtnTextDisabled,
                    ]}
                  >
                    Trước
                  </Text>
                </TouchableOpacity>

                <Text style={styles.pageIndicatorText}>
                  Trang <Text style={{ fontWeight: '800' }}>{currentPage}</Text> /{' '}
                  {totalPages} ({filteredOrders.length} đơn)
                </Text>

                <TouchableOpacity
                  style={[
                    styles.pageBtn,
                    currentPage === totalPages && styles.pageBtnDisabled,
                  ]}
                  disabled={currentPage === totalPages}
                  onPress={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  <Text
                    style={[
                      styles.pageBtnText,
                      currentPage === totalPages && styles.pageBtnTextDisabled,
                    ]}
                  >
                    Sau
                  </Text>
                  <ChevronRight
                    size={16}
                    color={currentPage === totalPages ? '#9CA3AF' : '#111827'}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ height: 20 }} />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 0,
  },
  filterTabsWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 10,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 280,
  },
  resetFilterBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  resetFilterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  exploreBtn: {
    backgroundColor: '#FFB700',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#FFB700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  exploreBtnText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  shopIcon: {
    marginRight: 8,
  },
  shopName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  orderBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderMeta: {
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 6,
  },
  totalItems: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
  },
  orderId: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D97706',
    marginRight: 2,
  },
  paginationCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  pageBtnTextDisabled: {
    color: '#9CA3AF',
  },
  pageIndicatorText: {
    fontSize: 13,
    color: '#4B5563',
  },
});
