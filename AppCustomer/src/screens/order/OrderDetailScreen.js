import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, Receipt, Star, Clock, Store, CheckCircle2, Bike, UtensilsCrossed } from 'lucide-react-native';
import { orderApi } from '../../api/orderApi';
import moment from 'moment';
import ReviewModal from '../../components/ReviewModal';
import TrackingMap from '../../components/TrackingMap';

export default function OrderDetailScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchOrder = async () => {
      try {
        const data = await orderApi.getOrderDetails(orderId);
        if (isMounted && data) {
          setOrder(data);
        }
      } catch (err) {
        console.error('Lỗi lấy chi tiết đơn hàng:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOrder();
    const interval = setInterval(fetchOrder, 3000); // Polling cập nhật tiến trình mỗi 3s giống bản Web

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [orderId]);

  const formatVND = (price) => {
    return Number(price || 0).toLocaleString('vi-VN') + ' đ';
  };

  const getStatusTitle = (status) => {
    const statusMap = {
      PLACED: 'Đã đặt hàng',
      PENDING: 'Đã đặt hàng',
      CONFIRMED: 'Đã xác nhận',
      PREPARING: 'Đang chuẩn bị',
      READY_FOR_PICKUP: 'Chờ tài xế lấy món',
      READY: 'Chờ tài xế lấy món',
      ASSIGNED: 'Đã có Shipper',
      PICKED_UP: 'Shipper đã lấy hàng',
      DELIVERING: 'Đang giao hàng',
      OUT_FOR_DELIVERY: 'Đang giao hàng',
      DELIVERED: 'Đã giao thành công',
      COMPLETED: 'Hoàn tất',
      CANCELLED: 'Đã hủy',
    };
    return statusMap[status] || 'Đang xử lý';
  };

  const getDetailedStatusDesc = (status) => {
    switch (status) {
      case 'PLACED':
      case 'PENDING':
        return 'Đang chờ nhà hàng xác nhận...';
      case 'CONFIRMED':
        return 'Nhà hàng đã xác nhận, đang chuẩn bị...';
      case 'PREPARING':
        return 'Nhà hàng đang chuẩn bị món...';
      case 'READY_FOR_PICKUP':
      case 'READY':
        return 'Món đã sẵn sàng, chờ Shipper lấy...';
      case 'ASSIGNED':
        return 'Đã tìm thấy Shipper! Tài xế đang đến quán...';
      case 'PICKED_UP':
        return 'Shipper đã lấy hàng!';
      case 'DELIVERING':
      case 'OUT_FOR_DELIVERY':
        return 'Shipper đang giao hàng đến bạn!';
      case 'DELIVERED':
        return 'Giao hàng thành công!';
      case 'COMPLETED':
        return 'Đơn hàng đã hoàn tất!';
      case 'CANCELLED':
        return 'Đơn hàng đã bị hủy!';
      default:
        return 'Đang xử lý...';
    }
  };

  const currentStatus = order?.orderStatus || order?.status || 'PENDING';
  const isCompleted = currentStatus === 'COMPLETED' || currentStatus === 'DELIVERED';

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFB700" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centerContainer}>
        <Text>Không tìm thấy đơn hàng</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderTrackingTimeline = () => {
    if (currentStatus === 'CANCELLED') return null;
    
    const steps = [
      { id: 'PLACED', label: 'Đơn hàng đã đặt', icon: <Receipt size={16} color="#FFF" /> },
      { id: 'CONFIRMED', label: 'Đã xác nhận', icon: <Store size={16} color="#FFF" /> },
      { id: 'PREPARING', label: 'Đang chuẩn bị', icon: <UtensilsCrossed size={16} color="#FFF" /> },
      { id: 'DELIVERING', label: 'Đang giao hàng', icon: <Bike size={16} color="#FFF" /> },
      { id: 'COMPLETED', label: 'Hoàn tất', icon: <CheckCircle2 size={16} color="#FFF" /> }
    ];

    let activeIndex = 0;
    if (currentStatus === 'CONFIRMED') activeIndex = 1;
    if (['PREPARING', 'READY', 'READY_FOR_PICKUP'].includes(currentStatus)) activeIndex = 2;
    if (['ASSIGNED', 'PICKING_UP', 'PICKED_UP', 'DELIVERING', 'OUT_FOR_DELIVERY'].includes(currentStatus)) activeIndex = 3;
    if (['DELIVERED', 'COMPLETED'].includes(currentStatus)) activeIndex = 4;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Clock size={20} color="#111827" />
          <Text style={styles.cardTitle}>Tiến trình đơn hàng</Text>
        </View>
        <View style={styles.divider} />
        
        <View style={{ paddingVertical: 8, paddingLeft: 8 }}>
          {steps.map((step, index) => {
            const isActive = index <= activeIndex;
            const isLast = index === steps.length - 1;
            const isCurrent = index === activeIndex;
            
            return (
              <View key={step.id} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ alignItems: 'center', width: 32 }}>
                  <View style={{ 
                    width: 32, height: 32, borderRadius: 16, 
                    backgroundColor: isActive ? '#10B981' : '#E5E7EB',
                    justifyContent: 'center', alignItems: 'center', zIndex: 2 
                  }}>
                    {step.icon}
                  </View>
                  {!isLast && (
                    <View style={{ 
                      width: 2, height: 28, 
                      backgroundColor: isActive && index < activeIndex ? '#10B981' : '#E5E7EB',
                      marginTop: -2, marginBottom: -2, zIndex: 1 
                    }} />
                  )}
                </View>
                <View style={{ marginLeft: 16, paddingTop: 4, paddingBottom: 16, flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: isActive ? '700' : '500', color: isActive ? '#111827' : '#9CA3AF' }}>
                    {step.label}
                  </Text>
                  {isCurrent && currentStatus !== 'COMPLETED' && currentStatus !== 'DELIVERED' && (
                    <Text style={{ fontSize: 13, color: '#10B981', fontWeight: '600', marginTop: 4 }}>
                      {getDetailedStatusDesc(currentStatus)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mã đơn #{order.orderCode || String(order.id).slice(-6).toUpperCase()}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>{getStatusTitle(currentStatus)}</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#10B981', marginTop: 2, marginBottom: 4 }}>
            {getDetailedStatusDesc(currentStatus)}
          </Text>
          <Text style={styles.statusDesc}>
            {moment(order.placedAt || order.createdAt).format('HH:mm - DD/MM/YYYY')}
          </Text>
        </View>

        {/* Tracking Timeline */}
        {renderTrackingTimeline()}

        {/* Real-time Tracking Map */}
        {order.status !== 'CANCELLED' && (
          <TrackingMap 
            orderId={order.id} 
            orderStatus={order.status}
            deliveryAddress={order.deliveryAddress} 
            shopName={order.shopName} 
          />
        )}

        {/* Location Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Store size={20} color="#111827" />
            <Text style={styles.cardTitle}>{order.shopName || 'Quán ăn'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.locationRow}>
            <MapPin size={20} color="#EF4444" />
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Giao đến</Text>
              <Text style={styles.locationAddress}>
                {typeof order.deliveryAddress === 'string' 
                  ? order.deliveryAddress 
                  : (order.deliveryAddress?.fullAddress || '')}
              </Text>
              {typeof order.deliveryAddress === 'object' && order.deliveryAddress?.recipientName && (
                <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                  {order.deliveryAddress.recipientName} - {order.deliveryAddress.recipientPhone}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Items List */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Receipt size={20} color="#111827" />
            <Text style={styles.cardTitle}>Chi tiết đơn hàng</Text>
          </View>
          <View style={styles.divider} />
          
          {(order.items || []).map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemQty}>
                <Text style={styles.itemQtyText}>{item.quantity}x</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.productName}</Text>
                {item.selectedOptions && item.selectedOptions.length > 0 && (
                  <Text style={styles.itemOptions}>
                    {item.selectedOptions.map(o => o.optionName).join(', ')}
                  </Text>
                )}
              </View>
              <Text style={styles.itemPrice}>{formatVND(item.price * item.quantity)}</Text>
            </View>
          ))}
          
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tạm tính</Text>
            <Text style={styles.summaryValue}>{formatVND(order.totalAmount - (order.deliveryFee || 0))}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Phí giao hàng</Text>
            <Text style={styles.summaryValue}>{formatVND(order.deliveryFee || 0)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Tổng cộng</Text>
            <Text style={styles.totalValue}>{formatVND(order.totalAmount)}</Text>
          </View>
        </View>

        {/* Action Button: Đánh giá */}
        {isCompleted && (
          <TouchableOpacity 
            style={styles.reviewBtn}
            onPress={() => setReviewModalVisible(true)}
          >
            <Star size={20} color="#111827" style={{ marginRight: 8 }} />
            <Text style={styles.reviewBtnText}>ĐÁNH GIÁ ĐƠN HÀNG</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {reviewModalVisible && (
        <ReviewModal
          visible={reviewModalVisible}
          order={order}
          onClose={() => setReviewModalVisible(false)}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#D97706',
    marginBottom: 4,
  },
  statusDesc: {
    fontSize: 14,
    color: '#6B7280',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationInfo: {
    marginLeft: 12,
    flex: 1,
  },
  locationLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 22,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  itemQty: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  itemQtyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemOptions: {
    fontSize: 13,
    color: '#6B7280',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#D97706',
  },
  reviewBtn: {
    flexDirection: 'row',
    backgroundColor: '#FFB700',
    padding: 16,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#FFB700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  reviewBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
});
