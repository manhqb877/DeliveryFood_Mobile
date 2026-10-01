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
import { Phone, Lock, Eye, EyeOff, Utensils, AlertCircle } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const { login, isLoading } = useAuth();
  const [identifier, setIdentifier] = useState('ankudo1234@gmail.com');
  const [password, setPassword] = useState('123456an');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    setErrorMsg('');
    if (!identifier.trim()) {
      const m = 'Vui lòng nhập số điện thoại hoặc email';
      setErrorMsg(m);
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(m);
      else Alert.alert('Thông báo', m);
      return;
    }
    if (!password) {
      const m = 'Vui lòng nhập mật khẩu';
      setErrorMsg(m);
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(m);
      else Alert.alert('Thông báo', m);
      return;
    }

    try {
      await login({ identifier: identifier.trim(), password });
    } catch (err) {
      console.log('Login error:', err);
      let msg = 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin!';
      
      const serverStatus = err.response?.data?.status || err.status;
      const rawMsg = (err.response?.data?.message || err.response?.data?.error || err.message || '').toString();

      if (
        serverStatus === 1002 ||
        rawMsg.toLowerCase().includes('incorrect') ||
        rawMsg.toLowerCase().includes('invalid') ||
        rawMsg.toLowerCase().includes('sai') ||
        rawMsg.includes('401')
      ) {
        msg = 'Số điện thoại/Email hoặc mật khẩu không chính xác!';
      } else if (serverStatus === 1001 || rawMsg.toLowerCase().includes('not found')) {
        msg = 'Không tìm thấy tài khoản với thông tin đã nhập!';
      } else if (serverStatus === 1005 || rawMsg.toLowerCase().includes('locked')) {
        msg = 'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ hỗ trợ!';
      } else if (serverStatus === 1006 || rawMsg.toLowerCase().includes('pending')) {
        msg = 'Tài khoản đang chờ kích hoạt!';
      } else if (rawMsg.toLowerCase().includes('timeout') || rawMsg.toLowerCase().includes('kết nối')) {
        msg = 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau!';
      } else if (rawMsg.toLowerCase().includes('network error')) {
        msg = 'Lỗi kết nối mạng. Vui lòng kiểm tra internet!';
      } else if (rawMsg && !rawMsg.includes('Request failed') && !rawMsg.includes('Yêu cầu thất bại')) {
        msg = rawMsg;
      }

      setErrorMsg(msg);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert('Đăng nhập thất bại', msg);
      }
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
          {/* Header Brand */}
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Utensils size={42} color="#111827" />
            </View>
            <Text style={styles.brandTitle}>FoodDelivery</Text>
            <Text style={styles.brandSubtitle}>Món ngon giao tận cửa bạn</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.formTitle}>Đăng nhập Khách hàng</Text>
            <Text style={styles.formDesc}>
              Nhập số điện thoại/email và mật khẩu đã đăng ký
            </Text>

            {/* Error banner */}
            {errorMsg ? (
              <View style={styles.errorBox}>
                <AlertCircle size={20} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Input Phone/Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Số điện thoại hoặc Email</Text>
              <View style={[styles.inputWrapper, !!errorMsg && styles.inputWrapperError]}>
                <Phone size={20} color={errorMsg ? '#EF4444' : '#6B7280'} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="0987654321 hoặc email@..."
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  value={identifier}
                  onChangeText={(val) => {
                    setIdentifier(val);
                    setErrorMsg('');
                  }}
                />
              </View>
            </View>

            {/* Input Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mật khẩu</Text>
              <View style={[styles.inputWrapper, !!errorMsg && styles.inputWrapperError]}>
                <Lock size={20} color={errorMsg ? '#EF4444' : '#6B7280'} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Nhập mật khẩu"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
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

            {/* Notice right above button if error */}
            {errorMsg ? (
              <View style={styles.btnErrorNotice}>
                <AlertCircle size={15} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.btnErrorNoticeText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Text style={styles.loginBtnText}>ĐĂNG NHẬP</Text>
              )}
            </TouchableOpacity>

            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>
                💡 Dùng chung tài khoản Khách hàng (CUSTOMER) đã đăng ký trên phiên bản Web.
              </Text>
            </View>

            {/* Links */}
            <View style={styles.linksContainer}>
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.linkText}>Quên mật khẩu?</Text>
              </TouchableOpacity>
              <View style={styles.registerWrap}>
                <Text style={styles.normalText}>Chưa có tài khoản? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                  <Text style={styles.registerText}>Đăng ký ngay</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFB700',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  formDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  btnErrorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#FEF2F2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  btnErrorNoticeText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  inputWrapperError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  eyeBtn: {
    padding: 6,
  },
  loginBtn: {
    backgroundColor: '#FFB700',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#FFB700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  noticeBox: {
    marginTop: 20,
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  noticeText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
    textAlign: 'center',
  },
  linksContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    color: '#D97706',
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 16,
  },
  registerWrap: {
    flexDirection: 'row',
  },
  normalText: {
    color: '#6B7280',
    fontSize: 14,
  },
  registerText: {
    color: '#D97706',
    fontWeight: '700',
    fontSize: 14,
  },
});
