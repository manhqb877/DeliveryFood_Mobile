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
import { Phone, Lock, Eye, EyeOff, Utensils, Mail, User, ShieldCheck, ArrowLeft } from 'lucide-react-native';
import { authApi } from '../../api/authApi';

export default function RegisterScreen({ navigation }) {
  const [step, setStep] = useState(1); // 1: Email for OTP, 2: OTP & other info
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');

  const handleSendOtp = async () => {
    setErrorMsg('');
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setErrorMsg('Vui lòng nhập email hợp lệ');
      return;
    }

    setLoading(true);
    try {
      await authApi.sendRegisterOtp({ email });
      Alert.alert('Thành công', 'Mã OTP đã được gửi đến email của bạn.');
      setStep(2);
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi gửi OTP. Email có thể đã tồn tại!');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setErrorMsg('');
    if (!otp.trim() || !phone.trim() || !fullName.trim() || !password.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    setLoading(true);
    try {
      await authApi.register({ phone, email, otp, fullName, password, role: 'CUSTOMER' });
      
      if (Platform.OS === 'web') {
        window.alert('Đăng ký thành công! Tài khoản của bạn đã được tạo. Vui lòng đăng nhập.');
        navigation.navigate('Login');
      } else {
        Alert.alert('Đăng ký thành công', 'Tài khoản của bạn đã được tạo. Vui lòng đăng nhập.', [
          { text: 'OK', onPress: () => navigation.navigate('Login') }
        ]);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi đăng ký. Vui lòng kiểm tra lại thông tin và mã OTP!');
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
            <View style={styles.beLogoBadge}>
              <View style={styles.beCircle}>
                <Text style={styles.beText}>be</Text>
              </View>
              <Text style={styles.foodText}>Food</Text>
            </View>
            <Text style={styles.brandTagline}>Đăng ký tài khoản Khách hàng mới</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.formTitle}>
              {step === 1 ? 'Bước 1: Xác thực Email' : 'Bước 2: Thông tin tài khoản'}
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
                  <Text style={styles.inputLabel}>Địa chỉ Email</Text>
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

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Họ và tên</Text>
                  <View style={styles.inputWrapper}>
                    <User size={20} color="#6B7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Nguyễn Văn A"
                      placeholderTextColor="#9CA3AF"
                      value={fullName}
                      onChangeText={(val) => {
                        setFullName(val);
                        setErrorMsg('');
                      }}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Số điện thoại</Text>
                  <View style={styles.inputWrapper}>
                    <Phone size={20} color="#6B7280" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="0987654321"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                      value={phone}
                      onChangeText={(val) => {
                        setPhone(val);
                        setErrorMsg('');
                      }}
                    />
                  </View>
                </View>

                {/* Input Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mật khẩu</Text>
                  <View style={styles.inputWrapper}>
                    <Lock size={20} color="#6B7280" style={styles.inputIcon} />
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

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.actionBtn, loading && styles.actionBtnDisabled]}
                  onPress={handleRegister}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#111827" />
                  ) : (
                    <Text style={styles.actionBtnText}>ĐĂNG KÝ TÀI KHOẢN</Text>
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
    backgroundColor: '#FFB800',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingTop: 36,
  },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  beLogoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  beCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFB800',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  beText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    fontStyle: 'italic',
  },
  foodText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFB800',
    letterSpacing: 0.8,
  },
  brandTagline: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '700',
    marginTop: 10,
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
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
