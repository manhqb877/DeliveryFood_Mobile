import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MapPin,
  Search,
  ChevronRight,
  Star,
  Clock,
  Ticket,
  Percent,
  Compass,
  Coffee,
  Pizza,
  UtensilsCrossed,
  Soup,
  Cookie,
  Flame,
  ShoppingBasket,
  Gift,
  X,
  Copy,
} from 'lucide-react-native';
import { coreApi } from '../../api/coreApi';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import moment from 'moment';

const { width } = Dimensions.get('window');

// 8 danh mục bo tròn chuẩn phong cách BeFood
const CATEGORIES = [
  { id: 'promo', name: 'Khuyến Mãi', icon: Percent, bg: '#FEF3C7', color: '#D97706' },
  { id: 'near', name: 'Gần tôi', icon: Compass, bg: '#E0F2FE', color: '#0284C7' },
  { id: 'drink', name: 'Đồ Uống', icon: Coffee, bg: '#FCE7F3', color: '#DB2777' },
  { id: 'fastfood', name: 'Đồ Nhanh', icon: Pizza, bg: '#FFEDD5', color: '#EA580C' },
  { id: 'milktea', name: 'Trà Sữa', icon: UtensilsCrossed, bg: '#FEF9C3', color: '#CA8A04' },
  { id: 'rice', name: 'Cơm', icon: Flame, bg: '#DCFCE7', color: '#16A34A' },
  { id: 'noodle', name: 'Bún - Phở', icon: Soup, bg: '#E0E7FF', color: '#4F46E5' },
  { id: 'snack', name: 'Ăn vặt', icon: Cookie, bg: '#FEE2E2', color: '#DC2626' },
];

// Danh sách banner mẫu
const BANNERS = [
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1000&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1000&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1000&auto=format&fit=crop&q=80',
];

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const { totalCount } = useCart();
  const [shops, setShops] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBanner, setActiveBanner] = useState(0);
  const [promoModalVisible, setPromoModalVisible] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [bannerWidth, setBannerWidth] = useState(Math.min(width, 480) - 32);

  // Fetch danh sách quán
  const fetchShops = async () => {
    try {
      const data = await coreApi.getShops();
      setShops(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Lỗi lấy danh sách quán:', err);
    }
  };

  // Fetch danh sách mã ưu đãi thật từ server
  const fetchPromotions = async () => {
    try {
      const data = await coreApi.getPlatformPromotions();
      setPromotions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Lỗi lấy khuyến mãi:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchShops(), fetchPromotions()]);
      setLoading(false);
    };
    init();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchShops(), fetchPromotions()]);
    setRefreshing(false);
  };

  const handleCopyPromo = (code) => {
    setCopiedCode(code);
    if (Platform.OS === 'web') {
      try {
        navigator.clipboard?.writeText(code);
      } catch (_) {}
    }
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Lọc quán theo tìm kiếm
  const filteredShops = shops.filter((shop) => {
    const sName = shop.shopName || shop.name || '';
    const sAddr = shop.locationDetail || shop.address || '';
    return sName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           sAddr.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header: Địa chỉ giao hàng & Giỏ hàng */}
      <View style={styles.topHeader}>
        <View style={styles.locationContainer}>
          <Text style={styles.locationSub}>GIAO TỚI</Text>
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => navigation.navigate('AddressList')}
          >
            <MapPin size={18} color="#D97706" style={{ marginRight: 6 }} />
            <Text style={styles.locationText} numberOfLines={1}>
              {user?.fullName ? `${user.fullName} - Điểm hiện tại` : 'Chọn địa chỉ nhận món...'}
            </Text>
            <ChevronRight size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.cartHeaderBtn}
          onPress={() => navigation.navigate('Cart')}
        >
          <ShoppingBasket size={22} color="#111827" />
          {totalCount > 0 && (
            <View style={styles.cartHeaderBadge}>
              <Text style={styles.cartHeaderBadgeText}>{totalCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Thanh Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBox}>
          <Search size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm món ăn hoặc nhà hàng..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FFB700']} />
        }
      >
        {/* Banner Carousel */}
        <View
          style={styles.bannerContainer}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) setBannerWidth(w);
          }}
        >
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const slide = Math.round(e.nativeEvent.contentOffset.x / (bannerWidth || 1));
              setActiveBanner(slide);
            }}
            scrollEventThrottle={16}
          >
            {BANNERS.map((banner, index) => (
              <View key={index} style={[styles.bannerSlide, { width: bannerWidth }]}>
                <Image source={{ uri: banner }} style={styles.bannerImage} resizeMode="cover" />
                <View style={styles.bannerOverlay}>
                  <Text style={styles.bannerBadge}>beFood ƯU ĐÃI ĐẶC BIỆT</Text>
                  <Text style={styles.bannerTitle}>Hôm Nay Ăn Gì? beFood Lo!</Text>
                  <Text style={styles.bannerSubtitle}>Ưu đãi món ngon giảm tới 50K & Freeship</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          {/* Indicator dots */}
          <View style={styles.dotsRow}>
            {BANNERS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === activeBanner && styles.activeDot]}
              />
            ))}
          </View>
        </View>

        {/* 8 Danh mục bo tròn (Category Circular Grid) */}
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => {
            const IconComponent = cat.icon;
            return (
              <TouchableOpacity
                key={cat.id}
                style={styles.categoryItem}
                onPress={() => setSearchQuery(cat.name)}
              >
                <View style={[styles.categoryIconWrap, { backgroundColor: cat.bg }]}>
                  <IconComponent size={24} color={cat.color} />
                </View>
                <Text style={styles.categoryName} numberOfLines={1}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Voucher Bar */}
        <TouchableOpacity
          style={styles.voucherContainer}
          activeOpacity={0.85}
          onPress={() => setPromoModalVisible(true)}
        >
          <View style={styles.voucherContent}>
            <Ticket size={20} color="#D97706" style={{ marginRight: 8 }} />
            <Text style={styles.voucherText}>
              <Text style={{ fontWeight: '800' }}>
                {promotions.length > 0 ? `${promotions.length} ưu đãi` : '3 ưu đãi'}
              </Text>{' '}
              đang chờ bạn!
            </Text>
          </View>
          <View style={styles.voucherBtn}>
            <Text style={styles.voucherBtnText}>Xem</Text>
          </View>
        </TouchableOpacity>

        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>QUÁN NGON GẦN BẠN</Text>
            <Text style={styles.sectionSub}>Giao hàng nhanh trong 15-30 phút</Text>
          </View>
          <Text style={styles.shopCountBadge}>{filteredShops.length} quán</Text>
        </View>

        {/* Shop List */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#FFB700" />
            <Text style={styles.loadingText}>Đang tải danh sách quán ăn...</Text>
          </View>
        ) : filteredShops.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Chưa tìm thấy quán nào</Text>
            <Text style={styles.emptyDesc}>Vui lòng thử lại với từ khoá tìm kiếm khác</Text>
          </View>
        ) : (
          <View style={styles.shopList}>
            {filteredShops.map((shop) => (
              <TouchableOpacity
                key={shop.id}
                style={styles.shopCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('ShopDetail', { shopId: shop.id, shop })}
              >
                <Image
                  source={{
                    uri:
                      shop.coverImageUrl ||
                      shop.coverUrl ||
                      shop.logoUrl ||
                      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&auto=format&fit=crop&q=60',
                  }}
                  style={styles.shopImage}
                />
                <View style={styles.shopInfo}>
                  <Text style={styles.shopName} numberOfLines={1}>
                    {shop.shopName || shop.name}
                  </Text>
                  <Text style={styles.shopAddress} numberOfLines={1}>
                    {shop.locationDetail || shop.address || 'Khu đô thị Đại học Quốc Gia'}
                  </Text>

                  {/* Rating & Distance */}
                  <View style={styles.shopMetaRow}>
                    <View style={styles.ratingBadge}>
                      <Star size={13} color="#F59E0B" fill="#F59E0B" />
                      <Text style={styles.ratingText}>
                        {shop.avgRating || shop.rating ? Number(shop.avgRating || shop.rating).toFixed(1) : '4.8'}
                      </Text>
                    </View>
                    <Text style={styles.metaDivider}>•</Text>
                    <View style={styles.metaTime}>
                      <Clock size={13} color="#6B7280" />
                      <Text style={styles.metaTimeText}>15-25 phút</Text>
                    </View>
                    <Text style={styles.metaDivider}>•</Text>
                    <Text style={styles.distanceText}>1.2 km</Text>
                  </View>

                  {/* Promo Tags */}
                  <View style={styles.tagsRow}>
                    <View style={styles.promoTag}>
                      <Text style={styles.promoTagText}>Giảm 25K</Text>
                    </View>
                    <View style={[styles.promoTag, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[styles.promoTagText, { color: '#92400E' }]}>Freeship</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal Danh Sách Mã Khuyến Mãi Thật */}
      <Modal
        visible={promoModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPromoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Gift size={22} color="#D97706" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Mã Khuyến Mãi beFood</Text>
              </View>
              <TouchableOpacity onPress={() => setPromoModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
              {promotions.length === 0 ? (
                <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                  <Text style={{ color: '#6B7280', fontSize: 14 }}>Hiện chưa có mã ưu đãi mới.</Text>
                </View>
              ) : (
                promotions.map((promo) => {
                  const isCopied = copiedCode === promo.code;
                  return (
                    <View key={promo.id || promo.code} style={styles.promoCard}>
                      <View style={styles.promoCardLeft}>
                        <View style={styles.promoBadge}>
                          <Text style={styles.promoBadgeText}>{promo.code}</Text>
                        </View>
                        <Text style={styles.promoDiscount}>
                          {promo.promoType === 'PERCENT'
                            ? `Giảm ${promo.discountValue}% (tối đa ${(promo.maxDiscountAmount || 30000).toLocaleString('vi-VN')} đ)`
                            : promo.promoType === 'FREE_DELIVERY'
                            ? `Freeship ${(promo.discountValue || 15000).toLocaleString('vi-VN')} đ`
                            : `Giảm ${(promo.discountValue || 20000).toLocaleString('vi-VN')} đ`}
                        </Text>
                        <Text style={styles.promoCond}>
                          Đơn tối thiểu: {(promo.minOrderValue || 0).toLocaleString('vi-VN')} đ
                        </Text>
                        {promo.validUntil && (
                          <Text style={styles.promoDate}>
                            HSD: {moment(promo.validUntil).format('DD/MM/YYYY')}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[styles.copyBtn, isCopied && styles.copiedBtn]}
                        onPress={() => handleCopyPromo(promo.code)}
                      >
                        <Copy size={13} color={isCopied ? '#FFFFFF' : '#D97706'} style={{ marginRight: 4 }} />
                        <Text style={[styles.copyBtnText, isCopied && styles.copiedBtnText]}>
                          {isCopied ? 'Đã chép' : 'Sao chép'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationContainer: {
    flex: 1,
    marginRight: 12,
  },
  cartHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cartHeaderBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FFB700',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  cartHeaderBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#111827',
  },
  locationSub: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  locationText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  bannerContainer: {
    marginTop: 10,
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerSlide: {
    height: 195,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#FFB700',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    opacity: 0.85,
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
  },
  bannerBadge: {
    backgroundColor: '#111827',
    color: '#FFB700',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#F9FAFB',
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 3,
  },
  activeDot: {
    width: 16,
    backgroundColor: '#FFB700',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    marginTop: 16,
  },
  categoryItem: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  voucherContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    marginHorizontal: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  voucherContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voucherText: {
    fontSize: 13,
    color: '#92400E',
  },
  voucherBtn: {
    backgroundColor: '#FFB700',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 8,
  },
  voucherBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 0.3,
  },
  sectionSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  shopCountBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  shopList: {
    paddingHorizontal: 16,
  },
  shopCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  shopImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  shopInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  shopName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  shopAddress: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  shopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 3,
  },
  metaDivider: {
    fontSize: 12,
    color: '#D1D5DB',
    marginHorizontal: 6,
  },
  metaTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaTimeText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 3,
  },
  distanceText: {
    fontSize: 12,
    color: '#6B7280',
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promoTag: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  promoTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#6B7280',
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  emptyDesc: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 24,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  modalCloseBtn: {
    padding: 6,
  },
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  promoCardLeft: {
    flex: 1,
    marginRight: 10,
  },
  promoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#D97706',
    borderStyle: 'dashed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  promoBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  promoDiscount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 3,
  },
  promoCond: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  promoDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  copiedBtn: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  copiedBtnText: {
    color: '#FFFFFF',
  },
});
