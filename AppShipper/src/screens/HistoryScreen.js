import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useShipper } from "../context/ShipperContext";
import {
  Clock, CheckCircle2, XCircle, ChevronRight, ChevronLeft, Star,
  MapPin, Store, Calendar, ArrowRight, Zap, Filter
} from "lucide-react-native";
import apiClient from "../lib/apiClient";
import HistoryDetailModal from "../components/HistoryDetailModal";

const PAGE_SIZE = 5;

function formatCurrency(n) {
  return n ? Number(n).toLocaleString('vi-VN') + 'đ' : '0đ';
}

export default function HistoryScreen() {
  const { shipper } = useShipper();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState("ALL"); // ALL | DELIVERED | FAILED
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchHistory = async (isPullRefresh = false) => {
    try {
      if (!isPullRefresh) setLoading(true);
      else setRefreshing(true);
      const res = await apiClient.get(`/tracking/shippers/${shipper.id}/history`);
      setHistory(Array.isArray(res) ? res : res.data || []);
    } catch (error) {
      console.log("Lỗi fetch lịch sử:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterTab]);

  const handleCardPress = (item) => {
    setSelectedDelivery(item);
    setModalVisible(true);
  };

  const filteredHistory = useMemo(() => {
    if (filterTab === "DELIVERED") return history.filter(item => item.status === "DELIVERED");
    if (filterTab === "FAILED") return history.filter(item => item.status !== "DELIVERED");
    return history;
  }, [history, filterTab]);

  const totalPages = Math.ceil(filteredHistory.length / PAGE_SIZE) || 1;
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const renderItem = ({ item }) => {
    const isSuccess = item.status === "DELIVERED";
    const dateFormatted = new Date(item.updatedAt || item.createdAt).toLocaleString("vi-VN", {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
    });

    return (
      <TouchableOpacity
        style={styles.card3D}
        activeOpacity={0.88}
        onPress={() => handleCardPress(item)}
      >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.brandRow}>
            <View style={styles.zapBadge}>
              <Zap size={11} color="#D97706" fill="#F59E0B" />
              <Text style={styles.zapText}>beFood</Text>
            </View>
            <Text style={styles.orderIdText}>
              {item.orderCode ? item.orderCode : `Đơn #${item.orderId}`}
            </Text>
          </View>

          <View style={[styles.statusBadge, isSuccess ? styles.statusSuccess : styles.statusFail]}>
            {isSuccess ? <CheckCircle2 size={13} color="#15803D" /> : <XCircle size={13} color="#B91C1C" />}
            <Text style={[styles.statusBadgeText, isSuccess ? styles.statusTextSuccess : styles.statusTextFail]}>
              {isSuccess ? "Thành công" : "Đã huỷ / Thất bại"}
            </Text>
          </View>
        </View>

        {/* Route Lộ trình 2 chặng */}
        <View style={styles.routeBox}>
          {/* Quán lấy hàng */}
          <View style={styles.routeRow}>
            <View style={styles.iconStore}>
              <Store size={14} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.placeNameText} numberOfLines={1}>
                {item.shopName || (item.pickupAddress ? item.pickupAddress.split(' - ')[0] : 'Cửa hàng đối tác')}
              </Text>
              <Text style={styles.routeSubText} numberOfLines={1}>
                {item.pickupAddress || 'Địa chỉ lấy món'}
              </Text>
            </View>
          </View>

          <View style={styles.routeConnector}>
            <View style={styles.routeDotLine} />
          </View>

          {/* Khách giao đến */}
          <View style={styles.routeRow}>
            <View style={styles.iconPin}>
              <MapPin size={14} color="#EA580C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.placeNameText} numberOfLines={1}>
                {item.customerName || 'Khách hàng'}
              </Text>
              <Text style={styles.routeSubText} numberOfLines={1}>
                {item.deliveryAddress || 'Địa chỉ giao hàng'}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer Tài chính & Thời gian */}
        <View style={styles.cardFooter}>
          <View style={styles.dateWrap}>
            <Calendar size={13} color="#64748B" />
            <Text style={styles.dateText}>{dateFormatted}</Text>
          </View>

          <View style={styles.codWrap}>
            <Text style={styles.codLabel}>COD: </Text>
            <Text style={styles.codAmountText}>
              {formatCurrency(item.codAmount || 0)}
            </Text>
          </View>
        </View>

        {/* Action affordance: Xem chi tiết & Đánh giá */}
        <View style={styles.actionRow}>
          <View style={styles.actionBadge}>
            <Star size={13} color="#D97706" fill="#F59E0B" />
            <Text style={styles.actionBadgeText}>Xem chi tiết đơn & Đánh giá khách</Text>
          </View>
          <View style={styles.chevronWrap}>
            <ChevronRight size={16} color="#64748B" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Lịch sử cuốc xe</Text>
          <Text style={styles.headerSub}>Tổng cộng {history.length} đơn hàng đã thực hiện</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn3D}
          onPress={() => fetchHistory(false)}
          activeOpacity={0.8}
        >
          <Clock color="#111827" size={18} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs 3D */}
      <View style={styles.filterSection}>
        <TouchableOpacity
          style={[styles.filterBtn, filterTab === "ALL" && styles.filterBtnActive]}
          onPress={() => setFilterTab("ALL")}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterText, filterTab === "ALL" && styles.filterTextActive]}>
            Tất cả ({history.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, filterTab === "DELIVERED" && styles.filterBtnActive]}
          onPress={() => setFilterTab("DELIVERED")}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterText, filterTab === "DELIVERED" && styles.filterTextActive]}>
            Thành công ({history.filter(h => h.status === 'DELIVERED').length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, filterTab === "FAILED" && styles.filterBtnActive]}
          onPress={() => setFilterTab("FAILED")}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterText, filterTab === "FAILED" && styles.filterTextActive]}>
            Huỷ / Lỗi ({history.filter(h => h.status !== 'DELIVERED').length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* History List */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#FFB800" />
          <Text style={styles.loadingText}>Đang tải lịch sử giao hàng...</Text>
        </View>
      ) : (
        <FlatList
          data={paginatedHistory}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchHistory(true)}
              colors={["#FFB800"]}
              tintColor="#FFB800"
            />
          }
          ListFooterComponent={
            filteredHistory.length > PAGE_SIZE ? (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={16} color={currentPage === 1 ? '#94A3B8' : '#1E293B'} />
                  <Text style={[styles.pageBtnText, currentPage === 1 && styles.pageBtnTextDisabled]}>Trước</Text>
                </TouchableOpacity>

                <View style={styles.pageIndicator}>
                  <Text style={styles.pageIndicatorText}>
                    Trang <Text style={{ fontWeight: '700', color: '#D97706' }}>{currentPage}</Text> / {totalPages}
                  </Text>
                  <Text style={styles.pageSubText}>({filteredHistory.length} đơn)</Text>
                </View>

                <TouchableOpacity
                  style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                  onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pageBtnText, currentPage === totalPages && styles.pageBtnTextDisabled]}>Sau</Text>
                  <ChevronRight size={16} color={currentPage === totalPages ? '#94A3B8' : '#1E293B'} />
                </TouchableOpacity>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Clock size={36} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>Chưa có lịch sử giao hàng</Text>
              <Text style={styles.emptySubtitle}>
                Các cuốc xe bạn đã nhận và giao hoàn tất sẽ được lưu lại đầy đủ tại đây.
              </Text>
            </View>
          }
        />
      )}

      {/* Modal chi tiết đơn hàng & đánh giá của khách */}
      {modalVisible && selectedDelivery && (
        <HistoryDetailModal
          visible={modalVisible}
          delivery={selectedDelivery}
          onClose={() => {
            setModalVisible(false);
            setSelectedDelivery(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  refreshBtn3D: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  // Filter Tabs
  filterSection: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
  },
  filterBtnActive: {
    backgroundColor: "#111827",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  filterText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  filterTextActive: {
    color: "#FFB800",
  },

  listContent: {
    padding: 16,
    paddingBottom: 90,
    gap: 12,
  },

  // 3D Card
  card3D: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  zapBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  zapText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#B45309",
  },
  orderIdText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusSuccess: {
    backgroundColor: "#DCFCE7",
  },
  statusFail: {
    backgroundColor: "#FEE2E2",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusTextSuccess: {
    color: "#15803D",
  },
  statusTextFail: {
    color: "#B91C1C",
  },

  // Route
  routeBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconStore: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  iconPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFF7ED",
    justifyContent: "center",
    alignItems: "center",
  },
  placeNameText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  routeSubText: {
    fontSize: 11,
    color: "#64748B",
  },
  routeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  routeConnector: {
    marginLeft: 11,
    height: 12,
    justifyContent: "center",
  },
  routeDotLine: {
    width: 2,
    height: "100%",
    backgroundColor: "#CBD5E1",
  },

  // Footer
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dateWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dateText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  codWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  codLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  codAmountText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#EA580C",
  },

  // Action Row
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  actionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B45309",
  },
  chevronWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },

  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 30,
  },
  emptyIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 10,
    marginBottom: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  pageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pageBtnDisabled: {
    backgroundColor: "#F1F5F9",
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E",
  },
  pageBtnTextDisabled: {
    color: "#94A3B8",
  },
  pageIndicator: {
    alignItems: "center",
  },
  pageIndicatorText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  pageSubText: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
});
