import apiClient from './apiClient';

export const orderApi = {
  // Lấy danh sách đơn hàng
  getOrders: async () => {
    const res = await apiClient.get('/orders');
    return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
  },

  // Lấy chi tiết đơn hàng
  getOrderDetails: async (orderId) => {
    const res = await apiClient.get(`/orders/${orderId}`);
    return res?.data ?? res;
  },

  // Tạo đơn hàng mới
  createOrder: async (payload, idempotencyKey) => {
    const key = idempotencyKey || payload?.idempotencyKey || `idem_${Date.now()}`;
    const headers = { 'X-Idempotency-Key': key };
    const res = await apiClient.post('/orders', payload, { headers });
    return res?.data ?? res;
  },
};
