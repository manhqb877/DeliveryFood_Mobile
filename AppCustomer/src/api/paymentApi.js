import apiClient from './apiClient';

export const paymentApi = {
  createSepayQr: async (payload) => {
    const res = await apiClient.post('/payments/sepay/qr', payload);
    return res?.data ?? res;
  },

  getPaymentStatus: async (orderId) => {
    const res = await apiClient.get(`/payments/status/${orderId}`);
    return res?.data ?? res;
  },
};
