import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import {
  X,
  Star,
  MapPin,
  Store,
  Clock,
  CheckCircle,
  XCircle,
  Receipt,
  Utensils,
  User,
  Phone,
  Camera,
  Banknote,
  CreditCard,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import apiClient from "../lib/apiClient";

export default function HistoryDetailModal({ visible, delivery, onClose }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [review, setReview] = useState(null);
  const [productReviews, setProductReviews] = useState([]);

  useEffect(() => {
    if (!visible || !delivery?.orderId) {
      setOrder(null);
      setReview(null);
      setProductReviews([]);
      return;
    }

    let isMounted = true;
    const fetchOrderAndReview = async () => {
      setLoading(true);
      try {
        const [orderRes, reviewRes, pReviewRes] = await Promise.allSettled([
          apiClient.get(`/orders/${delivery.orderId}`),
          apiClient.get(`/reviews/order/${delivery.orderId}`),
          apiClient.get(`/reviews/product-reviews/order/${delivery.orderId}`),
        ]);

        if (isMounted) {
          if (orderRes.status === "fulfilled" && orderRes.value) {
            setOrder(orderRes.value.data || orderRes.value);
          }
          if (reviewRes.status === "fulfilled" && reviewRes.value) {
            const rev = reviewRes.value.data || reviewRes.value;
            if (rev && (rev.id || rev.orderId || rev.shipperRating || rev.shopRating)) {
              setReview(rev);
            }
          }
          if (pReviewRes.status === "fulfilled" && Array.isArray(pReviewRes.value)) {
            setProductReviews(pReviewRes.value);
          } else if (pReviewRes.status === "fulfilled" && Array.isArray(pReviewRes.value?.data)) {
            setProductReviews(pReviewRes.value.data);
          }
        }
      } catch (err) {
        console.warn("Lỗi tải chi tiết đơn lịch sử:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOrderAndReview();
    return () => {
      isMounted = false;
    };
  }, [visible, delivery?.orderId]);

  if (!delivery) return null;

  const isSuccess = delivery.status === "DELIVERED";
  const deliveredTime = delivery.deliveredAt
    ? new Date(delivery.deliveredAt).toLocaleString("vi-VN")
    : new Date(delivery.updatedAt || delivery.createdAt).toLocaleString("vi-VN");

  const formatVND = (price) => {
    return Number(price || 0).toLocaleString("vi-VN") + "đ";
  };

  const renderStars = (rating = 5, size = 16) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            color={star <= rating ? "#F59E0B" : "#D1D5DB"}
            fill={star <= rating ? "#F59E0B" : "transparent"}
          />
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
        <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Chi tiết đơn hàng</Text>
              <Text style={styles.orderCodeText}>
                {delivery.orderCode || `Đơn #${delivery.orderId}`}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={22} color="#4B5563" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF6B35" />
              <Text style={styles.loadingText}>Đang tải thông tin đơn & đánh giá...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Status Banner */}
              <View style={[styles.statusBanner, isSuccess ? styles.statusBannerSuccess : styles.statusBannerFail]}>
                <View style={styles.statusBannerLeft}>
                  {isSuccess ? <CheckCircle size={20} color="#15803D" /> : <XCircle size={20} color="#B91C1C" />}
                  <Text style={[styles.statusBannerTitle, isSuccess ? styles.statusSuccessText : styles.statusFailText]}>
                    {isSuccess ? "Giao hàng thành công" : "Giao thất bại / Đã hủy"}
                  </Text>
                </View>
                <Text style={styles.statusBannerTime}>{deliveredTime}</Text>
              </View>

              {/* ===== SECTION 1: ĐÁNH GIÁ CỦA KHÁCH HÀNG ===== */}
              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <Star size={18} color="#F59E0B" fill="#F59E0B" style={{ marginRight: 6 }} />
                  <Text style={styles.cardTitle}>Đánh giá của khách hàng</Text>
                </View>

                {review ? (
                  <View style={styles.reviewContentWrapper}>
                    {/* Đánh giá cho Shipper */}
                    <View style={styles.shipperReviewHighlight}>
                      <View style={styles.reviewItemHeader}>
                        <Text style={styles.shipperReviewTitle}>🌟 Đánh giá cho bạn (Tài xế):</Text>
                        {renderStars(review.shipperRating || 5, 18)}
                      </View>
                      {review.shipperComment ? (
                        <Text style={styles.shipperCommentText}>"{review.shipperComment}"</Text>
                      ) : (
                        <Text style={styles.noCommentText}>Khách không để lại nhận xét bằng chữ</Text>
                      )}
                    </View>

                    {/* Đánh giá Cửa hàng */}
                    <View style={styles.shopReviewBox}>
                      <View style={styles.reviewItemHeader}>
                        <Text style={styles.reviewLabel}>Đánh giá Quán ({order?.shopName || "Cửa hàng"}):</Text>
                        {renderStars(review.shopRating || 5, 15)}
                      </View>
                      {review.shopComment ? (
                        <Text style={styles.subCommentText}>"{review.shopComment}"</Text>
                      ) : null}
                    </View>

                    {/* Đánh giá Món ăn */}
                    {productReviews && productReviews.length > 0 && (
                      <View style={styles.productReviewsContainer}>
                        <Text style={styles.productReviewMainLabel}>Đánh giá Món ăn:</Text>
                        {productReviews.map((pr, idx) => {
                          const item = order?.items?.find(
                            (i) => (i.itemId || i.productId || i.id) === pr.productId
                          );
                          return (
                            <View key={pr.id || idx} style={styles.productReviewItem}>
                              <View style={styles.reviewItemHeader}>
                                <Text style={styles.productNameText}>
                                  {item?.itemName || item?.productName || `Món #${idx + 1}`}
                                </Text>
                                {renderStars(pr.rating || 5, 14)}
                              </View>
                              {pr.comment ? (
                                <Text style={styles.productCommentText}>"{pr.comment}"</Text>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.noReviewBox}>
                    <Text style={styles.noReviewText}>
                      Khách hàng chưa để lại đánh giá cho đơn hàng này.
                    </Text>
                  </View>
                )}
              </View>

              {/* ===== SECTION 2: THÔNG TIN VẬN CHUYỂN ===== */}
              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <MapPin size={18} color="#2563EB" style={{ marginRight: 6 }} />
                  <Text style={styles.cardTitle}>Lộ trình giao hàng</Text>
                </View>

                {/* Điểm lấy */}
                <View style={styles.routePointRow}>
                  <View style={styles.routeIconWrapper}>
                    <Store size={16} color="#EA580C" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routePointType}>Điểm lấy hàng (Nhà hàng):</Text>
                    <Text style={styles.routePointName}>{order?.shopName || "Quán ăn"}</Text>
                    <Text style={styles.routePointAddress}>{delivery.pickupAddress}</Text>
                  </View>
                </View>

                {/* Đường nối */}
                <View style={styles.routeConnector} />

                {/* Điểm giao */}
                <View style={styles.routePointRow}>
                  <View style={[styles.routeIconWrapper, { backgroundColor: "#EFF6FF" }]}>
                    <MapPin size={16} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routePointType}>Điểm giao (Khách hàng):</Text>
                    <Text style={styles.routePointName}>
                      {order?.deliveryAddress?.recipientName || "Người nhận"}
                      {order?.deliveryAddress?.recipientPhone ? ` - ${order.deliveryAddress.recipientPhone}` : ""}
                    </Text>
                    <Text style={styles.routePointAddress}>{delivery.deliveryAddress}</Text>
                    {(order?.deliveryAddress?.note || order?.orderNote) ? (
                      <Text style={styles.orderNoteBadge}>
                        📝 Ghi chú: {order?.deliveryAddress?.note || order?.orderNote}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Ảnh xác nhận giao hàng (nếu có) */}
                {delivery.proofPhotoUrl ? (
                  <View style={styles.proofPhotoWrap}>
                    <View style={styles.proofHeader}>
                      <Camera size={15} color="#4B5563" style={{ marginRight: 5 }} />
                      <Text style={styles.proofTitle}>Ảnh xác nhận giao hàng thành công:</Text>
                    </View>
                    <Image
                      source={{ uri: delivery.proofPhotoUrl }}
                      style={styles.proofImage}
                      resizeMode="cover"
                    />
                  </View>
                ) : null}
              </View>

              {/* ===== SECTION 3: MÓN ĂN & HÓA ĐƠN ===== */}
              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <Utensils size={18} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={styles.cardTitle}>Danh sách món ăn</Text>
                </View>

                {order?.items && order.items.length > 0 ? (
                  <View style={styles.itemsList}>
                    {order.items.map((item, idx) => (
                      <View key={item.id || idx} style={styles.itemRow}>
                        <View style={styles.itemQtyBadge}>
                          <Text style={styles.itemQtyText}>{item.quantity}x</Text>
                        </View>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.itemNameText}>{item.itemName || item.productName || "Món ăn"}</Text>
                          {item.selectedOptions && item.selectedOptions.length > 0 && (
                            <Text style={styles.itemOptionText} numberOfLines={1}>
                              {item.selectedOptions
                                .map((o) => o.option || o.optionName || o.name || "")
                                .filter(Boolean)
                                .join(", ")}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.itemPriceText}>
                          {formatVND(item.totalPrice || (item.unitPrice || 0) * (item.quantity || 1))}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyItemsText}>Không có thông tin chi tiết món</Text>
                )}

                <View style={styles.divider} />

                {/* Thông tin tiền COD & Thanh toán */}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tạm tính món ăn:</Text>
                  <Text style={styles.summaryVal}>{formatVND(order?.subtotal || 0)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Phí giao hàng:</Text>
                  <Text style={styles.summaryVal}>{formatVND(order?.deliveryFee || 0)}</Text>
                </View>
                {Number(order?.discountAmount || 0) > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Giảm giá:</Text>
                    <Text style={[styles.summaryVal, { color: "#16A34A" }]}>
                      -{formatVND(order?.discountAmount)}
                    </Text>
                  </View>
                )}

                <View style={[styles.summaryRow, { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#F3F4F6" }]}>
                  <Text style={styles.totalLabel}>Tổng giá trị đơn:</Text>
                  <Text style={styles.totalVal}>{formatVND(order?.totalAmount || delivery.codAmount)}</Text>
                </View>

                {/* COD Badge cho Shipper */}
                <View style={styles.codHighlightBox}>
                  <View style={styles.codHeader}>
                    {order?.paymentMethod === "ONLINE" ? (
                      <CreditCard size={18} color="#059669" style={{ marginRight: 6 }} />
                    ) : (
                      <Banknote size={18} color="#D97706" style={{ marginRight: 6 }} />
                    )}
                    <Text style={styles.codHeaderTitle}>
                      {order?.paymentMethod === "ONLINE"
                        ? "ĐÃ THANH TOÁN ONLINE (VIETQR)"
                        : "THU TIỀN MẶT KHI GIAO (COD)"}
                    </Text>
                  </View>
                  <Text style={styles.codAmountText}>
                    Tiền thu tài xế: {formatVND(delivery.codAmount || 0)}
                  </Text>
                </View>
              </View>

              <View style={{ height: 30 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalContent: {
    width: "100%",
    maxWidth: 540,
    alignSelf: "center",
    backgroundColor: "#F9FAFB",
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
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  orderCodeText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 12,
  },
  scrollContent: {
    padding: 16,
  },
  statusBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
  },
  statusBannerSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  statusBannerFail: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  statusBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  statusSuccessText: {
    color: "#065F46",
  },
  statusFailText: {
    color: "#991B1B",
  },
  statusBannerTime: {
    fontSize: 12,
    color: "#6B7280",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewContentWrapper: {
    gap: 10,
  },
  shipperReviewHighlight: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FCD34D",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  reviewItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  shipperReviewTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#B45309",
  },
  shipperCommentText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
    fontStyle: "italic",
    marginTop: 4,
  },
  noCommentText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontStyle: "italic",
    marginTop: 2,
  },
  shopReviewBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  reviewLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    flex: 1,
  },
  subCommentText: {
    fontSize: 13,
    color: "#4B5563",
    fontStyle: "italic",
    marginTop: 2,
  },
  productReviewsContainer: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 8,
  },
  productReviewMainLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 6,
  },
  productReviewItem: {
    backgroundColor: "#F9FAFB",
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
  },
  productNameText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F2937",
    flex: 1,
  },
  productCommentText: {
    fontSize: 12,
    color: "#6B7280",
    fontStyle: "italic",
    marginTop: 2,
  },
  noReviewBox: {
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  noReviewText: {
    fontSize: 13,
    color: "#6B7280",
    fontStyle: "italic",
    textAlign: "center",
  },
  routePointRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  routeIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    marginTop: 2,
  },
  routePointType: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  routePointName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginTop: 1,
  },
  routePointAddress: {
    fontSize: 13,
    color: "#4B5563",
    marginTop: 2,
    lineHeight: 18,
  },
  routeConnector: {
    width: 2,
    height: 18,
    backgroundColor: "#CBD5E1",
    marginLeft: 15,
    marginVertical: 4,
  },
  orderNoteBadge: {
    fontSize: 12,
    color: "#D97706",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  proofPhotoWrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  proofHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  proofTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  proofImage: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
  },
  itemsList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  itemQtyBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  itemQtyText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  itemNameText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  itemOptionText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 1,
  },
  itemPriceText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  emptyItemsText: {
    fontSize: 13,
    color: "#6B7280",
    fontStyle: "italic",
    paddingVertical: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  totalVal: {
    fontSize: 16,
    fontWeight: "900",
    color: "#D97706",
  },
  codHighlightBox: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  codHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  codHeaderTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#B45309",
    letterSpacing: 0.5,
  },
  codAmountText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#B45309",
  },
});
