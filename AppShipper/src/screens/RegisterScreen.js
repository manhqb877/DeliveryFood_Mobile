import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mail, ShieldCheck, ChevronLeft } from "lucide-react-native";
import { useShipper } from "../context/ShipperContext";
import { VIETMAP_API_KEY } from "../lib/apiClient";

export default function RegisterScreen({ navigation }) {
  const { sendOtp, register } = useShipper();
  
  const [step, setStep] = useState(1); // 1: Info, 2: OTP
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [vehicleType, setVehicleType] = useState("MOTORBIKE"); // MOTORBIKE or EBIKE (Removed BICYCLE)
  const [vehiclePlate, setVehiclePlate] = useState("");
  
  const [addressLine, setAddressLine] = useState("");
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);

  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [resending, setResending] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [countdown]);

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
        .then((r) => r.json())
        .then((data) => {
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
      .then((r) => r.json())
      .then((place) => {
        if (place.lat) setLat(place.lat);
        if (place.lng) setLng(place.lng);
      })
      .catch(() => {});
  };

  const handleSendOtp = async () => {
    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();
    const cleanPlate = vehiclePlate.trim();
    const cleanAddr = addressLine.trim();

    if (!cleanName) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập Họ và tên.");
      return;
    }
    if (!cleanPhone) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập Số điện thoại.");
      return;
    }
    if (!/^(0|\+84)[0-9]{9}$/.test(cleanPhone)) {
      Alert.alert("Số điện thoại không hợp lệ", "Vui lòng nhập số điện thoại gồm 10 chữ số (bắt đầu bằng 0).");
      return;
    }
    if (!cleanEmail) {
      Alert.alert("Thiếu email", "Vui lòng nhập địa chỉ Email để hệ thống gửi mã xác thực OTP.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      Alert.alert("Email không hợp lệ", "Vui lòng nhập đúng định dạng email (ví dụ: shipper@example.com).");
      return;
    }
    if (!cleanPass || cleanPass.length < 6) {
      Alert.alert("Mật khẩu yếu", "Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (!cleanPlate) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập Biển số xe.");
      return;
    }
    if (!cleanAddr) {
      Alert.alert("Thiếu thông tin", "Vui lòng chọn hoặc nhập Địa chỉ hoạt động.");
      return;
    }
    
    setLoading(true);
    try {
      await sendOtp(cleanEmail);
      Alert.alert(
        "Đã gửi mã OTP",
        `Mã xác thực đã được gửi đến email: ${cleanEmail}. Vui lòng kiểm tra hộp thư đến (Inbox) hoặc thư mục Spam/Quảng cáo.`
      );
      setCountdown(60);
      setStep(2);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Không thể gửi mã OTP đến email. Vui lòng kiểm tra lại.";
      Alert.alert("Lỗi gửi OTP", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || resending || loading) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      Alert.alert("Lỗi", "Không tìm thấy email đăng ký. Vui lòng bấm Sửa thông tin để kiểm tra email.");
      return;
    }
    setResending(true);
    try {
      await sendOtp(cleanEmail);
      setCountdown(60);
      Alert.alert(
        "Đã gửi lại mã OTP",
        `Mã OTP mới đã được gửi tới email: ${cleanEmail}. Vui lòng kiểm tra hộp thư đến (Inbox) hoặc Spam/Quảng cáo.`
      );
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Không thể gửi lại mã OTP. Vui lòng thử lại sau.";
      Alert.alert("Lỗi gửi lại OTP", msg);
    } finally {
      setResending(false);
    }
  };

  const handleRegister = async () => {
    if (!otp.trim()) {
      Alert.alert("Thiếu mã OTP", "Vui lòng nhập mã OTP 6 số đã nhận từ email.");
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        password,
        vehicleType,
        vehiclePlate: vehiclePlate.trim(),
        addressLine: addressLine.trim(),
        latitude: lat,
        longitude: lng,
        otp: otp.trim(),
      };
      
      await register(payload);
      Alert.alert(
        "Đăng ký thành công",
        "Hồ sơ Shipper của bạn đã được gửi thành công. Vui lòng chờ Ban Quản Trị duyệt hồ sơ để bắt đầu nhận đơn!",
        [{ text: "Đăng nhập ngay", onPress: () => navigation.replace("Login") }]
      );
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Đăng ký thất bại. Vui lòng kiểm tra lại mã OTP.";
      Alert.alert("Đăng ký thất bại", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#FF6B35" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft size={22} color="#FF6B35" />
            <Text style={styles.backText}>Quay lại</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Đăng ký Tài xế (Shipper)</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            
            {step === 1 ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Họ và tên *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nguyễn Văn A"
                    placeholderTextColor="#9CA3AF"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Số điện thoại *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0901234567"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Email nhận mã OTP <Text style={{ color: "#DC2626" }}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="shipper@example.com"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                  <Text style={styles.fieldHelpText}>Mã xác thực OTP sẽ được gửi về địa chỉ email này.</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Mật khẩu đăng nhập *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Tối thiểu 6 ký tự"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>

                {/* Loại phương tiện: Chỉ Xe máy & Xe điện (Đã bỏ Xe đạp) */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Loại phương tiện *</Text>
                  <View style={styles.typeContainer}>
                    {[
                      { key: "MOTORBIKE", label: "🛵 Xe máy" },
                      { key: "EBIKE", label: "⚡ Xe điện" },
                    ].map((item) => (
                      <TouchableOpacity 
                        key={item.key} 
                        style={[styles.typeBtn, vehicleType === item.key && styles.typeBtnActive]}
                        onPress={() => setVehicleType(item.key)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.typeText, vehicleType === item.key && styles.typeTextActive]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Biển số xe *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="59-X1 12345"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="characters"
                    value={vehiclePlate}
                    onChangeText={setVehiclePlate}
                  />
                </View>

                <View style={[styles.inputGroup, { zIndex: 10 }]}>
                  <Text style={styles.label}>Địa chỉ hoạt động chính *</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="Tìm kiếm địa chỉ quận / khu vực hoạt động..." 
                    placeholderTextColor="#9CA3AF"
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

                <TouchableOpacity 
                  style={[styles.submitBtn, loading && { opacity: 0.7 }]} 
                  onPress={handleSendOtp} 
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Tiếp tục (Nhận mã OTP)</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.otpNoticeBox}>
                  <Mail size={22} color="#EA580C" style={{ marginRight: 8, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.otpNoticeTitle}>Kiểm tra hòm thư email của bạn</Text>
                    <Text style={styles.otpPrompt}>
                      Mã OTP 6 số đã được gửi đến:{"\n"}
                      <Text style={{ fontWeight: "700", color: "#111827" }}>{email.trim().toLowerCase()}</Text>
                      {"\n"}Vui lòng kiểm tra hộp thư đến (hoặc thư mục Spam/Quảng cáo).
                    </Text>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Nhập mã OTP 6 số *</Text>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder="123456"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otp}
                    onChangeText={setOtp}
                  />
                </View>

                <TouchableOpacity 
                  style={[styles.submitBtn, loading && { opacity: 0.7 }]} 
                  onPress={handleRegister} 
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Hoàn tất Đăng ký Shipper</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.otpActionsRow}>
                  <TouchableOpacity 
                    onPress={handleResendOtp} 
                    disabled={countdown > 0 || resending || loading}
                    style={[styles.resendBtn, (countdown > 0 || resending) && { opacity: 0.7 }]}
                    activeOpacity={0.7}
                  >
                    {resending ? (
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <ActivityIndicator size="small" color="#FF6B35" style={{ marginRight: 6 }} />
                        <Text style={styles.resendText}>Đang gửi lại...</Text>
                      </View>
                    ) : countdown > 0 ? (
                      <Text style={[styles.resendText, { color: "#6B7280", fontWeight: "600" }]}>
                        Gửi lại sau ({countdown}s)
                      </Text>
                    ) : (
                      <Text style={styles.resendText}>Gửi lại mã OTP</Text>
                    )}
                  </TouchableOpacity>

                  <Text style={{ color: "#D1D5DB" }}>|</Text>

                  <TouchableOpacity onPress={() => setStep(1)} style={styles.editBtn}>
                    <Text style={styles.editText}>Sửa thông tin / Đổi email</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F3F4F6" },
  container: { flex: 1 },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: 16,
    paddingVertical: 14, 
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB"
  },
  backBtn: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginRight: 12,
    paddingVertical: 4,
    paddingRight: 6,
  },
  backText: { color: "#FF6B35", fontSize: 15, fontWeight: "700" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#111827" },
  scrollContent: { padding: 16 },
  formCard: { 
    backgroundColor: "#fff", 
    borderRadius: 16, 
    padding: 20, 
    shadowColor: "#000", 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 6 },
  input: { 
    borderWidth: 1, 
    borderColor: "#D1D5DB", 
    borderRadius: 10, 
    paddingHorizontal: 14, 
    paddingVertical: 12, 
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#F9FAFB",
  },
  fieldHelpText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  typeContainer: { flexDirection: "row", gap: 10 },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  typeBtnActive: { borderColor: "#FF6B35", backgroundColor: "#FFF5F0" },
  typeText: { fontSize: 14, color: "#4B5563", fontWeight: "600" },
  typeTextActive: { color: "#FF6B35", fontWeight: "800" },
  autocompleteContainer: {
    position: "absolute",
    top: 75,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
    zIndex: 1000,
  },
  autocompleteItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  autocompleteText: { fontSize: 14, color: "#111827" },
  submitBtn: {
    backgroundColor: "#FF6B35", 
    borderRadius: 12, 
    paddingVertical: 14, 
    alignItems: "center", 
    marginTop: 10,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  otpNoticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFEDD5",
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  otpNoticeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9A3412",
    marginBottom: 4,
  },
  otpPrompt: { 
    fontSize: 13, 
    color: "#4B5563", 
    lineHeight: 18,
  },
  otpInput: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    /* letterSpacing removed */
    backgroundColor: "#FFFFFF",
    borderColor: "#FF6B35",
  },
  otpActionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
  },
  resendBtn: { padding: 4 },
  resendText: { color: "#FF6B35", fontSize: 14, fontWeight: "700" },
  editBtn: { padding: 4 },
  editText: { color: "#6B7280", fontSize: 14, textDecorationLine: "underline" },
});
