import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, StatusBar, ScrollView, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShipper } from '../context/ShipperContext';
import { VIETMAP_API_KEY } from '../lib/apiClient';

export default function RegisterScreen({ navigation }) {
  const { sendOtp, register } = useShipper();
  
  const [step, setStep] = useState(1); // 1: Info, 2: OTP
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleType, setVehicleType] = useState('MOTORBIKE');
  const [vehiclePlate, setVehiclePlate] = useState('');
  
  const [addressLine, setAddressLine] = useState('');
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);

  const [otp, setOtp] = useState('');

  // Address Autocomplete State
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const searchTimeoutRef = useRef(null);

  const handleAddressChange = (text) => {
    setAddressLine(text);
    if (!text.trim()) {
      setAutocompleteResults([]);
      setShowAutocomplete(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(() => {
      fetch(`https://maps.vietmap.vn/api/autocomplete/v3?apikey=${VIETMAP_API_KEY}&text=${encodeURIComponent(text)}`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setAutocompleteResults(data);
            setShowAutocomplete(true);
          }
        })
        .catch(() => {});
    }, 500);
  };

  const handleSelectAddress = (item) => {
    Keyboard.dismiss();
    const displayStr = item.address || item.display || item.name;
    setAddressLine(displayStr);
    setShowAutocomplete(false);
    
    // Fetch Place Details to get coordinates
    fetch(`https://maps.vietmap.vn/api/place/v3?apikey=${VIETMAP_API_KEY}&refid=${item.ref_id}`)
      .then(r => r.json())
      .then(place => {
        if (place.lat) setLat(place.lat);
        if (place.lng) setLng(place.lng);
      })
      .catch(() => {});
  };

  const handleSendOtp = async () => {
    if (!fullName.trim() || !phone.trim() || !password.trim() || !vehiclePlate.trim() || !addressLine.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }
    
    setLoading(true);
    try {
      await sendOtp(email.trim() || phone.trim());
      setStep(2);
    } catch (err) {
      Alert.alert('Lỗi gửi OTP', err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!otp.trim()) {
      Alert.alert('Thiếu OTP', 'Vui lòng nhập mã OTP.');
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password,
        vehicleType,
        vehiclePlate: vehiclePlate.trim(),
        addressLine: addressLine.trim(),
        latitude: lat,
        longitude: lng,
        otp: otp.trim()
      };
      
      await register(payload);
      Alert.alert(
        'Đăng ký thành công',
        'Hồ sơ Shipper của bạn đã được gửi. Vui lòng chờ Admin duyệt!',
        [{ text: 'OK', onPress: () => navigation.replace('Login') }]
      );
    } catch (err) {
      Alert.alert('Đăng ký thất bại', err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#FF6B35" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{'< Quay lại'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Đăng ký Shipper</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            
            {step === 1 ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Họ và tên *</Text>
                  <TextInput style={styles.input} placeholder="Nguyễn Văn A" value={fullName} onChangeText={setFullName} />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Số điện thoại *</Text>
                  <TextInput style={styles.input} placeholder="0901234567" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email (Tùy chọn)</Text>
                  <TextInput style={styles.input} placeholder="shipper@example.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Mật khẩu *</Text>
                  <TextInput style={styles.input} placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Loại phương tiện *</Text>
                  <View style={styles.typeContainer}>
                    {['MOTORBIKE', 'BICYCLE', 'EBIKE'].map(type => (
                      <TouchableOpacity 
                        key={type} 
                        style={[styles.typeBtn, vehicleType === type && styles.typeBtnActive]}
                        onPress={() => setVehicleType(type)}
                      >
                        <Text style={[styles.typeText, vehicleType === type && styles.typeTextActive]}>
                          {type === 'MOTORBIKE' ? 'Xe máy' : type === 'BICYCLE' ? 'Xe đạp' : 'Xe điện'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Biển số xe *</Text>
                  <TextInput style={styles.input} placeholder="59-X1 12345" autoCapitalize="characters" value={vehiclePlate} onChangeText={setVehiclePlate} />
                </View>

                <View style={[styles.inputGroup, { zIndex: 10 }]}>
                  <Text style={styles.label}>Địa chỉ hoạt động *</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="Tìm kiếm địa chỉ..." 
                    value={addressLine} 
                    onChangeText={handleAddressChange} 
                  />
                  {showAutocomplete && autocompleteResults.length > 0 && (
                    <View style={styles.autocompleteContainer}>
                      <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                        {autocompleteResults.map((item, index) => (
                          <TouchableOpacity key={item.ref_id || index} style={styles.autocompleteItem} onPress={() => handleSelectAddress(item)}>
                            <Text style={styles.autocompleteText}>{item.display || item.address || item.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSendOtp} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Tiếp tục</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.otpPrompt}>
                  Vui lòng nhập mã OTP đã được gửi đến {email ? 'email' : 'số điện thoại'} của bạn.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Mã OTP</Text>
                  <TextInput style={styles.input} placeholder="123456" keyboardType="number-pad" value={otp} onChangeText={setOtp} />
                </View>

                <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleRegister} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Hoàn tất Đăng ký</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.backLink} onPress={() => setStep(1)}>
                  <Text style={styles.backLinkText}>Sửa thông tin</Text>
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
  safe: { flex: 1, backgroundColor: '#F3F4F6' },
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  backBtn: { marginRight: 16 },
  backText: { color: '#FF6B35', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  scrollContent: { padding: 16 },
  formCard: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 20, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    elevation: 2 
  },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { 
    borderWidth: 1, 
    borderColor: '#D1D5DB', 
    borderRadius: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    fontSize: 15,
    color: '#111827'
  },
  typeContainer: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center'
  },
  typeBtnActive: { borderColor: '#FF6B35', backgroundColor: '#FFF5F0' },
  typeText: { fontSize: 13, color: '#4B5563', fontWeight: '500' },
  typeTextActive: { color: '#FF6B35', fontWeight: 'bold' },
  autocompleteContainer: {
    position: 'absolute',
    top: 75,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
    zIndex: 1000,
  },
  autocompleteItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  autocompleteText: { fontSize: 14, color: '#111827' },
  submitBtn: {
    backgroundColor: '#FF6B35', 
    borderRadius: 8, 
    paddingVertical: 14, 
    alignItems: 'center', 
    marginTop: 8,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  otpPrompt: { fontSize: 14, color: '#4B5563', marginBottom: 16, textAlign: 'center' },
  backLink: { marginTop: 16, alignItems: 'center' },
  backLinkText: { color: '#6B7280', fontSize: 14, textDecorationLine: 'underline' }
});
