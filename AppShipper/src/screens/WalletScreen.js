import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShipper } from '../context/ShipperContext';
import { Wallet, TrendingUp, RefreshCw } from 'lucide-react-native';
import apiClient from '../lib/apiClient';

export default function WalletScreen() {
  const { shipper } = useShipper();
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [remittances, setRemittances] = useState([]);
  const [remitLoading, setRemitLoading] = useState(false);

  const fetchWallet = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/tracking/shippers/${shipper.id}/wallet`);
      setWallet(res);
      
      // Fetch pending remittances qua apiClient (đã cấu hình đúng IP)
      try {
        const data = await apiClient.get(`/remittances/shipper/${shipper.id}`);
        const list = Array.isArray(data) ? data : (data?.data || []);
        setRemittances(list.filter(r => r.status === 'PENDING'));
      } catch (err) {
        console.log('Lỗi fetch remittances:', err);
      }

    } catch (error) {
      console.log('Lỗi fetch ví tiền:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemitCOD = async (remittanceId, amount) => {
    try {
      setRemitLoading(true);
      await apiClient.post(`/remittances/${remittanceId}/complete`);
      alert(`✅ Hoàn tiền thành công: ${Number(amount).toLocaleString('vi-VN')} đ`);
      fetchWallet(); // Reload after success
    } catch (e) {
      alert('Lỗi kết nối máy chủ: ' + (e?.message || ''));
    } finally {
      setRemitLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ví tiền Shipper</Text>
        <TouchableOpacity onPress={fetchWallet}>
          <RefreshCw color="#4B5563" size={24} />
        </TouchableOpacity>
      </View>
      
      {loading || !wallet ? (
        <ActivityIndicator size="large" color="#FACC15" style={{ marginTop: 50 }} />
      ) : (
        <View style={styles.content}>
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <Wallet color="#fff" size={24} />
              <Text style={styles.balanceTitle}>Tổng tiền COD đã thu</Text>
            </View>
            <Text style={styles.balanceAmount}>
              {Number(wallet.totalCodCollected || 0).toLocaleString('vi-VN')} đ
            </Text>
            <Text style={styles.balanceSubtext}>
              *Đây là số tiền mặt thu hộ từ khách hàng, cần nộp lại cho hệ thống.
            </Text>
          </View>
          
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <TrendingUp color="#15803D" size={24} />
              <View style={styles.statTextContainer}>
                <Text style={styles.statLabel}>Đơn hoàn thành</Text>
                <Text style={styles.statValue}>{wallet.totalCompletedDeliveries} đơn</Text>
              </View>
            </View>
          </View>

          {/* COD Remittances Section */}
          <View style={[styles.statsCard, { marginTop: 16 }]}>
             <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 12 }}>
               Các khoản thu hộ cần hoàn trả
             </Text>
             {remittances.length > 0 ? (
               remittances.map((remit, index) => (
                 <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                   <View style={{ flex: 1 }}>
                     <Text style={{ fontWeight: 'bold', color: '#D97706', fontSize: 14 }}>
                       Đơn: {remit.orderCode}
                     </Text>
                     <Text style={{ fontWeight: 'bold', color: '#111827', fontSize: 16, marginTop: 4 }}>
                       {Number(remit.amount || 0).toLocaleString('vi-VN')} đ
                     </Text>
                   </View>
                   <TouchableOpacity 
                     style={{ backgroundColor: '#D97706', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
                     onPress={() => handleRemitCOD(remit.id, remit.amount)}
                     disabled={remitLoading}
                   >
                     <Text style={{ color: '#fff', fontWeight: 'bold' }}>Hoàn tiền</Text>
                   </TouchableOpacity>
                 </View>
               ))
             ) : (
               <Text style={{ color: '#6B7280', fontStyle: 'italic' }}>Không có khoản thu hộ nào cần nộp.</Text>
             )}
          </View>
        </View>
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
  content: { padding: 16 },
  balanceCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#111827',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  balanceTitle: { color: '#9CA3AF', fontSize: 16, fontWeight: '500' },
  balanceAmount: { color: '#FACC15', fontSize: 36, fontWeight: 'bold', marginBottom: 8 },
  balanceSubtext: { color: '#6B7280', fontSize: 12, fontStyle: 'italic' },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statTextContainer: { flex: 1 },
  statLabel: { fontSize: 14, color: '#6B7280' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#111827' }
});
