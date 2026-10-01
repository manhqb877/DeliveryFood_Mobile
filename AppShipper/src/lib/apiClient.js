import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const GATEWAY_URL = "https://unentwined-johanne-biasedly.ngrok-free.dev";
const BASE_URL = `${GATEWAY_URL}/api/v1`;

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // 10s
  headers: {
    "Content-Type": "application/json",
    "Bypass-Tunnel-Reminder": "true",
    "ngrok-skip-browser-warning": "true",
  },
});

// Tự động đính kèm Bearer token vào mọi request
apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem("shipper_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (_) {}
  return config;
});

// Xử lý response & lỗi toàn cục (bao gồm Business Error status >= 400)
apiClient.interceptors.response.use(
  (res) => {
    if (res.data && res.data.status && res.data.status >= 400) {
      let msg = res.data.message || res.data.error || "Yêu cầu thất bại";
      if (res.data.status === 1004 || msg.toLowerCase().includes("email is already registered")) {
        msg = "Email này đã được sử dụng cho tài khoản khác trong hệ thống. Vui lòng dùng email khác.";
      } else if (res.data.status === 1003 || msg.toLowerCase().includes("phone number is already registered")) {
        msg = "Số điện thoại này đã được đăng ký trong hệ thống.";
      } else if (res.data.status === 1005 || msg.toLowerCase().includes("otp")) {
        msg = "Mã OTP không chính xác hoặc đã hết hạn.";
      }
      const err = new Error(msg);
      err.response = res;
      err.status = res.data.status;
      return Promise.reject(err);
    }
    return res.data;
  },
  (err) => {
    if (err.response?.status === 401) {
      AsyncStorage.removeItem("shipper_token");
      AsyncStorage.removeItem("shipper_session");
    }
    return Promise.reject(err);
  }
);

export const VIETMAP_API_KEY = "809bdd000025b62b0e9710b82e28f65f6178ee698cdb1845";

export const getSocketBaseUrl = () => BASE_URL;

export default apiClient;
