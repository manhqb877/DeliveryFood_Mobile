import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../lib/apiClient';

const SESSION_KEY = 'shipper_session';
const TOKEN_KEY = 'shipper_token';

const ShipperContext = createContext(null);

export function ShipperProvider({ children }) {
  const [shipper, setShipper] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Tự động restore session khi app mở lại
  useEffect(() => {
    (async () => {
      try {
        const [savedToken, savedSession] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(SESSION_KEY),
        ]);
        if (savedToken && savedSession) {
          const parsedSession = JSON.parse(savedSession);
          if (parsedSession.shipper && parsedSession.shipper.role === 'SHIPPER') {
            setToken(savedToken);
            setShipper(parsedSession.shipper);
          } else {
            await AsyncStorage.multiRemove([TOKEN_KEY, SESSION_KEY]);
          }
        }
      } catch (_) {}
      setIsLoading(false);
    })();
  }, []);

  const login = async (phone, password) => {
    const res = await apiClient.post('/auth/login', { phone, password, role: 'SHIPPER' });
    
    // apiClient interceptor already unwraps res.data once.
    // Backend returns ApiResponse: { status, message, data: { accessToken, user } }
    // So res here is the ApiResponse body, and actual payload is in res.data
    const payload = (res && res.data) ? res.data : res;
    const accessToken = payload.accessToken || payload.token || payload.access_token;
    const shipperData = payload.user || payload.shipper;

    if (!accessToken) {
        throw new Error('Không lấy được token từ server!');
    }

    if (shipperData?.role !== 'SHIPPER') {
        throw new Error('Tài khoản của bạn không có quyền đăng nhập vào ứng dụng Shipper!');
    }

    await AsyncStorage.setItem(TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ shipper: shipperData }));
    setToken(accessToken);
    setShipper(shipperData);
    return res;
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, SESSION_KEY]);
    setToken(null);
    setShipper(null);
  };

  const sendOtp = async (phoneOrEmail) => {
    const res = await apiClient.post('/auth/register/send-otp', {
      email: phoneOrEmail, // The backend expects 'email' field in SendOtpRequest even if it's phone sometimes? Wait, let's check SendOtpRequest.
    });
    return res;
  };

  const register = async (payload) => {
    const res = await apiClient.post('/auth/register-shipper', payload);
    return res;
  };
  const updateDeliveryInSession = async (deliveryId) => {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (raw) {
      const session = JSON.parse(raw);
      session.deliveryId = deliveryId;
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  };

  return (
    <ShipperContext.Provider value={{ shipper, token, isLoading, login, logout, sendOtp, register, updateDeliveryInSession }}>
      {children}
    </ShipperContext.Provider>
  );
}

export const useShipper = () => useContext(ShipperContext);
