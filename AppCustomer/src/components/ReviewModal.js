import React, { useState } from "react";
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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { X, Star, Utensils, Store, Bike } from "lucide-react-native";
import { reviewApi } from "../api/reviewApi";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ReviewModal({ visible, order, onClose, onSuccess }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [shopRating, setShopRating] = useState(5);
  const [shopComment, setShopComment] = useState("");
  const [shipperRating, setShipperRating] = useState(5);
  const [shipperComment, setShipperComment] = useState("");
  
  // Format: { [productId]: { rating: 5, comment: "" } }
  const [productReviews, setProductReviews] = useState({});

  if (!order) return null;

  const handleProductRatingChange = (productId, rating) => {
    setProductReviews(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || { comment: "" }),
        rating,
      }
    }));
  };

  const handleProductCommentChange = (productId, comment) => {
    setProductReviews(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || { rating: 5 }),
        comment,
      }
    }));
  };

  const getProductRating = (productId) => {
    return productReviews[productId]?.rating || 5;
  };

  const getProductComment = (productId) => {
    return productReviews[productId]?.comment || "";
  };

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const formattedProductReviews = (order.items || []).map(item => {
        const pId = item.itemId || item.productId || item.id;
        const pRev = productReviews[pId] || { rating: 5, comment: "" };
        return {
          productId: pId,
          rating: pRev.rating || 5,
          comment: (pRev.comment || "").trim(),
        };
      });

      const payload = {
        orderId: order.id,
        shopRating,
        shopComment: shopComment.trim(),
        shipperRating,
        shipperComment: shipperComment.trim(),
        productReviews: formattedProductReviews,
      };

      await reviewApi.submitReview(payload);
      Alert.alert("Thành công", "Cảm ơn bạn đã gửi đánh giá!");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      Alert.alert("Lỗi", err.message || "Không thể gửi đánh giá lúc này.");
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating, onSelect, size = 32) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onSelect(star)}
            style={styles.starBtn}
            activeOpacity={0.7}
          >
            <Star
              size={size}
              color={star <= rating ? "#F59E0B" : "#D1D5DB"}
              fill={star <= rating ? "#F59E0B" : "transparent"}
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
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Star size={20} color="#F59E0B" fill="#F59E0B" style={{ marginRight: 6 }} />
              <Text style={styles.headerTitle}>Đánh giá đơn hàng #{order.orderCode || order.id}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* 1. Shop Rating */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Store size={18} color="#D97706" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>
                  Chất lượng Cửa hàng {order.shopName ? `(${order.shopName})` : ""}
                </Text>
              </View>
              {renderStars(shopRating, setShopRating, 32)}
              <TextInput
                style={styles.commentInput}
                placeholder="Nhận xét về cửa hàng (tuỳ chọn)..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={2}
                value={shopComment}
                onChangeText={setShopComment}
                textAlignVertical="top"
              />
            </View>

            {/* 2. Shipper Rating */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Bike size={18} color="#2563EB" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>Tài xế giao hàng</Text>
              </View>
              {renderStars(shipperRating, setShipperRating, 32)}
              <TextInput
                style={styles.commentInput}
                placeholder="Nhận xét về tài xế (tuỳ chọn)..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={2}
                value={shipperComment}
                onChangeText={setShipperComment}
                textAlignVertical="top"
              />
            </View>

            {/* 3. Product Reviews */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Utensils size={18} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>Đánh giá Món ăn</Text>
              </View>

              {(order.items || []).map((item, index) => {
                const pId = item.itemId || item.productId || item.id;
                const pName = item.itemName || item.productName || item.name || `Món ăn #${index + 1}`;
                const pRating = getProductRating(pId);
                const pComment = getProductComment(pId);

                return (
                  <View key={pId || index} style={styles.productCard}>
                    <Text style={styles.productName}>{pName}</Text>
                    {item.selectedOptions && item.selectedOptions.length > 0 && (
                      <Text style={styles.productOptionDesc} numberOfLines={1}>
                        {item.selectedOptions
                          .map(o => o.option || o.optionName || o.name || "")
                          .filter(Boolean)
                          .join(", ")}
                      </Text>
                    )}
                    
                    <View style={styles.productStarsWrapper}>
                      {renderStars(pRating, (star) => handleProductRatingChange(pId, star), 24)}
                    </View>

                    <TextInput
                      style={styles.productCommentInput}
                      placeholder="Nhận xét món này (tuỳ chọn)..."
                      placeholderTextColor="#9CA3AF"
                      multiline
                      numberOfLines={2}
                      value={pComment}
                      onChangeText={(text) => handleProductCommentChange(pId, text)}
                      textAlignVertical="top"
                    />
                  </View>
                );
              })}
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>GỬI ĐÁNH GIÁ</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  modalContent: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  scrollContent: {
    padding: 16,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  starBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  commentInput: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    minHeight: 56,
  },
  productCard: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  productOptionDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  productStarsWrapper: {
    alignItems: "flex-start",
    marginBottom: 8,
  },
  productCommentInput: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: "#111827",
    minHeight: 46,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  submitBtn: {
    backgroundColor: "#E11D48",
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#E11D48",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnDisabled: {
    backgroundColor: "#FDA4AF",
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
});
