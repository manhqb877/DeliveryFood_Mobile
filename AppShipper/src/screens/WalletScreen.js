import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, RefreshControl, Alert, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShipper } from '../context/ShipperContext';
import {
  Wallet, TrendingUp, RefreshCw, AlertCircle, CheckCircle2,
  ArrowUpRight, ShieldCheck, DollarSign, Clock, ChevronRight, Store
} from 'lucide-react-native';
import apiClient from '../lib/apiClient';

function formatCurrency(n) {
  return n ? Number(n).toLocaleString('vi-VN') + 'đ' : '0đ';
}

export default function WalletScreen() {
  const { shipper } = useShipper();
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [remittances, setRemittances] = useState([]);
  const [shopMap, setShopMap] = useState({});
  const [remitLoading, setRemitLoading] = useState(false);

  const cardScaleAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.spring(cardScaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, []);

  const fetchWallet = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiClient.get(`/tracking/shippers/${shipper.id}/wallet`);
      setWallet(res);

      try {
        const [data, shopsRes, historyRes, activeRes] = await Promise.all([
          apiClient.get(`/remittances/shipper/${shipper.id}`).catch(() => []),
          apiClient.get('/core/shops').catch(() => []),
          apiClient.get(`/tracking/shippers/${shipper.id}/history`).catch(() => []),
          apiClient.get(`/tracking/shippers/${shipper.id}/deliveries/active`).catch(() => []),
        ]);
        const list = Array.isArray(data) ? data : (data?.data || []);
        const sList = Array.isArray(shopsRes) ? shopsRes : (shopsRes?.data || []);
        const deliveries = [
          ...(Array.isArray(historyRes) ? historyRes : (historyRes?.data || [])),
          ...(Array.isArray(activeRes) ? activeRes : (activeRes?.data || [])),
        ];
        
        const sMap = {};
        sList.forEach((s) => {
          if (s.id && s.shopName) sMap[s.id] = s.shopName;
        });
        
        const deliveryMap = {};
        deliveries.forEach((d) => {
          if (d.orderId != null) deliveryMap[String(d.orderId)] = d;
          if (d.orderCode) deliveryMap[d.orderCode] = d;
        });

        const pendingList = list
          .filter(r => r.status === 'PENDING')
          .map(r => {
            const del = deliveryMap[String(r.orderId)] || (r.orderCode ? deliveryMap[r.orderCode] : null);
            const isMulti = r.isMultiShop || (del && del.isMultiShop) || (r.shop2Id != null);
            
            const s1Name = r.shop1Name 
              || (del ? del.shop1Name : null) 
              || (del && del.pickupAddress ? del.pickupAddress.split(' - ')[0] : null) 
              || sMap[r.shopId] 
              || `Quán #${r.shopId}`;

            const s2Id = r.shop2Id || (del ? del.shop2Id : null);
            const s2Name = r.shop2Name 
              || (del ? del.shop2Name : null) 
              || (del && del.pickup2Address ? del.pickup2Address.split(' - ')[0] : null) 
              || (s2Id ? sMap[s2Id] : null) 
              || (s2Id ? `Quán #${s2Id}` : 'Quán 2');

            let amt1 = r.shop1Amount;
            let amt2 = r.shop2Amount;
            if (isMulti && (!amt1 || !amt2)) {
              amt1 = Math.round(Number(r.amount || 0) / 2);
              amt2 = Number(r.amount || 0) - amt1;
            }

            return {
              ...r,
              isMultiShop: !!isMulti,
              shop1Name: s1Name,
              shop2Name: s2Name,
              shop2Id: s2Id,
              shop1Amount: amt1,
              shop2Amount: amt2,
            };
          });

        setShopMap(sMap);
        setRemittances(pendingList);
      } catch (err) {
        console.log('Lỗi fetch remittances:', err);
      }
    } catch (error) {
      console.log('Lỗi fetch ví tiền:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRemitCOD = async (remit) => {
    const isMulti = remit.isMultiShop;
    const msg = isMulti
      ? `Khoản COD ${formatCurrency(remit.amount)} sẽ được tự động hoàn về ví của cả 2 quán:\n\n• ${remit.shop1Name}: ${formatCurrency(remit.shop1Amount)}\n• ${remit.shop2Name}: ${formatCurrency(remit.shop2Amount)}\n\nBạn có chắc chắn muốn nộp ngay?`
      : `Bạn có chắc chắn muốn nộp khoản tiền thu hộ ${formatCurrency(remit.amount)} về cho ${remit.shop1Name || 'đối tác'}?`;

    Alert.alert(
      'Xác nhận hoàn tiền COD',
      msg,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Nộp ngay',
          onPress: async () => {
            try {
              setRemitLoading(true);
              await apiClient.post(`/remittances/${remit.id}/complete`);
              Alert.alert('✅ Thành công', `Đã nộp tiền thu hộ ${formatCurrency(remit.amount)} về hệ thống và hoàn ví đối tác!`);
              fetchWallet(true);
            } catch (e) {
              Alert.alert('Lỗi', 'Không thể hoàn tiền: ' + (e?.message || ''));
            } finally {
              setRemitLoading(false);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Ví tiền & Thu nhập</Text>
          <Text style={styles.headerSub}>Quản lý số dư COD và lịch sử nộp tiền</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn3D}
          onPress={() => fetchWallet(true)}
          activeOpacity={0.8}
        >
          <RefreshCw color="#111827" size={18} />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#FFB800" />
          <Text style={styles.loadingText}>Đang cập nhật số dư ví...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchWallet(true)}
              colors={['#FFB800']}
              tintColor="#FFB800"
            />
          }
        >
          {/* ================= THẺ VÍ 3D ĐEN THAN & VÀNG BE ================= */}
          <Animated.View style={[styles.walletCard3D, { transform: [{ scale: cardScaleAnim }] }]}>
            <View style={styles.walletCardTop}>
              <View style={styles.walletBadgeRow}>
                <View style={styles.walletIconCircle}>
                  <Wallet color="#FFB800" size={20} />
                </View>
                <View>
                  <Text style={styles.walletCardLabel}>TỔNG TIỀN COD ĐANG GIỮ</Text>
                  <Text style={styles.driverTagText}>{shipper?.fullName || 'Tài xế công nghệ'}</Text>
                </View>
              </View>

              <View style={styles.activePill}>
                <View style={styles.activeDot} />
                <Text style={styles.activePillText}>Đang hoạt động</Text>
              </View>
            </View>

            <View style={styles.amountWrap}>
              <Text style={styles.balanceAmountText}>
                {formatCurrency(wallet?.totalCodCollected || 0)}
              </Text>
            </View>

            <View style={styles.walletDivider} />

            <View style={styles.walletCardFooter}>
              <AlertCircle size={14} color="#94A3B8" />
              <Text style={styles.walletNoteText}>
                Số tiền mặt thu hộ từ khách, cần nộp hoàn trả cho đối tác.
              </Text>
            </View>
          </Animated.View>

          {/* ================= THẺ THỐNG KÊ NHANH 3D ================= */}
          <View style={styles.statsRow}>
            <View style={styles.statCard3D}>
              <View style={[styles.statIconCircle, { backgroundColor: '#DCFCE7' }]}>
                <TrendingUp color="#15803D" size={18} />
              </View>
              <Text style={styles.statCardNum}>{wallet?.totalCompletedDeliveries || 0} đơn</Text>
              <Text style={styles.statCardLabel}>Giao thành công</Text>
            </View>

            <View style={styles.statCard3D}>
              <View style={[styles.statIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <DollarSign color="#D97706" size={18} />
              </View>
              <Text style={styles.statCardNum}>
                {formatCurrency((wallet?.totalCompletedDeliveries || 0) * 25000)}
              </Text>
              <Text style={styles.statCardLabel}>Cước nhận ước tính</Text>
            </View>
          </View>

          {/* ================= DANH SÁCH KHOẢN COD CẦN HOÀN TRẢ ================= */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Khoản thu hộ COD cần hoàn trả</Text>
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountText}>{remittances.length}</Text>
              </View>
            </View>

            {remittances.length > 0 ? (
              remittances.map((remit, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.remitCard3D, 
                    remit.isMultiShop && styles.remitCardMulti
                  ]}
                >
                  <View style={styles.remitCardHeader}>
                    <View style={styles.remitTag}>
                      <Clock size={12} color="#D97706" />
                      <Text style={styles.remitTagText}>Chờ nộp</Text>
                    </View>
                    <Text style={styles.remitCodeText}>
                      Đơn: {remit.orderCode ? remit.orderCode : `#${remit.orderId || remit.id}`}
                    </Text>
                  </View>

                  {remit.isMultiShop ? (
                    <View style={styles.multiShopRemitContainer}>
                      {/* Badge đơn ghép 2 quán */}
                      <View style={styles.multiShopBanner}>
                        <Text style={styles.multiShopBannerText}>
                          ⚡ ĐƠN GHÉP 2 QUÁN • HOÀN VÍ CẢ 2 QUÁN
                        </Text>
                      </View>

                      {/* Quán 1 */}
                      <View style={styles.multiShopItemRow}>
                        <View style={styles.multiShopLeft}>
                          <Store size={14} color="#2563EB" />
                          <Text style={styles.multiShopNameText} numberOfLines={1}>
                            <Text style={styles.shopIndexLabel}>Quán 1: </Text>
                            {remit.shop1Name}
                          </Text>
                        </View>
                        {remit.shop1Amount != null && (
                          <Text style={styles.multiShopShareText}>
                            {formatCurrency(remit.shop1Amount)}
                          </Text>
                        )}
                      </View>

                      {/* Quán 2 */}
                      <View style={styles.multiShopItemRow}>
                        <View style={styles.multiShopLeft}>
                          <Store size={14} color="#7C3AED" />
                          <Text style={styles.multiShopNameText} numberOfLines={1}>
                            <Text style={styles.shopIndexLabel2}>Quán 2: </Text>
                            {remit.shop2Name}
                          </Text>
                        </View>
                        {remit.shop2Amount != null && (
                          <Text style={styles.multiShopShareText2}>
                            {formatCurrency(remit.shop2Amount)}
                          </Text>
                        )}
                      </View>
                    </View>
                  ) : (
                    /* Single shop row */
                    <View style={styles.remitShopRow}>
                      <Store size={13} color="#2563EB" />
                      <Text style={styles.remitShopName} numberOfLines={1}>
                        {remit.shop1Name || shopMap[remit.shopId] || remit.shopName || (remit.pickupAddress ? remit.pickupAddress.split(' - ')[0] : (remit.shopId ? `Quán #${remit.shopId}` : 'Cửa hàng đối tác'))}
                      </Text>
                    </View>
                  )}

                  <View style={styles.remitBody}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.remitAmountLabel}>
                        {remit.isMultiShop ? 'Tổng tiền COD (2 quán):' : 'Số tiền thu hộ:'}
                      </Text>
                      <Text style={styles.remitAmountValue}>{formatCurrency(remit.amount)}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.btnRemit3D}
                      onPress={() => handleRemitCOD(remit)}
                      disabled={remitLoading}
                      activeOpacity={0.85}
                    >
                      {remitLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Text style={styles.btnRemitText}>Nộp ngay</Text>
                          <ArrowUpRight size={14} color="#FFFFFF" strokeWidth={2.5} />
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyRemitCard}>
                <View style={styles.emptyIconCircle}>
                  <CheckCircle2 color="#10B981" size={28} />
                </View>
                <Text style={styles.emptyTitle}>Đã hoàn tất thanh toán!</Text>
                <Text style={styles.emptySubtitle}>
                  Không có khoản thu hộ COD nào đang bị tồn đọng cần nộp lại.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  refreshBtn3D: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 90,
  },

  // 3D Wallet Card
  walletCard3D: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16,
    // Layered Shadow
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  walletCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.3)',
  },
  walletCardLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  driverTagText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activePillText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  amountWrap: {
    marginVertical: 18,
  },
  balanceAmountText: {
    color: '#FFB800',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  walletDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
  },
  walletCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletNoteText: {
    color: '#94A3B8',
    fontSize: 11,
    flex: 1,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard3D: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statCardNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  statCardLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },

  // Section
  sectionWrap: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  badgeCount: {
    backgroundColor: '#FFB800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeCountText: {
    color: '#111827',
    fontSize: 11,
    fontWeight: '800',
  },

  // Remit Card 3D
  remitCard3D: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  remitCardMulti: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFCF5',
  },
  multiShopRemitContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  multiShopBanner: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  multiShopBannerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.3,
  },
  multiShopItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: 8,
  },
  multiShopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  multiShopNameText: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '500',
    flex: 1,
  },
  shopIndexLabel: {
    fontWeight: '700',
    color: '#2563EB',
  },
  shopIndexLabel2: {
    fontWeight: '700',
    color: '#7C3AED',
  },
  multiShopShareText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  multiShopShareText2: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  remitCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  remitTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  remitTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  remitCodeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  remitShopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  remitShopName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
    flex: 1,
  },
  remitBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  remitAmountLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  remitAmountValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#D97706',
  },
  btnRemit3D: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D97706',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  btnRemitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // Empty Remittance
  emptyRemitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
