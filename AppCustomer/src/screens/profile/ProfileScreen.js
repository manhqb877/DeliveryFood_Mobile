import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Phone,
  Mail,
  MapPin,
  KeyRound,
  ShoppingBasket,
  HelpCircle,
  LogOut,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen({ navigation }) {
  const { user, logout, refreshProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
    } catch (_) {
      Alert.alert('Thông báo', 'Không thể đồng bộ hồ sơ từ máy chủ');
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng?');
      if (confirmed) {
        await logout();
      }
      return;
    }

    Alert.alert(
      'Xác nhận đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const displayName = user?.fullName || user?.phone || 'Khách hàng';
  const displayPhone = user?.phone || 'Chưa cập nhật';
  const displayEmail = user?.email || 'Chưa cập nhật';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Tài Khoản Của Tôi</Text>
        <TouchableOpacity onPress={handleRefresh} disabled={refreshing} style={styles.refreshBtn}>
          {refreshing ? (
            <ActivityIndicator size="small" color="#111827" />
          ) : (
            <RefreshCw size={20} color="#111827" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarWrap}>
            <User size={38} color="#111827" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{displayName}</Text>
            <View style={styles.userRoleBadge}>
              <ShieldCheck size={13} color="#D97706" />
              <Text style={styles.userRoleText}>KHÁCH HÀNG THÂN THIẾT</Text>
            </View>
          </View>
        </View>

        {/* Section 1: Thông tin liên hệ */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>THÔNG TIN LIÊN HỆ</Text>
          <View style={styles.infoRow}>
            <Phone size={18} color="#6B7280" style={{ marginRight: 12 }} />
            <Text style={styles.infoLabel}>Số điện thoại:</Text>
            <Text style={styles.infoVal}>{displayPhone}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Mail size={18} color="#6B7280" style={{ marginRight: 12 }} />
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoVal} numberOfLines={1}>{displayEmail}</Text>
          </View>
        </View>

        {/* Section 2: Quản lý & Cài đặt */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>CÀI ĐẶT & QUẢN LÝ</Text>

          {/* Sổ địa chỉ */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('AddressList')}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#E0F2FE' }]}>
                <MapPin size={20} color="#0284C7" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.menuItemTitle}>Sổ địa chỉ nhận hàng</Text>
                <Text style={styles.menuItemSub}>Quản lý địa chỉ giao đồ ăn</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Đổi mật khẩu */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('ChangePassword')}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <KeyRound size={20} color="#D97706" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.menuItemTitle}>Đổi mật khẩu</Text>
                <Text style={styles.menuItemSub}>Bảo vệ an toàn tài khoản</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Đơn hàng */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Đơn hàng')}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#DCFCE7' }]}>
                <ShoppingBasket size={20} color="#16A34A" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.menuItemTitle}>Đơn hàng của bạn</Text>
                <Text style={styles.menuItemSub}>Lịch sử và tiến trình giao hàng</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Trợ giúp */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Hỗ trợ', 'Hotline CSKH: 1900 1234 (8h - 22h hàng ngày)')}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#F3F4F6' }]}>
                <HelpCircle size={20} color="#4B5563" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.menuItemTitle}>Trung tâm trợ giúp</Text>
                <Text style={styles.menuItemSub}>Câu hỏi thường gặp & liên hệ</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Nút Đăng xuất */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <LogOut size={20} color="#DC2626" style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>ĐĂNG XUẤT</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Phiên bản 1.0.0 (Customer App)</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  refreshBtn: {
    padding: 6,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFB700',
    margin: 16,
    padding: 18,
    borderRadius: 20,
    shadowColor: '#FFB700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  userRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  userRoleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    width: 100,
  },
  infoVal: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  menuItemSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    marginHorizontal: 16,
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  logoutBtnText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 16,
  },
});
