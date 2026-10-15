import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShipper } from '../context/ShipperContext';
import { Phone, Lock, Bike, ShieldCheck, ArrowRight, Zap } from 'lucide-react-native';

export default function LoginScreen({ navigation }) {
  const { login } = useShipper();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập số điện thoại và mật khẩu');
      return;
    }
    setLoading(true);
    try {
      await login(phone.trim(), password);
    } catch (err) {
      Alert.alert(
        'Đăng nhập thất bại',
        err?.response?.data?.message || err.message || 'Lỗi không xác định'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFB800" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* Brand Area */}
        <View style={styles.logoArea}>
          <View style={styles.logoCircle3D}>
            <Text style={styles.logoEmoji}>🛵</Text>
          </View>
          <View style={styles.brandTitleRow}>
            <Zap size={22} color="#111827" fill="#111827" />
            <Text style={styles.appName}>BeFood Driver</Text>
          </View>
          <Text style={styles.appSub}>Ứng dụng dành riêng cho đối tác tài xế giao món</Text>
        </View>

        {/* 3D Form Card */}
        <View style={styles.formCard3D}>
          <Text style={styles.formTitle}>Đăng nhập tài xế</Text>

          {/* Số điện thoại */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Số điện thoại đăng ký</Text>
            <View style={styles.inputBox}>
              <Phone size={18} color="#64748B" />
              <TextInput
                style={styles.input}
                placeholder="0901234567"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Mật khẩu */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mật khẩu</Text>
            <View style={styles.inputBox}>
              <Lock size={18} color="#64748B" />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </View>

          {/* 3D Login Button */}
          <TouchableOpacity
            style={[styles.loginBtn3D, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFB800" />
            ) : (
              <View style={styles.btnContent}>
                <Text style={styles.loginBtnText}>BẮT ĐẦU NHẬN ĐƠN</Text>
                <ArrowRight size={18} color="#FFB800" strokeWidth={2.5} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footerContainer}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            style={styles.registerBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.registerPrompt}>Chưa là đối tác tài xế? </Text>
            <Text style={styles.registerLink}>Đăng ký ngay</Text>
          </TouchableOpacity>

          <View style={styles.secureNote}>
            <ShieldCheck size={14} color="#64748B" />
            <Text style={styles.secureText}>Hệ thống vận hành an toàn & bảo mật DeliveryFood</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFB800',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle3D: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  logoEmoji: {
    fontSize: 42,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  appSub: {
    fontSize: 12,
    color: 'rgba(17, 24, 39, 0.75)',
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
  },

  // 3D Form Card
  formCard3D: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 5,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    gap: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  loginBtn3D: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loginBtnText: {
    color: '#FFB800',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  footerContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  registerPrompt: {
    color: '#1E293B',
    fontSize: 13,
    fontWeight: '500',
  },
  registerLink: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  secureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  secureText: {
    color: 'rgba(17, 24, 39, 0.65)',
    fontSize: 11,
    fontWeight: '600',
  },
});
