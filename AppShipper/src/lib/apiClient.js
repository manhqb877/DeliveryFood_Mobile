import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Sử dụng IP cục bộ của máy tính để tránh lỗi 503 của localtunnel
const BASE_URL = 'http://10.62.148.11:8080/api/v1';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // 10s
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true' // Bỏ qua trang cảnh báo của localtunnel
  },
});

// Tự động đính kèm Bearer token vào mọi request
apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('shipper_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (_) {}
  return config;
});

// Xử lý lỗi 401 toàn cục (token hết hạn)
apiClient.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      AsyncStorage.removeItem('shipper_token');
      AsyncStorage.removeItem('shipper_session');
    }
    return Promise.reject(err);
  }
);

export const VIETMAP_API_KEY = '809bdd000025b62b0e9710b82e28f65f6178ee698cdb1845';

export const getSocketBaseUrl = () => BASE_URL;

export default apiClient;
