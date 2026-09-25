import apiClient from './apiClient';

export const authApi = {
  // Đăng ký: Gửi OTP
  sendRegisterOtp: async ({ email }) => {
    return await apiClient.post('/auth/register/send-otp', { email: email?.trim() });
  },

  // Đăng ký: Xác nhận OTP
  verifyRegisterOtp: async ({ email, otp }) => {
    return await apiClient.post('/auth/register/verify-otp', { email: email?.trim(), otp: otp?.trim() });
  },

  // Đăng ký tài khoản
  register: async ({ phone, email, otp, fullName, password, role = 'CUSTOMER', areaId = null }) => {
    return await apiClient.post('/auth/register', {
      phone: phone?.trim(),
      email: email?.trim(),
      otp: otp?.trim(),
      fullName: fullName?.trim(),
      password,
      role,
      areaId,
    });
  },

  // Quên mật khẩu: Gửi OTP
  sendForgotPasswordOtp: async ({ email }) => {
    return await apiClient.post('/auth/forgot-password/send-otp', { email: email?.trim() });
  },

  // Quên mật khẩu: Xác nhận OTP
  verifyForgotPasswordOtp: async ({ email, otp }) => {
    return await apiClient.post('/auth/forgot-password/verify-otp', { email: email?.trim(), otp: otp?.trim() });
  },

  // Đặt lại mật khẩu
  resetPassword: async ({ email, otp, newPassword }) => {
    return await apiClient.post('/auth/forgot-password/reset', {
      email: email?.trim(),
      otp: otp?.trim(),
      newPassword,
    });
  },

  // Đăng nhập bằng Số điện thoại hoặc Email + Mật khẩu
  login: async ({ identifier, password }) => {
    return await apiClient.post('/auth/login', {
      phone: identifier?.trim(),
      password,
    });
  },

  // Lấy thông tin tài khoản hiện tại
  getProfile: async () => {
    return await apiClient.get('/auth/me');
  },

  // Đăng xuất
  logout: async () => {
    try {
      return await apiClient.post('/auth/logout');
    } catch (_) {
      // Dù lỗi mạng vẫn xóa session ở máy
    }
  },

  // Đổi mật khẩu
  changePassword: async ({ oldPassword, newPassword }) => {
    return await apiClient.post('/auth/change-password', {
      oldPassword,
      newPassword,
    });
  },

  // Lấy danh sách sổ địa chỉ
  getAddresses: async () => {
    const res = await apiClient.get('/auth/addresses');
    return res?.data ?? res;
  },

  // Thêm địa chỉ mới
  addAddress: async ({ addressLine, isDefault = false }) => {
    return await apiClient.post('/auth/addresses', {
      addressLine: addressLine?.trim(),
      isDefault,
    });
  },

  // Xóa địa chỉ
  deleteAddress: async (id) => {
    return await apiClient.delete(`/auth/addresses/${id}`);
  },

  // Đặt địa chỉ làm mặc định
  setDefaultAddress: async (id) => {
    return await apiClient.put(`/auth/addresses/${id}/default`);
  },
};
