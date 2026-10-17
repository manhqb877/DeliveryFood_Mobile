import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, RefreshControl, Alert, Animated, Platform, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShipper } from '../context/ShipperContext';
import {
  Wallet, TrendingUp, RefreshCw, AlertCircle, CheckCircle2,
  ArrowUpRight, ShieldCheck, DollarSign, Clock, ChevronRight, Store, X
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

  // In-app Modals
  const [selectedRemit, setSelectedRemit] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [resultModal, setResultModal] = useState({
    visible: false,
    success: false,
    title: '',
    message: '',
    details: null,
  });

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

  const handleRemitCOD = (remit) => {
    setSelectedRemit(remit);
    setShowConfirmModal(true);
  };

  const executeRemit = async () => {
    if (!selectedRemit) return;
    try {
      setRemitLoading(true);
      await apiClient.post(`/remittances/${selectedRemit.id}/complete`);
      setShowConfirmModal(false);
      
      const isMulti = selectedRemit.isMultiShop;
      setResultModal({
        visible: true,
        success: true,
        title: 'Nộp tiền COD thành công!',
        message: isMulti
          ? `Khoản COD ${formatCurrency(selectedRemit.amount)} đã được hệ thống tự động đối soát và hoàn tiền vào ví của cả 2 đối tác quán.`
          : `Khoản COD ${formatCurrency(selectedRemit.amount)} đã được hoàn trả thành công vào ví của đối tác ${selectedRemit.shop1Name || 'cửa hàng'}.`,
        details: isMulti ? [
          { label: selectedRemit.shop1Name, amount: selectedRemit.shop1Amount, color: '#2563EB' },
          { label: selectedRemit.shop2Name, amount: selectedRemit.shop2Amount, color: '#7C3AED' },
        ] : null,
      });

      await fetchWallet(true);
    } catch (e) {
      const errMsg = e?.response?.data?.message || e?.message || 'Không thể kết nối máy chủ';
      setShowConfirmModal(false);
      setResultModal({
        visible: true,
        success: false,
        title: 'Nộp tiền không thành công',
        message: errMsg,
        details: null,
      });
    } finally {
      setRemitLoading(false);
    }
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

      {/* ================= MODAL XÁC NHẬN NỘP COD ================= */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => !remitLoading && setShowConfirmModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer3D}>
            {/* Header Icon & Close */}
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalIconCircle}>
                <Wallet color="#D97706" size={24} />
              </View>
              <TouchableOpacity 
                style={styles.modalCloseBtn}
                onPress={() => !remitLoading && setShowConfirmModal(false)}
                disabled={remitLoading}
                activeOpacity={0.7}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTitle}>Xác nhận nộp COD</Text>
            <Text style={styles.modalSubtitle}>
              Đơn hàng: {selectedRemit?.orderCode || `#${selectedRemit?.orderId || selectedRemit?.id}`}
            </Text>

            {/* Chi tiết khoản nộp */}
            {selectedRemit?.isMultiShop ? (
              <View style={styles.modalMultiCard}>
                <View style={styles.modalMultiBadge}>
                  <Text style={styles.modalMultiBadgeText}>⚡ HOÀN VÍ CẢ 2 QUÁN</Text>
                </View>

                <View style={styles.modalShopRow}>
                  <View style={styles.modalShopLeft}>
                    <Store size={14} color="#2563EB" />
                    <Text style={styles.modalShopName} numberOfLines={1}>
                      Quán 1: {selectedRemit?.shop1Name}
                    </Text>
                  </View>
                  <Text style={styles.modalShopAmountBlue}>
                    {formatCurrency(selectedRemit?.shop1Amount)}
                  </Text>
                </View>

                <View style={styles.modalShopRow}>
                  <View style={styles.modalShopLeft}>
                    <Store size={14} color="#7C3AED" />
                    <Text style={styles.modalShopName} numberOfLines={1}>
                      Quán 2: {selectedRemit?.shop2Name}
                    </Text>
                  </View>
                  <Text style={styles.modalShopAmountPurple}>
                    {formatCurrency(selectedRemit?.shop2Amount)}
                  </Text>
                </View>

                <View style={styles.modalDashedLine} />

                <View style={styles.modalTotalRow}>
                  <Text style={styles.modalTotalLabel}>Tổng tiền COD:</Text>
                  <Text style={styles.modalTotalValue}>
                    {formatCurrency(selectedRemit?.amount)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.modalSingleCard}>
                <View style={styles.modalShopRow}>
                  <View style={styles.modalShopLeft}>
                    <Store size={14} color="#2563EB" />
                    <Text style={styles.modalShopName} numberOfLines={1}>
                      {selectedRemit?.shop1Name || 'Cửa hàng đối tác'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.modalTotalRow, { marginTop: 8 }]}>
                  <Text style={styles.modalTotalLabel}>Số tiền COD:</Text>
                  <Text style={styles.modalTotalValue}>
                    {formatCurrency(selectedRemit?.amount)}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.modalNoteBox}>
              <ShieldCheck size={16} color="#059669" style={{ marginTop: 2, marginRight: 6 }} />
              <Text style={styles.modalNoteText}>
                Tiền COD sẽ được nộp về hệ thống và tự động nạp hoàn trả vào ví của chủ quán ngay lập tức.
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowConfirmModal(false)}
                disabled={remitLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelBtnText}>Huỷ bỏ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={executeRemit}
                disabled={remitLoading}
                activeOpacity={0.85}
              >
                {remitLoading ? (
                  <ActivityIndicator size="small" color="#0F172A" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Nộp ngay</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL KẾT QUẢ ================= */}
      <Modal
        visible={resultModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setResultModal(prev => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer3D}>
            <View style={styles.resultIconWrap}>
              {resultModal.success ? (
                <View style={styles.resultSuccessCircle}>
                  <CheckCircle2 color="#15803D" size={36} />
                </View>
              ) : (
                <View style={styles.resultErrorCircle}>
                  <AlertCircle color="#DC2626" size={36} />
                </View>
              )}
            </View>

            <Text style={styles.resultTitle}>{resultModal.title}</Text>
            <Text style={styles.resultMessage}>{resultModal.message}</Text>

            {resultModal.details && (
              <View style={styles.resultDetailsBox}>
                {resultModal.details.map((d, i) => (
                  <View key={i} style={styles.resultDetailRow}>
                    <Text style={styles.resultDetailLabel} numberOfLines={1}>• {d.label}:</Text>
                    <Text style={[styles.resultDetailAmount, { color: d.color }]}>+{formatCurrency(d.amount)}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.resultCloseBtn}
              onPress={() => setResultModal(prev => ({ ...prev, visible: false }))}
              activeOpacity={0.8}
            >
              <Text style={styles.resultCloseBtnText}>
                {resultModal.success ? 'Hoàn tất' : 'Đóng'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  // In-app Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer3D: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtn: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 14,
  },
  modalMultiCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  modalMultiBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
  },
  modalMultiBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  modalSingleCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  modalShopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  modalShopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  modalShopName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  modalShopAmountBlue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563EB',
  },
  modalShopAmountPurple: {
    fontSize: 13,
    fontWeight: '800',
    color: '#7C3AED',
  },
  modalDashedLine: {
    height: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginVertical: 10,
  },
  modalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalTotalValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#D97706',
  },
  modalNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 10,
    marginBottom: 18,
  },
  modalNoteText: {
    fontSize: 12,
    color: '#065F46',
    flex: 1,
    lineHeight: 17,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  modalConfirmBtn: {
    flex: 1.4,
    backgroundColor: '#FFB800',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFB800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  resultIconWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  resultSuccessCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultErrorCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  resultMessage: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  resultDetailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  resultDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultDetailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  resultDetailAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  resultCloseBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
