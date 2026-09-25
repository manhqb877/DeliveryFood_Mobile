import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Star,
  Clock,
  MapPin,
  Plus,
  Minus,
  ShoppingBasket,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { coreApi } from '../../api/coreApi';
import { useCart } from '../../context/CartContext';
import ProductOptionModal from '../../components/ProductOptionModal';

export default function ShopDetailScreen({ route, navigation }) {
  const { shopId, shop: initialShop } = route.params || {};
  const [shop, setShop] = useState(initialShop || null);
  const [categories, setCategories] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState('ALL');
  const [productPage, setProductPage] = useState(1);
  const PRODUCT_PAGE_SIZE = 10;
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const { items, addToCart, removeFromCart, totalCount, totalPrice } = useCart();

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const data = await coreApi.getShopDetails(shopId);
        if (data) {
          if (data.categories) {
            setCategories(data.categories);
          }
          if (data.shop) {
            setShop(data.shop);
          } else if (data.name) {
            setShop(data);
          }
        }
      } catch (err) {
        console.error('Lỗi lấy chi tiết quán:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [shopId]);

  // Gom tất cả sản phẩm hoặc lọc theo category
  const allProducts = categories.flatMap((cat) =>
    (cat.items || cat.products || []).map((p) => ({ ...p, categoryName: cat.name, categoryId: cat.id }))
  );

  const displayedProducts =
    activeCategoryId === 'ALL'
      ? allProducts
      : allProducts.filter((p) => p.categoryId === activeCategoryId);

  const totalProductPages = Math.ceil(displayedProducts.length / PRODUCT_PAGE_SIZE) || 1;
  const paginatedProducts = displayedProducts.slice(
    (productPage - 1) * PRODUCT_PAGE_SIZE,
    productPage * PRODUCT_PAGE_SIZE
  );

  const formatVND = (price) => {
    return Number(price || 0).toLocaleString('vi-VN') + ' đ';
  };

  const getItemQuantity = (productId) => {
    // Lấy tổng số lượng của sản phẩm này trong giỏ (không phân biệt options ở màn hình ngoài)
    const productItems = items.filter((i) => i.product.id === productId);
    return productItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleProductPress = (product) => {
    if (product.options && product.options.length > 0) {
      setSelectedProduct(product);
      setModalVisible(true);
    } else {
      addToCart(product, shop, 1, [], product.basePrice || product.price || 0);
    }
  };

  const handleAddToCartFromModal = ({ product: p, shop: s, quantity, selectedOptions, totalPrice }) => {
    // Custom price per unit
    const unitPrice = quantity > 0 ? totalPrice / quantity : p.basePrice || p.price;
    addToCart(p, s, quantity, selectedOptions, unitPrice);
  };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {shop?.shopName || shop?.name || 'Chi tiết quán'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Cover Image */}
        <Image
          source={{
            uri:
              shop?.coverImageUrl ||
              shop?.coverUrl ||
              shop?.logoUrl ||
              'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1000&auto=format&fit=crop&q=80',
          }}
          style={styles.coverImage}
        />

        {/* Shop Info Card */}
        <View style={styles.shopCard}>
          <Text style={styles.shopName}>{shop?.shopName || shop?.name || 'Quán Ăn Ngon'}</Text>
          <View style={styles.metaRow}>
            <View style={styles.ratingBadge}>
              <Star size={14} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.ratingText}>
                {shop?.avgRating || shop?.rating ? Number(shop.avgRating || shop.rating).toFixed(1) : '4.9'}
              </Text>
            </View>
            <Text style={styles.metaDivider}>•</Text>
            <View style={styles.metaTime}>
              <Clock size={14} color="#6B7280" />
              <Text style={styles.metaTimeText}>15-25 phút</Text>
            </View>
            <Text style={styles.metaDivider}>•</Text>
            <Text style={styles.statusOpen}>Đang mở cửa</Text>
          </View>
          <View style={styles.addressRow}>
            <MapPin size={14} color="#9CA3AF" style={{ marginRight: 4 }} />
            <Text style={styles.addressText} numberOfLines={2}>
              {shop?.locationDetail || shop?.address || 'Khu đô thị Đại học Quốc Gia, TP. Hồ Chí Minh'}
            </Text>
          </View>
        </View>

        {/* Horizontal Category Tabs */}
        {categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryTabs}
          >
            <TouchableOpacity
              style={[styles.catTab, activeCategoryId === 'ALL' && styles.catTabActive]}
              onPress={() => {
                setActiveCategoryId('ALL');
                setProductPage(1);
              }}
            >
              <Text
                style={[
                  styles.catTabText,
                  activeCategoryId === 'ALL' && styles.catTabTextActive,
                ]}
              >
                Tất cả ({allProducts.length})
              </Text>
            </TouchableOpacity>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catTab, activeCategoryId === cat.id && styles.catTabActive]}
                onPress={() => {
                  setActiveCategoryId(cat.id);
                  setProductPage(1);
                }}
              >
                <Text
                  style={[
                    styles.catTabText,
                    activeCategoryId === cat.id && styles.catTabTextActive,
                  ]}
                >
                  {cat.name} ({cat.items?.length || cat.products?.length || 0})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Product List */}
        <View style={styles.productSection}>
          <Text style={styles.sectionHeading}>THỰC ĐƠN MÓN ĂN</Text>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#FFB700" />
              <Text style={styles.loadingText}>Đang tải thực đơn...</Text>
            </View>
          ) : displayedProducts.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Chưa có món ăn trong danh mục này</Text>
            </View>
          ) : (
            <>
              {paginatedProducts.map((product) => {
                const qty = getItemQuantity(product.id);
                return (
                  <View key={product.id} style={styles.productCard}>
                    <Image
                      source={{
                        uri:
                          product.imageUrl ||
                          'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80',
                      }}
                      style={styles.productImage}
                    />
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={2}>
                        {product.name}
                      </Text>
                      {product.description ? (
                        <Text style={styles.productDesc} numberOfLines={2}>
                          {product.description}
                        </Text>
                      ) : null}
                      <Text style={styles.productPrice}>
                        {formatVND(product.basePrice ?? product.price ?? 0)}
                      </Text>
                    </View>

                    {/* Add / Stepper Button */}
                    <View style={styles.actionWrap}>
                      {qty === 0 ? (
                        <TouchableOpacity
                          style={styles.addBtn}
                          onPress={() => handleProductPress(product)}
                        >
                          <Plus size={18} color="#111827" />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.stepperWrap}>
                          <TouchableOpacity
                            style={styles.stepBtn}
                            onPress={() => {
                              if (product.options && product.options.length > 0) {
                                navigation.navigate('Cart');
                              } else {
                                removeFromCart(product.id, []);
                              }
                            }}
                          >
                            <Minus size={14} color="#111827" />
                          </TouchableOpacity>
                          <Text style={styles.stepQty}>{qty}</Text>
                          <TouchableOpacity
                            style={styles.stepBtn}
                            onPress={() => handleProductPress(product)}
                          >
                            <Plus size={14} color="#111827" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}

              {/* Phân trang món ăn */}
              {totalProductPages > 1 && (
                <View style={styles.paginationWrap}>
                  <TouchableOpacity
                    style={[styles.pageBtn, productPage === 1 && styles.pageBtnDisabled]}
                    disabled={productPage === 1}
                    onPress={() => setProductPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={16} color={productPage === 1 ? '#9CA3AF' : '#111827'} />
                    <Text
                      style={[styles.pageBtnText, productPage === 1 && styles.pageBtnTextDisabled]}
                    >
                      Trước
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.pageIndicatorText}>
                    Trang{' '}
                    <Text style={{ fontWeight: '800', color: '#111827' }}>
                      {productPage}
                    </Text>{' '}
                    / {totalProductPages}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.pageBtn,
                      productPage === totalProductPages && styles.pageBtnDisabled,
                    ]}
                    disabled={productPage === totalProductPages}
                    onPress={() => setProductPage((p) => Math.min(totalProductPages, p + 1))}
                  >
                    <Text
                      style={[
                        styles.pageBtnText,
                        productPage === totalProductPages && styles.pageBtnTextDisabled,
                      ]}
                    >
                      Sau
                    </Text>
                    <ChevronRight
                      size={16}
                      color={productPage === totalProductPages ? '#9CA3AF' : '#111827'}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Floating Bottom Cart Bar */}
      {totalCount > 0 && (
        <View style={styles.floatingCartBar}>
          <View style={styles.cartInfo}>
            <View style={styles.cartIconBadge}>
              <ShoppingBasket size={20} color="#111827" />
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{totalCount}</Text>
              </View>
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.cartTotalTitle}>Tổng tạm tính</Text>
              <Text style={styles.cartTotalPrice}>{formatVND(totalPrice)}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.checkoutBtn}
            onPress={() => navigation.navigate('Cart')}
          >
            <Text style={styles.checkoutBtnText}>XEM GIỎ</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal Chọn Tuỳ Chọn */}
      <ProductOptionModal
        visible={modalVisible}
        product={selectedProduct}
        shop={shop}
        onClose={() => setModalVisible(false)}
        onAddToCart={handleAddToCartFromModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    maxWidth: '70%',
  },
  coverImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#E5E7EB',
  },
  shopCard: {
    backgroundColor: '#FFFFFF',
    marginTop: -20,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  shopName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 3,
  },
  metaDivider: {
    color: '#D1D5DB',
    marginHorizontal: 8,
  },
  metaTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaTimeText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
  },
  statusOpen: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressText: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  categoryTabs: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  catTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  catTabActive: {
    backgroundColor: '#FFB700',
    borderColor: '#FFB700',
  },
  catTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  catTabTextActive: {
    color: '#111827',
    fontWeight: '800',
  },
  productSection: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    alignItems: 'center',
  },
  productImage: {
    width: 76,
    height: 76,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  productDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#D97706',
  },
  actionWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFB700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    padding: 2,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFB700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepQty: {
    marginHorizontal: 8,
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  floatingCartBar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#111827',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  cartInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFB700',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  cartTotalTitle: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  cartTotalPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFB700',
  },
  checkoutBtn: {
    backgroundColor: '#FFB700',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  checkoutBtnText: {
    color: '#111827',
    fontWeight: '900',
    fontSize: 13,
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
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  paginationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  pageBtnDisabled: {
    backgroundColor: '#F9FAFB',
    opacity: 0.6,
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  pageBtnTextDisabled: {
    color: '#9CA3AF',
  },
  pageIndicatorText: {
    fontSize: 13,
    color: '#6B7280',
  },
});
