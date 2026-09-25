import apiClient from './apiClient';

export const trackingApi = {
  // Lấy vị trí tracking đơn hàng
  getDeliveryTracking: async (orderId) => {
    return await apiClient.get(`/tracking/deliveries/order/${orderId}`);
  },
};
