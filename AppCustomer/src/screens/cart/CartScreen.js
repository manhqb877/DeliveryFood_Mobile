import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShoppingBasket,
  Trash2,
  X,
  Edit3,
  Plus,
  Minus,
  ArrowRight,
  Store,
} from 'lucide-react-native';
import { useCart } from '../../context/CartContext';
import ProductOptionModal from '../../components/ProductOptionModal';
import { coreApi } from '../../api/coreApi';

export default function CartScreen({ navigation }) {
  const {
    items,
    cartShop,
    cartId,
    totalCount,
    totalPrice,
    loading,
    updateCartItem,
    removeCartItem,
    clearCart,
    refreshCart,
  } = useCart();

  // Edit item state
  const [editingItem, setEditingItem] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);

  const formatVND = (price) => {
    return Number(price || 0).toLocaleString('vi-VN') + ' đ';
  };

  const handleRemove = (item) => {
    if (Platform.OS === 'web') {
      const confirm = window.confirm(`Bạn có chắc muốn xoá "${item.itemName}" khỏi giỏ hàng?`);
      if (confirm) {
        removeCartItem(item.id);
      }
    } else {
      Alert.alert('Xoá món', `Bạn có chắc muốn xoá "${item.itemName}" khỏi giỏ hàng?`, [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => removeCartItem(item.id),
        },
      ]);
    }
  };

  const handleClearAll = () => {
    if (Platform.OS === 'web') {
      const confirm = window.confirm('Bạn có chắc muốn xoá toàn bộ món trong giỏ?');
      if (confirm) {
        clearCart(cartId);
      }
    } else {
      Alert.alert('Xoá giỏ hàng', 'Bạn có chắc muốn xoá toàn bộ món trong giỏ?', [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa tất cả',
          style: 'destructive',
          onPress: () => clearCart(cartId),
        },
      ]);
    }
  };

  const handleQuantity = (item, delta) => {
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      handleRemove(item);
    } else {
      updateCartItem(item.id, { quantity: newQty });
    }
  };

  const handleOpenEdit = async (item) => {
    setLoadingEdit(item.id);
    try {
      const productData = await coreApi.getItem(item.itemId || item.product?.id);
      if (productData) {
        setEditingProduct(productData);
        setEditingItem(item);
        setEditModalVisible(true);
      } else {
        Alert.alert('Thông báo', 'Không thể lấy thông tin món ăn để chỉnh sửa');
      }
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể tải chi tiết tuỳ chọn của món');
    } finally {
      setLoadingEdit(null);
    }
  };

  const handleSaveEdit = async (origItem, updatedData) => {
    await updateCartItem(origItem.id, {
      quantity: updatedData.quantity,
      selectedOptions: updatedData.selectedOptions,
      itemNote: updatedData.itemNote,
      unitPrice: updatedData.unitPrice,
    });
    setEditModalVisible(false);
    setEditingItem(null);
    setEditingProduct(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ShoppingBasket size={24} color="#D97706" />
          <Text style={styles.headerTitle}>Giỏ hàng</Text>
          {totalCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{totalCount} món</Text>
            </View>
          )}
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <ShoppingBasket size={54} color="#D97706" />
          </View>
          <Text style={styles.emptyTitle}>“Hổng” có gì trong giỏ hết</Text>
          <Text style={styles.emptySubtitle}>
            Về trang cửa hàng để chọn đặt món ngon bạn nhé!!
          </Text>
          <TouchableOpacity
            style={styles.orderNowBtn}
            onPress={() => navigation.navigate('Trang chủ')}
            activeOpacity={0.8}
          >
            <Text style={styles.orderNowBtnText}>ĐẶT HÀNG NGAY</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Shop Header */}
            <View style={styles.shopSection}>
              <View style={styles.shopHeader}>
                <View style={styles.shopTitleRow}>
                  <Store size={18} color="#374151" style={{ marginRight: 6 }} />
                  <Text style={styles.shopName}>
                    {cartShop?.shopName || (cartShop?.id ? `Quán #${cartShop.id}` : 'Quán ăn')}
                  </Text>
                  <Text style={styles.shopItemCount}>({items.length} loại)</Text>
                </View>
                <TouchableOpacity onPress={handleClearAll} style={styles.clearAllBtn}>
                  <Trash2 size={14} color="#EF4444" style={{ marginRight: 4 }} />
                  <Text style={styles.clearAllText}>Xóa tất cả</Text>
                </TouchableOpacity>
              </View>

              {/* Items List */}
              <View style={styles.itemsList}>
                {items.map((item) => {
                  const optionsStr =
                    item.selectedOptions && item.selectedOptions.length > 0
                      ? item.selectedOptions
                          .map((o) => `${o.group || o.groupName}: ${o.option || o.optionName}`)
                          .join(' · ')
                      : 'Tùy chọn: Mặc định';

                  return (
                    <View key={item.id} style={styles.itemRow}>
                      {/* Delete button */}
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleRemove(item)}
                      >
                        <X size={16} color="#9CA3AF" />
                      </TouchableOpacity>

                      {/* Image */}
                      <Image
                        source={{
                          uri:
                            item.imageUrl ||
                            item.product?.imageUrl ||
                            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=80',
                        }}
                        style={styles.itemImage}
                      />

                      {/* Info */}
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={2}>
                          {item.itemName}
                        </Text>
                        <Text style={styles.itemOptions} numberOfLines={2}>
                          {optionsStr}
                        </Text>
                        {item.itemNote ? (
                          <Text style={styles.itemNote} numberOfLines={1}>
                            "{item.itemNote}"
                          </Text>
                        ) : null}

                        {/* Button Sửa Option */}
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() => handleOpenEdit(item)}
                          disabled={loadingEdit === item.id}
                        >
                          {loadingEdit === item.id ? (
                            <ActivityIndicator size="small" color="#2563EB" />
                          ) : (
                            <>
                              <Edit3 size={13} color="#2563EB" style={{ marginRight: 4 }} />
                              <Text style={styles.editBtnText}>Sửa</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* Right: Price & Stepper */}
                      <View style={styles.itemRight}>
                        <Text style={styles.itemTotalPrice}>
                          {formatVND(item.totalPrice || item.unitPrice * item.quantity)}
                        </Text>
                        <Text style={styles.itemUnitPrice}>
                          {formatVND(item.unitPrice)} / cái
                        </Text>

                        <View style={styles.stepper}>
                          <TouchableOpacity
                            style={styles.stepBtn}
                            onPress={() => handleQuantity(item, -1)}
                          >
                            <Minus size={13} color="#374151" />
                          </TouchableOpacity>
                          <Text style={styles.qtyText}>{item.quantity}</Text>
                          <TouchableOpacity
                            style={styles.stepBtn}
                            onPress={() => handleQuantity(item, 1)}
                          >
                            <Plus size={13} color="#374151" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Tóm tắt đơn hàng */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Tóm tắt đơn hàng</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tổng cộng</Text>
                <Text style={styles.summaryTotal}>{formatVND(totalPrice)}</Text>
              </View>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Bottom Checkout Button */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.checkoutBtn}
              onPress={() => navigation.navigate('Checkout')}
              activeOpacity={0.8}
            >
              <Text style={styles.checkoutBtnText}>THANH TOÁN</Text>
              <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal Sửa Options */}
      {editingProduct && (
        <ProductOptionModal
          visible={editModalVisible}
          product={editingProduct}
          shop={cartShop}
          editingItem={editingItem}
          onClose={() => {
            setEditModalVisible(false);
            setEditingItem(null);
            setEditingProduct(null);
          }}
          onSaveEdit={handleSaveEdit}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    marginLeft: 10,
  },
  badge: {
    backgroundColor: '#FFB700',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginLeft: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  orderNowBtn: {
    backgroundColor: '#FFB700',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#FFB700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  orderNowBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  scrollContent: {
    padding: 16,
  },
  shopSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
  },
  shopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 12,
  },
  shopTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  shopItemCount: {
    fontSize: 13,
    color: '#9CA3AF',
    marginLeft: 6,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  itemsList: {},
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  deleteBtn: {
    padding: 6,
    marginRight: 4,
  },
  itemImage: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    resizeMode: 'contain',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
    paddingRight: 8,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  itemOptions: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
  },
  itemNote: {
    fontSize: 11,
    color: '#D97706',
    fontStyle: 'italic',
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemTotalPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#DC2626',
  },
  itemUnitPrice: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
    marginBottom: 8,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    paddingHorizontal: 8,
  },
  summaryCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginTop: 10,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 10,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  summaryTotal: {
    fontSize: 20,
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
    borderTopColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 8,
  },
  checkoutBtn: {
    backgroundColor: '#0284C7',
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  checkoutBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
