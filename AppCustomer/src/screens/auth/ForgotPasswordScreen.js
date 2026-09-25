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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, Eye, EyeOff, Utensils, Mail, ShieldCheck, ArrowLeft } from 'lucide-react-native';
import { authApi } from '../../api/authApi';

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState(1); // 1: Email for OTP, 2: OTP & New Password
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSendOtp = async () => {
    setErrorMsg('');
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setErrorMsg('Vui lòng nhập email hợp lệ');
      return;
    }

    setLoading(true);
    try {
      await authApi.sendForgotPasswordOtp({ email });
      Alert.alert('Thành công', 'Mã OTP đã được gửi đến email của bạn.');
      setStep(2);
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi gửi OTP. Email có thể chưa được đăng ký!');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setErrorMsg('');
    if (!otp.trim() || !newPassword.trim()) {
      setErrorMsg('Vui lòng nhập mã OTP và mật khẩu mới');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({ email, otp, newPassword });
      
      if (Platform.OS === 'web') {
        window.alert('Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập.');
        navigation.navigate('Login');
      } else {
        Alert.alert('Thành công', 'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập.', [
          { text: 'OK', onPress: () => navigation.navigate('Login') }
        ]);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi đặt lại mật khẩu. Vui lòng kiểm tra lại mã OTP!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>

          {/* Header Brand */}
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Utensils size={42} color="#111827" />
            </View>
            <Text style={styles.brandTitle}>Quên mật khẩu</Text>
            <Text style={styles.brandSubtitle}>Khôi phục tài khoản của bạn</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.formTitle}>
              {step === 1 ? 'Bước 1: Xác thực Email' : 'Bước 2: Đặt mật khẩu mới'}
            </Text>

            {/* Error banner */}
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {step === 1 ? (
              <>
                {/* Input Email */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Địa chỉ Email đăng ký</Text>
                  <View style={styles.inputWrapper}>
                    <Mail size={20} color="#6B7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Nhập email của bạn"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={email}
                      onChangeText={(val) => {
                        setEmail(val);
                        setErrorMsg('');
                      }}
                    />
                  </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.actionBtn, loading && styles.actionBtnDisabled]}
                  onPress={handleSendOtp}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#111827" />
                  ) : (
                    <Text style={styles.actionBtnText}>GỬI MÃ OTP</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mã OTP từ Email</Text>
                  <View style={styles.inputWrapper}>
                    <ShieldCheck size={20} color="#6B7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Nhập mã OTP 6 số"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      value={otp}
                      onChangeText={(val) => {
                        setOtp(val);
                        setErrorMsg('');
                      }}
                    />
                  </View>
                </View>

                {/* Input New Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mật khẩu mới</Text>
                  <View style={styles.inputWrapper}>
                    <Lock size={20} color="#6B7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Nhập mật khẩu mới"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showPassword}
                      value={newPassword}
                      onChangeText={(val) => {
                        setNewPassword(val);
                        setErrorMsg('');
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeBtn}
                    >
                      {showPassword ? (
                        <EyeOff size={20} color="#6B7280" />
                      ) : (
                        <Eye size={20} color="#6B7280" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.actionBtn, loading && styles.actionBtnDisabled]}
                  onPress={handleResetPassword}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#111827" />
                  ) : (
                    <Text style={styles.actionBtnText}>XÁC NHẬN ĐỔI MẬT KHẨU</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.linkBtn} 
                  onPress={() => setStep(1)}
                >
                  <Text style={styles.linkText}>Sử dụng email khác?</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  backBtn: {
    position: 'absolute',
    top: 24,
    left: 24,
    zIndex: 10,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  logoBadge: {
    width: 80,
    height: 80,
    backgroundColor: '#FFB700',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 15,
    color: '#4B5563',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 24,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    height: 56,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#111827',
  },
  eyeBtn: {
    padding: 8,
  },
  actionBtn: {
    backgroundColor: '#FFB700',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#FFB700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnDisabled: {
    backgroundColor: '#FDE68A',
    shadowOpacity: 0,
    elevation: 0,
  },
  actionBtnText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  linkBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
});
