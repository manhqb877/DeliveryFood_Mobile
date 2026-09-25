import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Địa chỉ IP backend - cập nhật tự động bằng node update-ip.js
const BASE_URL = 'http://192.168.100.151:8080/api/v1';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true'
  },
});

// Interceptor đính kèm JWT Bearer token và X-User-Id hoặc X-Guest-Session-Id vào mỗi request
apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('customer_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const userStr = await AsyncStorage.getItem('customer_user');
    let hasUserId = false;
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.id) {
        config.headers['X-User-Id'] = user.id;
        hasUserId = true;
      }
    }
    if (!hasUserId) {
      const guestId = await AsyncStorage.getItem('customer_guest_session_id');
      if (guestId) {
        config.headers['X-Guest-Session-Id'] = guestId;
      }
    }
  } catch (_) {}
  return config;
});

// Interceptor xử lý lỗi 401 (hết hạn token)
apiClient.interceptors.response.use(
  (res) => {
    if (res.data && res.data.status >= 400) {
      return Promise.reject({ response: res });
    }
    return res.data;
  },
  async (err) => {
    if (err.response?.status === 401 || err.response?.data?.status === 401) {
      await AsyncStorage.removeItem('customer_token');
      await AsyncStorage.removeItem('customer_user');
    }
    return Promise.reject(err);
  }
);

export const getBaseUrl = () => BASE_URL;

export default apiClient;
