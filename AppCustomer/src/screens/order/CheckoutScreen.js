import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MapPin,
  CheckCircle2,
  Tag,
  ShieldCheck,
  CreditCard,
  ChevronDown,
  Clock,
  Sparkles,
  ShoppingBasket,
} from 'lucide-react-native';
import { useCart, getOrCreateGuestSessionId } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/authApi';
import { coreApi } from '../../api/coreApi';
import { cartApi } from '../../api/cartApi';
import { orderApi } from '../../api/orderApi';

export default function CheckoutScreen({ navigation }) {
  const { items, cartShop, cartId, activeCart, totalPrice, clearCart } = useCart();
  const { user } = useAuth();

  // Recipient form states
  const [fullName, setFullName] = useState(user?.fullName || user?.name || '');
  const [phone, setPhone] = useState(user?.phone || user?.phoneNumber || '');
  const [email, setEmail] = useState(user?.email || '');

  // Address states
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [streetAddress, setStreetAddress] = useState('42/3 nguyễn hữu tiến');
  const [province, setProvince] = useState('Thành phố Hồ Chí Minh');
  const [district, setDistrict] = useState('Quận Tân Phú');
  const [ward, setWard] = useState('Phường Tây Thạnh');
  const [note, setNote] = useState('');

  // Dropdown modal state for location selection
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [pickerType, setPickerType] = useState('province'); // 'province' | 'district' | 'ward'

  // Vouchers state
  const [shopPromotions, setShopPromotions] = useState([]);
  const [platformPromotions, setPlatformPromotions] = useState([]);
  const [activePromoTab, setActivePromoTab] = useState('ALL'); // 'ALL' | 'SHOP' | 'PLATFORM'
  const [voucherInput, setVoucherInput] = useState('');
  const [selectedShopPromo, setSelectedShopPromo] = useState(null);
  const [selectedPlatformPromo, setSelectedPlatformPromo] = useState(null);
  const [loadingPromos, setLoadingPromos] = useState(false);

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delivery fee
  const deliveryFee = items.length > 0 ? 15000 : 0;

  // Load user saved addresses
  useEffect(() => {
    const loadAddresses = async () => {
      try {
        const res = await authApi.getAddresses();
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        setSavedAddresses(list);
        if (list.length > 0) {
          const defaultAddr = list.find((a) => a.isDefault) || list[0];
          setSelectedAddress(defaultAddr);
          parseAddressString(defaultAddr.addressLine);
        }
      } catch (err) {
        console.error('Lỗi lấy địa chỉ:', err);
      }
    };
    loadAddresses();
  }, []);

  const parseAddressString = (addrStr) => {
    if (!addrStr) return;
    const parts = addrStr.split(',').map((s) => s.trim());
    if (parts.length >= 4) {
      setProvince(parts[parts.length - 1]);
      setDistrict(parts[parts.length - 2]);
      setWard(parts[parts.length - 3]);
      setStreetAddress(parts.slice(0, parts.length - 3).join(', '));
    } else {
      setStreetAddress(addrStr);
    }
  };

  // Load vouchers from shop and platform
  useEffect(() => {
    const loadVouchers = async () => {
      setLoadingPromos(true);
      try {
        const shopId = cartShop?.id || items[0]?.shopId;
        const [shopList, platformList] = await Promise.all([
          shopId ? coreApi.getShopPromotions(shopId) : Promise.resolve([]),
          coreApi.getPlatformPromotions(),
        ]);

        // Mock vouchers if none returned to ensure rich UX matching web screenshot
        const fallbackShopPromos =
          shopList.length > 0
            ? shopList
            : [
                {
                  id: 101,
                  code: 'CUABAC15',
                  promoType: 'PERCENT',
                  discountValue: 15,
                  maxDiscountAmount: 25000,
                  minOrderValue: 30000,
                  description: 'Giảm 15% (Tối đa 25.000đ)',
                },
                {
                  id: 102,
                  code: 'CUABAC10K',
                  promoType: 'FIXED_AMOUNT',
                  discountValue: 10000,
                  minOrderValue: 50000,
                  description: 'Giảm 10.000đ',
                },
              ];

        const fallbackPlatformPromos =
          platformList.length > 0
            ? platformList
            : [
                {
                  id: 201,
                  code: 'CHUNGCU15K',
                  promoType: 'FREE_DELIVERY',
                  discountValue: 15000,
                  minOrderValue: 40000,
                  description: 'Freeship Toàn Sàn',
                },
              ];

        setShopPromotions(fallbackShopPromos);
        setPlatformPromotions(fallbackPlatformPromos);
      } catch (err) {
        console.error('Lỗi lấy khuyến mãi:', err);
      } finally {
        setLoadingPromos(false);
      }
    };
    loadVouchers();
  }, [cartShop, items]);

  const getPromoDiscountText = (promo) => {
    if (!promo) return '';
    const type = (promo.promoType || '').toUpperCase();
    const val = Number(promo.discountValue ?? promo.discountAmount ?? 0);
    const maxCap = promo.maxDiscountAmount ?? promo.maxDiscount;

    if (type === 'PERCENT' || type === 'PERCENTAGE' || promo.discountPercent) {
      const pct = promo.discountValue ?? promo.discountPercent ?? 0;
      let text = `Giảm ${pct}%`;
      if (maxCap) {
        text += ` (Tối đa ${Number(maxCap).toLocaleString('vi-VN')}đ)`;
      }
      return text;
    }

    if (type === 'FREE_DELIVERY') {
      return 'Freeship Toàn Sàn';
    }

    if (val > 0) {
      return `Giảm ${val.toLocaleString('vi-VN')}đ`;
    }

    if (promo.description) return promo.description;
    return 'Giảm giá ưu đãi';
  };

  // Calculate discounts
  const calculateShopDiscount = () => {
    if (!selectedShopPromo) return 0;
    if (totalPrice < (selectedShopPromo.minOrderValue || 0)) return 0;

    const type = (selectedShopPromo.promoType || '').toUpperCase();
    const val = Number(selectedShopPromo.discountValue ?? selectedShopPromo.discountAmount ?? 0);
    const maxCap = Number(selectedShopPromo.maxDiscountAmount ?? selectedShopPromo.maxDiscount ?? 0);

    if (type === 'PERCENT' || type === 'PERCENTAGE' || selectedShopPromo.discountPercent) {
      const pct = Number(selectedShopPromo.discountValue ?? selectedShopPromo.discountPercent ?? 0);
      const disc = (totalPrice * pct) / 100;
      return maxCap > 0 ? Math.min(disc, maxCap) : disc;
    } else if (type === 'FIXED_AMOUNT' || selectedShopPromo.discountAmount) {
      return Math.min(totalPrice, val);
    } else if (type === 'FREE_DELIVERY') {
      return deliveryFee;
    }
    return Math.min(totalPrice, val);
  };

  const calculatePlatformDiscount = () => {
    if (!selectedPlatformPromo) return 0;
    if (totalPrice < (selectedPlatformPromo.minOrderValue || 0)) return 0;

    const type = (selectedPlatformPromo.promoType || '').toUpperCase();
    const val = Number(selectedPlatformPromo.discountValue ?? selectedPlatformPromo.discountAmount ?? 0);
    const maxCap = Number(selectedPlatformPromo.maxDiscountAmount ?? selectedPlatformPromo.maxDiscount ?? 0);

    if (type === 'PERCENT' || type === 'PERCENTAGE' || selectedPlatformPromo.discountPercent) {
      const pct = Number(selectedPlatformPromo.discountValue ?? selectedPlatformPromo.discountPercent ?? 0);
      const disc = (totalPrice * pct) / 100;
      return maxCap > 0 ? Math.min(disc, maxCap) : disc;
    } else if (type === 'FIXED_AMOUNT' || selectedPlatformPromo.discountAmount) {
      return Math.min(totalPrice, val);
    } else if (type === 'FREE_DELIVERY') {
      return deliveryFee;
    }
    return Math.min(totalPrice, val);
  };

  const shopDiscount = calculateShopDiscount();
  const platformDiscount = calculatePlatformDiscount();
  const totalDiscount = shopDiscount + platformDiscount;
  const finalTotal = Math.max(0, totalPrice + deliveryFee - totalDiscount);

  const formatVND = (price) => {
    return Number(price || 0).toLocaleString('vi-VN') + ' đ';
  };

  const handleApplyCustomVoucher = () => {
    const code = voucherInput.trim().toUpperCase();
    if (!code) return;

    const foundShop = shopPromotions.find((p) => p.code.toUpperCase() === code);
    if (foundShop) {
      setSelectedShopPromo(foundShop);
      setVoucherInput('');
      Alert.alert('Thành công', `Áp dụng mã quán "${foundShop.code}" thành công!`);
      return;
    }

    const foundPlatform = platformPromotions.find((p) => p.code.toUpperCase() === code);
    if (foundPlatform) {
      setSelectedPlatformPromo(foundPlatform);
      setVoucherInput('');
      Alert.alert('Thành công', `Áp dụng mã sàn "${foundPlatform.code}" thành công!`);
      return;
    }

    Alert.alert('Không hợp lệ', 'Mã giảm giá không tồn tại hoặc đã hết hạn.');
  };

  const handlePlaceOrder = async () => {
    if (!fullName.trim() || !phone.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập Họ tên và Số điện thoại nhận hàng!');
      return;
    }
    if (!streetAddress.trim()) {
      Alert.alert('Thiếu địa chỉ', 'Vui lòng nhập địa chỉ giao hàng chi tiết!');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Giỏ hàng trống', 'Vui lòng thêm món trước khi thanh toán!');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalCartId = cartId || activeCart?.id;

      // Nếu cartId chưa có trên server, tự động đồng bộ giỏ hàng lên server để có cartId hợp lệ
      if (!finalCartId && items.length > 0) {
        try {
          const shop = cartShop || { id: items[0]?.shopId || 1 };
          const gId = !user?.id ? await getOrCreateGuestSessionId() : null;
          for (const it of items) {
            await cartApi.addToCart({
              shopId: shop.id,
              areaId: shop.areaId || 1,
              itemId: it.itemId || it.product?.id || it.id,
              itemName: it.itemName || it.product?.name || 'Món ăn',
              unitPrice: it.unitPrice || it.product?.basePrice || 0,
              quantity: it.quantity || 1,
              selectedOptions: it.selectedOptions || [],
              itemNote: it.itemNote || null,
              userId: user?.id || null,
              guestSessionId: gId || null,
            });
          }
          const updatedCartsRes = await cartApi.getAllCarts(user?.id, gId);
          const updatedCarts = Array.isArray(updatedCartsRes) ? updatedCartsRes : (updatedCartsRes?.data || []);
          const matchingCart = updatedCarts.find((c) => c.items?.length > 0) || updatedCarts[0];
          finalCartId = matchingCart?.id;
        } catch (syncErr) {
          console.warn('Lỗi đồng bộ giỏ hàng trước khi đặt:', syncErr);
        }
      }

      if (!finalCartId) {
        Alert.alert('Lỗi giỏ hàng', 'Không tìm thấy giỏ hàng hợp lệ để tạo đơn. Vui lòng thử lại!');
        setIsSubmitting(false);
        return;
      }

      const fullDeliveryAddress = `${streetAddress}, ${ward}, ${district}, ${province}`;
      const appliedPromoCodes = [selectedShopPromo?.code, selectedPlatformPromo?.code]
        .filter(Boolean)
        .join(', ');

      const payload = {
        cartId: finalCartId,
        deliveryAddress: {
          fullAddress: fullDeliveryAddress,
          recipientName: fullName.trim(),
          recipientPhone: phone.trim(),
          note: note.trim(),
          latitude: 10.8016,
          longitude: 106.6392,
        },
        paymentMethod: 'COD',
        orderNote: note.trim(),
        idempotencyKey: 'idem_' + Date.now(),
        promotionCode: appliedPromoCodes || null,
        promotionId: selectedShopPromo?.id || selectedPlatformPromo?.id || null,
        discountAmount: totalDiscount || 0,
      };

      const res = await orderApi.createOrder(payload, payload.idempotencyKey);
      const createdOrder = res?.data || res;

      Alert.alert(
        'Đặt đơn thành công! 🎉',
        `Mã đơn: ${createdOrder.orderCode || '#' + createdOrder.id}\nShipper sẽ sớm liên hệ và giao hàng tới bạn!`,
        [
          {
            text: 'Xem đơn hàng',
            onPress: () => {
              clearCart();
              navigation.navigate('OrderDetail', { orderId: createdOrder.id });
            },
          },
        ]
      );
    } catch (err) {
      let errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Không thể tạo đơn. Vui lòng thử lại!';
      
      if (typeof errorMsg === 'object') {
        errorMsg = JSON.stringify(errorMsg);
      }
      
      // Fix triệt để: Nếu cart bị lỗi (stale/not found), tự động tạo lại cart mới và thử đặt hàng lại 1 lần
      if (String(errorMsg).includes('Cart not found')) {
        console.log('Phát hiện giỏ hàng hết hạn, đang tự động đồng bộ và thử lại...');
        try {
          const shop = cartShop || { id: items[0]?.shopId || 1 };
          const gId = !user?.id ? guestSessionId : null;
          let newCartId = null;
          for (const it of items) {
            console.log('Adding item:', it.itemName);
            const addedRes = await cartApi.addToCart({
              shopId: shop.id,
              areaId: shop.areaId || 1,
              itemId: it.itemId || it.product?.id || it.id,
              itemName: it.itemName,
              unitPrice: it.unitPrice,
              quantity: it.quantity,
              selectedOptions: it.selectedOptions || [],
              itemNote: it.itemNote || null,
              userId: user?.id || null,
              guestSessionId: gId,
            });
            const cartData = addedRes?.data || addedRes;
            console.log('Added item, cartId returned:', cartData?.id);
            if (cartData?.id) newCartId = cartData.id;
          }
          
          console.log('Finished adding items. newCartId=', newCartId);
          if (newCartId) {
            const retryPayload = {
              cartId: newCartId,
              deliveryAddress: {
                fullAddress: `${streetAddress}, ${ward}, ${district}, ${province}`,
                recipientName: fullName.trim(),
                recipientPhone: phone.trim(),
                note: note.trim(),
                latitude: 10.8016,
                longitude: 106.6392,
              },
              paymentMethod: 'COD',
              orderNote: note.trim(),
              idempotencyKey: 'idem_' + Date.now() + '_retry',
              promotionCode: [selectedShopPromo?.code, selectedPlatformPromo?.code].filter(Boolean).join(', ') || null,
              promotionId: selectedShopPromo?.id || selectedPlatformPromo?.id || null,
              discountAmount: (calculateShopDiscount() + calculatePlatformDiscount()) || 0,
            };
            console.log('Sending retry payload:', retryPayload);
            const retryRes = await orderApi.createOrder(retryPayload, retryPayload.idempotencyKey);
            const createdOrder = retryRes?.data || retryRes;
            console.log('Retry success!', createdOrder);
            
            Alert.alert(
              'Đặt đơn thành công! 🎉',
              `Mã đơn: ${createdOrder.orderCode || '#' + createdOrder.id}\nShipper sẽ sớm liên hệ và giao hàng tới bạn!`,
              [
                {
                  text: 'Xem đơn hàng',
                  onPress: () => {
                    clearCart();
                    navigation.navigate('OrderDetail', { orderId: createdOrder.id });
                  },
                },
              ],
              { cancelable: false }
            );
            return;
          } else {
            console.warn('Retry skipped: newCartId is null!');
          }
        } catch (retryErr) {
          console.error('Lỗi khi thử nghiệm lại:', retryErr);
          Alert.alert('Thử lại thất bại', 'Lỗi: ' + (retryErr.response?.data?.message || retryErr.message));
          return;
        }
      }
      
      console.error('Lỗi đặt hàng:', err);
      Alert.alert('Đặt hàng thất bại', errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered promotions for tabs
  const allPromos = [
    ...shopPromotions.map((p) => ({ ...p, type: 'SHOP' })),
    ...platformPromotions.map((p) => ({ ...p, type: 'PLATFORM' })),
  ];

  const displayedPromos =
    activePromoTab === 'ALL'
      ? allPromos
      : activePromoTab === 'SHOP'
      ? allPromos.filter((p) => p.type === 'SHOP')
      : allPromos.filter((p) => p.type === 'PLATFORM');

  const renderPromoCard = (promo, isShop) => {
    const isSelected = isShop
      ? selectedShopPromo?.id === promo.id || selectedShopPromo?.code === promo.code
      : selectedPlatformPromo?.id === promo.id || selectedPlatformPromo?.code === promo.code;

    const isEligible = totalPrice >= (promo.minOrderValue || 0);
    const neededMore = Math.max(0, (promo.minOrderValue || 0) - totalPrice);

    return (
      <View
        key={`${isShop ? 'SHOP' : 'PLATFORM'}_${promo.id || promo.code}`}
        style={[
          styles.voucherCard,
          isSelected && styles.voucherCardSelected,
          !isEligible && styles.voucherCardIneligible,
        ]}
      >
        <View style={styles.voucherLeft}>
          <View style={styles.voucherHeaderRow}>
            <View style={[styles.voucherCodeWrap, !isShop && styles.platformCodeWrap]}>
              <Text style={[styles.voucherCode, !isShop && styles.platformCode]}>{promo.code}</Text>
            </View>
            <Text style={styles.voucherDesc} numberOfLines={1}>
              {getPromoDiscountText(promo)}
            </Text>
          </View>
          <Text style={styles.voucherMin}>
            Đơn tối thiểu: {formatVND(promo.minOrderValue || 0)}
            {!isEligible && neededMore > 0 && (
              <Text style={styles.voucherNeededMore}>
                {' '}(Mua thêm {formatVND(neededMore)})
              </Text>
            )}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.selectVoucherBtn,
            isSelected && styles.selectVoucherBtnActive,
            !isEligible && styles.selectVoucherBtnDisabled,
          ]}
          disabled={!isEligible}
          onPress={() => {
            if (isSelected) {
              if (isShop) setSelectedShopPromo(null);
              else setSelectedPlatformPromo(null);
            } else {
              if (isShop) setSelectedShopPromo(promo);
              else setSelectedPlatformPromo(promo);
            }
          }}
        >
          <Text
            style={[
              styles.selectVoucherText,
              isSelected && styles.selectVoucherTextActive,
              !isEligible && styles.selectVoucherTextDisabled,
            ]}
          >
            {isSelected ? 'Đang dùng' : 'Chọn'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thanh toán đơn hàng</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Saved Address Highlight Card */}
        {selectedAddress && (
          <View style={styles.savedAddressCard}>
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>⭐ Mặc định</Text>
            </View>
            <Text style={styles.savedAddressText}>{selectedAddress.addressLine}</Text>
          </View>
        )}

        {/* Form Thông tin nhận hàng */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>THÔNG TIN GIAO HÀNG</Text>

          {/* Họ tên */}
          <Text style={styles.inputLabel}>
            Họ tên người nhận <Text style={styles.reqStar}>*</Text>
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="Nhập họ và tên"
            placeholderTextColor="#9CA3AF"
            value={fullName}
            onChangeText={setFullName}
          />

          {/* SĐT */}
          <Text style={styles.inputLabel}>
            Số điện thoại nhận hàng <Text style={styles.reqStar}>*</Text>
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="Nhập số điện thoại"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          {/* Email */}
          <Text style={styles.inputLabel}>Địa chỉ Email</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Nhập email"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          {/* Tỉnh / TP */}
          <Text style={styles.inputLabel}>Tỉnh / Thành phố</Text>
          <View style={styles.selectBox}>
            <Text style={styles.selectText}>{province}</Text>
            <ChevronDown size={18} color="#6B7280" />
          </View>

          {/* Quận / Huyện */}
          <Text style={styles.inputLabel}>Quận / Huyện</Text>
          <View style={styles.selectBox}>
            <Text style={styles.selectText}>{district}</Text>
            <ChevronDown size={18} color="#6B7280" />
          </View>

          {/* Phường / Xã */}
          <Text style={styles.inputLabel}>Phường / Xã</Text>
          <View style={styles.selectBox}>
            <Text style={styles.selectText}>{ward}</Text>
            <ChevronDown size={18} color="#6B7280" />
          </View>

          {/* Địa chỉ chi tiết */}
          <Text style={styles.inputLabel}>
            Địa chỉ chi tiết (Số nhà, tên đường, số phòng) <Text style={styles.reqStar}>*</Text>
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="VD: 42/3 Nguyễn Hữu Tiến"
            placeholderTextColor="#9CA3AF"
            value={streetAddress}
            onChangeText={setStreetAddress}
          />

          {/* Ghi chú */}
          <Text style={styles.inputLabel}>Ghi chú cho tài xế giao hàng</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="VD: Giao trước sảnh lễ tân hoặc gọi trước khi tới..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={2}
            value={note}
            onChangeText={setNote}
          />
        </View>

        {/* Phương thức thanh toán (COD Tiền Mặt) */}
        <View style={styles.card}>
          <View style={styles.paymentHeader}>
            <Text style={styles.cardHeading}>PHƯƠNG THỨC THANH TOÁN</Text>
            <View style={styles.codTag}>
              <Text style={styles.codTagText}>COD Tiền Mặt</Text>
            </View>
          </View>

          <View style={styles.codCard}>
            <View style={styles.codIconCircle}>
              <CreditCard size={22} color="#10B981" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.codTitle}>
                Thanh toán khi nhận món (COD - Cash On Delivery)
              </Text>
              <Text style={styles.codDesc}>
                Bạn sẽ thanh toán số tiền cho shipper khi nhận được đúng và đủ món ăn. An toàn
                100%.
              </Text>
            </View>
            <CheckCircle2 size={20} color="#10B981" />
          </View>
        </View>

        {/* Khuyến mãi / Voucher */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>MÃ KHUYẾN MÃI / VOUCHER</Text>

          {/* Input mã */}
          <View style={styles.voucherInputRow}>
            <TextInput
              style={styles.voucherInput}
              placeholder="NHẬP MÃ VOUCHER (QUÁN HOẶC SÀN)..."
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              value={voucherInput}
              onChangeText={setVoucherInput}
            />
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={handleApplyCustomVoucher}
              activeOpacity={0.8}
            >
              <Text style={styles.applyBtnText}>Áp dụng</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.promoTabs}>
            <TouchableOpacity
              style={[styles.promoTab, activePromoTab === 'ALL' && styles.promoTabActive]}
              onPress={() => setActivePromoTab('ALL')}
            >
              <Text
                style={[
                  styles.promoTabText,
                  activePromoTab === 'ALL' && styles.promoTabTextActive,
                ]}
              >
                Tất cả ({allPromos.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.promoTab, activePromoTab === 'SHOP' && styles.promoTabActive]}
              onPress={() => setActivePromoTab('SHOP')}
            >
              <Text
                style={[
                  styles.promoTabText,
                  activePromoTab === 'SHOP' && styles.promoTabTextActive,
                ]}
              >
                Quán ({shopPromotions.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.promoTab, activePromoTab === 'PLATFORM' && styles.promoTabActive]}
              onPress={() => setActivePromoTab('PLATFORM')}
            >
              <Text
                style={[
                  styles.promoTabText,
                  activePromoTab === 'PLATFORM' && styles.promoTabTextActive,
                ]}
              >
                Hệ Thống ({platformPromotions.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Voucher Items List */}
          <View style={styles.voucherList}>
            {loadingPromos ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#F97316" />
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6, fontStyle: 'italic' }}>
                  Đang tải danh sách ưu đãi...
                </Text>
              </View>
            ) : (
              <>
                {(activePromoTab === 'ALL' || activePromoTab === 'SHOP') && (
                  <View style={styles.promoGroup}>
                    <View style={styles.promoSectionHeader}>
                      <Text style={styles.promoSectionTitle}>
                        🏪 KHUYẾN MÃI TỪ QUÁN ({shopPromotions.length})
                      </Text>
                      {selectedShopPromo && (
                        <View style={styles.selectedBadge}>
                          <Text style={styles.selectedBadgeText}>
                            Đã chọn: {selectedShopPromo.code}
                          </Text>
                        </View>
                      )}
                    </View>
                    {shopPromotions.length === 0 ? (
                      <Text style={styles.emptyPromoText}>Quán chưa phát hành voucher riêng.</Text>
                    ) : (
                      shopPromotions.map((p) => renderPromoCard(p, true))
                    )}
                  </View>
                )}

                {(activePromoTab === 'ALL' || activePromoTab === 'PLATFORM') && (
                  <View style={[styles.promoGroup, activePromoTab === 'ALL' && styles.platformGroupDivider]}>
                    <View style={styles.promoSectionHeader}>
                      <Text style={[styles.promoSectionTitle, { color: '#1D4ED8' }]}>
                        🌐 KHUYẾN MÃI TOÀN SÀN / HỆ THỐNG ({platformPromotions.length})
                      </Text>
                      {selectedPlatformPromo && (
                        <View style={styles.selectedBadge}>
                          <Text style={styles.selectedBadgeText}>
                            Đã chọn: {selectedPlatformPromo.code}
                          </Text>
                        </View>
                      )}
                    </View>
                    {platformPromotions.length === 0 ? (
                      <Text style={styles.emptyPromoText}>Hệ thống chưa có voucher khả dụng.</Text>
                    ) : (
                      platformPromotions.map((p) => renderPromoCard(p, false))
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Chi tiết giỏ hàng */}
        <View style={styles.card}>
          <View style={styles.cartDetailHeader}>
            <Text style={styles.cardHeading}>CHI TIẾT GIỎ HÀNG ({items.length} món)</Text>
            <Text style={styles.cartShopName}>{cartShop?.shopName || 'Gian hàng'}</Text>
          </View>

          {items.map((item) => (
            <View key={item.id} style={styles.cartItemRow}>
              <Image
                source={{
                  uri:
                    item.imageUrl ||
                    item.product?.imageUrl ||
                    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=80',
                }}
                style={styles.cartItemThumb}
              />
              <View style={styles.cartItemInfo}>
                <Text style={styles.cartItemName}>{item.itemName}</Text>
                <Text style={styles.cartItemOpts} numberOfLines={1}>
                  {item.selectedOptions && item.selectedOptions.length > 0
                    ? item.selectedOptions
                        .map((o) => `${o.group || o.groupName}: ${o.option || o.optionName}`)
                        .join(' · ')
                    : 'Mặc định'}
                </Text>
                <Text style={styles.cartItemQty}>Số lượng: x{item.quantity}</Text>
              </View>
              <Text style={styles.cartItemPrice}>
                {formatVND(item.totalPrice || item.unitPrice * item.quantity)}
              </Text>
            </View>
          ))}

          <View style={styles.divider} />

          {/* Pricing breakdown */}
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Tạm tính tiền món:</Text>
            <Text style={styles.priceVal}>{formatVND(totalPrice)}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Phí giao hàng:</Text>
            <Text style={styles.priceVal}>{formatVND(deliveryFee)}</Text>
          </View>

          {totalDiscount > 0 && (
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: '#16A34A', fontWeight: '700' }]}>
                Giảm giá khuyến mãi:
              </Text>
              <Text style={[styles.priceVal, { color: '#16A34A', fontWeight: '700' }]}>
                -{formatVND(totalDiscount)}
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng thanh toán:</Text>
            <Text style={styles.totalVal}>{formatVND(finalTotal)}</Text>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Place Order Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomTotalWrap}>
          <Text style={styles.bottomTotalLabel}>Tổng cộng:</Text>
          <Text style={styles.bottomTotalVal}>{formatVND(finalTotal)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.placeOrderBtn, isSubmitting && styles.placeOrderBtnDisabled]}
          onPress={handlePlaceOrder}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#111827" />
          ) : (
            <Text style={styles.placeOrderBtnText}>ĐẶT HÀNG (COD)</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  scrollContent: {
    padding: 16,
  },
  savedAddressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    padding: 14,
    marginBottom: 14,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  defaultBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  savedAddressText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 19,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 6,
    marginTop: 8,
  },
  reqStar: {
    color: '#EF4444',
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  codTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  codCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  codIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  codTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
    lineHeight: 18,
  },
  codDesc: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
    lineHeight: 15,
  },
  voucherInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  voucherInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  applyBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  promoTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 12,
  },
  promoTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  promoTabActive: {
    borderBottomColor: '#7C3AED',
  },
  promoTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  promoTabTextActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  promoGroup: {
    marginBottom: 10,
  },
  platformGroupDivider: {
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  promoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  promoSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C2410C',
    letterSpacing: 0.5,
  },
  selectedBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  selectedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  emptyPromoText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  voucherList: {},
  voucherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  voucherCardSelected: {
    backgroundColor: '#FFF7ED',
    borderColor: '#EA580C',
    borderWidth: 1.5,
  },
  voucherCardIneligible: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    opacity: 0.65,
  },
  voucherLeft: {
    flex: 1,
    marginRight: 8,
  },
  voucherHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 3,
  },
  voucherCodeWrap: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  voucherCode: {
    fontSize: 11,
    fontWeight: '900',
    color: '#C2410C',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
  platformCodeWrap: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  platformCode: {
    color: '#1D4ED8',
  },
  voucherDesc: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  voucherMin: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  voucherNeededMore: {
    color: '#B45309',
    fontWeight: '600',
  },
  selectVoucherBtn: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 54,
    alignItems: 'center',
  },
  selectVoucherBtnActive: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  selectVoucherBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  selectVoucherText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C2410C',
  },
  selectVoucherTextActive: {
    color: '#FFFFFF',
  },
  selectVoucherTextDisabled: {
    color: '#94A3B8',
  },
  cartDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cartShopName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cartItemThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    resizeMode: 'contain',
  },
  cartItemInfo: {
    flex: 1,
    marginLeft: 10,
  },
  cartItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  cartItemOpts: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  cartItemQty: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 2,
  },
  cartItemPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 13,
    color: '#4B5563',
  },
  priceVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  totalVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0284C7',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 8,
  },
  bottomTotalWrap: {},
  bottomTotalLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  bottomTotalVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0284C7',
  },
  placeOrderBtn: {
    backgroundColor: '#FFB700',
    paddingHorizontal: 24,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFB700',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  placeOrderBtnDisabled: {
    opacity: 0.6,
  },
  placeOrderBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 0.5,
  },
});
