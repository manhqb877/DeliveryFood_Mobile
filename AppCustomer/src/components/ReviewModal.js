import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X, Star } from 'lucide-react-native';
import { reviewApi } from '../api/reviewApi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ReviewModal({ visible, order, onClose }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [shopRating, setShopRating] = useState(5);
  const [driverRating, setDriverRating] = useState(5);
  const [comment, setComment] = useState('');
  
  // Rating per product
  // Format: { [productId]: rating }
  const [productRatings, setProductRatings] = useState({});

  if (!order) return null;

  const handleProductRatingChange = (productId, rating) => {
    setProductRatings(prev => ({
      ...prev,
      [productId]: rating
    }));
  };

  const getProductRating = (productId) => {
    return productRatings[productId] || 5;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const items = (order.items || []).map(item => ({
        productId: item.productId,
        rating: getProductRating(item.productId),
        comment: '',
      }));

      const payload = {
        orderId: order.id,
        shopRating,
        driverRating,
        comment,
        items
      };

      await reviewApi.submitReview(payload);
      Alert.alert('Thành công', 'Cảm ơn bạn đã gửi đánh giá!');
      onClose();
    } catch (err) {
      Alert.alert('Lỗi', err.message || 'Không thể gửi đánh giá lúc này.');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating, setRating) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            style={styles.starBtn}
            activeOpacity={0.7}
          >
            <Star
              size={32}
              color={star <= rating ? '#F59E0B' : '#E5E7EB'}
              fill={star <= rating ? '#F59E0B' : 'transparent'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: insets.bottom || 24 }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Đánh giá đơn hàng</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* Shop Rating */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Đánh giá quán {order.shopName}</Text>
              {renderStars(shopRating, setShopRating)}
            </View>

            {/* Driver Rating */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Đánh giá tài xế</Text>
              {renderStars(driverRating, setDriverRating)}
            </View>

            {/* Products Rating */}
            {(order.items || []).map((item, index) => (
              <View key={index} style={styles.productSection}>
                <Text style={styles.productName}>{item.productName}</Text>
                <View style={styles.productStarsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => handleProductRatingChange(item.productId, star)}
                      style={styles.starSmallBtn}
                    >
                      <Star
                        size={24}
                        color={star <= getProductRating(item.productId) ? '#F59E0B' : '#E5E7EB'}
                        fill={star <= getProductRating(item.productId) ? '#F59E0B' : 'transparent'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            {/* Comment */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Chia sẻ trải nghiệm của bạn</Text>
              <TextInput
                style={styles.commentInput}
                placeholder="Món ăn ngon, giao hàng nhanh..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                value={comment}
                onChangeText={setComment}
                textAlignVertical="top"
              />
            </View>
            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Text style={styles.submitBtnText}>GỬI ĐÁNH GIÁ</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  starBtn: {
    padding: 8,
  },
  productSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginRight: 12,
  },
  productStarsRow: {
    flexDirection: 'row',
  },
  starSmallBtn: {
    paddingHorizontal: 2,
  },
  commentInput: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#111827',
    minHeight: 100,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  submitBtn: {
    backgroundColor: '#FFB700',
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#FDE68A',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
});
