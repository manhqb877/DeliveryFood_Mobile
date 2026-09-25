import apiClient from './apiClient';

export const reviewApi = {
  // Kiểm tra đánh giá của đơn hàng
  getReviewByOrderId: async (orderId) => {
    return await apiClient.get(`/reviews/order/${orderId}`);
  },

  // Lấy đánh giá sản phẩm của đơn hàng
  getProductReviewsByOrderId: async (orderId) => {
    return await apiClient.get(`/reviews/product-reviews/order/${orderId}`);
  },

  // Submit đánh giá
  submitReview: async (payload) => {
    return await apiClient.post('/reviews', payload);
  },
};
