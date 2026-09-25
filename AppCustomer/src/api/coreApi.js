import apiClient from './apiClient';

export const coreApi = {
  // Lấy danh sách tất cả các quán
  getShops: async () => {
    return await apiClient.get('/core/shops');
  },

  // Lấy chi tiết quán, bao gồm categories và products
  getShopDetails: async (shopId) => {
    return await apiClient.get(`/core/shops/${shopId}/details`);
  },

  // Lấy chi tiết sản phẩm / món ăn
  getItem: async (itemId) => {
    const res = await apiClient.get(`/core/items/${itemId}`);
    return res?.data ?? res;
  },

  // Lấy danh sách khuyến mãi của quán
  getShopPromotions: async (shopId) => {
    try {
      const res = await apiClient.get(`/promotions/shop/${shopId}/active`);
      return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    } catch (_) {
      try {
        const fallback = await apiClient.get(`/promotions/shop/${shopId}`);
        return Array.isArray(fallback?.data) ? fallback.data : (Array.isArray(fallback) ? fallback : []);
      } catch (e) {
        return [];
      }
    }
  },

  // Lấy danh sách khuyến mãi sàn / hệ thống
  getPlatformPromotions: async () => {
    try {
      const res = await apiClient.get('/promotions/platform');
      return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    } catch (_) {
      try {
        const fallback = await apiClient.get('/promotions/admin?scope=PLATFORM');
        return Array.isArray(fallback?.data) ? fallback.data : (Array.isArray(fallback) ? fallback : []);
      } catch (e) {
        return [];
      }
    }
  },
};
