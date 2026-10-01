import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useShipper } from "../context/ShipperContext";
import { Clock, CheckCircle, XCircle, ChevronRight, Star } from "lucide-react-native";
import apiClient from "../lib/apiClient";
import HistoryDetailModal from "../components/HistoryDetailModal";

export default function HistoryScreen() {
  const { shipper } = useShipper();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleCardPress = (item) => {
    setSelectedDelivery(item);
    setModalVisible(true);
  };

  const renderItem = ({ item }) => {
    const isSuccess = item.status === "DELIVERED";
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => handleCardPress(item)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>{item.orderCode ? item.orderCode : `Đơn #${item.orderId}`}</Text>
          <View style={[styles.statusBadge, isSuccess ? styles.statusSuccess : styles.statusFail]}>
            {isSuccess ? <CheckCircle size={14} color="#15803D" /> : <XCircle size={14} color="#B91C1C" />}
            <Text style={[styles.statusText, isSuccess ? styles.statusTextSuccess : styles.statusTextFail]}>
              {isSuccess ? "Thành công" : "Thất bại"}
            </Text>
          </View>
        </View>

        <Text style={styles.addressText} numberOfLines={1}>
          🏪 {item.pickupAddress}
        </Text>
        <Text style={styles.addressText} numberOfLines={1}>
          📍 {item.deliveryAddress}
        </Text>

        <View style={styles.footer}>
          <Text style={styles.dateText}>
            {new Date(item.updatedAt || item.createdAt).toLocaleString("vi-VN")}
          </Text>
          <Text style={styles.codText}>
            COD: {Number(item.codAmount || 0).toLocaleString("vi-VN")}đ
          </Text>
        </View>

        {/* Action affordance: Xem chi tiết & đánh giá */}
        <View style={styles.actionRow}>
          <View style={styles.actionBadge}>
            <Star size={13} color="#D97706" fill="#F59E0B" style={{ marginRight: 4 }} />
            <Text style={styles.actionBadgeText}>Xem chi tiết đơn & Đánh giá</Text>
          </View>
          <ChevronRight size={16} color="#9CA3AF" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lịch sử giao hàng</Text>
        <TouchableOpacity onPress={() => fetchHistory(false)} style={styles.refreshBtn}>
          <Clock color="#4B5563" size={22} />
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#FF6B35" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchHistory(true)}
              colors={["#FF6B35"]}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>Chưa có lịch sử giao hàng.</Text>
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
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14, 
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB"
  },
  title: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  refreshBtn: { padding: 4 },
  list: { padding: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  orderId: { fontSize: 16, fontWeight: "bold", color: "#111827" },
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  statusSuccess: { backgroundColor: "#DCFCE7" },
  statusFail: { backgroundColor: "#FEE2E2" },
  statusText: { fontSize: 12, fontWeight: "600" },
  statusTextSuccess: { color: "#15803D" },
  statusTextFail: { color: "#B91C1C" },
  addressText: { fontSize: 14, color: "#4B5563", marginBottom: 5 },
  footer: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  dateText: { fontSize: 12, color: "#9CA3AF" },
  codText: { fontSize: 14, fontWeight: "bold", color: "#FF6B35" },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  actionBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  actionBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B45309",
  },
  emptyText: { textAlign: "center", marginTop: 40, color: "#6B7280" }
});
