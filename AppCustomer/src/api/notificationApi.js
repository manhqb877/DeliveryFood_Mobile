import apiClient from './apiClient';

export const notificationApi = {
  getNotifications: (recipientId) => apiClient.get(`/notifications/recipient/${recipientId}`),
  getUnreadCount: (recipientId) => apiClient.get(`/notifications/unread-count/${recipientId}`),
  markAsRead: (id) => apiClient.patch(`/notifications/${id}/read`),
  markAllAsRead: (recipientId) => apiClient.patch(`/notifications/recipient/${recipientId}/read-all`),
};
