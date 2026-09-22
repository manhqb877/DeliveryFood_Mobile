import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, Linking, Animated, Dimensions, StatusBar,
  PanResponder
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Bike, MapPin, Store, Navigation, ChevronUp, Phone } from 'lucide-react-native';
import apiClient, { VIETMAP_API_KEY } from '../lib/apiClient';
import { useShipper } from '../context/ShipperContext';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const STATUS_FLOW = [
  { key: 'ASSIGNED', label: 'Nhận đơn' },
  { key: 'GOING_PICKUP', label: 'Đến quán' },
  { key: 'PICKED_UP', label: 'Lấy hàng' },
  { key: 'DELIVERED', label: 'Thành công' },
];

function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatETA(distKm) {
  const mins = Math.round((distKm / 30) * 60);
  if (mins < 1) return '< 1 phút';
  if (mins < 60) return `~${mins} phút`;
  return `~${Math.floor(mins / 60)}h ${mins % 60}p`;
}

export default function OrderDetailScreen({ route, navigation }) {
  const { delivery: initialDelivery } = route.params;
  const { shipper, updateDeliveryInSession } = useShipper();
  const [delivery, setDelivery] = useState(initialDelivery);
  const [actionLoading, setActionLoading] = useState(false);

  // Map state
  const [shipperCoords, setShipperCoords] = useState(null);
  const [routesToShop, setRoutesToShop] = useState([]);   // shipper → shop
  const [routesToCustomer, setRoutesToCustomer] = useState([]); // shop → khách
  const [selectedRouteShopIdx, setSelectedRouteShopIdx] = useState(0);
  const [selectedRouteCustIdx, setSelectedRouteCustIdx] = useState(0);
  const [etaText, setEtaText] = useState('');
  const [distKm, setDistKm] = useState(null);

  const mapRef = useRef(null);
  const locationSubRef = useRef(null);
  const gpsIntervalRef = useRef(null);

  // Bottom sheet
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);

  // Demo state
  const demoIntervalRef = useRef(null);
  const [isDemoRunning, setIsDemoRunning] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -30) {
          // Drag up to open
          Animated.spring(bottomSheetAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
          setIsSheetExpanded(true);
        } else if (gestureState.dy > 30) {
          // Drag down to close
          Animated.spring(bottomSheetAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
          setIsSheetExpanded(false);
        } else {
          // Tap to toggle
          toggleSheet();
        }
      }
    })
  ).current;

  // Toạ độ từ delivery
  const pickupLat = Number(delivery?.pickupLat || 10.8411);
  const pickupLng = Number(delivery?.pickupLng || 106.8427);
  const deliveryLat = Number(delivery?.deliveryLat || 10.843);
  const deliveryLng = Number(delivery?.deliveryLng || 106.845);

  useEffect(() => {
    if (delivery?.id) updateDeliveryInSession(delivery.id).catch(() => {});
  }, [delivery?.id]);

  // ===== GPS + WATCH =====
  useEffect(() => {
    let sub = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Cần quyền GPS', 'Ứng dụng cần vị trí để điều hướng giao hàng.');
        return;
      }

      // Lấy vị trí ngay lập tức
      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setShipperCoords(initial.coords);
      sendLocationToServer(initial.coords.latitude, initial.coords.longitude);

      // Fetch routes ngay sau khi có GPS
      fetchRoutes(initial.coords.latitude, initial.coords.longitude);

      // Theo dõi vị trí real-time
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 8000, distanceInterval: 15 },
        (newLoc) => {
          setShipperCoords(newLoc.coords);
          sendLocationToServer(newLoc.coords.latitude, newLoc.coords.longitude);
          const d = calcDistance(newLoc.coords.latitude, newLoc.coords.longitude, deliveryLat, deliveryLng);
          setDistKm(d);
          setEtaText(formatETA(d));
        }
      );
      locationSubRef.current = sub;
    })();

    return () => {
      if (locationSubRef.current) locationSubRef.current.remove();
      if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
    };
  }, []);

  const sendLocationToServer = (lat, lng) => {
    if (!shipper?.id) return;
    apiClient.patch(`/tracking/shippers/${shipper.id}/location`, { lat: lat, lng: lng })
      .catch(() => {});
  };

  // ===== FETCH 2 TUYẾN ĐƯỜNG =====
  const fetchRoutes = async (shipLat, shipLng) => {
    // Tuyến 1: Shipper → Shop (lấy hàng)
    fetchVietmapRoute(shipLat, shipLng, pickupLat, pickupLng).then(routes => {
      setRoutesToShop(routes);
    });
    // Tuyến 2: Shop → Khách
    fetchVietmapRoute(pickupLat, pickupLng, deliveryLat, deliveryLng).then(routes => {
      setRoutesToCustomer(routes);
      if (routes.length > 0) {
        setDistKm(routes[0].distance);
        setEtaText(formatETA(routes[0].distance));
      }
      // Auto fit bản đồ
      setTimeout(() => {
        const allCoords = [
          { latitude: shipLat, longitude: shipLng },
          { latitude: pickupLat, longitude: pickupLng },
          { latitude: deliveryLat, longitude: deliveryLng },
        ];
        mapRef.current?.fitToCoordinates(allCoords, {
          edgePadding: { top: 80, right: 50, bottom: 300, left: 50 },
          animated: true,
        });
      }, 500);
    });
  };

  const fetchVietmapRoute = async (fromLat, fromLng, toLat, toLng) => {
    try {
      const url = `https://maps.vietmap.vn/api/route?api-version=1.1&apikey=${VIETMAP_API_KEY}&point=${fromLat},${fromLng}&point=${toLat},${toLng}&vehicle=motorcycle&points_encoded=false`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === 'OK' && data.paths) {
        return data.paths.map(p => ({
          distance: p.distance / 1000,
          duration: p.time / 1000 / 60,
          coordinates: (p.points?.coordinates || []).map(c => ({ latitude: c[1], longitude: c[0] })),
        }));
      }
    } catch (e) {
      console.warn('Vietmap route error:', e);
    }
    return [];
  };

  const toggleSheet = () => {
    // If it's closed (anim=0) -> open (anim=1)
    // If it's open (anim=1) -> close (anim=0)
    Animated.spring(bottomSheetAnim, {
      toValue: isSheetExpanded ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
    setIsSheetExpanded(!isSheetExpanded);
  };

  const currentStep = STATUS_FLOW.findIndex(s => s.key === delivery?.status);

  const handleNextStep = async () => {
    const nextActions = {
      ASSIGNED: { endpoint: 'start-pickup', label: 'Bắt đầu đi lấy hàng' },
      GOING_PICKUP: { endpoint: 'confirm-pickup', label: 'Đã lấy hàng tại quán' },
      PICKED_UP: { endpoint: 'complete', label: 'Xác nhận giao thành công', isComplete: true },
    };

    const action = nextActions[delivery?.status];
    if (!action) return;

    if (action.isComplete) {
      navigation.navigate('Camera', {
        orderId: delivery?.orderId || delivery?.id,
        onPhotoTaken: async (photoUri) => {
          setActionLoading(true);
          try {
            const mockPhotoUrl = 'https://example.com/proof/' + Date.now() + '.jpg';
            const res = await apiClient.post(
              `/tracking/deliveries/${delivery.id}/${action.endpoint}?shipperId=${shipper?.id}`,
              { proofPhotoUrl: mockPhotoUrl }
            );
            setDelivery(res);
            Alert.alert('🎉 Giao thành công!', 'Tiền ship đã được ghi nhận!', [
              { text: 'OK', onPress: () => navigation.popToTop() },
            ]);
          } catch (e) {
            Alert.alert('Lỗi', e?.response?.data?.message || 'Không thể cập nhật trạng thái');
          } finally {
            setActionLoading(false);
          }
        },
      });
      return;
    }

    Alert.alert('Xác nhận', action.label + '?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xác nhận',
        onPress: async () => {
          setActionLoading(true);
          try {
            const res = await apiClient.post(
              `/tracking/deliveries/${delivery.id}/${action.endpoint}?shipperId=${shipper?.id}`
            );
            setDelivery(res);
            // Khi bấm "Bắt đầu đi lấy" → re-fetch route mới
            if (delivery?.status === 'ASSIGNED' && shipperCoords) {
              fetchRoutes(shipperCoords.latitude, shipperCoords.longitude);
            }
          } catch (e) {
            Alert.alert('Lỗi', e?.response?.data?.message || 'Không thể cập nhật trạng thái');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const startDemoMovement = () => {
    if (isDemoRunning) {
      clearInterval(demoIntervalRef.current);
      setIsDemoRunning(false);
      return;
    }

    const currentRoute = delivery?.status === 'PICKED_UP' 
      ? routesToCustomer[selectedRouteCustIdx]?.coordinates 
      : routesToShop[selectedRouteShopIdx]?.coordinates;

    if (!currentRoute || currentRoute.length === 0) {
      Alert.alert('Chưa có tuyến đường', 'Đang tải tuyến đường, vui lòng thử lại sau.');
      return;
    }

    setIsDemoRunning(true);
    let step = 0;
    
    // Tìm điểm bắt đầu gần shipperCoords nhất (nếu có)
    if (shipperCoords) {
      let minDist = Infinity;
      for (let i = 0; i < currentRoute.length; i++) {
        const dist = calcDistance(shipperCoords.latitude, shipperCoords.longitude, currentRoute[i].latitude, currentRoute[i].longitude);
        if (dist < minDist) {
          minDist = dist;
          step = i;
        }
      }
    }

    demoIntervalRef.current = setInterval(async () => {
      if (step >= currentRoute.length) {
        clearInterval(demoIntervalRef.current);
        setIsDemoRunning(false);

        // Auto actions based on destination reached
        if (delivery?.status === 'ASSIGNED' || delivery?.status === 'GOING_PICKUP') {
          try {
             if (delivery?.status === 'ASSIGNED') {
               await apiClient.post(`/tracking/deliveries/${delivery.id}/start-pickup?shipperId=${shipper?.id}`);
             }
             const res = await apiClient.post(`/tracking/deliveries/${delivery.id}/confirm-pickup?shipperId=${shipper?.id}`);
             setDelivery(res);
             Alert.alert('Demo', 'Đã tự động lấy hàng thành công!\nVui lòng bấm "Chạy Demo (Đến Khách)" để tiếp tục.');
          } catch(e) {}
        } else if (delivery?.status === 'PICKED_UP') {
          try {
             const mockPhotoUrl = 'https://example.com/proof/' + Date.now() + '.jpg';
             const res = await apiClient.post(`/tracking/deliveries/${delivery.id}/complete?shipperId=${shipper?.id}`, { proofPhotoUrl: mockPhotoUrl });
             setDelivery(res);
             Alert.alert('Demo', 'Giao hàng thành công!\nĐơn hàng đã được tự động chuyển vào Lịch sử.', [{ text: 'Tuyệt vời', onPress: () => navigation.popToTop() }]);
          } catch(e) {}
        }
        return;
      }
      const nextCoord = currentRoute[step];
      setShipperCoords(nextCoord);
      sendLocationToServer(nextCoord.latitude, nextCoord.longitude);
      step += Math.max(1, Math.floor(currentRoute.length / 50)); // Di chuyển nhanh (khoảng 50 steps)
    }, 400);
  };

  useEffect(() => {
    return () => clearInterval(demoIntervalRef.current);
  }, []);

  const openGoogleMaps = () => {
    // Điều hướng tới shop nếu chưa lấy hàng, tới khách nếu đã lấy
    const targetLat = delivery?.status === 'PICKED_UP' ? deliveryLat : pickupLat;
    const targetLng = delivery?.status === 'PICKED_UP' ? deliveryLng : pickupLng;
    Linking.openURL(`https://maps.google.com/?daddr=${targetLat},${targetLng}`);
  };

  const actionBtnLabel = {
    ASSIGNED: '🛵 Bắt đầu đi lấy hàng',
    GOING_PICKUP: '📦 Xác nhận đã lấy hàng',
    PICKED_UP: '✅ Hoàn thành giao hàng',
    DELIVERED: null,
  }[delivery?.status];

  const mapRegion = {
    latitude: shipperCoords?.latitude || pickupLat,
    longitude: shipperCoords?.longitude || pickupLng,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  };

  const sheetTranslateY = bottomSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT * 0.35, 0], // Only drop 35% height when collapsed
  });

  // Quyết định hiển thị tuyến đường nào nổi bật
  const isGoingToShop = delivery?.status === 'ASSIGNED' || delivery?.status === 'GOING_PICKUP';

  // Distance validation cho các nút thao tác
  const targetLat = isGoingToShop ? pickupLat : deliveryLat;
  const targetLng = isGoingToShop ? pickupLng : deliveryLng;
  let distToTarget = null;
  if (shipperCoords) {
    distToTarget = calcDistance(shipperCoords.latitude, shipperCoords.longitude, targetLat, targetLng);
  }
  const isNearTarget = distToTarget !== null && distToTarget <= 0.15; // Cách < 150m thì cho phép bấm

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* ===== NATIVE MAPVIEW ===== */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {/* Marker: Cửa hàng (Điểm lấy hàng) */}
        <Marker coordinate={{ latitude: pickupLat, longitude: pickupLng }} title={delivery?.shopName || 'Cửa hàng'} zIndex={2}>
          <View style={styles.markerStore}>
            <Store color="#fff" size={18} />
          </View>
        </Marker>

        {/* Marker: Khách hàng (Điểm giao) */}
        <Marker coordinate={{ latitude: deliveryLat, longitude: deliveryLng }} title={delivery?.customerName || 'Khách hàng'} zIndex={2}>
          <View style={styles.markerDest}>
            <MapPin color="#fff" size={18} />
          </View>
        </Marker>

        {/* Marker: Shipper (Vị trí GPS thực) */}
        {shipperCoords && (
          <Marker coordinate={{ latitude: shipperCoords.latitude, longitude: shipperCoords.longitude }} title="Bạn" zIndex={10}>
            <View style={styles.markerShipper}>
              <Bike color="#fff" size={18} />
            </View>
          </Marker>
        )}

        {/* Tuyến đường 1: Shipper → Shop (màu xanh luôn sáng) */}
        {routesToShop.map((route, idx) => (
          <Polyline
            key={`shop-${idx}`}
            coordinates={route.coordinates}
            strokeColor={idx === selectedRouteShopIdx ? '#3B82F6' : '#93C5FD'}
            strokeWidth={idx === selectedRouteShopIdx ? 5 : 3}
            zIndex={idx === selectedRouteShopIdx ? 9 : 1}
            tappable
            onPress={() => setSelectedRouteShopIdx(idx)}
          />
        ))}

        {/* Tuyến đường 2: Shop → Khách (màu cam luôn sáng) */}
        {routesToCustomer.map((route, idx) => (
          <Polyline
            key={`cust-${idx}`}
            coordinates={route.coordinates}
            strokeColor={idx === selectedRouteCustIdx ? '#F97316' : '#FDBA74'} // Orange
            strokeWidth={idx === selectedRouteCustIdx ? 6 : 3}
            zIndex={idx === selectedRouteCustIdx ? 10 : 2}
            tappable
            onPress={() => {
              setSelectedRouteCustIdx(idx);
              setDistKm(route.distance);
              setEtaText(formatETA(route.distance));
            }}
          />
        ))}
      </MapView>

      {/* ===== FLOATING TOP BUTTONS ===== */}
      <SafeAreaView style={styles.floatingTop} pointerEvents="box-none">
        <TouchableOpacity style={styles.circleBtn} onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1F2937' }}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.circleBtn} onPress={openGoogleMaps}>
          <Navigation color="#1F2937" size={20} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* ETA Floating Card */}
      {(etaText || distKm) && (
        <View style={styles.etaCard}>
          <Text style={styles.etaTime}>{etaText}</Text>
          {distKm != null && <Text style={styles.etaDist}>{distKm.toFixed(1)} km</Text>}
        </View>
      )}

      {/* Demo Button - nhỏ gọn dạng pill đặt ở trên cùng góc phải dễ nhìn */}
      {delivery?.status !== 'DELIVERED' && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 100,
            right: 16,
            backgroundColor: isDemoRunning ? '#DC2626' : '#2563EB',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            zIndex: 20,
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 4,
          }}
          onPress={startDemoMovement}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
            {isDemoRunning ? '⏹ Dừng' : (delivery?.status === 'PICKED_UP' ? '🛵 Demo→KH' : '🛵 Demo→Quán')}
          </Text>
        </TouchableOpacity>
      )}

      {/* ===== BOTTOM SHEET ===== */}
      <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
        {/* Handle */}
        <View style={styles.dragHandleArea} {...panResponder.panHandlers}>
          <View style={styles.dragHandle} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <View style={[styles.statusBadge, { backgroundColor: isGoingToShop ? '#EFF6FF' : '#FFF7ED' }]}>
              <Text style={[styles.statusBadgeText, { color: isGoingToShop ? '#1D4ED8' : '#EA580C' }]}>
                {isGoingToShop ? '🏪 Đang đến lấy hàng' : '📦 Đang giao đến khách'}
              </Text>
            </View>
          </View>
          <Text style={styles.orderIdText}>{delivery?.orderCode ? delivery.orderCode : `Mã: #${String(delivery?.orderId || '').slice(-6).toUpperCase()}`}</Text>
          <Animated.View style={{ transform: [{ rotate: isSheetExpanded ? '180deg' : '0deg' }] }}>
            <ChevronUp color="#9CA3AF" size={18} />
          </Animated.View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

          {/* Timeline */}
          <View style={styles.timelineRow}>
            {STATUS_FLOW.map((step, idx) => {
              const isPast = idx <= currentStep;
              const isCurrent = idx === currentStep;
              return (
                <View key={step.key} style={{ alignItems: 'center', flex: 1 }}>
                  <View style={[styles.timelineDot,
                    isPast && styles.timelineDotActive,
                    isCurrent && styles.timelineDotCurrent
                  ]} />
                  <Text style={[styles.timelineText, isPast && styles.timelineTextActive]}>{step.label}</Text>
                </View>
              );
            })}
          </View>

          {/* Địa chỉ */}
          <View style={styles.addressCard}>
            {/* Lấy hàng */}
            <View style={styles.addressRow}>
              <View style={[styles.iconWrap, { backgroundColor: '#EFF6FF' }]}>
                <Store color="#1D4ED8" size={16} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.addressLabel}>Lấy hàng tại</Text>
                <Text style={styles.addressValue}>{delivery?.shopName || 'Cửa hàng'}</Text>
                <Text style={styles.addressSub}>{delivery?.pickupAddress || 'Địa chỉ quán'}</Text>
              </View>
            </View>
            <View style={styles.dotLine} />
            {/* Giao đến */}
            <View style={styles.addressRow}>
              <View style={[styles.iconWrap, { backgroundColor: '#FFF7ED' }]}>
                <MapPin color="#EA580C" size={16} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.addressLabel}>Giao đến khách</Text>
                <Text style={styles.addressValue}>{delivery?.deliveryAddress || 'Địa chỉ khách hàng'}</Text>
                {delivery?.deliveryBuilding && <Text style={styles.addressSub}>{delivery.deliveryBuilding}</Text>}
                {delivery?.deliveryFloor && <Text style={styles.addressSub}>Tầng {delivery.deliveryFloor}</Text>}
              </View>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Thu hộ (COD)</Text>
              <Text style={styles.statValueCod}>
                {delivery?.codAmount ? `${Number(delivery.codAmount).toLocaleString('vi-VN')}đ` : '0đ'}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Khoảng cách</Text>
              <Text style={styles.statValue}>{distKm ? `${distKm.toFixed(1)} km` : '--'}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>ETA</Text>
              <Text style={styles.statValue}>{etaText || '--'}</Text>
            </View>
          </View>

        </ScrollView>

        {/* Next Step Button */}
        {delivery?.status !== 'DELIVERED' && delivery?.status !== 'CANCELLED' && (
          <View style={styles.actionWrap}>
            <TouchableOpacity 
              style={[styles.actionBtn, !isNearTarget && { backgroundColor: '#9CA3AF' }]} 
              onPress={() => {
                if (!isNearTarget) {
                  Alert.alert('Chưa đến nơi', 'Vui lòng chạy đến đúng vị trí trước khi thao tác. Bạn có thể bấm "Chạy Demo" để tự động di chuyển.');
                  return;
                }
                handleNextStep();
              }} 
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>
                  {delivery?.status === 'ASSIGNED' ? 'Bắt đầu đi lấy hàng' : 
                   delivery?.status === 'GOING_PICKUP' ? 'Đã lấy hàng tại quán' :
                   delivery?.status === 'PICKED_UP' ? 'Xác nhận giao thành công' : 'Cập nhật'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  map: { position: 'absolute', width: '100%', height: '100%' },

  markerStore: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#1D4ED8', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6
  },
  markerDest: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#EA580C', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6
  },
  markerShipper: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 10
  },

  floatingTop: {
    position: 'absolute', top: 10, left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between', zIndex: 10
  },
  circleBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 5, marginTop: 10
  },

  etaCard: {
    position: 'absolute', top: 80, alignSelf: 'center',
    backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4
  },
  etaTime: { fontSize: 15, fontWeight: '800', color: '#1F2937' },
  etaDist: { fontSize: 13, color: '#6B7280', fontWeight: '600' },

  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SCREEN_HEIGHT * 0.60, // Giảm chiều cao từ 0.72 xuống 0.60 để không che khuất map
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 24
  },
  dragHandleArea: {
    alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8
  },
  dragHandle: {
    width: 40, height: 5, borderRadius: 3, backgroundColor: '#D1D5DB',
    position: 'absolute', top: 8, left: SCREEN_WIDTH / 2 - 20
  },
  statusBadge: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  orderIdText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },

  timelineRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 18, backgroundColor: '#fff', marginBottom: 10
  },
  timelineDot: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: '#E5E7EB', marginBottom: 6
  },
  timelineDotActive: { backgroundColor: '#FACC15' },
  timelineDotCurrent: { borderWidth: 3, borderColor: '#FEF08A', width: 18, height: 18, borderRadius: 9, marginBottom: 4 },
  timelineText: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', textAlign: 'center' },
  timelineTextActive: { color: '#1F2937', fontWeight: '700' },

  addressCard: {
    backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 18,
    padding: 16, marginBottom: 10
  },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  dotLine: { width: 2, height: 20, backgroundColor: '#E5E7EB', marginLeft: 17, marginVertical: 4 },
  iconWrap: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  addressLabel: { fontSize: 11, color: '#6B7280', marginBottom: 2 },
  addressValue: { fontSize: 14, color: '#1F2937', fontWeight: '600', lineHeight: 20 },
  addressSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 12 },
  statBox: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2
  },
  statLabel: { fontSize: 11, color: '#6B7280', marginBottom: 4, textAlign: 'center' },
  statValue: { fontSize: 15, color: '#1F2937', fontWeight: '700' },
  statValueCod: { fontSize: 16, color: '#EA580C', fontWeight: '800' },

  actionWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 16, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: '#F3F4F6'
  },
  actionBtn: {
    backgroundColor: '#111827', borderRadius: 18, paddingVertical: 16, alignItems: 'center',
    shadowColor: '#111827', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 6
  },
  actionBtnText: { color: '#FACC15', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  demoBtn: {
    position: 'absolute', top: 130, alignSelf: 'center',
    backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 5
  },
  demoBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 }
});
