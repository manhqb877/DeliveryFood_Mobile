import apiClient from './apiClient';

export const cartApi = {
  // Lấy tất cả giỏ hàng của user hoặc guest
  getAllCarts: async (userId, guestSessionId) => {
    const params = {};
    if (userId) params.userId = userId;
    else if (guestSessionId) params.guestSessionId = guestSessionId;
    params._t = Date.now(); // Bypass browser cache
    const res = await apiClient.get('/carts/all', { params });
    return res?.data ?? res;
  },

  // Thêm item vào giỏ trên server
  addToCart: async (payload) => {
    const res = await apiClient.post('/carts/items', payload);
    return res?.data ?? res;
  },

  // Cập nhật số lượng / options của item
  updateCartItem: async (cartItemId, payload, userId, guestSessionId) => {
    const params = {};
    if (userId) params.userId = userId;
    else if (guestSessionId) params.guestSessionId = guestSessionId;
    const res = await apiClient.patch(`/carts/items/${cartItemId}`, payload, { params });
    return res?.data ?? res;
  },

  // Xóa 1 item khỏi giỏ
  removeCartItem: async (cartItemId, userId, guestSessionId) => {
    const params = {};
    if (userId) params.userId = userId;
    else if (guestSessionId) params.guestSessionId = guestSessionId;
    const res = await apiClient.delete(`/carts/items/${cartItemId}`, { params });
    return res?.data ?? res;
  },

  // Xóa sạch giỏ hàng theo cartId
  clearCart: async (cartId, userId, guestSessionId) => {
    const params = {};
    if (userId) params.userId = userId;
    else if (guestSessionId) params.guestSessionId = guestSessionId;
    const res = await apiClient.delete(`/carts/${cartId}`, { params });
    return res?.data ?? res;
  },
};
