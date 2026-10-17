import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, Linking, Animated, Dimensions, StatusBar,
  PanResponder, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

let MapView = null;
let Marker = null;
let Polyline = null;
if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Polyline = Maps.Polyline;
  } catch (e) {
    console.warn('react-native-maps could not be loaded on this platform:', e?.message);
  }
}

import * as Location from 'expo-location';
import { Bike, MapPin, Store, Navigation, ChevronUp, Phone, RotateCcw, Check, Compass, ArrowLeft, Zap, Clock, AlertCircle } from 'lucide-react-native';
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

const shipperRouteCache = new Map();

export default function OrderDetailScreen({ route, navigation }) {
  const { delivery: initialDelivery } = route.params;
  const { shipper, updateDeliveryInSession } = useShipper();
  const [delivery, setDelivery] = useState(initialDelivery);
  const [actionLoading, setActionLoading] = useState(false);

  // Throttling ref cho việc lấy tuyến VietMap của Shipper
  const lastShipperFetchRef = useRef(null);

  // Map state
  const [shipperCoords, setShipperCoords] = useState(null);
  const [routesToShop, setRoutesToShop] = useState([]);   // shipper -> first stop
  const [routesBetweenShops, setRoutesBetweenShops] = useState([]); // first stop -> second stop
  const [routesToCustomer, setRoutesToCustomer] = useState([]); // second stop -> customer
  const [selectedRouteShopIdx, setSelectedRouteShopIdx] = useState(0);
  const [selectedRouteCustIdx, setSelectedRouteCustIdx] = useState(0);
  const [etaText, setEtaText] = useState('');
  const [distKm, setDistKm] = useState(null);
  const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);

  const mapRef = useRef(null);
  const iframeRef = useRef(null);
  const locationSubRef = useRef(null);
  const gpsIntervalRef = useRef(null);

  // Bottom sheet
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const sheetTranslateY = bottomSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT * 0.28, 0],
  });

  // Demo state & refs to avoid stale closure in setInterval
  const demoIntervalRef = useRef(null);
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const isDemoRunningRef = useRef(isDemoRunning);
  useEffect(() => { isDemoRunningRef.current = isDemoRunning; }, [isDemoRunning]);

  // Cờ khoá GPS thật khi đang ở chế độ Demo mô phỏng (ngăn không cho GPS thật kéo xe về phòng)
  const isDemoModeRef = useRef(false);
  const initialShipperCoordsRef = useRef(null);

  const deliveryRef = useRef(delivery);
  useEffect(() => { deliveryRef.current = delivery; }, [delivery]);

  const shipperRef = useRef(shipper);
  useEffect(() => { shipperRef.current = shipper; }, [shipper]);

  // Toạ độ & thông tin đa điểm từ delivery
  const isMultiShop = Boolean(delivery?.isMultiShop || delivery?.pickup2Lat);
  const isGoingToShop = delivery?.status === 'ASSIGNED' || delivery?.status === 'GOING_PICKUP';
  const pickupLat = Number(delivery?.pickupLat || 10.77328);
  const pickupLng = Number(delivery?.pickupLng || 106.69769);
  const pickup2Lat = Number(delivery?.pickup2Lat || 10.77173);
  const pickup2Lng = Number(delivery?.pickup2Lng || 106.70036);
  const deliveryLat = Number(delivery?.deliveryLat || 10.77204);
  const deliveryLng = Number(delivery?.deliveryLng || 106.65774);

  // Phân giải tên quán thực tế chính xác (tránh "Nhà hàng đối tác" hoặc Shop #ID)
  const resolvedShopName = useMemo(() => {
    if (delivery?.shopName && delivery.shopName !== 'Nhà hàng đối tác' && !delivery.shopName.startsWith('Shop #')) {
      return delivery.shopName;
    }
    if (delivery?.pickupAddress) {
      const parts = delivery.pickupAddress.split(' - ');
      if (parts.length > 0 && parts[0].trim()) {
        return parts[0].trim();
      }
      const commaParts = delivery.pickupAddress.split(',');
      if (commaParts[0].trim()) {
        return commaParts[0].trim();
      }
    }
    return delivery?.shopName || 'Cửa hàng';
  }, [delivery?.shopName, delivery?.pickupAddress]);

  const shop1Name = delivery?.shop1Name || resolvedShopName || 'Quán 1';
  const shop2Name = delivery?.shop2Name || 'TAKA CHA - Trà Sữa & Chè Sầu Riêng';
  const pickup1Address = delivery?.pickupAddress || 'Địa chỉ Quán 1';
  const pickup2Address = delivery?.pickup2Address || '66/1 Huỳnh Thúc Kháng, P.Bến Thành, Q.1, Hồ Chí Minh';
  const pickup1Completed = Boolean(delivery?.pickup1Completed);
  const pickup2Completed = Boolean(delivery?.pickup2Completed);

  // === THUẬT TOÁN TỐI ƯU HOÁ QUÃNG ĐƯỜNG NGẮN NHẤT (TSP 2 QUÁN) ===
  const optimalRoutePlan = useMemo(() => {
    const shipLat = shipperCoords?.latitude || pickupLat;
    const shipLng = shipperCoords?.longitude || pickupLng;

    if (!isMultiShop) {
      const d1 = calcDistance(shipLat, shipLng, pickupLat, pickupLng);
      const d2 = calcDistance(pickupLat, pickupLng, deliveryLat, deliveryLng);
      return {
        isMultiShop: false,
        optimalOrder: 'SINGLE_SHOP',
        firstStop: { id: 1, name: resolvedShopName, lat: pickupLat, lng: pickupLng, addr: pickup1Address, done: delivery?.status === 'PICKED_UP' || delivery?.status === 'DELIVERED' },
        secondStop: null,
        totalKm: d1 + d2,
        savedKm: 0,
        leg1Km: d1,
        leg2Km: d2,
        isShop1First: true,
      };
    }

    // Khoảng cách từng chặng
    const dS_P1 = calcDistance(shipLat, shipLng, pickupLat, pickupLng);
    const dS_P2 = calcDistance(shipLat, shipLng, pickup2Lat, pickup2Lng);
    const dP1_P2 = calcDistance(pickupLat, pickupLng, pickup2Lat, pickup2Lng);
    const dP1_D = calcDistance(pickupLat, pickupLng, deliveryLat, deliveryLng);
    const dP2_D = calcDistance(pickup2Lat, pickup2Lng, deliveryLat, deliveryLng);

    // Phương án 1: Shipper -> Quán 1 -> Quán 2 -> Khách
    const distPlan1 = dS_P1 + dP1_P2 + dP2_D;
    // Phương án 2: Shipper -> Quán 2 -> Quán 1 -> Khách
    const distPlan2 = dS_P2 + dP1_P2 + dP1_D;

    const isShop1First = distPlan1 <= distPlan2;
    const bestTotalDist = isShop1First ? distPlan1 : distPlan2;
    const worstTotalDist = isShop1First ? distPlan2 : distPlan1;
    const savedKm = Math.max(0, worstTotalDist - bestTotalDist);

    const firstStop = isShop1First
      ? { id: 1, name: shop1Name, lat: pickupLat, lng: pickupLng, addr: pickup1Address, done: pickup1Completed }
      : { id: 2, name: shop2Name, lat: pickup2Lat, lng: pickup2Lng, addr: pickup2Address, done: pickup2Completed };

    const secondStop = isShop1First
      ? { id: 2, name: shop2Name, lat: pickup2Lat, lng: pickup2Lng, addr: pickup2Address, done: pickup2Completed }
      : { id: 1, name: shop1Name, lat: pickupLat, lng: pickupLng, addr: pickup1Address, done: pickup1Completed };

    return {
      isMultiShop: true,
      optimalOrder: isShop1First ? 'SHOP1_FIRST' : 'SHOP2_FIRST',
      firstStop,
      secondStop,
      totalKm: bestTotalDist,
      savedKm: savedKm,
      plan1Km: distPlan1,
      plan2Km: distPlan2,
      isShop1First,
    };
  }, [isMultiShop, shipperCoords, pickupLat, pickupLng, pickup2Lat, pickup2Lng, deliveryLat, deliveryLng, shop1Name, shop2Name, pickup1Address, pickup2Address, pickup1Completed, pickup2Completed, resolvedShopName, delivery?.status]);

  // Refresh latest status on mount
  useEffect(() => {
    if (initialDelivery?.id) {
      updateDeliveryInSession(initialDelivery.id).catch(() => {});
      apiClient.get(`/tracking/deliveries/${initialDelivery.id}`)
        .then(async (fresh) => {
          if (fresh && fresh.id) {
            let shopName = fresh.shopName;
            if (!shopName || shopName === 'Nhà hàng đối tác' || shopName.startsWith('Shop #')) {
              if (fresh.shopId) {
                try {
                  const sRes = await apiClient.get(`/core/shops/${fresh.shopId}`);
                  const sData = sRes?.data || sRes;
                  if (sData?.shopName) shopName = sData.shopName;
                } catch (_) {}
              }
              if (!shopName && fresh.pickupAddress) {
                const parts = fresh.pickupAddress.split(' - ');
                if (parts.length > 0 && parts[0].trim()) shopName = parts[0].trim();
              }
            }
            setDelivery(prev => ({
              ...prev,
              ...fresh,
              shopName: shopName || prev?.shopName || fresh?.shopName,
              customerName: prev?.customerName || fresh?.customerName,
            }));
          }
        })
        .catch(() => {});
    }
  }, [initialDelivery?.id]);

  // Đồng bộ vị trí GPS Shipper sang Iframe Web Map khi có cập nhật toạ độ
  useEffect(() => {
    if (Platform.OS === 'web' && iframeRef.current?.contentWindow && shipperCoords?.latitude && shipperCoords?.longitude) {
      try {
        iframeRef.current.contentWindow.postMessage({
          type: 'UPDATE_LOCATION',
          lat: shipperCoords.latitude,
          lng: shipperCoords.longitude,
        }, '*');
      } catch (e) {}
    }
  }, [shipperCoords?.latitude, shipperCoords?.longitude]);

  // Lắng nghe sự kiện iframe sẵn sàng để đẩy toạ độ ban đầu sang Web Map
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleWindowMsg = (event) => {
      if (event.data?.type === 'IFRAME_READY' && iframeRef.current?.contentWindow) {
        if (shipperCoords?.latitude && shipperCoords?.longitude) {
          try {
            iframeRef.current.contentWindow.postMessage({
              type: 'UPDATE_LOCATION',
              lat: shipperCoords.latitude,
              lng: shipperCoords.longitude,
            }, '*');
          } catch (e) {}
        }
      }

      // Cho phép người dùng nhấp trực tiếp lên bản đồ để đặt vị trí xuất phát Shipper
      if (event.data?.type === 'MAP_CLICK_LOCATION' && event.data.lat && event.data.lng) {
        const newCoords = { latitude: event.data.lat, longitude: event.data.lng };
        initialShipperCoordsRef.current = newCoords;
        setShipperCoords(newCoords);
        sendLocationToServer(newCoords.latitude, newCoords.longitude);
        fetchRoutes(newCoords.latitude, newCoords.longitude);
      }
    };
    window.addEventListener('message', handleWindowMsg);
    return () => window.removeEventListener('message', handleWindowMsg);
  }, [shipperCoords]);

  // Re-fetch routes when delivery coordinates change/load
  useEffect(() => {
    if (shipperCoords?.latitude && shipperCoords?.longitude && delivery?.deliveryLat && delivery?.deliveryLng) {
      fetchRoutes(shipperCoords.latitude, shipperCoords.longitude);
    }
  }, [delivery?.deliveryLat, delivery?.deliveryLng]);

  const sendLocationToServer = (lat, lng) => {
    const sId = shipperRef.current?.id || shipper?.id;
    if (!sId) return;
    apiClient.patch(`/tracking/shippers/${sId}/location`, { lat: lat, lng: lng })
      .catch(() => {});
  };

  const fetchVietmapRoute = async (fromLat, fromLng, toLat, toLng) => {
    if (!fromLat || !fromLng || !toLat || !toLng) return null;
    const key = `${Number(fromLat).toFixed(4)}_${Number(fromLng).toFixed(4)}_${Number(toLat).toFixed(4)}_${Number(toLng).toFixed(4)}`;
    if (shipperRouteCache.has(key)) {
      return shipperRouteCache.get(key);
    }

    // 1. Thử VietMap API
    try {
      const url = `https://maps.vietmap.vn/api/route?api-version=1.1&apikey=${VIETMAP_API_KEY}&point=${fromLat},${fromLng}&point=${toLat},${toLng}&vehicle=motorcycle&points_encoded=false`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.code === 'OK' && data.paths && data.paths.length > 0) {
          const routes = data.paths.map(p => ({
            distance: p.distance / 1000,
            duration: p.time / 1000 / 60,
            coordinates: (p.points?.coordinates || []).map(c => ({ latitude: c[1], longitude: c[0] })),
          }));
          shipperRouteCache.set(key, routes);
          return routes;
        }
      }
    } catch (e) {
      console.warn('Vietmap route error:', e);
    }

    // 2. Dự phòng chất lượng cao OSRM khi VietMap gặp lỗi hoặc HTTP 429
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
      const oRes = await fetch(osrmUrl);
      if (oRes.ok) {
        const oData = await oRes.json();
        if (oData && oData.routes && oData.routes.length > 0 && oData.routes[0].geometry?.coordinates) {
          const oRoutes = [{
            distance: (oData.routes[0].distance || 1000) / 1000,
            duration: (oData.routes[0].duration || 120) / 60,
            coordinates: oData.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] })),
          }];
          shipperRouteCache.set(key, oRoutes);
          return oRoutes;
        }
      }
    } catch (e) {
      console.warn('OSRM fallback error:', e);
    }

    // 3. Dự phòng toạ độ nội suy để tuyến màu không bao giờ bị biến mất
    const fbRoutes = generateFallbackRoute(fromLat, fromLng, toLat, toLng);
    shipperRouteCache.set(key, fbRoutes);
    return fbRoutes;
  };

  const fetchRoutes = async (shipLat, shipLng) => {
    if (!shipLat || !shipLng) return;

    // Giới hạn tần suất gọi VietMap (Tối thiểu cách nhau 3.5s hoặc di chuyển > 50m) để không bị 429 Too Many Requests
    const now = Date.now();
    const last = lastShipperFetchRef.current;
    if (last) {
      const dist = calcDistance(shipLat, shipLng, last.lat, last.lng);
      if (now - last.time < 3500 && dist < 0.05) {
        return;
      }
    }
    lastShipperFetchRef.current = { lat: shipLat, lng: shipLng, time: now };

    if (!isMultiShop) {
      // Đơn 1 quán: Shipper -> Shop -> Customer
      fetchVietmapRoute(shipLat, shipLng, pickupLat, pickupLng).then(routes => {
        if (routes && routes.length > 0) {
          setRoutesToShop(routes);
          if (deliveryRef.current?.status === 'ASSIGNED' || deliveryRef.current?.status === 'GOING_PICKUP') {
            setDistKm(routes[0].distance);
            setEtaText(formatETA(routes[0].distance));
          }
        }
      });

      fetchVietmapRoute(pickupLat, pickupLng, deliveryLat, deliveryLng).then(routes => {
        if (routes && routes.length > 0) {
          setRoutesToCustomer(routes);
          if (deliveryRef.current?.status === 'PICKED_UP') {
            setDistKm(routes[0].distance);
            setEtaText(formatETA(routes[0].distance));
          }

          setTimeout(() => {
            const isCustTarget = deliveryRef.current?.status === 'PICKED_UP';
            const allCoords = isCustTarget
              ? [{ latitude: shipLat, longitude: shipLng }, { latitude: deliveryLat, longitude: deliveryLng }]
              : [{ latitude: shipLat, longitude: shipLng }, { latitude: pickupLat, longitude: pickupLng }, { latitude: deliveryLat, longitude: deliveryLng }];

            mapRef.current?.fitToCoordinates(allCoords, {
              edgePadding: { top: 80, right: 50, bottom: 260, left: 50 },
              animated: true,
            });
          }, 500);
        }
      });
      return;
    }

    // ĐƠN GHÉP 2 QUÁN (ĐIỀU HƯỚNG 3 CHẶNG TỐI ƯU TSP):
    if (!optimalRoutePlan?.firstStop || !optimalRoutePlan?.secondStop) return;

    // Đồng bộ thứ tự TSP lên Tracking Service backend để Web & App khách hàng đồng bộ tức thì
    if (deliveryRef.current?.id) {
      apiClient.post(`/tracking/deliveries/${deliveryRef.current.id}/optimize-route?shipperLat=${shipLat}&shipperLng=${shipLng}`)
        .then(res => {
          if (res?.optimalPickupOrder) {
            setDelivery(prev => ({ ...prev, optimalPickupOrder: res.optimalPickupOrder }));
          }
        })
        .catch(() => {});
    }

    const firstLat = optimalRoutePlan.firstStop.lat;
    const firstLng = optimalRoutePlan.firstStop.lng;
    const secondLat = optimalRoutePlan.secondStop.lat;
    const secondLng = optimalRoutePlan.secondStop.lng;

    // Chặng 1: Shipper -> Điểm lấy 1 (tối ưu ngắn nhất)
    fetchVietmapRoute(shipLat, shipLng, firstLat, firstLng).then(routes => {
      if (routes && routes.length > 0) {
        setRoutesToShop(routes);
        if (!optimalRoutePlan?.firstStop?.done) {
          setDistKm(routes[0].distance);
          setEtaText(formatETA(routes[0].distance));
        }
      }
    });

    // Chặng 2: Điểm lấy 1 -> Điểm lấy 2
    fetchVietmapRoute(firstLat, firstLng, secondLat, secondLng).then(routes => {
      if (routes && routes.length > 0) {
        setRoutesBetweenShops(routes);
        if (optimalRoutePlan?.firstStop?.done && !optimalRoutePlan?.secondStop?.done) {
          setDistKm(routes[0].distance);
          setEtaText(formatETA(routes[0].distance));
        }
      }
    });

    // Chặng 3: Điểm lấy 2 -> Khách hàng
    fetchVietmapRoute(secondLat, secondLng, deliveryLat, deliveryLng).then(routes => {
      if (routes && routes.length > 0) {
        setRoutesToCustomer(routes);
        if (optimalRoutePlan?.firstStop?.done && optimalRoutePlan?.secondStop?.done) {
          setDistKm(routes[0].distance);
          setEtaText(formatETA(routes[0].distance));
        }

        setTimeout(() => {
          const allCoords = [
            { latitude: shipLat, longitude: shipLng },
            { latitude: pickupLat, longitude: pickupLng },
            { latitude: pickup2Lat, longitude: pickup2Lng },
            { latitude: deliveryLat, longitude: deliveryLng },
          ];
          mapRef.current?.fitToCoordinates(allCoords, {
            edgePadding: { top: 80, right: 50, bottom: 260, left: 50 },
            animated: true,
          });
        }, 500);
      }
    });
  };

  // Hàm kích hoạt yêu cầu lấy GPS trực tiếp từ trình duyệt / thiết bị
  const requestLiveGps = useCallback((isManual = false) => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos?.coords?.latitude && pos?.coords?.longitude) {
            const newCoords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setGpsPermissionDenied(false);
            initialShipperCoordsRef.current = newCoords;
            setShipperCoords(newCoords);
            sendLocationToServer(newCoords.latitude, newCoords.longitude);
            fetchRoutes(newCoords.latitude, newCoords.longitude);
            if (iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage({
                type: 'UPDATE_LOCATION',
                lat: newCoords.latitude,
                lng: newCoords.longitude,
                heading: 0,
                name: shipper?.fullName || 'Bạn',
              }, '*');
              iframeRef.current.contentWindow.postMessage({ type: 'RECENTER' }, '*');
            }
            if (isManual) {
              Alert.alert('📍 Định vị thành công', `Đã lấy đúng toạ độ GPS thực tế của bạn:\n(${newCoords.latitude.toFixed(6)}, ${newCoords.longitude.toFixed(6)})`);
            }
          }
        },
        (err) => {
          console.warn('[GPS] Error:', err);
          if (err?.code === 1) { // PERMISSION_DENIED
            setGpsPermissionDenied(true);
            if (isManual) {
              Alert.alert(
                '📍 Quyền vị trí bị từ chối',
                'Trình duyệt Chrome đang chặn quyền vị trí cho http://localhost:8092.\n\nVui lòng bấm vào biểu tượng 📍 bị gạch chéo ở bên phải thanh URL -> Chọn "Luôn cho phép" (Always allow) -> Tải lại trang hoặc bấm Thử lại.'
              );
            }
          } else if (isManual) {
            Alert.alert('Không thể lấy GPS', err?.message || 'Lỗi thiết bị định vị');
          }
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else if (Platform.OS !== 'web') {
      Location.requestForegroundPermissionsAsync().then(({ status }) => {
        if (status === 'granted') {
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).then((pos) => {
            if (pos?.coords) {
              const newCoords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
              initialShipperCoordsRef.current = newCoords;
              setShipperCoords(newCoords);
              sendLocationToServer(newCoords.latitude, newCoords.longitude);
              fetchRoutes(newCoords.latitude, newCoords.longitude);
            }
          });
        }
      });
    }
  }, [shipper?.fullName]);

  // GPS + WATCH (Có kiểm tra isDemoModeRef để không kéo giật xe khi đang mô phỏng)
  useEffect(() => {
    let sub = null;
    (async () => {
      const currShipper = shipperRef.current;
      let shipCoords = null;

      // 1. Kiểm tra trạng thái quyền vị trí trên trình duyệt
      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        try {
          const perm = await navigator.permissions.query({ name: 'geolocation' });
          if (perm.state === 'denied') {
            setGpsPermissionDenied(true);
          }
          perm.onchange = () => {
            if (perm.state === 'granted') {
              setGpsPermissionDenied(false);
              requestLiveGps(false);
            } else if (perm.state === 'denied') {
              setGpsPermissionDenied(true);
            }
          };
        } catch (_) {}
      }

      // 2. Ưu tiên số 1: Lấy toạ độ GPS thực tế từ Trình duyệt (Web) hoặc Thiết bị (Native)
      let realDeviceLocation = null;
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          realDeviceLocation = await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setGpsPermissionDenied(false);
                if (pos?.coords?.latitude && pos?.coords?.longitude) {
                  resolve({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                  });
                } else {
                  resolve(null);
                }
              },
              (err) => {
                console.warn('[GPS] Lỗi/từ chối vị trí trình duyệt:', err?.message);
                if (err?.code === 1) {
                  setGpsPermissionDenied(true);
                }
                resolve(null);
              },
              { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
            );
          });
        } catch (_) {}
      }

      if (!realDeviceLocation && Platform.OS !== 'web') {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            if (initial?.coords?.latitude && initial?.coords?.longitude) {
              realDeviceLocation = {
                latitude: initial.coords.latitude,
                longitude: initial.coords.longitude,
              };
            }
          }
        } catch (_) {}
      }

      if (realDeviceLocation) {
        shipCoords = realDeviceLocation;
        console.log('[GPS] Đã định vị thành công vị trí hiện tại của bạn:', shipCoords);
      }

      // 3. Nếu chưa lấy được GPS từ thiết bị, lấy vị trí đã lưu trên Backend
      if (!shipCoords && currShipper?.id) {
        try {
          const locRes = await apiClient.get(`/tracking/shippers/${currShipper.id}/location`);
          const locData = locRes?.data || locRes;
          if (locData && locData.lat && locData.lng && Number(locData.lat) !== 0) {
            shipCoords = {
              latitude: Number(locData.lat),
              longitude: Number(locData.lng),
            };
          }
        } catch (_) {}
      }

      // 4. Nếu vẫn không có toạ độ (chưa có quyền GPS), đặt tạm tại Quán 1
      if (!shipCoords || !shipCoords.latitude) {
        shipCoords = {
          latitude: pickupLat,
          longitude: pickupLng,
        };
      }

      initialShipperCoordsRef.current = shipCoords;

      if (!isDemoModeRef.current) {
        setShipperCoords(shipCoords);
        sendLocationToServer(shipCoords.latitude, shipCoords.longitude);
        fetchRoutes(shipCoords.latitude, shipCoords.longitude);
      }

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 8000, distanceInterval: 15 },
        (newLoc) => {
          // NẾU ĐANG TRONG CHẾ ĐỘ DEMO hoặc Web test -> BỎ QUA ĐỂ KHÔNG BỊ RESET VỀ NHÀ
          if (isDemoModeRef.current || Platform.OS === 'web') return;

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

    // 1. Xác định giai đoạn giao hàng hiện tại:
    // Stage 1: Đi đến quán 1 (hoặc quán duy nhất)
    // Stage 2: Đi đến quán 2 (nếu là đơn ghép 2 quán và quán 1 đã lấy xong)
    // Stage 3: Đi đến khách hàng
    let currentStage = 'TO_SHOP_1';
    if (isMultiShop) {
      if (!optimalRoutePlan?.firstStop?.done) {
        currentStage = 'TO_SHOP_1';
      } else if (!optimalRoutePlan?.secondStop?.done) {
        currentStage = 'TO_SHOP_2';
      } else {
        currentStage = 'TO_CUSTOMER';
      }
    } else {
      currentStage = (currentStatus === 'PICKED_UP' || currentStatus === 'DELIVERING') ? 'TO_CUSTOMER' : 'TO_SHOP_1';
    }

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

    let currentRoute = null;
    let targetCoord = null;
    let targetLabel = '';

    if (currentStage === 'TO_SHOP_1') {
      currentRoute = routesToShop[selectedRouteShopIdx]?.coordinates;
      const targetStop = isMultiShop ? optimalRoutePlan?.firstStop : { lat: pickupLat, lng: pickupLng, name: resolvedShopName };
      targetCoord = { latitude: targetStop?.lat || pickupLat, longitude: targetStop?.lng || pickupLng };
      targetLabel = targetStop?.name || 'Quán 1';
      if (!currentRoute || currentRoute.length === 0) {
        const start = shipperCoords || { latitude: (targetCoord.latitude || pickupLat) + 0.010, longitude: (targetCoord.longitude || pickupLng) - 0.010 };
        currentRoute = generateFallbackRoute(start.latitude, start.longitude, targetCoord.latitude, targetCoord.longitude)[0].coordinates;
      }
    } else if (currentStage === 'TO_SHOP_2') {
      currentRoute = routesBetweenShops[0]?.coordinates;
      const targetStop = optimalRoutePlan?.secondStop;
      if (!targetStop) return;
      targetCoord = { latitude: targetStop.lat, longitude: targetStop.lng };
      targetLabel = targetStop.name || 'Quán 2';
      if (!currentRoute || currentRoute.length === 0) {
        const start = shipperCoords || { latitude: optimalRoutePlan?.firstStop?.lat || pickupLat, longitude: optimalRoutePlan?.firstStop?.lng || pickupLng };
        currentRoute = generateFallbackRoute(start.latitude, start.longitude, targetCoord.latitude, targetCoord.longitude)[0].coordinates;
      }
    } else {
      currentRoute = routesToCustomer[selectedRouteCustIdx]?.coordinates;
      targetCoord = { latitude: deliveryLat, longitude: deliveryLng };
      targetLabel = delivery?.customerName || 'Khách hàng';
      if (!currentRoute || currentRoute.length === 0) {
        const start = shipperCoords || (isMultiShop && optimalRoutePlan?.secondStop ? { latitude: optimalRoutePlan.secondStop.lat, longitude: optimalRoutePlan.secondStop.lng } : { latitude: pickupLat, longitude: pickupLng });
        currentRoute = generateFallbackRoute(start.latitude, start.longitude, targetCoord.latitude, targetCoord.longitude)[0].coordinates;
      }
    }

    setIsDemoRunning(true);
    let step = 0;

    // Tìm điểm xuất phát gần nhất trên tuyến đường
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
      try {
        // === KHI ĐẾN ĐÍCH CHẶNG HIỆN TẠI ===
        if (step >= currentRoute.length) {
          if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
          setIsDemoRunning(false);
          isDemoModeRef.current = true;
          setShipperCoords(targetCoord);
          sendLocationToServer(targetCoord.latitude, targetCoord.longitude);

          if (currentStage === 'TO_SHOP_1') {
            if (isMultiShop) {
              const stop1Id = optimalRoutePlan?.firstStop?.id || 1;
              try {
                await apiClient.post(`/tracking/deliveries/${currDelivery.id}/confirm-pickup-shop/${stop1Id}?shipperId=${currShipper?.id}`);
              } catch (e) {}

              setDelivery(prev => ({
                ...prev,
                pickup1Completed: stop1Id === 1 ? true : prev?.pickup1Completed,
                pickup2Completed: stop1Id === 2 ? true : prev?.pickup2Completed,
              }));

              if (routesBetweenShops.length > 0) {
                setDistKm(routesBetweenShops[0].distance);
                setEtaText(formatETA(routesBetweenShops[0].distance));
              }

              Alert.alert(
                `🛵 Đã đến & lấy món tại Quán 1!`,
                `Bạn đã nhận đủ phần món tại "${optimalRoutePlan?.firstStop?.name || 'Quán 1'}". Nhấn nút "Demo → 2. ${optimalRoutePlan?.secondStop?.name || 'Quán 2'}" để tiếp tục chạy sang quán thứ 2!`,
                [{ text: 'Lấy quán 2' }]
              );
            } else {
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
                setDelivery(prev => ({ ...prev, status: 'PICKED_UP' }));
              }

              if (routesToCustomer.length > 0) {
                setDistKm(routesToCustomer[0].distance);
                setEtaText(formatETA(routesToCustomer[0].distance));
              }

              Alert.alert(
                '🛵 Đã lấy hàng thành công!',
                'Bạn đã nhận món từ quán. Nhấn nút "Demo → Khách" bên dưới để tiếp tục giao hàng.',
                [{ text: 'Đã hiểu' }]
              );
            }
          } else if (currentStage === 'TO_SHOP_2') {
            const stop2Id = optimalRoutePlan?.secondStop?.id || 2;
            try {
              await apiClient.post(`/tracking/deliveries/${currDelivery.id}/confirm-pickup-shop/${stop2Id}?shipperId=${currShipper?.id}`);
            } catch (e) {}

            setDelivery(prev => ({
              ...prev,
              pickup1Completed: true,
              pickup2Completed: true,
              status: 'PICKED_UP',
            }));

            if (routesToCustomer.length > 0) {
              setDistKm(routesToCustomer[0].distance);
              setEtaText(formatETA(routesToCustomer[0].distance));
            }

            Alert.alert(
              '📦 Đã gom đủ món cả 2 quán! 🎉',
              `Bạn đã hoàn tất lấy món tại cả 2 quán: "${optimalRoutePlan?.firstStop?.name || 'Quán 1'}" và "${optimalRoutePlan?.secondStop?.name || 'Quán 2'}". Nhấn nút "Demo → Khách" để bắt đầu đi giao cho khách!`,
              [{ text: 'Bắt đầu giao khách' }]
            );
          } else {
            setDistKm(0);
            setEtaText('Đã đến nơi');

            Alert.alert(
              '🎉 Đã đến điểm giao khách!',
              'Bạn đã đến nhà khách hàng. Nhấn nút "XÁC NHẬN GIAO THÀNH CÔNG" bên dưới để hoàn tất đơn và nhận tiền thu hộ COD.',
              [{ text: 'OK' }]
            );
          }
          return;
        }

        // === ĐANG TRÊN ĐƯỜNG ĐI ===
        const nextCoord = currentRoute[step];
        if (nextCoord && nextCoord.latitude && nextCoord.longitude) {
          setShipperCoords(nextCoord);
          
          if (step % 4 === 0) {
            sendLocationToServer(nextCoord.latitude, nextCoord.longitude);
          }

          if (step % 2 === 0) {
            const d = calcDistance(nextCoord.latitude, nextCoord.longitude, targetCoord.latitude, targetCoord.longitude);
            setDistKm(d);
            setEtaText(formatETA(d));
          }
        }

        // Tốc độ: chia tuyến thành ~45 bước
        step += Math.max(1, Math.floor(currentRoute.length / 45));
      } catch (err) {
        console.error('Error during demo interval:', err);
        if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
        setIsDemoRunning(false);
      }
    }, 300);
  };

  // ===== RESET DEMO STATUS (Phục vụ test lại từ đầu) =====
  const handleResetDemo = async () => {
    if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    setIsDemoRunning(false);
    isDemoModeRef.current = false;
    setActionLoading(true);

    const currDelivery = deliveryRef.current;
    const currShipper = shipperRef.current;

    try {
      // 1. Gọi backend tracking-service để reset delivery về ASSIGNED và huỷ các cờ lấy hàng
      const res = await apiClient.post(`/tracking/deliveries/${currDelivery?.id}/reset`);

      // 2. Đồng bộ sang order-service để reset trạng thái đơn sang ASSIGNED
      if (currDelivery?.orderId) {
        try {
          await apiClient.put(`/orders/${currDelivery.orderId}/status`, {
            status: 'ASSIGNED',
            actorType: 'SHIPPER'
          });
        } catch (_) {}
      }

      // 3. Khôi phục toạ độ xuất phát ban đầu của Shipper
      const startCoords = initialShipperCoordsRef.current || {
        latitude: 10.78033,
        longitude: 106.65691,
      };
      setShipperCoords(startCoords);
      sendLocationToServer(startCoords.latitude, startCoords.longitude);
      fetchRoutes(startCoords.latitude, startCoords.longitude);

      // 4. Cập nhật state delivery trên màn hình Shipper
      const resetDeliveryData = {
        ...currDelivery,
        ...(res || {}),
        status: 'ASSIGNED',
        pickup1Completed: false,
        pickup2Completed: false,
        goingPickupAt: null,
        pickedUpAt: null,
        deliveredAt: null,
        proofPhotoUrl: null,
        shopName: currDelivery?.shopName || res?.shopName,
        customerName: currDelivery?.customerName || res?.customerName,
      };
      setDelivery(resetDeliveryData);
      deliveryRef.current = resetDeliveryData;

      // 5. Gửi postMessage reset bản đồ Leaflet
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({
          type: 'RESET_MAP',
          lat: startCoords.latitude,
          lng: startCoords.longitude
        }, '*');
      }

      Alert.alert('✅ Đã Reset thành công', 'Trạng thái đơn hàng và vị trí shipper đã được đưa về ban đầu!');
    } catch (err) {
      console.warn('Reset error:', err);
      const startCoords = initialShipperCoordsRef.current || { latitude: 10.78033, longitude: 106.65691 };
      setShipperCoords(startCoords);
      sendLocationToServer(startCoords.latitude, startCoords.longitude);
      fetchRoutes(startCoords.latitude, startCoords.longitude);
      setDelivery(prev => ({
        ...prev,
        status: 'ASSIGNED',
        pickup1Completed: false,
        pickup2Completed: false,
        goingPickupAt: null,
        pickedUpAt: null,
        deliveredAt: null,
        proofPhotoUrl: null,
      }));
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({
          type: 'RESET_MAP',
          lat: startCoords.latitude,
          lng: startCoords.longitude
        }, '*');
      }
      Alert.alert('✅ Đã Reset', 'Đã đặt lại trạng thái ban đầu!');
    } finally {
      setActionLoading(false);
    }
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
      if (!isMultiShop) {
        // Đơn 1 quán thông thường
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

      // ĐƠN GHÉP 2 QUÁN: XÁC NHẬN TỪNG QUÁN THEO THỨ TỰ TỐI ƯU
      const nextStop = !optimalRoutePlan?.firstStop?.done ? optimalRoutePlan?.firstStop : optimalRoutePlan?.secondStop;
      const isLastShop = optimalRoutePlan?.firstStop?.done && !optimalRoutePlan?.secondStop?.done;

      if (!nextStop) return;

      Alert.alert(
        `Xác nhận lấy hàng tại ${nextStop.name}`,
        `Bạn đã nhận đủ món tại quán "${nextStop.name}"?`,
        [
          { text: 'Huỷ', style: 'cancel' },
          {
            text: 'Đã nhận món',
            onPress: async () => {
              setActionLoading(true);
              try {
                const res = await apiClient.post(`/tracking/deliveries/${currDelivery.id}/confirm-pickup-shop/${nextStop.id}?shipperId=${currShipper?.id}`);
                setDelivery(prev => ({
                  ...prev,
                  ...(res || {}),
                  pickup1Completed: res?.pickup1Completed ?? (nextStop.id === 1 ? true : prev?.pickup1Completed),
                  pickup2Completed: res?.pickup2Completed ?? (nextStop.id === 2 ? true : prev?.pickup2Completed),
                  status: res?.status || prev?.status,
                }));

                if (!isLastShop) {
                  Alert.alert(
                    '📦 Đã lấy xong Quán 1!',
                    `Tiếp tục di chuyển đến ${optimalRoutePlan?.secondStop?.name || 'Quán 2'} để lấy phần món còn lại theo lộ trình tối ưu!`,
                    [{ text: 'Tiếp tục' }]
                  );
                } else {
                  Alert.alert(
                    '📦 Đã gom đủ món cả 2 quán! 🎉',
                    'Bạn đã hoàn tất lấy hàng tại 2 quán. Bắt đầu di chuyển giao hàng đến khách!',
                    [{ text: 'Giao cho khách' }]
                  );
                }
              } catch (e) {
                Alert.alert('Lỗi', e?.response?.data?.message || 'Không thể xác nhận lấy hàng');
              } finally {
                setActionLoading(false);
              }
            }
          }
        ]
      );
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
            Alert.alert('🎉 Giao thành công!', 'Tiền ship và thưởng đơn ghép đã được ghi nhận vào ví!', [
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

  // Nút chuyển đổi nhanh đơn sang 2 Quán (Phục vụ Demo kiểm thử)
  const handleToggleMultiShopTest = async () => {
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/tracking/deliveries/${deliveryRef.current?.id}/convert-to-multi-shop`);
      setDelivery(prev => ({ ...prev, ...(res || {}) }));
      Alert.alert(
        '⚡ Đã chuyển sang Đơn Ghép 2 Quán!',
        `Hệ thống đã tự động tính toán lộ trình TSP ngắn nhất:\n• Quán 1: ${res?.shop1Name || 'Quán 1'}\n• Quán 2: ${res?.shop2Name || 'Quán 2'}\n• Đề xuất ghé: ${res?.optimalPickupOrder === 'SHOP2_FIRST' ? res?.shop2Name : res?.shop1Name} trước!`
      );
      if (shipperCoords) {
        fetchRoutes(shipperCoords.latitude, shipperCoords.longitude);
      }
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể chuyển đổi sang đơn 2 quán');
    } finally {
      setActionLoading(false);
    }
  };

  const openGoogleMaps = () => {
    const targetLat = delivery?.status === 'PICKED_UP' ? deliveryLat : pickupLat;
    const targetLng = delivery?.status === 'PICKED_UP' ? deliveryLng : pickupLng;
    Linking.openURL(`https://maps.google.com/?daddr=${targetLat},${targetLng}`);
  };

  const makeCall = (phone) => {
    if (!phone) {
      Alert.alert('Thông báo', 'Số điện thoại không khả dụng');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const recenterMap = () => {
    requestLiveGps(true);
  };

  const isShop1First = optimalRoutePlan?.isShop1First ?? true;
  const firstStopName = optimalRoutePlan?.firstStop?.name || 'Quán 1';
  const secondStopName = optimalRoutePlan?.secondStop?.name || 'Quán 2';
  const totalKmText = (optimalRoutePlan?.totalKm || 0).toFixed(1);

  // Leaflet Map Interactive dành cho môi trường Web trên Shipper
  const leafletSrcDoc = useMemo(() => {
    if (Platform.OS !== 'web') return '';

    const safeShop1Name = (shop1Name || 'Quán 1').replace(/'/g, "\\'");
    const safeShop2Name = (shop2Name || 'Quán 2').replace(/'/g, "\\'");
    const safeCustName = (delivery?.customerName || 'Khách hàng').replace(/'/g, "\\'");
    const safePickup1Addr = (pickup1Address || 'Địa chỉ quán 1').replace(/'/g, "\\'");
    const safePickup2Addr = (pickup2Address || 'Địa chỉ quán 2').replace(/'/g, "\\'");
    const safeDeliveryAddr = (delivery?.deliveryAddress || 'Địa chỉ khách hàng').replace(/'/g, "\\'");
    const safeShipperName = (shipper?.fullName || 'Tài xế').replace(/'/g, "\\'");
    const initialShipLat = shipperCoords?.latitude || initialShipperCoordsRef.current?.latitude || 10.78033;
    const initialShipLng = shipperCoords?.longitude || initialShipperCoordsRef.current?.longitude || 106.65691;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html { margin: 0; padding: 0; height: 100%; width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow: hidden; }
    #map { height: 100%; width: 100%; background: #e2e8f0; }
    .badge-overlay {
      position: absolute;
      top: 64px;
      left: 14px;
      right: 14px;
      z-index: 900;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(8px);
      padding: 8px 14px;
      border-radius: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      display: flex;
      flex-direction: column;
      gap: 4px;
      pointer-events: none;
    }
    .badge-top-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
    }
    .badge-dot {
      width: 10px;
      height: 10px;
      border-radius: 5px;
      background: #10b981;
      position: relative;
    }
    .badge-dot.pulse {
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      animation: pulse 1.6s infinite cubic-bezier(0.66, 0, 0, 1);
    }
    @keyframes pulse {
      to { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
    }
    .badge-route-summary {
      font-size: 11px;
      font-weight: 600;
      color: #475569;
    }
    .badge-route-highlight {
      color: #7c3aed;
      font-weight: 800;
    }
    .custom-tooltip {
      background: rgba(15, 23, 42, 0.90) !important;
      border: 1px solid rgba(255, 255, 255, 0.25) !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25) !important;
      padding: 4px 9px !important;
      pointer-events: none !important;
      color: #ffffff !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      white-space: nowrap !important;
    }
    .custom-tooltip::before {
      display: none !important;
    }
    .shop-tooltip {
      background: #1e3a8a !important;
      border-color: #60a5fa !important;
    }
    .shop2-tooltip {
      background: #581c87 !important;
      border-color: #c084fc !important;
    }
    .customer-tooltip {
      background: #7c2d12 !important;
      border-color: #fb923c !important;
    }
    .shipper-tooltip {
      background: #064e3b !important;
      border-color: #34d399 !important;
    }
  </style>
</head>
<body>
  <div class="badge-overlay">
    <div class="badge-top-row">
      <div id="badge-dot" class="badge-dot pulse"></div>
      <span id="badge-text">${isMultiShop ? '⚡ ĐƠN GHÉP 2 QUÁN - TỐI ƯU TSP' : 'GPS Shipper trực tuyến'}</span>
    </div>
    ${isMultiShop ? `
    <div class="badge-route-summary">
      🎯 Tuyến ngắn nhất: <span class="badge-route-highlight">${firstStopName} (1) ➔ ${secondStopName} (2) ➔ Khách</span> (${totalKmText} km)
    </div>
    ` : ''}
  </div>
  <div id="map"></div>

  <script>
    var isMultiShop = ${isMultiShop};
    var pickupLat = ${pickupLat};
    var pickupLng = ${pickupLng};
    var pickup2Lat = ${pickup2Lat};
    var pickup2Lng = ${pickup2Lng};
    var deliveryLat = ${deliveryLat};
    var deliveryLng = ${deliveryLng};
    var initialShipLat = ${initialShipLat};
    var initialShipLng = ${initialShipLng};
    var apiKey = '${VIETMAP_API_KEY}';
    var isShop1First = ${isShop1First};

    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([(pickupLat + deliveryLat) / 2, (pickupLng + deliveryLng) / 2], 13);
    
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 19,
    }).addTo(map);

    var storeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>';
    var customerSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
    var shipperSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>';

    function createShopIcon(bgColor, size, label, isMulti) {
      var badge = isMulti ? '<div style="position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:9px;background:#EF4444;color:white;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);">' + label + '</div>' : '';
      return L.divIcon({
        html: '<div style="position:relative;width:' + size + 'px;height:' + size + 'px;border-radius:' + (size/2) + 'px;background-color:' + bgColor + ';border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.35);display:flex;justify-content:center;align-items:center;color:white;">' + storeSvg + badge + '</div>',
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
      });
    }

    function createCustomIcon(bgColor, size, svgIcon) {
      return L.divIcon({
        html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:' + (size/2) + 'px;background-color:' + bgColor + ';border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.35);display:flex;justify-content:center;align-items:center;color:white;">' + svgIcon + '</div>',
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
      });
    }

    var customerIcon = createCustomIcon('#EA580C', 40, customerSvg);
    var shipperIcon = createCustomIcon('#10B981', 44, shipperSvg);

    var shop1Num = isShop1First ? '1' : '2';
    var shop1Icon = createShopIcon('#2563EB', 42, shop1Num, isMultiShop);
    var shop1Marker = L.marker([pickupLat, pickupLng], { icon: shop1Icon, zIndexOffset: 700 }).addTo(map);
    shop1Marker.bindTooltip('🏪 ' + '${safeShop1Name}' + (isMultiShop ? ' (Quán ' + shop1Num + ')' : ''), {
      permanent: true,
      direction: 'top',
      offset: [0, -22],
      className: 'custom-tooltip shop-tooltip'
    });
    shop1Marker.bindPopup('<b>Điểm lấy hàng ' + (isMultiShop ? ('#' + shop1Num) : '') + '</b><br/>' + '${safeShop1Name}' + '<br/><span style="font-size:11px;color:#64748b;">${safePickup1Addr}</span>');

    var shop2Marker = null;
    if (isMultiShop) {
      var shop2Num = isShop1First ? '2' : '1';
      var shop2Icon = createShopIcon('#7C3AED', 42, shop2Num, true);
      shop2Marker = L.marker([pickup2Lat, pickup2Lng], { icon: shop2Icon, zIndexOffset: 700 }).addTo(map);
      shop2Marker.bindTooltip('🏪 ' + '${safeShop2Name}' + ' (Quán ' + shop2Num + ')', {
        permanent: true,
        direction: 'top',
        offset: [0, -22],
        className: 'custom-tooltip shop2-tooltip'
      });
      shop2Marker.bindPopup('<b>Điểm lấy hàng #' + shop2Num + '</b><br/>' + '${safeShop2Name}' + '<br/><span style="font-size:11px;color:#64748b;">${safePickup2Addr}</span>');
    }

    var customerMarker = L.marker([deliveryLat, deliveryLng], { icon: customerIcon, zIndexOffset: 500 }).addTo(map);
    customerMarker.bindTooltip('📍 ' + '${safeCustName}' + ' (Khách)', {
      permanent: true,
      direction: 'top',
      offset: [0, -22],
      className: 'custom-tooltip customer-tooltip'
    });
    customerMarker.bindPopup('<b>Điểm giao hàng</b><br/>' + '${safeCustName}' + '<br/><span style="font-size:11px;color:#64748b;">${safeDeliveryAddr}</span>');

    var shipperMarker = L.marker([initialShipLat, initialShipLng], { icon: shipperIcon, zIndexOffset: 1000 }).addTo(map);
    shipperMarker.bindTooltip('🛵 ' + '${safeShipperName}' + ' (Bạn)', {
      permanent: true,
      direction: 'bottom',
      offset: [0, 24],
      className: 'custom-tooltip shipper-tooltip'
    });
    shipperMarker.bindPopup('<b>' + '${safeShipperName}' + '</b><br/>Đang trực tuyến');

    var routeLines = [];

    function fitAll() {
      var bounds = L.latLngBounds([]);
      bounds.extend([pickupLat, pickupLng]);
      if (isMultiShop) bounds.extend([pickup2Lat, pickup2Lng]);
      bounds.extend([deliveryLat, deliveryLng]);
      if (shipperMarker) bounds.extend(shipperMarker.getLatLng());
      routeLines.forEach(function(l) {
        if (l && l.getLatLngs().length > 0) bounds.extend(l.getBounds());
      });
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }

    var routeCache = {};

    function drawLeg(coords, color, lineIdx) {
      if (routeLines[lineIdx]) {
        routeLines[lineIdx].setLatLngs(coords);
      } else {
        routeLines[lineIdx] = L.polyline(coords, {
          color: color,
          weight: lineIdx === 0 ? 6 : 5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);
      }
      fitAll();
    }

    function fetchAndDrawLeg(fromLat, fromLng, toLat, toLng, color, lineIdx) {
      if (!fromLat || !fromLng || !toLat || !toLng) return;
      var cacheKey = Number(fromLat).toFixed(4) + '_' + Number(fromLng).toFixed(4) + '_' + Number(toLat).toFixed(4) + '_' + Number(toLng).toFixed(4);
      if (routeCache[cacheKey]) {
        drawLeg(routeCache[cacheKey], color, lineIdx);
        return;
      }

      function drawFallbackLine() {
        var fb = [];
        for (var i = 0; i <= 20; i++) {
          fb.push([fromLat + (toLat - fromLat) * (i / 20), fromLng + (toLng - fromLng) * (i / 20)]);
        }
        routeCache[cacheKey] = fb;
        drawLeg(fb, color, lineIdx);
      }

      var url = 'https://maps.vietmap.vn/api/route?api-version=1.1&apikey=' + apiKey + '&point=' + fromLat + ',' + fromLng + '&point=' + toLat + ',' + toLng + '&vehicle=motorcycle&points_encoded=false';
      fetch(url)
        .then(function(r) {
          if (!r.ok) return null;
          return r.json();
        })
        .then(function(data) {
          if (data && data.paths && data.paths.length > 0) {
            var coords = data.paths[0].points.coordinates.map(function(c) { return [c[1], c[0]]; });
            routeCache[cacheKey] = coords;
            drawLeg(coords, color, lineIdx);
            return;
          }
          throw new Error('Fallback OSRM');
        })
        .catch(function() {
          // Dự phòng OSRM khi VietMap gặp 429 hoặc lỗi mạng
          var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' + fromLng + ',' + fromLat + ';' + toLng + ',' + toLat + '?overview=full&geometries=geojson';
          fetch(osrmUrl)
            .then(function(r) { return r.json(); })
            .then(function(oData) {
              if (oData && oData.routes && oData.routes.length > 0 && oData.routes[0].geometry?.coordinates) {
                var osrmCoords = oData.routes[0].geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
                routeCache[cacheKey] = osrmCoords;
                drawLeg(osrmCoords, color, lineIdx);
              } else {
                drawFallbackLine();
              }
            })
            .catch(function() {
              drawFallbackLine();
            });
        });
    }

    if (!isMultiShop) {
      fetchAndDrawLeg(initialShipLat, initialShipLng, pickupLat, pickupLng, '#2563EB', 0);
      fetchAndDrawLeg(pickupLat, pickupLng, deliveryLat, deliveryLng, '#EA580C', 1);
    } else {
      // Đơn 2 shop: 3 chặng theo thứ tự tối ưu TSP
      var stop1Lat = isShop1First ? pickupLat : pickup2Lat;
      var stop1Lng = isShop1First ? pickupLng : pickup2Lng;
      var stop2Lat = isShop1First ? pickup2Lat : pickupLat;
      var stop2Lng = isShop1First ? pickup2Lng : pickupLng;

      // Leg 1: Shipper -> Stop 1 (Xanh dương)
      fetchAndDrawLeg(initialShipLat, initialShipLng, stop1Lat, stop1Lng, '#2563EB', 0);
      // Leg 2: Stop 1 -> Stop 2 (Tím)
      fetchAndDrawLeg(stop1Lat, stop1Lng, stop2Lat, stop2Lng, '#7C3AED', 1);
      // Leg 3: Stop 2 -> Customer (Cam)
      fetchAndDrawLeg(stop2Lat, stop2Lng, deliveryLat, deliveryLng, '#EA580C', 2);
    }

    // Cho phép nhấp vào bản đồ để chuyển toạ độ Shipper
    map.on('click', function(e) {
      if (shipperMarker) {
        shipperMarker.setLatLng(e.latlng);
      }
      var targetLat = isMultiShop ? stop1Lat : pickupLat;
      var targetLng = isMultiShop ? stop1Lng : pickupLng;
      fetchAndDrawLeg(e.latlng.lat, e.latlng.lng, targetLat, targetLng, '#2563EB', 0);
      try {
        window.parent.postMessage({
          type: 'MAP_CLICK_LOCATION',
          lat: e.latlng.lat,
          lng: e.latlng.lng
        }, '*');
      } catch(err) {}
    });

    window.addEventListener('message', function(event) {
      var msg = event.data;
      if (!msg) return;

      if (msg.type === 'UPDATE_LOCATION' && msg.lat && msg.lng) {
        if (shipperMarker) {
          shipperMarker.setLatLng([msg.lat, msg.lng]);
        }
        var targetLat = isMultiShop ? stop1Lat : pickupLat;
        var targetLng = isMultiShop ? stop1Lng : pickupLng;
        fetchAndDrawLeg(msg.lat, msg.lng, targetLat, targetLng, '#2563EB', 0);
      }

      if (msg.type === 'RECENTER') {
        if (shipperMarker) {
          map.setView(shipperMarker.getLatLng(), 15, { animate: true });
        }
      }

      if (msg.type === 'RESET_MAP') {
        if (shipperMarker && msg.lat && msg.lng) {
          shipperMarker.setLatLng([msg.lat, msg.lng]);
        }
        fitAll();
      }
    });

    setTimeout(function() {
      map.invalidateSize();
      fitAll();
      try {
        window.parent.postMessage({ type: 'IFRAME_READY' }, '*');
      } catch(e) {}
    }, 400);
  </script>
  <div style="position:absolute; bottom:14px; left:14px; z-index:999; background:rgba(255,255,255,0.95); backdrop-filter:blur(6px); padding:6px 12px; border-radius:8px; font-size:11px; font-weight:600; color:#1E293B; box-shadow:0 2px 8px rgba(0,0,0,0.12); border:1px solid #E2E8F0; pointer-events:none;">
    📍 Nhấp điểm bất kỳ trên bản đồ để di chuyển vị trí Shipper
  </div>
</body>
</html>
    `;
  }, [
    isMultiShop,
    shop1Name,
    shop2Name,
    pickup1Address,
    pickup2Address,
    delivery?.customerName,
    delivery?.deliveryAddress,
    shipper?.fullName,
    pickupLat,
    pickupLng,
    pickup2Lat,
    pickup2Lng,
    deliveryLat,
    deliveryLng,
    isShop1First,
    firstStopName,
    secondStopName
  ]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* ===== MAPVIEW HOẶC WEB LEAFLET MAP ===== */}
      {Platform.OS !== 'web' && MapView ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={mapRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
        >
          {/* Cửa hàng 1 */}
          <Marker coordinate={{ latitude: pickupLat, longitude: pickupLng }} title={shop1Name} zIndex={2}>
            <View style={styles.markerStore}>
              <Store color="#fff" size={18} />
              {isMultiShop && (
                <View style={styles.markerNumBadge}>
                  <Text style={styles.markerNumText}>{optimalRoutePlan.isShop1First ? '1' : '2'}</Text>
                </View>
              )}
            </View>
          </Marker>

          {/* Cửa hàng 2 (nếu là đơn ghép 2 quán) */}
          {isMultiShop && (
            <Marker coordinate={{ latitude: pickup2Lat, longitude: pickup2Lng }} title={shop2Name} zIndex={3}>
              <View style={[styles.markerStore, { backgroundColor: '#7C3AED' }]}>
                <Store color="#fff" size={18} />
                <View style={[styles.markerNumBadge, { backgroundColor: '#7C3AED' }]}>
                  <Text style={styles.markerNumText}>{optimalRoutePlan.isShop1First ? '2' : '1'}</Text>
                </View>
              </View>
            </Marker>
          )}

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

          {/* Tuyến Shipper -> Chặng 1 (Màu xanh dương) */}
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

          {/* Tuyến Chặng 1 -> Chặng 2 (Màu tím) nếu là đơn 2 shop */}
          {isMultiShop && routesBetweenShops.map((route, idx) => (
            <Polyline
              key={`between-${idx}`}
              coordinates={route.coordinates}
              strokeColor="#8B5CF6"
              strokeWidth={5}
              zIndex={8}
            />
          ))}

          {/* Tuyến Shop cuối -> Khách (Màu cam) */}
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
      ) : (
        <View style={styles.webMapContainer}>
          <iframe
            ref={iframeRef}
            key={`shipper-web-map-${delivery?.id || 'default'}`}
            title="shipper-tracking-map"
            width="100%"
            height="100%"
            style={{ border: 0, width: '100%', height: '100%', display: 'block' }}
            srcDoc={leafletSrcDoc}
          />
        </View>
      )}

      {/* Floating Top Navigation Buttons */}
      <SafeAreaView style={styles.floatingTop} pointerEvents="box-none">
        <TouchableOpacity style={styles.circleBtn3D} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <ArrowLeft size={19} color="#111827" strokeWidth={2.2} />
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {/* Nút Toggle Test Đơn Ghép 2 Quán */}
          <TouchableOpacity 
            style={[styles.circleBtn3D, isMultiShop && { backgroundColor: '#F3E8FF', borderColor: '#DDD6FE' }]} 
            onPress={handleToggleMultiShopTest}
            activeOpacity={0.85}
          >
            <Zap color={isMultiShop ? '#7C3AED' : '#64748B'} size={19} />
          </TouchableOpacity>

          {/* Nút Recenter GPS vị trí Shipper */}
          <TouchableOpacity 
            style={styles.circleBtn3D} 
            onPress={recenterMap}
            activeOpacity={0.85}
          >
            <Compass color="#2563EB" size={20} />
          </TouchableOpacity>

          {/* Nút Reset Demo */}
          <TouchableOpacity 
            style={[styles.circleBtn3D, { backgroundColor: '#FEE2E2' }]} 
            onPress={handleResetDemo}
            activeOpacity={0.85}
          >
            <RotateCcw color="#DC2626" size={19} />
          </TouchableOpacity>

          {/* Nút mở Google Maps */}
          <TouchableOpacity style={styles.circleBtn3D} onPress={openGoogleMaps} activeOpacity={0.85}>
            <Navigation color="#111827" size={19} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Banner cảnh báo quyền GPS bị chặn trên Trình duyệt */}
      {gpsPermissionDenied && (
        <View style={styles.gpsDeniedBanner}>
          <AlertCircle color="#DC2626" size={22} style={{ flexShrink: 0 }} />
          <View style={{ flex: 1, paddingRight: 6 }}>
            <Text style={styles.gpsDeniedTitle}>Trình duyệt đang chặn quyền Vị trí GPS</Text>
            <Text style={styles.gpsDeniedSub}>
              Bấm vào biểu tượng 📍 bị gạch chéo ở bên phải thanh URL của Chrome ➔ Chọn "Luôn cho phép" (Always allow) ➔ Bấm nút "Thử lại".
            </Text>
          </View>
          <TouchableOpacity style={styles.gpsRetryBtn} onPress={() => requestLiveGps(true)} activeOpacity={0.8}>
            <Text style={styles.gpsRetryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ETA Floating 3D Pill Card */}
      {(etaText || distKm) && (
        <View style={styles.etaCard3D}>
          <View style={styles.etaClockBadge}>
            <Clock size={14} color="#D97706" />
          </View>
          <View>
            <Text style={styles.etaTimeText}>{etaText}</Text>
            {distKm != null && <Text style={styles.etaDistText}>{distKm.toFixed(1)} km còn lại</Text>}
          </View>
        </View>
      )}

      {/* Floating Demo Pill Button */}
      {delivery?.status !== 'DELIVERED' && (
        <TouchableOpacity
          style={[
            styles.floatingDemoPill3D,
            {
              backgroundColor: isDemoRunning
                ? '#DC2626'
                : isMultiShop
                ? (!optimalRoutePlan?.firstStop?.done
                    ? '#2563EB'
                    : !optimalRoutePlan?.secondStop?.done
                    ? '#7C3AED'
                    : '#EA580C')
                : (delivery?.status === 'PICKED_UP' ? '#EA580C' : '#2563EB')
            }
          ]}
          onPress={startDemoMovement}
          activeOpacity={0.85}
        >
          <Bike size={16} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.floatingDemoPillText}>
            {isDemoRunning
              ? '⏹ Dừng Demo'
              : isMultiShop
              ? (!optimalRoutePlan?.firstStop?.done
                  ? `Demo → 1. ${optimalRoutePlan?.firstStop?.name || 'Quán 1'}`
                  : !optimalRoutePlan?.secondStop?.done
                  ? `Demo → 2. ${optimalRoutePlan?.secondStop?.name || 'Quán 2'}`
                  : `Demo → Khách: ${delivery?.customerName || 'Khách'}`)
              : (delivery?.status === 'PICKED_UP' ? 'Demo → Khách' : 'Demo → Quán')}
          </Text>
        </TouchableOpacity>
      )}

      {/* ===== BOTTOM SHEET 3D GRAB & BEFOOD DRIVER ===== */}
      <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
        {/* Drag Handle & Status Header */}
        <View style={styles.dragHandleArea} {...panResponder.panHandlers}>
          <View style={styles.dragHandle} />
          
          <View style={styles.sheetHeaderRow}>
            <View style={[styles.statusBadge, { backgroundColor: isGoingToShop ? '#EFF6FF' : (delivery?.status === 'DELIVERED' ? '#ECFDF5' : '#FFF7ED') }]}>
              <View style={[styles.statusDot, { backgroundColor: isGoingToShop ? '#2563EB' : (delivery?.status === 'DELIVERED' ? '#059669' : '#EA580C') }]} />
              <Text style={[styles.statusBadgeText, { color: isGoingToShop ? '#1D4ED8' : (delivery?.status === 'DELIVERED' ? '#059669' : '#EA580C') }]}>
                {delivery?.status === 'DELIVERED'
                  ? 'Giao hàng thành công'
                  : isGoingToShop
                  ? 'Đang đến lấy món tại quán'
                  : 'Đang giao đến khách hàng'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.orderIdText}>
                {delivery?.orderCode ? delivery.orderCode : `Mã: #${String(delivery?.orderId || '').slice(-6).toUpperCase()}`}
              </Text>
              
              <TouchableOpacity 
                style={styles.resetBadgeBtn} 
                onPress={handleResetDemo}
                activeOpacity={0.7}
              >
                <RotateCcw color="#DC2626" size={11} />
                <Text style={styles.resetBadgeText}>Reset</Text>
              </TouchableOpacity>

              <Animated.View style={{ transform: [{ rotate: isSheetExpanded ? '180deg' : '0deg' }] }}>
                <ChevronUp color="#94A3B8" size={20} />
              </Animated.View>
            </View>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 170 }}>
          {/* 3D Stepper Progress Timeline */}
          <View style={styles.stepperContainer}>
            {STATUS_FLOW.map((step, idx) => {
              const isPast = idx < currentStep;
              const isCurrent = idx === currentStep;
              const isDone = isPast || isCurrent;
              return (
                <View key={step.key} style={styles.stepperItem}>
                  <View style={styles.stepperCircleRow}>
                    {idx > 0 && (
                      <View style={[styles.stepperLineLeft, isPast && styles.stepperLineActive]} />
                    )}
                    <View style={[
                      styles.stepperCircle,
                      isDone && styles.stepperCircleDone,
                      isCurrent && styles.stepperCircleCurrent
                    ]}>
                      {isPast ? (
                        <Check size={12} color="#111827" strokeWidth={3} />
                      ) : (
                        <Text style={[styles.stepperNum, isDone && styles.stepperNumDone]}>{idx + 1}</Text>
                      )}
                    </View>
                    {idx < STATUS_FLOW.length - 1 && (
                      <View style={[styles.stepperLineRight, isPast && styles.stepperLineActive]} />
                    )}
                  </View>
                  <Text style={[styles.stepperLabel, isDone && styles.stepperLabelDone, isCurrent && styles.stepperLabelCurrent]}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* TSP Route Optimization Card (Hiển thị khi là đơn ghép 2 quán) */}
          {isMultiShop && (
            <View style={styles.tspOptimizeCard}>
              <View style={styles.tspHeaderRow}>
                <View style={styles.tspBadge}>
                  <Zap size={12} color="#7C3AED" />
                  <Text style={styles.tspBadgeText}>LỘ TRÌNH GHÉP 2 QUÁN TỐI ƯU (TSP)</Text>
                </View>
                {optimalRoutePlan.savedKm > 0 && (
                  <View style={styles.savedKmBadge}>
                    <Text style={styles.savedKmText}>⚡ Tiết kiệm ~{optimalRoutePlan.savedKm.toFixed(1)} km</Text>
                  </View>
                )}
              </View>

              <Text style={styles.tspSequenceText}>
                Thứ tự tối ưu: Bạn ➔ <Text style={{ color: '#2563EB', fontWeight: '800' }}>1. {optimalRoutePlan?.firstStop?.name || 'Quán 1'}</Text> ➔ <Text style={{ color: '#7C3AED', fontWeight: '800' }}>2. {optimalRoutePlan?.secondStop?.name || 'Quán 2'}</Text> ➔ <Text style={{ color: '#EA580C', fontWeight: '800' }}>3. Khách</Text>
              </Text>

              <View style={styles.tspStatusNotice}>
                <Text style={styles.tspStatusNoticeText}>
                  {!optimalRoutePlan?.firstStop?.done
                    ? `🛵 Đang đến điểm lấy #1: ${optimalRoutePlan?.firstStop?.name || 'Quán 1'}`
                    : !optimalRoutePlan?.secondStop?.done
                    ? `🛵 Đã xong điểm #1 ➔ Đang đến lấy điểm #2: ${optimalRoutePlan?.secondStop?.name || 'Quán 2'}`
                    : '🎉 Đã lấy đủ 2 quán ➔ Đang giao cho khách'}
                </Text>
              </View>
            </View>
          )}

          {/* 3D Journey Route Card */}
          <View style={styles.addressCard3D}>
            {!isMultiShop ? (
              <>
                {/* Lấy hàng tại Quán (Đơn 1 quán) */}
                <View style={styles.addressRow}>
                  <View style={[styles.iconWrap3D, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                    <Store color="#2563EB" size={16} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.addressRoleLabel}>Điểm lấy món</Text>
                    <Text style={styles.addressValueText}>{resolvedShopName}</Text>
                    <Text style={styles.addressSubText} numberOfLines={2}>{delivery?.pickupAddress || 'Địa chỉ quán'}</Text>
                  </View>
                  {/* Nút Gọi Quán */}
                  <TouchableOpacity
                    style={styles.callBtn3D}
                    onPress={() => makeCall(delivery?.shopPhone || '0901234567')}
                    activeOpacity={0.8}
                  >
                    <Phone size={13} color="#2563EB" />
                    <Text style={styles.callBtnText}>Gọi quán</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* Điểm lấy món #1 */}
                <View style={styles.addressRow}>
                  <View style={[styles.iconWrap3D, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', position: 'relative' }]}>
                    <Store color="#2563EB" size={16} />
                    <View style={styles.markerNumBadge}>
                      <Text style={styles.markerNumText}>1</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Text style={styles.addressRoleLabel}>Điểm lấy món #1</Text>
                      <View style={[styles.statusMiniBadge, optimalRoutePlan?.firstStop?.done ? styles.miniDone : styles.miniCurrent]}>
                        <Text style={[styles.statusMiniText, optimalRoutePlan?.firstStop?.done ? styles.miniDoneText : styles.miniCurrentText]}>
                          {optimalRoutePlan?.firstStop?.done ? '✓ Đã lấy' : 'Đang lấy'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.addressValueText}>{optimalRoutePlan?.firstStop?.name || 'Quán 1'}</Text>
                    <Text style={styles.addressSubText} numberOfLines={2}>{optimalRoutePlan?.firstStop?.addr || ''}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.callBtn3D}
                    onPress={() => makeCall(optimalRoutePlan?.firstStop?.id === 1 ? (delivery?.shopPhone || '0901234567') : '0909123456')}
                    activeOpacity={0.8}
                  >
                    <Phone size={13} color="#2563EB" />
                    <Text style={styles.callBtnText}>Gọi quán</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.connectorBox}>
                  <View style={styles.dotLineVertical} />
                </View>

                {/* Điểm lấy món #2 */}
                <View style={styles.addressRow}>
                  <View style={[styles.iconWrap3D, { backgroundColor: '#F3E8FF', borderColor: '#DDD6FE', position: 'relative' }]}>
                    <Store color="#7C3AED" size={16} />
                    <View style={[styles.markerNumBadge, { backgroundColor: '#7C3AED' }]}>
                      <Text style={styles.markerNumText}>2</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Text style={[styles.addressRoleLabel, { color: '#7C3AED' }]}>Điểm lấy món #2</Text>
                      <View style={[styles.statusMiniBadge, optimalRoutePlan?.secondStop?.done ? styles.miniDone : (optimalRoutePlan?.firstStop?.done ? styles.miniCurrent : styles.miniPending)]}>
                        <Text style={[styles.statusMiniText, optimalRoutePlan?.secondStop?.done ? styles.miniDoneText : (optimalRoutePlan?.firstStop?.done ? styles.miniCurrentText : styles.miniPendingText)]}>
                          {optimalRoutePlan?.secondStop?.done ? '✓ Đã lấy' : (optimalRoutePlan?.firstStop?.done ? 'Đang lấy' : 'Chờ lấy')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.addressValueText}>{optimalRoutePlan?.secondStop?.name || 'Quán 2'}</Text>
                    <Text style={styles.addressSubText} numberOfLines={2}>{optimalRoutePlan?.secondStop?.addr || ''}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.callBtn3D, { backgroundColor: '#F3E8FF', borderColor: '#DDD6FE' }]}
                    onPress={() => makeCall(optimalRoutePlan?.secondStop?.id === 2 ? '0909123456' : (delivery?.shopPhone || '0901234567'))}
                    activeOpacity={0.8}
                  >
                    <Phone size={13} color="#7C3AED" />
                    <Text style={[styles.callBtnText, { color: '#7C3AED' }]}>Gọi quán</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={styles.connectorBox}>
              <View style={styles.dotLineVertical} />
            </View>

            {/* Giao đến Khách */}
            <View style={styles.addressRow}>
              <View style={[styles.iconWrap3D, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
                <MapPin color="#EA580C" size={16} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.addressRoleLabel, { color: '#EA580C' }]}>Điểm giao đến</Text>
                <Text style={styles.addressValueText}>
                  {delivery?.customerName ? `${delivery.customerName}` : 'Khách hàng'}
                </Text>
                <Text style={styles.addressSubText} numberOfLines={2}>
                  {delivery?.deliveryAddress || 'Địa chỉ khách hàng'}
                </Text>
                {(delivery?.deliveryBuilding || delivery?.deliveryFloor) && (
                  <Text style={styles.buildingBadgeText}>
                    🏢 {delivery.deliveryBuilding ? `${delivery.deliveryBuilding} ` : ''}{delivery.deliveryFloor ? `(Tầng ${delivery.deliveryFloor})` : ''}
                  </Text>
                )}
              </View>
              {/* Nút Gọi Khách */}
              <TouchableOpacity
                style={[styles.callBtn3D, { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' }]}
                onPress={() => makeCall(delivery?.customerPhone || '0909888777')}
                activeOpacity={0.8}
              >
                <Phone size={15} color="#EA580C" />
                <Text style={[styles.callBtnText, { color: '#EA580C' }]}>Gọi khách</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 3D Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox3D}>
              <Text style={styles.statLabel}>Thu hộ COD</Text>
              <Text style={styles.statValueCod}>
                {delivery?.codAmount ? `${Number(delivery.codAmount).toLocaleString('vi-VN')}đ` : '0đ'}
              </Text>
            </View>
            <View style={styles.statBox3D}>
              <Text style={styles.statLabel}>Khoảng cách</Text>
              <Text style={styles.statValue}>{distKm ? `${distKm.toFixed(1)} km` : '--'}</Text>
            </View>
            <View style={styles.statBox3D}>
              <Text style={styles.statLabel}>Thời gian (ETA)</Text>
              <Text style={styles.statValue}>{etaText || '--'}</Text>
            </View>
          </View>
        </ScrollView>

        {/* ===== BOTTOM ACTION CONTROLS 3D ===== */}
        {delivery?.status !== 'DELIVERED' && delivery?.status !== 'CANCELLED' && (
          <View style={styles.actionWrap3D}>
            {isDemoRunning ? (
              <TouchableOpacity
                style={[styles.actionBtn3D, { backgroundColor: '#DC2626' }]}
                onPress={startDemoMovement}
                activeOpacity={0.85}
              >
                <Text style={styles.actionBtnText}>⏹ DỪNG CHẠY MÔ PHỎNG (DEMO)</Text>
              </TouchableOpacity>
            ) : (
              <>
                {/* 1. Trạng thái ASSIGNED */}
                {delivery?.status === 'ASSIGNED' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.actionBtn3D, { flex: 1, backgroundColor: '#2563EB' }]}
                      onPress={startDemoMovement}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.actionBtnText}>
                        {isMultiShop
                          ? `🛵 Đến Quán 1`
                          : '🛵 Chạy Demo'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn3D, { flex: 1.3, backgroundColor: '#111827' }]}
                      onPress={handleManualAction}
                      disabled={actionLoading}
                      activeOpacity={0.85}
                    >
                      {actionLoading ? <ActivityIndicator color="#FFB800" /> : <Text style={[styles.actionBtnText, { color: '#FFB800' }]}>ĐẾN QUÁN LẤY</Text>}
                    </TouchableOpacity>
                  </View>
                )}

                {/* 2. Trạng thái GOING_PICKUP */}
                {delivery?.status === 'GOING_PICKUP' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn3D,
                        {
                          flex: 1,
                          backgroundColor: isMultiShop && optimalRoutePlan.firstStop.done ? '#7C3AED' : '#2563EB'
                        }
                      ]}
                      onPress={startDemoMovement}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.actionBtnText}>
                        {isMultiShop
                          ? (!optimalRoutePlan.firstStop.done
                              ? `🛵 Đến Quán 1`
                              : `🛵 Đến Quán 2`)
                          : '🛵 Chạy Demo'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn3D, { flex: 1.3, backgroundColor: '#059669' }]}
                      onPress={handleManualAction}
                      disabled={actionLoading}
                      activeOpacity={0.85}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.actionBtnText}>
                          {isMultiShop
                            ? (!optimalRoutePlan.firstStop.done
                                ? `📦 ĐÃ LẤY ĐIỂM #1 (1/2)`
                                : `📦 ĐÃ LẤY ĐIỂM #2 (2/2)`)
                            : '📦 ĐÃ LẤY HÀNG'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* 3. Trạng thái PICKED_UP */}
                {delivery?.status === 'PICKED_UP' && (
                  <View style={{ gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.actionBtn3D, { backgroundColor: '#EA580C' }]}
                      onPress={startDemoMovement}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.actionBtnText}>🛵 CHẠY DEMO ĐẾN KHÁCH</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn3D, { backgroundColor: '#111827' }]}
                      onPress={handleManualAction}
                      disabled={actionLoading}
                      activeOpacity={0.85}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#FFB800" />
                      ) : (
                        <Text style={[styles.actionBtnText, { color: '#FFB800', fontSize: 15 }]}>
                          📸 XÁC NHẬN GIAO THÀNH CÔNG (CHỤP ẢNH)
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
          <View style={styles.actionWrap3D}>
            <TouchableOpacity
              style={[styles.actionBtn3D, { backgroundColor: '#059669' }]}
              onPress={() => navigation.popToTop()}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnText}>🎉 HOÀN TẤT - VỀ TRANG CHỦ</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  map: { position: 'absolute', width: '100%', height: '100%' },

  // Markers
  markerStore: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1D4ED8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  markerDest: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EA580C',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  markerShipper: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },

  // Floating Top Controls 3D
  floatingTop: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  circleBtn3D: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },

  // ETA Floating 3D Card
  etaCard3D: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  etaClockBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  etaTimeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  etaDistText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },

  // Floating Demo Pill 3D
  floatingDemoPill3D: {
    position: 'absolute',
    top: 135,
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  floatingDemoPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.65,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 24,
  },
  dragHandleArea: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  orderIdText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
  },
  resetBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
  },
  resetBadgeText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '800',
  },

  // Stepper Timeline
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  stepperItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepperCircleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 6,
  },
  stepperLineLeft: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
  },
  stepperLineRight: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
  },
  stepperLineActive: {
    backgroundColor: '#FFB800',
  },
  stepperCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  stepperCircleDone: {
    backgroundColor: '#FFB800',
    borderColor: '#D97706',
  },
  stepperCircleCurrent: {
    backgroundColor: '#FFB800',
    borderColor: '#111827',
    transform: [{ scale: 1.15 }],
  },
  stepperNum: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  stepperNumDone: {
    color: '#111827',
  },
  stepperLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    textAlign: 'center',
  },
  stepperLabelDone: {
    color: '#475569',
  },
  stepperLabelCurrent: {
    color: '#111827',
    fontWeight: '800',
  },

  // 3D Address Journey Card
  addressCard3D: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap3D: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  addressRoleLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  addressValueText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '700',
    lineHeight: 19,
    marginBottom: 2,
  },
  addressSubText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 16,
  },
  buildingBadgeText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '700',
    marginTop: 4,
  },
  callBtn3D: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'center',
  },
  callBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  connectorBox: {
    marginLeft: 17,
    height: 20,
    justifyContent: 'center',
    marginVertical: 4,
  },
  dotLineVertical: {
    width: 2,
    height: '100%',
    backgroundColor: '#E2E8F0',
  },

  // 3D Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  statBox3D: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 3,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  statValueCod: {
    fontSize: 14,
    color: '#EA580C',
    fontWeight: '700',
  },

  // 3D Action Wrap
  actionWrap3D: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 12,
  },
  actionBtn3D: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  webMapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#E2E8F0',
  },
  webMapFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 160,
  },
  webMapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  webMapTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  webMapDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  webRouteBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  webRouteText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },

  // Multi-shop & TSP Route Optimization UI
  markerNumBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1D4ED8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  markerNumText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tspOptimizeCard: {
    backgroundColor: '#FAF5FF',
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  tspHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tspBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },
  tspBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.4,
  },
  savedKmBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  savedKmText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  tspSequenceText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 8,
  },
  tspStatusNotice: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3E8FF',
  },
  tspStatusNoticeText: {
    fontSize: 11,
    color: '#6B21A8',
    fontWeight: '700',
  },
  statusMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusMiniText: {
    fontSize: 9,
    fontWeight: '800',
  },
  miniDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  miniDoneText: {
    color: '#059669',
  },
  miniCurrent: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  miniCurrentText: {
    color: '#2563EB',
  },
  miniPending: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  miniPendingText: {
    color: '#94A3B8',
  },
  gpsDeniedBanner: {
    position: 'absolute',
    top: 72,
    left: 16,
    right: 16,
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  gpsDeniedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 2,
  },
  gpsDeniedSub: {
    fontSize: 11,
    color: '#7F1D1D',
    lineHeight: 15,
  },
  gpsRetryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    alignSelf: 'center',
  },
  gpsRetryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

