import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, Linking, Animated, Dimensions, StatusBar,
  PanResponder
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Bike, MapPin, Store, Navigation, ChevronUp, Phone, RotateCcw } from 'lucide-react-native';
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

function generateFallbackRoute(fromLat, fromLng, toLat, toLng, numPoints = 25) {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const ratio = i / numPoints;
    points.push({
      latitude: fromLat + (toLat - fromLat) * ratio,
      longitude: fromLng + (toLng - fromLng) * ratio,
    });
  }
  const dist = calcDistance(fromLat, fromLng, toLat, toLng);
  return [{
    distance: dist,
    duration: (dist / 30) * 60,
    coordinates: points,
  }];
}

export default function OrderDetailScreen({ route, navigation }) {
  const { delivery: initialDelivery } = route.params;
  const { shipper, updateDeliveryInSession } = useShipper();
  const [delivery, setDelivery] = useState(initialDelivery);
  const [actionLoading, setActionLoading] = useState(false);

  // Map state
  const [shipperCoords, setShipperCoords] = useState(null);
  const [routesToShop, setRoutesToShop] = useState([]);   // shipper -> shop
  const [routesToCustomer, setRoutesToCustomer] = useState([]); // shop -> customer
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

  // Demo state & refs to avoid stale closure in setInterval
  const demoIntervalRef = useRef(null);
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const isDemoRunningRef = useRef(isDemoRunning);
  useEffect(() => { isDemoRunningRef.current = isDemoRunning; }, [isDemoRunning]);

  // Cờ khoá GPS thật khi đang ở chế độ Demo mô phỏng (ngăn không cho GPS thật kéo xe về phòng)
  const isDemoModeRef = useRef(false);

  const deliveryRef = useRef(delivery);
  useEffect(() => { deliveryRef.current = delivery; }, [delivery]);

  const shipperRef = useRef(shipper);
  useEffect(() => { shipperRef.current = shipper; }, [shipper]);

  // Toạ độ từ delivery
  const pickupLat = Number(delivery?.pickupLat || 10.77328);
  const pickupLng = Number(delivery?.pickupLng || 106.69769);
  const deliveryLat = Number(delivery?.deliveryLat || 10.77204);
  const deliveryLng = Number(delivery?.deliveryLng || 106.65774);

  // Refresh latest status on mount
  useEffect(() => {
    if (initialDelivery?.id) {
      updateDeliveryInSession(initialDelivery.id).catch(() => {});
      apiClient.get(`/tracking/deliveries/${initialDelivery.id}`)
        .then(fresh => {
          if (fresh && fresh.id) {
            setDelivery(prev => ({
              ...prev,
              ...fresh,
              shopName: prev?.shopName || fresh?.shopName,
              customerName: prev?.customerName || fresh?.customerName,
            }));
          }
        })
        .catch(() => {});
    }
  }, [initialDelivery?.id]);

  const sendLocationToServer = (lat, lng) => {
    const sId = shipperRef.current?.id || shipper?.id;
    if (!sId) return;
    apiClient.patch(`/tracking/shippers/${sId}/location`, { lat: lat, lng: lng })
      .catch(() => {});
  };

  const fetchVietmapRoute = async (fromLat, fromLng, toLat, toLng) => {
    try {
      const url = `https://maps.vietmap.vn/api/route?api-version=1.1&apikey=${VIETMAP_API_KEY}&point=${fromLat},${fromLng}&point=${toLat},${toLng}&vehicle=motorcycle&points_encoded=false`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === 'OK' && data.paths && data.paths.length > 0) {
        return data.paths.map(p => ({
          distance: p.distance / 1000,
          duration: p.time / 1000 / 60,
          coordinates: (p.points?.coordinates || []).map(c => ({ latitude: c[1], longitude: c[0] })),
        }));
      }
    } catch (e) {
      console.warn('Vietmap route error:', e);
    }
    return generateFallbackRoute(fromLat, fromLng, toLat, toLng);
  };

  const fetchRoutes = async (shipLat, shipLng) => {
    // 1. Shipper -> Shop
    fetchVietmapRoute(shipLat, shipLng, pickupLat, pickupLng).then(routes => {
      setRoutesToShop(routes);
      if (routes.length > 0 && (deliveryRef.current?.status === 'ASSIGNED' || deliveryRef.current?.status === 'GOING_PICKUP')) {
        setDistKm(routes[0].distance);
        setEtaText(formatETA(routes[0].distance));
      }
    });

    // 2. Shop -> Customer
    fetchVietmapRoute(pickupLat, pickupLng, deliveryLat, deliveryLng).then(routes => {
      setRoutesToCustomer(routes);
      if (routes.length > 0 && deliveryRef.current?.status === 'PICKED_UP') {
        setDistKm(routes[0].distance);
        setEtaText(formatETA(routes[0].distance));
      }

      // Auto fit coordinates
      setTimeout(() => {
        const isCustTarget = deliveryRef.current?.status === 'PICKED_UP';
        const allCoords = isCustTarget
          ? [
              { latitude: shipLat, longitude: shipLng },
              { latitude: deliveryLat, longitude: deliveryLng },
            ]
          : [
              { latitude: shipLat, longitude: shipLng },
              { latitude: pickupLat, longitude: pickupLng },
              { latitude: deliveryLat, longitude: deliveryLng },
            ];

        mapRef.current?.fitToCoordinates(allCoords, {
          edgePadding: { top: 80, right: 50, bottom: 260, left: 50 },
          animated: true,
        });
      }, 500);
    });
  };

  // GPS + WATCH (Có kiểm tra isDemoModeRef để không kéo giật xe khi đang mô phỏng)
  useEffect(() => {
    let sub = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Cần quyền GPS', 'Ứng dụng cần vị trí để điều hướng giao hàng.');
        return;
      }

      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!isDemoModeRef.current) {
        setShipperCoords(initial.coords);
        sendLocationToServer(initial.coords.latitude, initial.coords.longitude);
        fetchRoutes(initial.coords.latitude, initial.coords.longitude);
      }

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 8000, distanceInterval: 15 },
        (newLoc) => {
          // NẾU ĐANG TRONG CHẾ ĐỘ DEMO -> BỎ QUA ĐỂ KHÔNG BỊ RESET VỀ NHÀ
          if (isDemoModeRef.current) return;

          setShipperCoords(newLoc.coords);
          sendLocationToServer(newLoc.coords.latitude, newLoc.coords.longitude);
          const isCust = deliveryRef.current?.status === 'PICKED_UP';
          const targetL = isCust ? deliveryLat : pickupLat;
          const targetG = isCust ? deliveryLng : pickupLng;
          const d = calcDistance(newLoc.coords.latitude, newLoc.coords.longitude, targetL, targetG);
          setDistKm(d);
          setEtaText(formatETA(d));
        }
      );
      locationSubRef.current = sub;
    })();

    return () => {
      if (locationSubRef.current) locationSubRef.current.remove();
      if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -30) {
          Animated.spring(bottomSheetAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
          setIsSheetExpanded(true);
        } else if (gestureState.dy > 30) {
          Animated.spring(bottomSheetAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
          setIsSheetExpanded(false);
        } else {
          toggleSheet();
        }
      }
    })
  ).current;

  const toggleSheet = () => {
    Animated.spring(bottomSheetAnim, {
      toValue: isSheetExpanded ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
    setIsSheetExpanded(!isSheetExpanded);
  };

  const currentStep = STATUS_FLOW.findIndex(s => s.key === delivery?.status);

  // ===== DEMO SIMULATION ENGINE =====
  const startDemoMovement = async () => {
    if (isDemoRunningRef.current) {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
      setIsDemoRunning(false);
      return;
    }

    // Bật cờ khoá GPS thật
    isDemoModeRef.current = true;

    const currDelivery = deliveryRef.current;
    const currShipper = shipperRef.current;
    const currentStatus = currDelivery?.status;

    // Xác định chặng giao: Đi đến Quán hay Đi đến Khách
    const isToCustomer = currentStatus === 'PICKED_UP';

    // Nếu đang ở ASSIGNED -> Gọi start-pickup để đổi sang GOING_PICKUP ngay
    if (currentStatus === 'ASSIGNED') {
      try {
        await apiClient.post(`/tracking/deliveries/${currDelivery.id}/start-pickup?shipperId=${currShipper?.id}`);
        setDelivery(prev => ({ ...prev, status: 'GOING_PICKUP' }));
      } catch (err) {
        console.warn('start-pickup error:', err);
        setDelivery(prev => ({ ...prev, status: 'GOING_PICKUP' }));
      }
    }

    let currentRoute = isToCustomer
      ? routesToCustomer[selectedRouteCustIdx]?.coordinates
      : routesToShop[selectedRouteShopIdx]?.coordinates;

    if (!currentRoute || currentRoute.length === 0) {
      const start = isToCustomer
        ? { latitude: pickupLat, longitude: pickupLng }
        : (shipperCoords || { latitude: pickupLat, longitude: pickupLng });
      const target = isToCustomer 
        ? { latitude: deliveryLat, longitude: deliveryLng }
        : { latitude: pickupLat, longitude: pickupLng };
      const fallback = generateFallbackRoute(start.latitude, start.longitude, target.latitude, target.longitude);
      currentRoute = fallback[0].coordinates;
    }

    setIsDemoRunning(true);
    let step = 0;

    // Nếu là chặng đến khách, xuất phát từ quán
    if (isToCustomer) {
      step = 0;
    } else if (shipperCoords) {
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
      try {
        // === KHI ĐẾN ĐÍCH ===
        if (step >= currentRoute.length) {
          if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
          setIsDemoRunning(false);

          if (!isToCustomer) {
            // Đến quán: Giữ toạ độ tại quán, KHÔNG bị GPS thật kéo về
            isDemoModeRef.current = true;
            const shopCoord = { latitude: pickupLat, longitude: pickupLng };
            setShipperCoords(shopCoord);
            sendLocationToServer(shopCoord.latitude, shopCoord.longitude);

            try {
              const res = await apiClient.post(`/tracking/deliveries/${currDelivery.id}/confirm-pickup?shipperId=${currShipper?.id}`);
              setDelivery(prev => ({
                ...prev,
                ...(res || {}),
                status: 'PICKED_UP',
                shopName: prev?.shopName || res?.shopName,
                customerName: prev?.customerName || res?.customerName,
              }));
            } catch (e) {
              console.warn('Auto confirm-pickup error:', e);
              setDelivery(prev => ({ ...prev, status: 'PICKED_UP' }));
            }

            // Chuyển ETA và khoảng cách sang chặng giao khách
            if (routesToCustomer.length > 0) {
              setDistKm(routesToCustomer[0].distance);
              setEtaText(formatETA(routesToCustomer[0].distance));
            }

            // Fit bản đồ tuyến Quán -> Khách
            mapRef.current?.fitToCoordinates(
              [
                { latitude: pickupLat, longitude: pickupLng },
                { latitude: deliveryLat, longitude: deliveryLng },
              ],
              { edgePadding: { top: 80, right: 50, bottom: 260, left: 50 }, animated: true }
            );

            Alert.alert(
              '🛵 Đã lấy hàng thành công!',
              'Bạn đã nhận món từ quán. Nhấn nút "Chạy Demo đến Khách" bên dưới để tiếp tục giao hàng.',
              [{ text: 'Đã hiểu' }]
            );
          } else {
            // Đến nhà khách: Giữ toạ độ tại khách
            isDemoModeRef.current = true;
            const custCoord = { latitude: deliveryLat, longitude: deliveryLng };
            setShipperCoords(custCoord);
            sendLocationToServer(custCoord.latitude, custCoord.longitude);
            setDistKm(0);
            setEtaText('Đã đến nơi');

            Alert.alert(
              '🎉 Đã đến điểm giao!',
              'Bạn đã đến nhà khách hàng. Nhấn "Xác nhận giao thành công" bên dưới để hoàn tất đơn.',
              [{ text: 'OK' }]
            );
          }
          return;
        }

        // === ĐANG TRÊN ĐƯỜNG ĐI ===
        const nextCoord = currentRoute[step];
        if (nextCoord && nextCoord.latitude && nextCoord.longitude) {
          setShipperCoords(nextCoord);
          sendLocationToServer(nextCoord.latitude, nextCoord.longitude);
          const targetCoord = isToCustomer
            ? { latitude: deliveryLat, longitude: deliveryLng }
            : { latitude: pickupLat, longitude: pickupLng };
          const d = calcDistance(nextCoord.latitude, nextCoord.longitude, targetCoord.latitude, targetCoord.longitude);
          setDistKm(d);
          setEtaText(formatETA(d));
        }

        // Tốc độ: chia tuyến thành ~40 bước
        step += Math.max(1, Math.floor(currentRoute.length / 40));
      } catch (err) {
        console.error('Error during demo interval:', err);
        if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
        setIsDemoRunning(false);
      }
    }, 250);
  };

  // ===== RESET DEMO STATUS (Phục vụ test lại từ đầu) =====
  const handleResetDemo = () => {
    Alert.alert(
      '🔄 Reset trạng thái Demo',
      'Đưa đơn hàng về trạng thái ban đầu (Nhận đơn) để bạn có thể chạy mô phỏng lại từ đầu?',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Reset ngay',
          style: 'destructive',
          onPress: async () => {
            if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
            setIsDemoRunning(false);
            isDemoModeRef.current = false;
            setActionLoading(true);

            try {
              const res = await apiClient.post(`/tracking/deliveries/${deliveryRef.current?.id}/reset`);
              setDelivery(prev => ({
                ...prev,
                ...(res || {}),
                status: 'ASSIGNED',
                shopName: prev?.shopName || res?.shopName,
                customerName: prev?.customerName || res?.customerName,
              }));

              // Khôi phục toạ độ ban đầu từ GPS thật
              const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
              setShipperCoords(loc.coords);
              sendLocationToServer(loc.coords.latitude, loc.coords.longitude);
              fetchRoutes(loc.coords.latitude, loc.coords.longitude);

              Alert.alert('✅ Thành công', 'Đơn hàng đã được reset về trạng thái ban đầu!');
            } catch (err) {
              console.warn('Reset error:', err);
              setDelivery(prev => ({ ...prev, status: 'ASSIGNED' }));
              Alert.alert('Thông báo', 'Đã đặt lại trạng thái hiển thị trên màn hình!');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  // ===== MANUAL ACTION BUTTONS =====
  const handleManualAction = async () => {
    const currDelivery = deliveryRef.current;
    const currShipper = shipperRef.current;
    const status = currDelivery?.status;

    if (status === 'ASSIGNED') {
      setActionLoading(true);
      try {
        const res = await apiClient.post(`/tracking/deliveries/${currDelivery.id}/start-pickup?shipperId=${currShipper?.id}`);
        setDelivery(prev => ({ ...prev, ...(res || {}), status: 'GOING_PICKUP' }));
        Alert.alert('🛵 Đang đến quán', 'Trạng thái đã cập nhật: Đang di chuyển đến quán lấy hàng.');
      } catch (e) {
        Alert.alert('Lỗi', e?.response?.data?.message || 'Không thể bắt đầu đi lấy');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    if (status === 'GOING_PICKUP') {
      Alert.alert('Xác nhận đã lấy hàng', 'Bạn đã nhận đủ món tại quán và sẵn sàng giao?', [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await apiClient.post(`/tracking/deliveries/${currDelivery.id}/confirm-pickup?shipperId=${currShipper?.id}`);
              setDelivery(prev => ({
                ...prev,
                ...(res || {}),
                status: 'PICKED_UP',
                shopName: prev?.shopName || res?.shopName,
                customerName: prev?.customerName || res?.customerName,
              }));
              if (routesToCustomer.length > 0) {
                setDistKm(routesToCustomer[0].distance);
                setEtaText(formatETA(routesToCustomer[0].distance));
              }
              Alert.alert('📦 Đã lấy hàng!', 'Hãy bắt đầu giao đến cho khách hàng.');
            } catch (e) {
              Alert.alert('Lỗi', e?.response?.data?.message || 'Không thể xác nhận lấy hàng');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]);
      return;
    }

    if (status === 'PICKED_UP') {
      navigation.navigate('Camera', {
        orderId: currDelivery?.orderId || currDelivery?.id,
        onPhotoTaken: async (photoUri) => {
          setActionLoading(true);
          try {
            const mockPhotoUrl = 'https://example.com/proof/' + Date.now() + '.jpg';
            const res = await apiClient.post(
              `/tracking/deliveries/${currDelivery.id}/complete?shipperId=${currShipper?.id}`,
              { proofPhotoUrl: mockPhotoUrl }
            );
            setDelivery(prev => ({ ...prev, ...(res || {}), status: 'DELIVERED' }));
            Alert.alert('🎉 Giao thành công!', 'Tiền ship đã được ghi nhận vào ví!', [
              { text: 'Tuyệt vời', onPress: () => navigation.popToTop() },
            ]);
          } catch (e) {
            Alert.alert('Lỗi', e?.response?.data?.message || 'Không thể hoàn thành đơn hàng');
          } finally {
            setActionLoading(false);
          }
        },
      });
      return;
    }
  };

  const openGoogleMaps = () => {
    const targetLat = delivery?.status === 'PICKED_UP' ? deliveryLat : pickupLat;
    const targetLng = delivery?.status === 'PICKED_UP' ? deliveryLng : pickupLng;
    Linking.openURL(`https://maps.google.com/?daddr=${targetLat},${targetLng}`);
  };

  const mapRegion = {
    latitude: shipperCoords?.latitude || pickupLat,
    longitude: shipperCoords?.longitude || pickupLng,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  };

  const sheetTranslateY = bottomSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT * 0.35, 0],
  });

  const isGoingToShop = delivery?.status === 'ASSIGNED' || delivery?.status === 'GOING_PICKUP';

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
        {/* Cửa hàng */}
        <Marker coordinate={{ latitude: pickupLat, longitude: pickupLng }} title={delivery?.shopName || 'Cửa hàng'} zIndex={2}>
          <View style={styles.markerStore}>
            <Store color="#fff" size={18} />
          </View>
        </Marker>

        {/* Khách hàng */}
        <Marker coordinate={{ latitude: deliveryLat, longitude: deliveryLng }} title={delivery?.customerName || 'Khách hàng'} zIndex={2}>
          <View style={styles.markerDest}>
            <MapPin color="#fff" size={18} />
          </View>
        </Marker>

        {/* Shipper */}
        {shipperCoords && (
          <Marker coordinate={{ latitude: shipperCoords.latitude, longitude: shipperCoords.longitude }} title="Bạn" zIndex={10}>
            <View style={styles.markerShipper}>
              <Bike color="#fff" size={18} />
            </View>
          </Marker>
        )}

        {/* Tuyến Shipper -> Shop (Màu xanh dương) */}
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

        {/* Tuyến Shop -> Khách (Màu cam) */}
        {routesToCustomer.map((route, idx) => (
          <Polyline
            key={`cust-${idx}`}
            coordinates={route.coordinates}
            strokeColor={idx === selectedRouteCustIdx ? '#F97316' : '#FDBA74'}
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

      {/* Floating Top Navigation Buttons */}
      <SafeAreaView style={styles.floatingTop} pointerEvents="box-none">
        <TouchableOpacity style={styles.circleBtn} onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1F2937' }}>←</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {/* Nút Reset Demo (Màu đỏ nhạt dễ thấy) */}
          <TouchableOpacity 
            style={[styles.circleBtn, { backgroundColor: '#FEE2E2' }]} 
            onPress={handleResetDemo}
            activeOpacity={0.8}
          >
            <RotateCcw color="#DC2626" size={20} />
          </TouchableOpacity>

          {/* Nút mở Google Maps */}
          <TouchableOpacity style={styles.circleBtn} onPress={openGoogleMaps}>
            <Navigation color="#1F2937" size={20} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ETA Floating Card */}
      {(etaText || distKm) && (
        <View style={styles.etaCard}>
          <Text style={styles.etaTime}>{etaText}</Text>
          {distKm != null && <Text style={styles.etaDist}>{distKm.toFixed(1)} km</Text>}
        </View>
      )}

      {/* Floating Demo Pill Button at Top Right */}
      {delivery?.status !== 'DELIVERED' && (
        <TouchableOpacity
          style={[
            styles.floatingDemoPill,
            { backgroundColor: isDemoRunning ? '#DC2626' : (delivery?.status === 'PICKED_UP' ? '#EA580C' : '#2563EB') }
          ]}
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
            <View style={[styles.statusBadge, { backgroundColor: isGoingToShop ? '#EFF6FF' : (delivery?.status === 'DELIVERED' ? '#ECFDF5' : '#FFF7ED') }]}>
              <Text style={[styles.statusBadgeText, { color: isGoingToShop ? '#1D4ED8' : (delivery?.status === 'DELIVERED' ? '#059669' : '#EA580C') }]}>
                {delivery?.status === 'DELIVERED'
                  ? '✅ Giao hàng thành công'
                  : isGoingToShop
                  ? '🏪 Đang đến lấy hàng'
                  : '📦 Đang giao đến khách'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.orderIdText}>{delivery?.orderCode ? delivery.orderCode : `Mã: #${String(delivery?.orderId || '').slice(-6).toUpperCase()}`}</Text>
            {/* Nút Reset nhỏ trong Header Bottom Sheet */}
            <TouchableOpacity 
              style={styles.resetBadgeBtn} 
              onPress={handleResetDemo}
            >
              <RotateCcw color="#DC2626" size={12} />
              <Text style={styles.resetBadgeText}>Reset</Text>
            </TouchableOpacity>
          </View>

          <Animated.View style={{ transform: [{ rotate: isSheetExpanded ? '180deg' : '0deg' }] }}>
            <ChevronUp color="#9CA3AF" size={18} />
          </Animated.View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
          {/* Stepper Timeline */}
          <View style={styles.timelineRow}>
            {STATUS_FLOW.map((step, idx) => {
              const isPast = idx <= currentStep;
              const isCurrent = idx === currentStep;
              return (
                <View key={step.key} style={{ alignItems: 'center', flex: 1 }}>
                  <View style={[
                    styles.timelineDot,
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
                <Text style={styles.addressValue}>{delivery?.customerName ? `${delivery.customerName} - ${delivery?.deliveryAddress || ''}` : (delivery?.deliveryAddress || 'Địa chỉ khách hàng')}</Text>
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

        {/* ===== BOTTOM ACTION CONTROLS ===== */}
        {delivery?.status !== 'DELIVERED' && delivery?.status !== 'CANCELLED' && (
          <View style={styles.actionWrap}>
            {isDemoRunning ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#DC2626' }]}
                onPress={startDemoMovement}
              >
                <Text style={styles.actionBtnText}>⏹ Dừng chạy mô phỏng (Demo)</Text>
              </TouchableOpacity>
            ) : (
              <>
                {/* 1. Trạng thái ASSIGNED */}
                {delivery?.status === 'ASSIGNED' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { flex: 1, backgroundColor: '#2563EB' }]}
                      onPress={startDemoMovement}
                    >
                      <Text style={styles.actionBtnText}>🛵 Chạy Demo đến Quán</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { flex: 1, backgroundColor: '#111827' }]}
                      onPress={handleManualAction}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Bắt đầu đi lấy</Text>}
                    </TouchableOpacity>
                  </View>
                )}

                {/* 2. Trạng thái GOING_PICKUP */}
                {delivery?.status === 'GOING_PICKUP' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { flex: 1, backgroundColor: '#2563EB' }]}
                      onPress={startDemoMovement}
                    >
                      <Text style={styles.actionBtnText}>🛵 Chạy Demo đến Quán</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { flex: 1, backgroundColor: '#059669' }]}
                      onPress={handleManualAction}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>📦 Đã lấy hàng</Text>}
                    </TouchableOpacity>
                  </View>
                )}

                {/* 3. Trạng thái PICKED_UP */}
                {delivery?.status === 'PICKED_UP' && (
                  <View style={{ gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#EA580C' }]}
                      onPress={startDemoMovement}
                    >
                      <Text style={styles.actionBtnText}>🛵 Chạy Demo đến Khách</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#111827', paddingVertical: 13 }]}
                      onPress={handleManualAction}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={[styles.actionBtnText, { fontSize: 15, color: '#FACC15' }]}>
                          📸 Xác nhận giao thành công (Chụp ảnh)
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* 4. Trạng thái DELIVERED */}
        {delivery?.status === 'DELIVERED' && (
          <View style={styles.actionWrap}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#059669' }]}
              onPress={() => navigation.popToTop()}
            >
              <Text style={styles.actionBtnText}>🎉 Hoàn tất - Về trang chủ</Text>
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

  floatingDemoPill: {
    position: 'absolute', top: 100, right: 16,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22,
    flexDirection: 'row', alignItems: 'center', gap: 4, zIndex: 20,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, elevation: 5,
  },

  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SCREEN_HEIGHT * 0.62,
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

  resetBadgeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#FEE2E2', borderRadius: 10
  },
  resetBadgeText: { fontSize: 11, color: '#DC2626', fontWeight: '700' },

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
    backgroundColor: '#111827', borderRadius: 18, paddingVertical: 15, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 4
  },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
});
