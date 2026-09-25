import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  MapPin,
  Plus,
  Trash2,
  CheckCircle,
  X,
} from 'lucide-react-native';
import { authApi } from '../../api/authApi';

export default function AddressListScreen({ navigation }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newAddressLine, setNewAddressLine] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAddresses = async () => {
    try {
      const res = await authApi.getAddresses();
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setAddresses(list);
    } catch (err) {
      console.error('Lỗi lấy địa chỉ:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  const handleAddAddress = async () => {
    if (!newAddressLine.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập chi tiết địa chỉ');
      return;
    }

    setSaving(true);
    try {
      await authApi.addAddress({
        addressLine: newAddressLine.trim(),
        isDefault,
      });
      setModalVisible(false);
      setNewAddressLine('');
      setIsDefault(false);
      fetchAddresses();
    } catch (err) {
      Alert.alert('Thất bại', err.response?.data?.message || 'Không thể thêm địa chỉ');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await authApi.setDefaultAddress(id);
      fetchAddresses();
    } catch (_) {
      Alert.alert('Lỗi', 'Không thể đổi địa chỉ mặc định');
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Xoá địa chỉ', 'Bạn có chắc muốn xoá địa chỉ này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await authApi.deleteAddress(id);
            fetchAddresses();
          } catch (_) {
            Alert.alert('Lỗi', 'Không thể xoá địa chỉ');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sổ Địa Chỉ Nhận Hàng</Text>
        <TouchableOpacity style={styles.addHeaderBtn} onPress={() => setModalVisible(true)}>
          <Plus size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#FFB700" />
            <Text style={styles.loadingText}>Đang tải danh sách địa chỉ...</Text>
          </View>
        ) : addresses.length === 0 ? (
          <View style={styles.emptyWrap}>
            <MapPin size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Chưa có địa chỉ nào</Text>
            <Text style={styles.emptyDesc}>Hãy thêm địa chỉ giao hàng để đặt món nhanh hơn!</Text>
            <TouchableOpacity style={styles.addFirstBtn} onPress={() => setModalVisible(true)}>
              <Text style={styles.addFirstBtnText}>+ Thêm địa chỉ mới</Text>
            </TouchableOpacity>
          </View>
        ) : (
          addresses.map((item) => (
            <View key={item.id} style={styles.addressCard}>
              <View style={styles.cardHeader}>
                <View style={styles.addressIconWrap}>
                  <MapPin size={18} color="#D97706" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.addressLine}>{item.addressLine}</Text>
                  {item.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>MẶC ĐỊNH</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.actionRow}>
                {!item.isDefault ? (
                  <TouchableOpacity
                    style={styles.setDefaultBtn}
                    onPress={() => handleSetDefault(item.id)}
                  >
                    <CheckCircle size={15} color="#4B5563" style={{ marginRight: 4 }} />
                    <Text style={styles.setDefaultText}>Đặt làm mặc định</Text>
                  </TouchableOpacity>
                ) : (
                  <View />
                )}

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item.id)}
                >
                  <Trash2 size={16} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal Thêm Địa Chỉ */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm Địa Chỉ Giao Món</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Chi tiết địa chỉ (Số nhà, đường, toà nhà, khu vực)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ví dụ: KTX Khu B ĐHQG, Linh Trung, Thủ Đức"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              value={newAddressLine}
              onChangeText={setNewAddressLine}
            />

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setIsDefault(!isDefault)}
            >
              <View style={[styles.checkbox, isDefault && styles.checkboxActive]}>
                {isDefault && <CheckCircle size={14} color="#111827" />}
              </View>
              <Text style={styles.checkboxLabel}>Đặt làm địa chỉ nhận hàng mặc định</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleAddAddress}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Text style={styles.saveBtnText}>LƯU ĐỊA CHỈ</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingTop: 50,
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
  addHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFB700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
  },
  addressIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressLine: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 22,
  },
  defaultBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  setDefaultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setDefaultText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 6,
  },
  loadingWrap: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7280',
    fontSize: 13,
  },
  emptyWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#374151',
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
    marginBottom: 20,
  },
  addFirstBtn: {
    backgroundColor: '#FFB700',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addFirstBtnText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
    height: 80,
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: '#FFB700',
    borderColor: '#FFB700',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
  },
  saveBtn: {
    backgroundColor: '#FFB700',
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
});
