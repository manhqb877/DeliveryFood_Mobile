import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { authApi } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';

export default function ChangePasswordScreen({ navigation }) {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Trạng thái lỗi cho từng field và thông báo chung
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Hàm validate các trường
  const validateForm = () => {
    const newErrors = {};

    if (!oldPassword.trim()) {
      newErrors.oldPassword = 'Vui lòng nhập mật khẩu hiện tại';
    }

    if (!newPassword) {
      newErrors.newPassword = 'Vui lòng nhập mật khẩu mới';
    } else if (newPassword.length < 6) {
      newErrors.newPassword = 'Mật khẩu mới phải có tối thiểu 6 ký tự';
    } else if (oldPassword && newPassword === oldPassword) {
      newErrors.newPassword = 'Mật khẩu mới không được trùng với mật khẩu cũ';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Vui lòng xác nhận lại mật khẩu mới';
    } else if (newPassword && confirmPassword !== newPassword) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không trùng khớp';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChangePassword = async () => {
    setServerError('');
    setSuccessMsg('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.changePassword({ oldPassword, newPassword });
      
      // Kiểm tra phản hồi từ backend
      if (res?.status && res.status >= 400) {
        setServerError(res.message || 'Mật khẩu cũ không chính xác hoặc không hợp lệ');
        return;
      }

      setSuccessMsg('Đổi mật khẩu thành công! Đang chuyển hướng...');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});

      setTimeout(() => {
        navigation.goBack();
      }, 1500);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu cũ';
      setServerError(msg);
      
      // Nếu lỗi là mật khẩu cũ sai -> highlight ô mật khẩu cũ
      if (msg.toLowerCase().includes('cũ') || msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('incorrect')) {
        setErrors((prev) => ({ ...prev, oldPassword: 'Mật khẩu hiện tại không chính xác' }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đổi Mật Khẩu</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cập nhật mật khẩu mới</Text>
            <Text style={styles.cardDesc}>
              Mật khẩu mới cần tối thiểu 6 ký tự để bảo vệ an toàn cho tài khoản của bạn.
            </Text>

            {/* Thông báo lỗi từ server */}
            {serverError ? (
              <View style={styles.serverErrorBox}>
                <AlertCircle size={18} color="#DC2626" style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={styles.serverErrorText}>{serverError}</Text>
              </View>
            ) : null}

            {/* Thông báo thành công */}
            {successMsg ? (
              <View style={styles.successBox}>
                <CheckCircle2 size={18} color="#16A34A" style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            ) : null}

            {/* Field 1: Mật khẩu hiện tại */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Mật khẩu hiện tại <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  errors.oldPassword && styles.inputWrapperError,
                ]}
              >
                <Lock
                  size={18}
                  color={errors.oldPassword ? '#DC2626' : '#6B7280'}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Nhập mật khẩu hiện tại"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showOld}
                  value={oldPassword}
                  onChangeText={(text) => {
                    setOldPassword(text);
                    if (errors.oldPassword) {
                      setErrors((prev) => ({ ...prev, oldPassword: '' }));
                    }
                    if (serverError) setServerError('');
                  }}
                />
                <TouchableOpacity onPress={() => setShowOld(!showOld)} style={styles.eyeBtn}>
                  {showOld ? <EyeOff size={18} color="#6B7280" /> : <Eye size={18} color="#6B7280" />}
                </TouchableOpacity>
              </View>
              {errors.oldPassword ? (
                <View style={styles.errorRow}>
                  <AlertCircle size={13} color="#DC2626" style={{ marginRight: 4 }} />
                  <Text style={styles.errorText}>{errors.oldPassword}</Text>
                </View>
              ) : null}
            </View>

            {/* Field 2: Mật khẩu mới */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Mật khẩu mới <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  errors.newPassword && styles.inputWrapperError,
                ]}
              >
                <Lock
                  size={18}
                  color={errors.newPassword ? '#DC2626' : '#6B7280'}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Tối thiểu 6 ký tự"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showNew}
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    if (errors.newPassword) {
                      setErrors((prev) => ({ ...prev, newPassword: '' }));
                    }
                    if (confirmPassword && text !== confirmPassword) {
                      setErrors((prev) => ({ ...prev, confirmPassword: 'Mật khẩu xác nhận không trùng khớp' }));
                    } else if (confirmPassword && text === confirmPassword) {
                      setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                    }
                  }}
                />
                <TouchableOpacity onPress={() => setShowNew(!showNew)} style={styles.eyeBtn}>
                  {showNew ? <EyeOff size={18} color="#6B7280" /> : <Eye size={18} color="#6B7280" />}
                </TouchableOpacity>
              </View>
              {errors.newPassword ? (
                <View style={styles.errorRow}>
                  <AlertCircle size={13} color="#DC2626" style={{ marginRight: 4 }} />
                  <Text style={styles.errorText}>{errors.newPassword}</Text>
                </View>
              ) : null}
            </View>

            {/* Field 3: Xác nhận mật khẩu mới */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Xác nhận mật khẩu mới <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  errors.confirmPassword && styles.inputWrapperError,
                ]}
              >
                <Lock
                  size={18}
                  color={errors.confirmPassword ? '#DC2626' : '#6B7280'}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Nhập lại mật khẩu mới"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showConfirm}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errors.confirmPassword) {
                      setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                    }
                  }}
                />
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
                  {showConfirm ? <EyeOff size={18} color="#6B7280" /> : <Eye size={18} color="#6B7280" />}
                </TouchableOpacity>
              </View>
              {errors.confirmPassword ? (
                <View style={styles.errorRow}>
                  <AlertCircle size={13} color="#DC2626" style={{ marginRight: 4 }} />
                  <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                </View>
              ) : null}
            </View>

            {/* Button Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.65 }]}
              onPress={handleChangePassword}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Text style={styles.submitBtnText}>ĐỔI MẬT KHẨU</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 16 : 48,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  content: {
    padding: 16,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  cardDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 18,
    lineHeight: 18,
  },
  serverErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  serverErrorText: {
    fontSize: 13,
    color: '#B91C1C',
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  successText: {
    fontSize: 13,
    color: '#15803D',
    fontWeight: '700',
    flex: 1,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  requiredStar: {
    color: '#DC2626',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
  },
  inputWrapperError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  eyeBtn: {
    padding: 6,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    marginLeft: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#FFB700',
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#FFB700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 0.5,
  },
});
