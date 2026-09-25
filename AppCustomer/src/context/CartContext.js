import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { cartApi } from '../api/cartApi';
import { coreApi } from '../api/coreApi';

const CartContext = createContext(null);
const GUEST_SESSION_KEY = 'customer_guest_session_id';

export const getOrCreateGuestSessionId = async () => {
  try {
    let id = await AsyncStorage.getItem(GUEST_SESSION_KEY);
    if (!id || id.length > 10) {
      id = Math.floor(Math.random() * 900000000 + 100000000).toString();
      await AsyncStorage.setItem(GUEST_SESSION_KEY, id);
    }
    return parseInt(id, 10);
  } catch (_) {
    return Math.floor(Math.random() * 900000000 + 100000000);
  }
};

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [carts, setCarts] = useState([]); // [{ id, shopId, subtotal, items: [...] }]
  const [activeCart, setActiveCart] = useState(null); // Quán đang chọn
  const [items, setItems] = useState([]); // flatten items của active cart
  const [cartShop, setCartShop] = useState(null);
  const [loading, setLoading] = useState(false);
  const [guestSessionId, setGuestSessionId] = useState(null);

  const userId = user?.id || null;

  useEffect(() => {
    if (!userId) {
      getOrCreateGuestSessionId().then((gid) => setGuestSessionId(gid));
    } else {
      setGuestSessionId(null);
    }
  }, [userId]);

  // Lấy danh sách cart từ backend
  const fetchAllCarts = useCallback(async () => {
    let gId = guestSessionId;
    if (!userId && !gId) {
      gId = await getOrCreateGuestSessionId();
      setGuestSessionId(gId);
    }
    if (!userId && !gId) {
      return;
    }

    setLoading(true);
    try {
      const res = await cartApi.getAllCarts(userId, gId);
      const rawCarts = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      
      if (rawCarts.length > 0) {
        // Hydrate images cho từng item
        const hydratedCarts = await Promise.all(
          rawCarts.map(async (cart) => {
            const hydratedItems = await Promise.all(
              (cart.items || []).map(async (item) => {
                let imgUrl = item.imageUrl || null;
                let optList = [];
                try {
                  const itemData = await coreApi.getItem(item.itemId);
                  if (itemData) {
                    imgUrl = itemData.imageUrl || imgUrl;
                    optList = itemData.options || [];
                  }
                } catch (_) {}

                return {
                  ...item,
                  imageUrl: imgUrl,
                  product: {
                    id: item.itemId,
                    name: item.itemName,
                    basePrice: item.unitPrice,
                    imageUrl: imgUrl,
                    options: optList,
                  },
                };
              })
            );
            return { ...cart, items: hydratedItems };
          })
        );

        setCarts(hydratedCarts);
        const currentCart = hydratedCarts.find((c) => c.items?.length > 0) || hydratedCarts[0];
        setActiveCart(currentCart);
        setItems(currentCart?.items || []);
        if (currentCart) {
          setCartShop({
            id: currentCart.shopId,
            shopName: currentCart.shopName || `Quán #${currentCart.shopId}`,
          });
        }
      } else {
        setCarts([]);
        setActiveCart(null);
        setItems([]);
        setCartShop(null);
      }
    } catch (err) {
      console.error('Lỗi tải giỏ hàng từ server:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, guestSessionId]);

  useEffect(() => {
    fetchAllCarts();
  }, [fetchAllCarts]);

  // Thêm món vào giỏ
  const addToCart = async (product, shop, quantity = 1, selectedOptions = [], customPrice = null, itemNote = null) => {
    const unitPrice = customPrice !== null ? customPrice : Number(product.basePrice ?? product.price ?? 0);
    let gId = guestSessionId;
    if (!userId && !gId) {
      gId = await getOrCreateGuestSessionId();
      setGuestSessionId(gId);
    }

    const payload = {
      shopId: shop.id,
      areaId: shop.areaId || 1,
      itemId: product.id,
      itemName: product.name,
      unitPrice: unitPrice,
      quantity: quantity,
      selectedOptions: selectedOptions || [],
      itemNote: itemNote || null,
      userId: userId || null,
      guestSessionId: !userId ? gId : null,
    };

    try {
      await cartApi.addToCart(payload);
      await fetchAllCarts();
    } catch (e) {
      console.error('Lỗi thêm giỏ hàng:', e);
      // Fallback local state if network failure
      setCartShop(shop);
      setItems((prev) => [
        ...prev,
        {
          id: Date.now(),
          itemId: product.id,
          itemName: product.name,
          unitPrice: unitPrice,
          quantity: quantity,
          selectedOptions: selectedOptions || [],
          itemNote: itemNote,
          totalPrice: unitPrice * quantity,
          product,
        },
      ]);
    }
  };

  // Cập nhật món (sửa quantity, options, note)
  const updateCartItem = async (cartItemId, updateData) => {
    try {
      let gId = guestSessionId;
      if (!userId && !gId) gId = await getOrCreateGuestSessionId();
      if (cartItemId) {
        await cartApi.updateCartItem(cartItemId, updateData, userId, gId);
        await fetchAllCarts();
      }
    } catch (e) {
      console.error('Lỗi cập nhật món trong giỏ:', e);
      // Fallback local update
      setItems((prev) =>
        prev.map((item) =>
          item.id === cartItemId
            ? {
                ...item,
                ...updateData,
                totalPrice: (updateData.unitPrice || item.unitPrice) * (updateData.quantity || item.quantity),
              }
            : item
        )
      );
    }
  };

  // Xóa 1 món khỏi giỏ
  const removeCartItem = async (cartItemId) => {
    try {
      let gId = guestSessionId;
      if (!userId && !gId) gId = await getOrCreateGuestSessionId();
      if (cartItemId) {
        try {
          await cartApi.removeCartItem(cartItemId, userId, gId);
        } catch (apiError) {
          if (apiError?.response?.status === 404) {
            console.log('Cart item already removed on server.');
          } else {
            throw apiError;
          }
        }
        await fetchAllCarts();
      }
    } catch (e) {
      console.error('Lỗi xoá món khỏi giỏ:', e);
      setItems((prev) => prev.filter((i) => i.id !== cartItemId));
    }
  };

  // Giảm số lượng hoặc xóa
  const removeFromCart = async (productId) => {
    const target = items.find((i) => (i.itemId || i.product?.id) === productId);
    if (!target) return;
    if (target.quantity > 1) {
      await updateCartItem(target.id, { quantity: target.quantity - 1 });
    } else {
      await removeCartItem(target.id);
    }
  };

  const clearCart = async (cartId) => {
    const idToClear = cartId || activeCart?.id;
    try {
      let gId = guestSessionId;
      if (!userId && !gId) gId = await getOrCreateGuestSessionId();
      if (idToClear) {
        try {
          await cartApi.clearCart(idToClear, userId, gId);
        } catch (apiError) {
          if (apiError?.response?.status === 404) {
            console.log('Cart already cleared on server.');
          } else {
            throw apiError;
          }
        }
      }
      setItems([]);
      setActiveCart(null);
      setCartShop(null);
      setCarts([]);
      await fetchAllCarts();
    } catch (e) {
      console.error('Lỗi xoá giỏ hàng:', e);
      setItems([]);
      setActiveCart(null);
      setCartShop(null);
      setCarts([]);
    }
  };

  const totalCount = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const totalPrice = items.reduce((sum, i) => sum + Number(i.totalPrice || (i.unitPrice * i.quantity) || 0), 0);

  return (
    <CartContext.Provider
      value={{
        carts,
        activeCart,
        items,
        cartShop,
        cartId: activeCart?.id || null,
        guestSessionId,
        loading,
        totalCount,
        totalPrice,
        addToCart,
        updateCartItem,
        removeCartItem,
        removeFromCart,
        clearCart,
        refreshCart: fetchAllCarts,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart phải được dùng trong CartProvider');
  }
  return context;
};
