import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/authApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Khởi tạo phiên đăng nhập từ AsyncStorage
  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('customer_token');
        const storedUser = await AsyncStorage.getItem('customer_user');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));

          // Đồng bộ lại profile mới nhất từ server
          try {
            const response = await authApi.getProfile();
            const latestProfile = response.data || response;
            if (latestProfile && latestProfile.role === 'CUSTOMER') {
              setUser(latestProfile);
              await AsyncStorage.setItem('customer_user', JSON.stringify(latestProfile));
            }
          } catch (_) {
            // Giữ lại profile cũ đã lưu nếu offline
          }
        }
      } catch (err) {
        console.error('Lỗi tải session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  // Đăng nhập
  const login = async ({ identifier, password }) => {
    setIsLoading(true);
    try {
      const response = await authApi.login({ identifier, password });
      // The Java backend wraps the payload in an ApiResponse { status, message, data }
      const { accessToken, user: userData } = response.data || response;

      if (userData?.role !== 'CUSTOMER') {
        throw new Error('Tài khoản này không có quyền truy cập ứng dụng khách hàng.');
      }

      setToken(accessToken);
      setUser(userData);

      await AsyncStorage.setItem('customer_token', accessToken);
      await AsyncStorage.setItem('customer_user', JSON.stringify(userData));

      return userData;
    } finally {
      setIsLoading(false);
    }
  };

  // Làm mới thông tin profile từ server
  const refreshProfile = async () => {
    try {
      const response = await authApi.getProfile();
      const profile = response.data || response;
      if (profile) {
        setUser(profile);
        await AsyncStorage.setItem('customer_user', JSON.stringify(profile));
      }
      return profile;
    } catch (err) {
      console.error('Lỗi làm mới profile:', err);
      throw err;
    }
  };

  // Đăng xuất
  const logout = async () => {
    try {
      await authApi.logout();
    } catch (_) {
    } finally {
      setToken(null);
      setUser(null);
      await AsyncStorage.removeItem('customer_token');
      await AsyncStorage.removeItem('customer_user');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được dùng bên trong AuthProvider');
  }
  return context;
};
