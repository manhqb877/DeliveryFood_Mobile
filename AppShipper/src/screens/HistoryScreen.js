import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShipper } from '../context/ShipperContext';
import { Clock, CheckCircle, XCircle } from 'lucide-react-native';
import apiClient from '../lib/apiClient';

export default function HistoryScreen() {
  const { shipper } = useShipper();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/tracking/shippers/${shipper.id}/history`);
      setHistory(res);
    } catch (error) {
      console.log('Lỗi fetch lịch sử:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const renderItem = ({ item }) => {
    const isSuccess = item.status === 'DELIVERED';
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>{item.orderCode ? item.orderCode : `Đơn #${item.orderId}`}</Text>
          <View style={[styles.statusBadge, isSuccess ? styles.statusSuccess : styles.statusFail]}>
            {isSuccess ? <CheckCircle size={14} color="#15803D" /> : <XCircle size={14} color="#B91C1C" />}
            <Text style={[styles.statusText, isSuccess ? styles.statusTextSuccess : styles.statusTextFail]}>
              {isSuccess ? 'Thành công' : 'Thất bại'}
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
          <Text style={styles.dateText}>{new Date(item.updatedAt || item.createdAt).toLocaleString('vi-VN')}</Text>
          <Text style={styles.codText}>COD: {Number(item.codAmount || 0).toLocaleString('vi-VN')}đ</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lịch sử giao hàng</Text>
        <TouchableOpacity onPress={fetchHistory}>
          <Clock color="#4B5563" size={24} />
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
          ListEmptyComponent={
            <Text style={styles.emptyText}>Chưa có lịch sử giao hàng.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: 16, 
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  list: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  orderId: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  statusSuccess: { backgroundColor: '#DCFCE7' },
  statusFail: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 12, fontWeight: '600' },
  statusTextSuccess: { color: '#15803D' },
  statusTextFail: { color: '#B91C1C' },
  addressText: { fontSize: 14, color: '#4B5563', marginBottom: 6 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  dateText: { fontSize: 12, color: '#9CA3AF' },
  codText: { fontSize: 14, fontWeight: 'bold', color: '#FF6B35' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#6B7280' }
});
