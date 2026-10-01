import React, { useState, useEffect, useRef } from 'react';
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
  XCircle,
  Copy,
  Bell,
  Plus,
  Sparkles,
} from 'lucide-react-native';
import { coreApi } from '../../api/coreApi';
import { authApi } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useNotification } from '../../context/NotificationContext';
import ProductOptionModal from '../../components/ProductOptionModal';
import moment from 'moment';

const { width } = Dimensions.get('window');

// Công thức Haversine tính khoảng cách thực tế giữa 2 toạ độ (km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Bán kính Trái Đất tính theo km
  const dLat = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
  const dLon = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((Number(lat1) * Math.PI) / 180) *
      Math.cos((Number(lat2) * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

// 8 danh mục chuẩn phong cách BeFood với bộ lọc từ khóa thực tế trong DB
const CATEGORIES = [
  { id: 'promo', name: 'Khuyến Mãi', icon: Percent, bg: '#FEF3C7', color: '#D97706' },
  { id: 'near', name: 'Gần tôi', icon: Compass, bg: '#E0F2FE', color: '#0284C7' },
  { id: 'drink', name: 'Đồ Uống', icon: Coffee, bg: '#FCE7F3', color: '#DB2777', keywords: ['nước', 'trà', 'cà phê', 'cafe', 'sinh tố', 'ép', 'juice'] },
  { id: 'fastfood', name: 'Đồ Nhanh', icon: Pizza, bg: '#FFEDD5', color: '#EA580C', keywords: ['mì', 'fast', 'bánh', 'trộn'] },
  { id: 'milktea', name: 'Trà Sữa', icon: UtensilsCrossed, bg: '#FEF9C3', color: '#CA8A04', keywords: ['trà sữa', 'taka', 'matcha', 'cheese'] },
  { id: 'rice', name: 'Cơm', icon: Flame, bg: '#DCFCE7', color: '#16A34A', keywords: ['cơm', 'sườn', 'tấm'] },
  { id: 'noodle', name: 'Bún - Phở', icon: Soup, bg: '#E0E7FF', color: '#4F46E5', keywords: ['bún', 'phở', 'mì', 'hủ tiếu'] },
  { id: 'snack', name: 'Ăn vặt', icon: Cookie, bg: '#FEE2E2', color: '#DC2626', keywords: ['kem', 'chè', 'ăn vặt', 'trái cây', 'snack'] },
];

// 3 banner đặc sắc đúng chủ đề ẩm thực & giao hàng
const BANNERS = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1000&auto=format&fit=crop&q=80',
    badge: 'ĐẠI TIỆC MÓN VIỆT',
    title: 'Hôm Nay Ăn Gì? beFood Lo!',
    subtitle: 'Món ngon chuẩn vị, ưu đãi tới 50K & Freeship',
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1000&auto=format&fit=crop&q=80',
    badge: 'SIÊU DEAL GIẢM 50K',
    title: 'Bùng Nổ Tiệc Burger & FastFood',
    subtitle: 'Giảm 30% khi đặt đơn nhóm bạn ngay hôm nay',
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=1000&auto=format&fit=crop&q=80',
    badge: 'GIẢI NHIỆT MÙA HÈ',
    title: 'Trà Sữa & Nước Ép Tươi Mát',
    subtitle: 'Đồng giá chỉ từ 19K, giao nhanh tận cửa',
  },
];

// Hàm nhận diện và loại trừ topping / đồ ăn kèm / phần thêm (chỉ hiển thị món ăn chính)
const isTopping = (item) => {
  if (!item) return false;
  const name = (item.name || '').trim().toLowerCase();
  const desc = (item.description || '').toLowerCase();
  const cat = (item.categoryName || '').toLowerCase();
  const price = Number(item.basePrice || item.price || item.discountPrice || 0);

  // 1. Theo tên danh mục
  if (
    cat.includes('topping') ||
    cat.includes('món thêm') ||
    cat.includes('ăn kèm') ||
    cat.includes('gia vị') ||
    cat.includes('phụ')
  ) {
    return true;
  }

  // 2. Từ khóa topping trong tên món
  if (
    name.includes('topping') ||
    name.startsWith('thêm ') ||
    name.endsWith(' thêm') ||
    name.includes('(thêm)') ||
    name.includes('[thêm]') ||
    name.includes('phần thêm')
  ) {
    return true;
  }

  // 3. Tên các món topping / món ăn kèm phổ biến
  const commonToppings = [
    'thanh cua',
    'trứng lòng đào',
    'trứng ốp la',
    'trứng cút',
    'bò viên',
    'cá viên',
    'tôm viên',
    'xúc xích',
    'xúc xích thêm',
    'chả lụa thêm',
    'chả cá thêm',
    'đậu hũ',
    'đậu hũ thêm',
    'phô mai sợi',
    'rong biển khô',
    'thịt thêm',
    'bún thêm',
    'cơm thêm',
    'mì thêm',
    'nước lèo thêm',
  ];
  if (commonToppings.some((tn) => name === tn || name.includes(`topping ${tn}`))) {
    return true;
  }

  // 4. Mô tả dạng đơn giá bán lẻ cho từng que/viên/miếng (VD: "6k/1 thanh", "5k/viên")
  if (
    desc.includes('/1 thanh') ||
    desc.includes('/thanh') ||
    desc.includes('/viên') ||
    desc.includes('/quả') ||
    desc.includes('/cục') ||
    desc.includes('/miếng') ||
    desc.includes('món ăn kèm') ||
    desc.includes('topping')
  ) {
    return true;
  }

  // 5. Giá thấp bất thường (< 15.000 đ) ngoại trừ nước ngọt/trà/đồ uống/chè
  if (price > 0 && price < 15000) {
    const isDrinkOrDessert =
      cat.includes('uống') ||
      cat.includes('trà') ||
      cat.includes('cafe') ||
      cat.includes('cà phê') ||
      cat.includes('nước') ||
      cat.includes('tráng miệng') ||
      cat.includes('chè');
    if (!isDrinkOrDessert) {
      return true;
    }
  }

  return false;
};

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const { totalCount, addToCart } = useCart();
  const { unreadCount } = useNotification();
  const [shops, setShops] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBanner, setActiveBanner] = useState(0);
  const [promoModalVisible, setPromoModalVisible] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [bannerWidth, setBannerWidth] = useState(Math.min(width, 480) - 32);

  // Auto-play banner ref & state
  const bannerScrollRef = useRef(null);

  // Quick Add to Cart Option Modal state
  const [selectedProductForModal, setSelectedProductForModal] = useState(null);
  const [selectedShopForModal, setSelectedShopForModal] = useState(null);
  const [optionModalVisible, setOptionModalVisible] = useState(false);
  const [addingItemId, setAddingItemId] = useState(null);

  // Vị trí người dùng (lấy từ sổ địa chỉ)
  const [userAddress, setUserAddress] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Tìm kiếm món ăn thực tế
  const [searchedItems, setSearchedItems] = useState([]);
  const [searching, setSearching] = useState(false);

  // Món ăn theo tab danh mục
  const [categoryItems, setCategoryItems] = useState([]);
  const [loadingCategoryItems, setLoadingCategoryItems] = useState(false);

  // Fetch sổ địa chỉ người dùng để lấy tọa độ tính km
  const fetchAddresses = async () => {
    try {
      const res = await authApi.getAddresses();
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      if (list.length > 0) {
        const def = list.find((a) => a.isDefault) || list[0];
        setUserAddress({
          id: def.id,
          addressLine: def.addressLine,
          latitude: parseFloat(def.latitude || 10.809552),
          longitude: parseFloat(def.longitude || 106.62624),
        });
      } else {
        setUserAddress({
          addressLine: '42/3 Nguyễn Hữu Tiến, P. Tây Thạnh, Q. Tân Phú',
          latitude: 10.809552,
          longitude: 106.62624,
        });
      }
    } catch (_) {
      setUserAddress({
        addressLine: '42/3 Nguyễn Hữu Tiến, P. Tây Thạnh, Q. Tân Phú',
        latitude: 10.809552,
        longitude: 106.62624,
      });
    }
  };

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
      await Promise.all([fetchShops(), fetchPromotions(), fetchAddresses()]);
      setLoading(false);
    };
    init();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchShops(), fetchPromotions(), fetchAddresses()]);
    setRefreshing(false);
  };

  // Tìm kiếm món ăn thực tế từ backend khi người dùng nhập từ khóa
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchedItems([]);
      setSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const items = await coreApi.searchItems(searchQuery.trim());
        const filtered = Array.isArray(items) ? items.filter((item) => !isTopping(item)) : [];
        setSearchedItems(filtered);
      } catch (err) {
        setSearchedItems([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Xử lý khi bấm vào danh mục
  const handleSelectCategory = async (cat) => {
    if (cat.id === 'promo') {
      setPromoModalVisible(true);
      return;
    }

    if (selectedCategory?.id === cat.id) {
      setSelectedCategory(null);
      setCategoryItems([]);
      return;
    }

    setSelectedCategory(cat);
    setSearchQuery('');

    // Nếu là danh mục món ăn -> Fetch món ăn thật từ database theo từ khóa
    if (cat.keywords && cat.keywords.length > 0) {
      setLoadingCategoryItems(true);
      try {
        let items = [];
        for (const kw of cat.keywords) {
          const res = await coreApi.searchItems(kw);
          if (Array.isArray(res) && res.length > 0) {
            const nonTopping = res.filter((item) => !isTopping(item));
            if (nonTopping.length > 0) {
              items = nonTopping;
              break;
            }
          }
        }
        setCategoryItems(Array.isArray(items) ? items.slice(0, 12) : []);
      } catch (_) {
        setCategoryItems([]);
      } finally {
        setLoadingCategoryItems(false);
      }
    } else {
      setCategoryItems([]);
    }
  };

  // Tự động chuyển banner qua lại (Auto-play carousel)
  useEffect(() => {
    if (!bannerWidth || bannerWidth <= 0) return;
    const interval = setInterval(() => {
      setActiveBanner((current) => {
        const next = (current + 1) % BANNERS.length;
        bannerScrollRef.current?.scrollTo({
          x: next * bannerWidth,
          animated: true,
        });
        return next;
      });
    }, 3800);
    return () => clearInterval(interval);
  }, [bannerWidth]);

  // Xử lý nút dấu cộng: thêm vào giỏ hàng thật hoặc mở modal tùy chọn
  const handleQuickAddToCart = async (item, e) => {
    e?.stopPropagation?.();
    setAddingItemId(item.id);
    const targetShop = shops.find((s) => s.id === item.shopId) || {
      id: item.shopId,
      shopName: item.shopName,
    };

    try {
      const fullProduct = await coreApi.getItem(item.id);
      const prod = fullProduct || item;

      if (prod.options && prod.options.length > 0) {
        setSelectedProductForModal(prod);
        setSelectedShopForModal(targetShop);
        setOptionModalVisible(true);
      } else {
        await addToCart(prod, targetShop, 1, [], prod.basePrice || prod.price || 0);
        if (Platform.OS === 'web') {
          window.alert(`Đã thêm "${prod.name}" vào giỏ hàng!`);
        } else {
          Alert.alert('Thành công', `Đã thêm "${prod.name}" vào giỏ hàng!`);
        }
      }
    } catch (err) {
      console.warn('Lỗi thêm nhanh vào giỏ:', err);
      await addToCart(item, targetShop, 1, [], item.basePrice || item.price || 0);
    } finally {
      setAddingItemId(null);
    }
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

  // Tính khoảng cách km thực tế cho từng quán từ địa chỉ của người dùng
  const shopsWithDistance = shops.map((shop) => {
    const lat = shop.shopLat || shop.latitude;
    const lng = shop.shopLng || shop.longitude;
    const dist = userAddress
      ? calculateDistance(userAddress.latitude, userAddress.longitude, lat, lng)
      : null;
    return {
      ...shop,
      distanceKm: dist,
    };
  });

  // Lọc và sắp xếp quán theo tìm kiếm hoặc danh mục
  let displayedShops = [...shopsWithDistance];

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    displayedShops = displayedShops.filter((shop) => {
      const sName = (shop.shopName || shop.name || '').toLowerCase();
      const sAddr = (shop.locationDetail || shop.address || '').toLowerCase();
      return sName.includes(q) || sAddr.includes(q);
    });
  } else if (selectedCategory) {
    if (selectedCategory.id === 'near') {
      // Sắp xếp các quán gần nhất lên đầu
      displayedShops.sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));
    } else if (selectedCategory.keywords) {
      // Lọc các quán có tên hoặc mô tả chứa từ khóa
      displayedShops = displayedShops.filter((shop) => {
        const sName = (shop.shopName || shop.name || '').toLowerCase();
        const sDesc = (shop.shopDescription || '').toLowerCase();
        return selectedCategory.keywords.some((kw) => sName.includes(kw) || sDesc.includes(kw));
      });
    }
  }

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
              {userAddress?.addressLine
                ? `${user?.fullName ? user.fullName + ' - ' : ''}${userAddress.addressLine}`
                : '42/3 Nguyễn Hữu Tiến, P. Tây Thạnh, Q. Tân Phú'}
            </Text>
            <ChevronRight size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.bellHeaderBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Bell size={21} color="#111827" />
            {unreadCount > 0 && (
              <View style={styles.bellHeaderBadge}>
                <Text style={styles.bellHeaderBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cartHeaderBtn}
            onPress={() => navigation.navigate('Giỏ hàng')}
          >
            <ShoppingBasket size={21} color="#111827" />
            {totalCount > 0 && (
              <View style={styles.cartHeaderBadge}>
                <Text style={styles.cartHeaderBadgeText}>{totalCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
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
            onChangeText={(text) => {
              setSearchQuery(text);
              if (selectedCategory) {
                setSelectedCategory(null);
                setCategoryItems([]);
              }
            }}
          />
          {searchQuery.trim().length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <XCircle size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
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
            ref={bannerScrollRef}
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
              <View key={banner.id || index} style={[styles.bannerSlide, { width: bannerWidth }]}>
                <Image source={{ uri: banner.image }} style={styles.bannerImage} resizeMode="cover" />
                <View style={styles.bannerOverlay}>
                  <Text style={styles.bannerBadge}>{banner.badge}</Text>
                  <Text style={styles.bannerTitle}>{banner.title}</Text>
                  <Text style={styles.bannerSubtitle}>{banner.subtitle}</Text>
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
            const isSelected = selectedCategory?.id === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={styles.categoryItem}
                onPress={() => handleSelectCategory(cat)}
              >
                <View
                  style={[
                    styles.categoryIconWrap,
                    { backgroundColor: isSelected ? '#FFB700' : cat.bg },
                    isSelected && styles.categoryIconWrapSelected,
                  ]}
                >
                  <IconComponent size={24} color={isSelected ? '#FFFFFF' : cat.color} />
                </View>
                <Text
                  style={[
                    styles.categoryName,
                    isSelected && { fontWeight: '700', color: '#B45309' },
                  ]}
                  numberOfLines={1}
                >
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

        {/* Category Pill Tabs Bar (Cuộn ngang chọn nhanh các tab món) */}
        <View style={styles.pillTabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillTabsScroll}
          >
            <TouchableOpacity
              style={[styles.pillTab, !selectedCategory && styles.pillTabActive]}
              activeOpacity={0.8}
              onPress={() => {
                setSelectedCategory(null);
                setCategoryItems([]);
              }}
            >
              <Sparkles
                size={14}
                color={!selectedCategory ? '#111827' : '#6B7280'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.pillTabText, !selectedCategory && styles.pillTabTextActive]}>
                Tất cả
              </Text>
            </TouchableOpacity>

            {CATEGORIES.map((cat) => {
              const IconComponent = cat.icon;
              const isActive = selectedCategory?.id === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.pillTab, isActive && styles.pillTabActive]}
                  activeOpacity={0.8}
                  onPress={() => handleSelectCategory(cat)}
                >
                  <IconComponent
                    size={14}
                    color={isActive ? '#111827' : cat.color}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.pillTabText, isActive && styles.pillTabTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Searching Indicator */}
        {searching && (
          <View style={styles.searchingRow}>
            <ActivityIndicator size="small" color="#FFB700" />
            <Text style={styles.searchingText}>Đang tìm kiếm món ngon từ beFood...</Text>
          </View>
        )}

        {/* Món ăn tìm thấy từ Search Backend */}
        {!searching && searchedItems.length > 0 && (
          <View style={styles.searchedItemsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>MÓN ĂN PHÙ HỢP</Text>
              <Text style={styles.shopCountBadge}>{searchedItems.length} món</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 6 }}
            >
              {searchedItems.map((item) => {
                const targetShop = shops.find((s) => s.id === item.shopId) || {
                  id: item.shopId,
                  shopName: item.shopName,
                };
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.foodItemCard}
                    activeOpacity={0.85}
                    onPress={() =>
                      navigation.navigate('ShopDetail', { shopId: item.shopId, shop: targetShop })
                    }
                  >
                    <View style={styles.foodItemImageWrap}>
                      <Image
                        source={{
                          uri:
                            item.imageUrl ||
                            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300',
                        }}
                        style={styles.foodItemImage}
                        resizeMode="cover"
                      />
                      <View style={styles.foodItemBadge}>
                        <Star size={10} color="#F59E0B" fill="#F59E0B" style={{ marginRight: 2 }} />
                        <Text style={styles.foodItemBadgeText}>
                          {item.avgRating && Number(item.avgRating) > 0 ? Number(item.avgRating).toFixed(1) : '5.0'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.foodItemContent}>
                      <Text style={styles.foodItemName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.foodItemShop} numberOfLines={1}>
                        📍 {item.shopName || `Quán #${item.shopId}`}
                      </Text>
                      <View style={styles.foodPriceRow}>
                        <Text style={styles.foodItemPrice}>
                          {Number(item.basePrice || item.price || item.discountPrice || 0).toLocaleString(
                            'vi-VN'
                          )}{' '}
                          ₫
                        </Text>
                        <TouchableOpacity
                          style={styles.foodAddBtn}
                          onPress={(e) => handleQuickAddToCart(item, e)}
                          activeOpacity={0.7}
                        >
                          {addingItemId === item.id ? (
                            <ActivityIndicator size={12} color="#B45309" />
                          ) : (
                            <Plus size={14} color="#B45309" />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Món ăn theo Tab Danh Mục (Neon DB) */}
        {selectedCategory && selectedCategory.id !== 'near' && (
          <View style={styles.categoryItemsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>MÓN NGON: {selectedCategory.name.toUpperCase()}</Text>
              {categoryItems.length > 0 && (
                <Text style={styles.shopCountBadge}>{categoryItems.length} món</Text>
              )}
            </View>
            {loadingCategoryItems ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#FFB700" />
              </View>
            ) : categoryItems.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 6 }}
              >
                {categoryItems.map((item) => {
                  const targetShop = shops.find((s) => s.id === item.shopId) || {
                    id: item.shopId,
                    shopName: item.shopName,
                  };
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.foodItemCard}
                      activeOpacity={0.85}
                      onPress={() =>
                        navigation.navigate('ShopDetail', { shopId: item.shopId, shop: targetShop })
                      }
                    >
                      <View style={styles.foodItemImageWrap}>
                        <Image
                          source={{
                            uri:
                              item.imageUrl ||
                              'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300',
                          }}
                          style={styles.foodItemImage}
                          resizeMode="cover"
                        />
                        <View style={styles.foodItemBadge}>
                          <Star size={10} color="#F59E0B" fill="#F59E0B" style={{ marginRight: 2 }} />
                          <Text style={styles.foodItemBadgeText}>
                            {item.avgRating && Number(item.avgRating) > 0 ? Number(item.avgRating).toFixed(1) : '5.0'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.foodItemContent}>
                        <Text style={styles.foodItemName} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={styles.foodItemShop} numberOfLines={1}>
                          📍 {item.shopName || `Quán #${item.shopId}`}
                        </Text>
                        <View style={styles.foodPriceRow}>
                          <Text style={styles.foodItemPrice}>
                            {Number(item.basePrice || item.price || item.discountPrice || 0).toLocaleString(
                              'vi-VN'
                            )}{' '}
                            ₫
                          </Text>
                          <TouchableOpacity
                            style={styles.foodAddBtn}
                            onPress={(e) => handleQuickAddToCart(item, e)}
                            activeOpacity={0.7}
                          >
                            {addingItemId === item.id ? (
                              <ActivityIndicator size={12} color="#B45309" />
                            ) : (
                              <Plus size={14} color="#B45309" />
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={{ marginHorizontal: 16, color: '#9CA3AF', fontSize: 13, marginBottom: 8 }}>
                Chưa có món riêng cho danh mục này.
              </Text>
            )}
          </View>
        )}

        {/* Section Title Quán Ăn */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              {selectedCategory?.id === 'near'
                ? 'QUÁN GẦN BẠN NHẤT'
                : selectedCategory
                ? `QUÁN PHÙ HỢP (${selectedCategory.name})`
                : searchQuery.trim()
                ? 'KẾT QUẢ TÌM QUÁN'
                : 'QUÁN NGON GẦN BẠN'}
            </Text>
            <Text style={styles.sectionSub}>Giao hàng nhanh trong 15-30 phút</Text>
          </View>
          <Text style={styles.shopCountBadge}>{displayedShops.length} quán</Text>
        </View>

        {/* Shop List */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#FFB700" />
            <Text style={styles.loadingText}>Đang tải danh sách quán ăn...</Text>
          </View>
        ) : displayedShops.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Chưa tìm thấy quán nào</Text>
            <Text style={styles.emptyDesc}>Vui lòng thử lại với từ khoá tìm kiếm khác</Text>
          </View>
        ) : (
          <View style={styles.shopList}>
            {displayedShops.map((shop) => (
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
                    <View style={styles.distanceBadge}>
                      <MapPin size={11} color="#0284C7" style={{ marginRight: 2 }} />
                      <Text style={styles.distanceText}>
                        {shop.distanceKm != null ? `${shop.distanceKm} km` : '1.2 km'}
                      </Text>
                    </View>
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

      {/* Product Option Modal khi bấm nút + ở các món có topping/tùy chọn */}
      <ProductOptionModal
        visible={optionModalVisible}
        onClose={() => {
          setOptionModalVisible(false);
          setSelectedProductForModal(null);
          setSelectedShopForModal(null);
        }}
        product={selectedProductForModal}
        shop={selectedShopForModal}
        onAddToCart={({ product: p, shop: s, quantity, selectedOptions, totalPrice }) => {
          const unitPrice = quantity > 0 ? totalPrice / quantity : p.basePrice || p.price;
          addToCart(p, s, quantity, selectedOptions, unitPrice);
        }}
      />
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellHeaderBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  bellHeaderBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
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
    paddingVertical: 0,
    borderWidth: 0,
    ...(Platform.OS === 'web'
      ? {
          outlineStyle: 'none',
          outlineWidth: 0,
          outlineColor: 'transparent',
          boxShadow: 'none',
        }
      : {}),
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
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  categoryItemSelected: {
    transform: [{ scale: 1.05 }],
  },
  categoryIconWrapSelected: {
    borderWidth: 2,
    borderColor: '#D97706',
    shadowColor: '#D97706',
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  voucherContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderStyle: 'solid',
    marginHorizontal: 16,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginTop: 4,
    marginBottom: 14,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
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
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
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
  pillTabsContainer: {
    marginBottom: 16,
  },
  pillTabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pillTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pillTabActive: {
    backgroundColor: '#FFB700',
    borderColor: '#F59E0B',
    shadowColor: '#FFB700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
  pillTabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  pillTabTextActive: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#111827',
  },
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  searchingText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  searchedItemsSection: {
    marginBottom: 18,
  },
  categoryItemsSection: {
    marginBottom: 18,
  },
  foodItemCard: {
    width: 165,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 7,
    elevation: 3,
  },
  foodItemImageWrap: {
    width: '100%',
    height: 112,
    position: 'relative',
    backgroundColor: '#F3F4F6',
  },
  foodItemImage: {
    width: '100%',
    height: '100%',
  },
  foodItemBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  foodItemBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  foodItemContent: {
    padding: 10,
  },
  foodItemName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 18,
    minHeight: 36,
    marginBottom: 4,
  },
  foodItemShop: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 6,
  },
  foodPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  foodItemPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D97706',
  },
  foodAddBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
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
    borderStyle: 'solid',
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
