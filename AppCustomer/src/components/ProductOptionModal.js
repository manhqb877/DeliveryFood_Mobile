import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  TextInput,
  Alert,
} from 'react-native';
import { X, Plus, Minus, ShoppingBasket, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height } = Dimensions.get('window');

const groupBy = (array, key) => {
  return (array || []).reduce((result, currentValue) => {
    (result[currentValue[key]] = result[currentValue[key]] || []).push(currentValue);
    return result;
  }, {});
};

export default function ProductOptionModal({
  visible,
  onClose,
  product,
  shop,
  onAddToCart,
  editingItem,
  onSaveEdit,
}) {
  const insets = useSafeAreaInsets();
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [itemNote, setItemNote] = useState('');

  const isEditMode = !!editingItem;

  useEffect(() => {
    if (visible && product) {
      if (isEditMode && editingItem) {
        setQuantity(editingItem.quantity || 1);
        setItemNote(editingItem.itemNote || '');

        const opts = {};
        const optionGroups = groupBy(product.options || [], 'groupName');
        (editingItem.selectedOptions || []).forEach((o) => {
          const groupName = o.group || o.groupName;
          const optId = o.option_id || o.id;
          if (groupName && optId) {
            if (!opts[groupName]) opts[groupName] = [];
            opts[groupName].push(optId);
          }
        });

        // Ensure single required options have selection
        Object.keys(optionGroups).forEach((groupName) => {
          const group = optionGroups[groupName];
          if (group.length > 0 && group[0].isRequired && !group[0].isMultiple && (!opts[groupName] || opts[groupName].length === 0)) {
            opts[groupName] = [group[0].id];
          }
        });
        setSelectedOptions(opts);
      } else {
        setQuantity(1);
        setItemNote('');
        const initialOptions = {};
        const optionGroups = groupBy(product.options || [], 'groupName');

        Object.keys(optionGroups).forEach((groupName) => {
          const group = optionGroups[groupName];
          if (group.length > 0 && group[0].isRequired && !group[0].isMultiple) {
            initialOptions[groupName] = [group[0].id];
          } else {
            initialOptions[groupName] = [];
          }
        });

        setSelectedOptions(initialOptions);
      }
    }
  }, [visible, product, editingItem]);

  if (!product) return null;

  const optionGroups = groupBy(product.options || [], 'groupName');
  const basePrice = Number(product.basePrice ?? product.price ?? 0);

  const formatVND = (price) => {
    return Number(price || 0).toLocaleString('vi-VN') + ' đ';
  };

  const handleOptionChange = (groupName, option, isMultiple) => {
    setSelectedOptions((prev) => {
      const current = prev[groupName] || [];
      if (!isMultiple) {
        return { ...prev, [groupName]: [option.id] };
      }
      if (current.includes(option.id)) {
        return { ...prev, [groupName]: current.filter((id) => id !== option.id) };
      }
      return { ...prev, [groupName]: [...current, option.id] };
    });
  };

  const calculateUnitExtraPrice = () => {
    let extra = 0;
    Object.values(selectedOptions).flat().forEach((optionId) => {
      const option = product.options?.find((opt) => opt.id === optionId);
      if (option && option.extraPrice) {
        extra += Number(option.extraPrice);
      }
    });
    return extra;
  };

  const calculateTotalPrice = () => {
    return (basePrice + calculateUnitExtraPrice()) * quantity;
  };

  const isFormValid = () => {
    for (const [groupName, options] of Object.entries(optionGroups)) {
      if (options[0]?.isRequired) {
        const selectedInGroup = selectedOptions[groupName] || [];
        if (selectedInGroup.length === 0) {
          return false;
        }
      }
    }
    return true;
  };

  const buildSelectedOptionsPayload = () => {
    const result = [];
    Object.entries(selectedOptions).forEach(([groupName, optionIds]) => {
      optionIds.forEach((id) => {
        const opt = product.options?.find((o) => o.id === id);
        if (opt) {
          result.push({
            group: groupName,
            groupName: groupName,
            option_id: opt.id,
            id: opt.id,
            option: opt.optionName,
            optionName: opt.optionName,
            extraPrice: Number(opt.extraPrice || 0),
            extra_price: Number(opt.extraPrice || 0),
          });
        }
      });
    });
    return result;
  };

  const handleSubmit = () => {
    if (!isFormValid()) {
      Alert.alert('Chưa hoàn tất', 'Vui lòng chọn đầy đủ các tuỳ chọn bắt buộc!');
      return;
    }

    const payload = {
      product,
      shop,
      quantity,
      selectedOptions: buildSelectedOptionsPayload(),
      itemNote: itemNote?.trim() || null,
      unitPrice: basePrice + calculateUnitExtraPrice(),
      totalPrice: calculateTotalPrice(),
    };

    if (isEditMode && onSaveEdit) {
      onSaveEdit(editingItem, payload);
    } else if (onAddToCart) {
      onAddToCart(payload);
    }

    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: insets.bottom || 16 }]}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={20} color="#1F2937" />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Image container - resized & contain mode */}
            <View style={styles.imageContainer}>
              <Image
                source={{
                  uri:
                    product.imageUrl ||
                    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
                }}
                style={styles.productImage}
              />
              {product.priceName ? (
                <View style={styles.priceTagBadge}>
                  <Text style={styles.priceTagText}>{product.priceName}</Text>
                </View>
              ) : null}
            </View>

            {/* Product Info */}
            <View style={styles.infoContainer}>
              <View style={styles.titleRow}>
                <Text style={styles.productName} numberOfLines={2}>
                  {isEditMode ? `Sửa: ${product.name}` : product.name}
                </Text>
                <Text style={styles.productPrice}>{formatVND(basePrice)}</Text>
              </View>
              {product.description ? (
                <Text style={styles.productDesc}>{product.description}</Text>
              ) : null}
            </View>

            {/* Ghi chú */}
            <View style={styles.noteSection}>
              <Text style={styles.noteLabel}>Ghi chú cho quán (nếu có)</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="VD: Không hành, ít đá, bỏ tương ớt riêng..."
                placeholderTextColor="#9CA3AF"
                value={itemNote}
                onChangeText={setItemNote}
                maxLength={150}
              />
            </View>

            {/* Options List */}
            <View style={styles.optionsContainer}>
              {Object.keys(optionGroups).length === 0 ? (
                <View style={styles.noOptionBox}>
                  <Text style={styles.noOptionText}>Món này không có tuỳ chọn topping</Text>
                </View>
              ) : (
                Object.entries(optionGroups).map(([groupName, options]) => {
                  const isRequired = options[0]?.isRequired;
                  const isMultiple = options[0]?.isMultiple;
                  const selectedInGroup = selectedOptions[groupName] || [];

                  return (
                    <View key={groupName} style={styles.optionGroup}>
                      <View style={styles.groupHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={styles.groupTitle}>{groupName}</Text>
                          {isRequired && (
                            <View style={styles.requiredBadge}>
                              <Text style={styles.requiredText}>BẮT BUỘC</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.groupSub}>
                          {isMultiple ? 'Chọn nhiều' : 'Chọn 1'}
                        </Text>
                      </View>

                      <View style={styles.optionsList}>
                        {options.map((option) => {
                          const isSelected = selectedInGroup.includes(option.id);
                          return (
                            <TouchableOpacity
                              key={option.id}
                              style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                              onPress={() => handleOptionChange(groupName, option, isMultiple)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.optionLeft}>
                                <View
                                  style={[
                                    styles.radioOuter,
                                    isMultiple && styles.checkboxOuter,
                                    isSelected && styles.radioOuterSelected,
                                  ]}
                                >
                                  {isSelected && (
                                    <View
                                      style={[
                                        styles.radioInner,
                                        isMultiple && styles.checkboxInner,
                                      ]}
                                    >
                                      {isMultiple && <Check size={12} color="#FFFFFF" />}
                                    </View>
                                  )}
                                </View>
                                <Text
                                  style={[
                                    styles.optionName,
                                    isSelected && styles.optionNameSelected,
                                  ]}
                                >
                                  {option.optionName}
                                </Text>
                              </View>
                              {option.extraPrice > 0 ? (
                                <Text style={styles.optionPrice}>
                                  +{formatVND(option.extraPrice)}
                                </Text>
                              ) : null}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <View style={{ height: 90 }} />
          </ScrollView>

          {/* Bottom Action Footer */}
          <View style={styles.footer}>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus size={18} color={quantity > 1 ? '#111827' : '#D1D5DB'} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{quantity}</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setQuantity(quantity + 1)}
              >
                <Plus size={18} color="#111827" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.addBtn, !isFormValid() && styles.addBtnDisabled]}
              onPress={handleSubmit}
              disabled={!isFormValid()}
              activeOpacity={0.8}
            >
              <ShoppingBasket
                size={18}
                color={isFormValid() ? '#111827' : '#9CA3AF'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.addBtnText, !isFormValid() && { color: '#9CA3AF' }]}>
                {isEditMode ? 'CẬP NHẬT' : 'THÊM VÀO GIỎ'} • {formatVND(calculateTotalPrice())}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.76,
    minHeight: height * 0.45,
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: 160,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  productImage: {
    width: '90%',
    height: '90%',
    resizeMode: 'contain',
  },
  priceTagBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priceTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  infoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginRight: 10,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#DC2626',
  },
  productDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 18,
  },
  noteSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 6,
  },
  noteInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
  },
  optionsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  noOptionBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noOptionText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  optionGroup: {
    marginBottom: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
  },
  requiredBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  requiredText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  groupSub: {
    fontSize: 12,
    color: '#6B7280',
  },
  optionsList: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionItemSelected: {
    backgroundColor: '#FFFBEB',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  radioOuterSelected: {
    borderColor: '#FFB700',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFB700',
  },
  checkboxOuter: {
    borderRadius: 4,
  },
  checkboxInner: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#FFB700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionName: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  optionNameSelected: {
    fontWeight: '600',
    color: '#111827',
  },
  optionPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D97706',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 3,
    marginRight: 12,
  },
  stepBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 1,
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '700',
    width: 28,
    textAlign: 'center',
    color: '#111827',
  },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFB700',
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFB700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  addBtnDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
});
