import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { MapPin, Navigation, Store, Bike } from 'lucide-react-native';
import apiClient from '../api/apiClient';

let MapView, Marker, Polyline;
if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Polyline = Maps.Polyline;
  } catch (e) {
    console.warn('react-native-maps could not be loaded on this platform');
  }
}

const VIETMAP_API_KEY = '809bdd000025b62b0e9710b82e28f65f6178ee698cdb1845';

const customerRouteCache = new Map();

export default function TrackingMap({ orderId, orderStatus, deliveryAddress, shopName }) {
  const [deliveryData, setDeliveryData] = useState(null);
  const [shipperLocation, setShipperLocation] = useState(null);
  const [shipperName, setShipperName] = useState('');
  const [routeShopToCustomer, setRouteShopToCustomer] = useState([]);
  const [routeBetweenShops, setRouteBetweenShops] = useState([]);
  const [routeShipperToShop, setRouteShipperToShop] = useState([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef(null);
  const iframeRef = useRef(null);
  const lastCustomerRouteKey = useRef('');
  const lastBetweenRouteKey = useRef('');
  const lastShipperRouteKey = useRef('');
  const lastShipperFetchTimeRef = useRef(0);

  // Fallback coordinates (TP.HCM)
  const defaultPickup = { lat: 10.79292, lng: 106.71222 };
  const defaultDelivery = { lat: 10.80955, lng: 106.62624 };

  const pickup = {
    lat: deliveryData?.pickupLat || defaultPickup.lat,
    lng: deliveryData?.pickupLng || defaultPickup.lng,
  };

  const isMultiShop = Boolean(deliveryData?.isMultiShop || deliveryData?.pickup2Lat);
  const pickup2 = {
    lat: deliveryData?.pickup2Lat || null,
    lng: deliveryData?.pickup2Lng || null,
  };
  const shop1Name = deliveryData?.shop1Name || shopName || 'Quán 1';
  const shop2Name = deliveryData?.shop2Name || 'Quán 2';

  const delivery = {
    lat: deliveryData?.deliveryLat || (typeof deliveryAddress === 'object' ? deliveryAddress?.latitude : null) || defaultDelivery.lat,
    lng: deliveryData?.deliveryLng || (typeof deliveryAddress === 'object' ? deliveryAddress?.longitude : null) || defaultDelivery.lng,
  };

  // Thuật toán tối ưu quãng đường ngắn nhất TSP cho 2 quán (đồng bộ tuyệt đối với AppShipper và Web Customer)
  const isShop1First = useMemo(() => {
    if (!isMultiShop || !pickup2.lat || !pickup.lat) return true;
    if (deliveryData?.optimalPickupOrder === 'SHOP2_FIRST') return false;
    if (deliveryData?.optimalPickupOrder === 'SHOP1_FIRST') return true;

    const sLat = shipperLocation?.lat || 10.78033;
    const sLng = shipperLocation?.lng || 106.65691;
    const p1 = pickup;
    const p2 = pickup2;
    const d = delivery;

    const calcDist = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const dS_P1 = calcDist(sLat, sLng, p1.lat, p1.lng);
    const dS_P2 = calcDist(sLat, sLng, p2.lat, p2.lng);
    const dP1_P2 = calcDist(p1.lat, p1.lng, p2.lat, p2.lng);
    const dP1_D = calcDist(p1.lat, p1.lng, d.lat, d.lng);
    const dP2_D = calcDist(p2.lat, p2.lng, d.lat, d.lng);

    return (dS_P1 + dP1_P2 + dP2_D) <= (dS_P2 + dP1_P2 + dP1_D);
  }, [isMultiShop, deliveryData?.optimalPickupOrder, shipperLocation?.lat, shipperLocation?.lng, pickup.lat, pickup.lng, pickup2.lat, pickup2.lng, delivery.lat, delivery.lng]);

  const stop1 = useMemo(() => {
    return isShop1First
      ? { name: shop1Name, lat: pickup.lat, lng: pickup.lng, done: Boolean(deliveryData?.pickup1Completed), id: 1 }
      : { name: shop2Name, lat: pickup2.lat, lng: pickup2.lng, done: Boolean(deliveryData?.pickup2Completed), id: 2 };
  }, [isShop1First, shop1Name, shop2Name, pickup.lat, pickup.lng, pickup2.lat, pickup2.lng, deliveryData?.pickup1Completed, deliveryData?.pickup2Completed]);

  const stop2 = useMemo(() => {
    return isShop1First
      ? { name: shop2Name, lat: pickup2.lat, lng: pickup2.lng, done: Boolean(deliveryData?.pickup2Completed), id: 2 }
      : { name: shop1Name, lat: pickup.lat, lng: pickup.lng, done: Boolean(deliveryData?.pickup1Completed), id: 1 };
  }, [isShop1First, shop1Name, shop2Name, pickup.lat, pickup.lng, pickup2.lat, pickup2.lng, deliveryData?.pickup1Completed, deliveryData?.pickup2Completed]);

  // Helper fetch route từ VietMap có dự phòng OSRM chất lượng cao (chuẩn toạ độ [lat, lng])
  const fetchVietmapRoute = async (from, to) => {
    if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return null;
    const key = `${Number(from.lat).toFixed(4)}_${Number(from.lng).toFixed(4)}_${Number(to.lat).toFixed(4)}_${Number(to.lng).toFixed(4)}`;
    if (customerRouteCache.has(key)) {
      return customerRouteCache.get(key);
    }

    // 1. Thử gọi VietMap
    try {
      const url = `https://maps.vietmap.vn/api/route?api-version=1.1&apikey=${VIETMAP_API_KEY}&point=${from.lat},${from.lng}&point=${to.lat},${to.lng}&vehicle=motorcycle&points_encoded=false`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.paths && data.paths.length > 0) {
          const coords = data.paths[0].points.coordinates.map((c) => [c[1], c[0]]);
          customerRouteCache.set(key, coords);
          return coords;
        }
      }
    } catch (e) {
      console.warn('Vietmap route error:', e);
    }

    // 2. Dự phòng OSRM định tuyến đường phố thật khi VietMap bị lỗi hoặc HTTP 429
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      const oRes = await fetch(osrmUrl);
      if (oRes.ok) {
        const oData = await oRes.json();
        if (oData && oData.routes && oData.routes.length > 0 && oData.routes[0].geometry?.coordinates) {
          const coords = oData.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
          customerRouteCache.set(key, coords);
          return coords;
        }
      }
    } catch (e) {
      console.warn('OSRM route error:', e);
    }

    // 3. Dự phòng toạ độ nội suy để tuyến đường luôn luôn hiển thị màu đầy đủ
    const fallbackCoords = [];
    for (let i = 0; i <= 20; i++) {
      fallbackCoords.push([
        from.lat + (to.lat - from.lat) * (i / 20),
        from.lng + (to.lng - from.lng) * (i / 20)
      ]);
    }
    customerRouteCache.set(key, fallbackCoords);
    return fallbackCoords;
  };

  // 1. Fetch thông tin Delivery của đơn hàng & Polling real-time nhanh (1.5s)
  useEffect(() => {
    let intervalId;

    const fetchDeliveryInfo = async () => {
      try {
        const delRes = await apiClient.get(`/tracking/deliveries/order/${orderId}`);
        const del = delRes?.data || delRes;
        if (del && del.id) {
          setDeliveryData(del);

          if (del.shipper?.fullName) {
            setShipperName(del.shipper.fullName);
          }

          // Gửi thông báo shipperId sang iframe nếu có
          if (del.shipperId && iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
              type: 'SET_SHIPPER_ID',
              shipperId: del.shipperId,
              shipperName: del.shipper?.fullName || 'Tài xế',
            }, '*');
          }

          // Lấy toạ độ hiện tại của Shipper
          if (del.shipperId) {
            try {
              const locRes = await apiClient.get(`/tracking/shippers/${del.shipperId}/location`);
              const loc = locRes?.data || locRes;
              if (loc && loc.lat && loc.lng) {
                setShipperLocation({
                  lat: loc.lat,
                  lng: loc.lng,
                  heading: loc.headingDeg || 0,
                });

                // Cập nhật vị trí mượt mà sang iframe qua postMessage
                if (iframeRef.current?.contentWindow) {
                  iframeRef.current.contentWindow.postMessage({
                    type: 'UPDATE_LOCATION',
                    lat: loc.lat,
                    lng: loc.lng,
                    heading: loc.headingDeg || 0,
                    name: del.shipper?.fullName || 'Tài xế',
                  }, '*');
                }
              }
            } catch (_) {}
          }
        }
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };

    fetchDeliveryInfo();
    intervalId = setInterval(fetchDeliveryInfo, 1500); // Polling mỗi 1.5 giây

    return () => clearInterval(intervalId);
  }, [orderId]);

  // Tuyến Quán cuối -> Customer (Màu cam)
  useEffect(() => {
    const origin = (isMultiShop && stop2.lat) ? stop2 : pickup;
    if (!origin?.lat || !delivery.lat) return;
    const routeKey = `${origin.lat}_${origin.lng}_${delivery.lat}_${delivery.lng}`;
    if (lastCustomerRouteKey.current === routeKey) return;

    fetchVietmapRoute(origin, delivery).then((route1) => {
      if (route1 && route1.length > 0) {
        lastCustomerRouteKey.current = routeKey;
        setRouteShopToCustomer(route1);
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            type: 'SET_ROUTE_CUSTOMER',
            route: route1,
          }, '*');
        }
      }
    });
  }, [pickup.lat, pickup.lng, stop2.lat, stop2.lng, delivery.lat, delivery.lng, isMultiShop]);

  // Tuyến Stop 1 -> Stop 2 (Màu tím) nếu là đơn ghép 2 quán
  useEffect(() => {
    if (!isMultiShop || !stop1.lat || !stop2.lat) return;
    const key = `${stop1.lat}_${stop1.lng}_${stop2.lat}_${stop2.lng}`;
    if (lastBetweenRouteKey.current === key) return;

    fetchVietmapRoute(stop1, stop2).then((routeBetween) => {
      if (routeBetween && routeBetween.length > 0) {
        lastBetweenRouteKey.current = key;
        setRouteBetweenShops(routeBetween);
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            type: 'SET_ROUTE_BETWEEN',
            route: routeBetween,
          }, '*');
        }
      }
    });
  }, [isMultiShop, stop1.lat, stop1.lng, stop2.lat, stop2.lng]);

  // Tuyến Shipper xuất phát -> Điểm lấy món 1 (Màu xanh dương) - Đồng bộ 100% chuẩn y hệt AppShipper
  const initialShipperOriginRef = useRef(null);

  useEffect(() => {
    const target = isMultiShop ? stop1 : pickup;
    if (!target?.lat) return;

    if (shipperLocation?.lat && shipperLocation?.lng && !initialShipperOriginRef.current) {
      initialShipperOriginRef.current = { lat: shipperLocation.lat, lng: shipperLocation.lng };
    }

    const origin = initialShipperOriginRef.current || shipperLocation || { lat: 10.78033, lng: 106.65691 };

    fetchVietmapRoute(origin, target).then((route2) => {
      if (route2 && route2.length > 0) {
        setRouteShipperToShop(route2);
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            type: 'SET_ROUTE_SHOP',
            route: route2,
          }, '*');
        }
      }
    });
  }, [isMultiShop, stop1.lat, stop1.lng, pickup.lat, pickup.lng]);

  // Lắng nghe IFRAME_READY từ iframe để đồng bộ ngay khi iframe sẵn sàng
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleWindowMsg = (event) => {
      if (event.data?.type === 'IFRAME_READY' && iframeRef.current?.contentWindow) {
        const cw = iframeRef.current.contentWindow;
        if (deliveryData?.shipperId) {
          cw.postMessage({
            type: 'SET_SHIPPER_ID',
            shipperId: deliveryData.shipperId,
            shipperName: shipperName || 'Tài xế',
          }, '*');
        }
        if (routeShopToCustomer.length > 0) {
          cw.postMessage({ type: 'SET_ROUTE_CUSTOMER', route: routeShopToCustomer }, '*');
        }
        if (routeShipperToShop.length > 0) {
          cw.postMessage({ type: 'SET_ROUTE_SHOP', route: routeShipperToShop }, '*');
        }
        if (shipperLocation?.lat && shipperLocation?.lng) {
          cw.postMessage({
            type: 'UPDATE_LOCATION',
            lat: shipperLocation.lat,
            lng: shipperLocation.lng,
            name: shipperName || 'Tài xế',
          }, '*');
        }
      }
    };

    window.addEventListener('message', handleWindowMsg);
    return () => window.removeEventListener('message', handleWindowMsg);
  }, [deliveryData?.shipperId, shipperName, routeShopToCustomer, routeShipperToShop, shipperLocation]);

  // Auto-fit coordinates trên Mobile MapView
  useEffect(() => {
    if (mapRef.current && Platform.OS !== 'web') {
      const coords = [
        { latitude: pickup.lat, longitude: pickup.lng },
        { latitude: delivery.lat, longitude: delivery.lng },
      ];
      if (shipperLocation) {
        coords.push({ latitude: shipperLocation.lat, longitude: shipperLocation.lng });
      }
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }, 500);
    }
  }, [pickup.lat, delivery.lat, shipperLocation]);

  const hasShipper = !!deliveryData?.shipperId;

  // Leaflet HTML chuẩn dùng Google Maps tile và tích hợp STOMP WebSocket real-time
  const leafletSrcDoc = useMemo(() => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/stomp.js/2.3.3/stomp.min.js"></script>
  <style>
    body, html { margin: 0; padding: 0; height: 100%; width: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow: hidden; }
    #map { height: 100%; width: 100%; background: #e2e8f0; }
    .badge-overlay {
      position: absolute;
      top: 14px;
      left: 14px;
      right: 14px;
      z-index: 1000;
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
      color: #ffffff !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      white-space: nowrap !important;
    }
    .custom-tooltip::before { display: none !important; }
    .shop-tooltip { background: #1e3a8a !important; border-color: #60a5fa !important; }
    .shop2-tooltip { background: #581c87 !important; border-color: #c084fc !important; }
    .customer-tooltip { background: #7c2d12 !important; border-color: #fb923c !important; }
    .shipper-tooltip { background: #064e3b !important; border-color: #34d399 !important; }
  </style>
</head>
<body>
  <div class="badge-overlay">
    <div class="badge-top-row">
      <div id="badge-dot" class="badge-dot pulse"></div>
      <span id="badge-text">${isMultiShop ? '⚡ ĐƠN 2 QUÁN - TỐI ƯU LỘ TRÌNH' : (hasShipper ? (shipperName ? 'Tài xế: ' + shipperName : 'Shipper trực tuyến') : 'Đang tìm Shipper...')}</span>
    </div>
    ${isMultiShop ? `
    <div class="badge-route-summary">
      🎯 Tuyến lấy & giao: <span class="badge-route-highlight">${stop1.name} (1) ➔ ${stop2.name} (2) ➔ Bạn</span>
    </div>
    ` : ''}
  </div>
  <div id="map"></div>

  <script>
    var isMultiShop = ${isMultiShop ? 'true' : 'false'};
    var isShop1First = ${isShop1First ? 'true' : 'false'};
    var pickupLat = ${pickup.lat};
    var pickupLng = ${pickup.lng};
    var pickup2Lat = ${pickup2.lat || 'null'};
    var pickup2Lng = ${pickup2.lng || 'null'};
    var stop1Lat = ${stop1.lat};
    var stop1Lng = ${stop1.lng};
    var stop2Lat = ${stop2.lat || 'null'};
    var stop2Lng = ${stop2.lng || 'null'};
    var stop1Done = ${Boolean(stop1.done)};
    var stop2Done = ${Boolean(stop2.done)};
    var deliveryLat = ${delivery.lat};
    var deliveryLng = ${delivery.lng};
    var initialShipLat = ${shipperLocation?.lat || (pickup.lat + 0.008)};
    var initialShipLng = ${shipperLocation?.lng || (pickup.lng - 0.008)};
    var apiKey = '${VIETMAP_API_KEY}';

    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([(pickupLat + deliveryLat) / 2, (pickupLng + deliveryLng) / 2], 13);
    
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 19,
      attribution: '&copy; Google Maps'
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
    shop1Marker.bindTooltip('🏪 ' + '${shop1Name.replace(/'/g, "\\'")}' + (isMultiShop ? ' (Quán ' + shop1Num + ')' : ''), {
      permanent: true,
      direction: 'top',
      offset: [0, -22],
      className: 'custom-tooltip shop-tooltip'
    });
    shop1Marker.bindPopup('<b>Điểm lấy hàng ' + (isMultiShop ? ('#' + shop1Num) : '') + '</b><br/>${shop1Name.replace(/'/g, "\\'")}');

    var shop2Marker = null;
    if (isMultiShop && pickup2Lat && pickup2Lng) {
      var shop2Num = isShop1First ? '2' : '1';
      var shop2Icon = createShopIcon('#7C3AED', 42, shop2Num, true);
      shop2Marker = L.marker([pickup2Lat, pickup2Lng], { icon: shop2Icon, zIndexOffset: 700 }).addTo(map);
      shop2Marker.bindTooltip('🏪 ' + '${shop2Name.replace(/'/g, "\\'")}' + ' (Quán ' + shop2Num + ')', {
        permanent: true,
        direction: 'top',
        offset: [0, -22],
        className: 'custom-tooltip shop2-tooltip'
      });
      shop2Marker.bindPopup('<b>Điểm lấy hàng #' + shop2Num + '</b><br/>${shop2Name.replace(/'/g, "\\'")}');
    }

    var customerMarker = L.marker([deliveryLat, deliveryLng], { icon: customerIcon, zIndexOffset: 500 }).addTo(map);
    customerMarker.bindTooltip('📍 Điểm nhận hàng (Bạn)', {
      permanent: true,
      direction: 'top',
      offset: [0, -22],
      className: 'custom-tooltip customer-tooltip'
    });
    customerMarker.bindPopup('<b>Điểm giao hàng</b><br/>${typeof deliveryAddress === 'string' ? deliveryAddress.replace(/'/g, "\\'") : ((deliveryAddress?.fullAddress || '').replace(/'/g, "\\'"))}');

    var shipperMarker = L.marker([initialShipLat, initialShipLng], { icon: shipperIcon, zIndexOffset: 1000 }).addTo(map);
    shipperMarker.bindTooltip('🛵 ' + ('${shipperName.replace(/'/g, "\\'")}' || 'Tài xế') + ' (Shipper)', {
      permanent: true,
      direction: 'bottom',
      offset: [0, 24],
      className: 'custom-tooltip shipper-tooltip'
    });
    shipperMarker.bindPopup('<b>' + ('${shipperName.replace(/'/g, "\\'")}' || 'Tài xế') + '</b><br/>Đang trực tuyến');

    var routeLines = [];

    function fitAll() {
      var bounds = L.latLngBounds([]);
      bounds.extend([pickupLat, pickupLng]);
      if (isMultiShop && pickup2Lat) bounds.extend([pickup2Lat, pickup2Lng]);
      bounds.extend([deliveryLat, deliveryLng]);
      if (shipperMarker) bounds.extend(shipperMarker.getLatLng());
      routeLines.forEach(function(l) {
        if (l && l.getLatLngs().length > 0) bounds.extend(l.getBounds());
      });
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
      }
    }

    var routeCache = {};
    var lastShipperLegTime = 0;

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
          // Dự phòng OSRM khi VietMap gặp 429 hoặc lỗi
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

    // Vẽ 3 chặng VietMap chuẩn đồng bộ như AppShipper
    if (!isMultiShop) {
      fetchAndDrawLeg(initialShipLat, initialShipLng, pickupLat, pickupLng, '#2563EB', 0);
      fetchAndDrawLeg(pickupLat, pickupLng, deliveryLat, deliveryLng, '#EA580C', 1);
    } else {
      // Leg 0: Shipper -> Stop 1 (Xanh dương)
      fetchAndDrawLeg(initialShipLat, initialShipLng, stop1Lat, stop1Lng, '#2563EB', 0);
      // Leg 1: Stop 1 -> Stop 2 (Tím)
      fetchAndDrawLeg(stop1Lat, stop1Lng, stop2Lat, stop2Lng, '#7C3AED', 1);
      // Leg 2: Stop 2 -> Khách (Cam)
      fetchAndDrawLeg(stop2Lat, stop2Lng, deliveryLat, deliveryLng, '#EA580C', 2);
    }

    function smoothUpdateShipper(lat, lng, name) {
      var dot = document.getElementById('badge-dot');
      var text = document.getElementById('badge-text');
      if (dot) dot.className = 'badge-dot pulse';
      if (text && !isMultiShop) text.innerText = name ? 'Tài xế: ' + name : 'Shipper trực tuyến';

      var sName = name || '${shipperName.replace(/'/g, "\\'")}' || 'Tài xế';
      if (!shipperMarker) {
        shipperMarker = L.marker([lat, lng], { icon: shipperIcon, zIndexOffset: 1000 }).addTo(map);
        shipperMarker.bindTooltip('🛵 ' + sName + ' (Shipper)', {
          permanent: true,
          direction: 'bottom',
          offset: [0, 24],
          className: 'custom-tooltip shipper-tooltip'
        });
        shipperMarker.bindPopup('<b>' + sName + '</b><br/>Đang di chuyển');
      } else {
        shipperMarker.setLatLng([lat, lng]);
        shipperMarker.setTooltipContent('🛵 ' + sName + ' (Shipper)');
      }
    }

    // Kết nối STOMP WebSocket trực tiếp
    var activeShipperId = ${deliveryData?.shipperId || 'null'};
    var stompClient = null;

    function connectStomp(sId) {
      if (!sId || stompClient) return;
      try {
        var wsHost = window.location.hostname || 'localhost';
        var wsUrl = (window.location.protocol === 'https:' || wsHost.includes('ngrok')) ? 'https://unentwined-johanne-biasedly.ngrok-free.dev/ws' : 'http://' + wsHost + ':8080/ws';
        var socket = new SockJS(wsUrl);
        stompClient = Stomp.over(socket);
        stompClient.debug = null;
        stompClient.connect({}, function() {
          var dot = document.getElementById('badge-dot');
          var text = document.getElementById('badge-text');
          if (dot) dot.className = 'badge-dot pulse';
          if (text && !isMultiShop) text.innerText = 'Shipper trực tuyến';

          stompClient.subscribe('/topic/shippers/' + sId, function(message) {
            if (message.body) {
              try {
                var loc = JSON.parse(message.body);
                if (loc && loc.lat && loc.lng) {
                  smoothUpdateShipper(loc.lat, loc.lng, 'Shipper');
                }
              } catch(e) {}
            }
          });
        }, function() {
          stompClient = null;
          setTimeout(function() { connectStomp(sId); }, 4000);
        });
      } catch(e) {}
    }

    if (activeShipperId) {
      connectStomp(activeShipperId);
    }

    // Lắng nghe postMessage từ React
    window.addEventListener('message', function(event) {
      var msg = event.data;
      if (!msg) return;

      if (msg.type === 'SET_SHIPPER_ID' && msg.shipperId) {
        var dot = document.getElementById('badge-dot');
        var text = document.getElementById('badge-text');
        if (dot) dot.className = 'badge-dot pulse';
        if (text && !isMultiShop) text.innerText = msg.shipperName ? 'Tài xế: ' + msg.shipperName : 'Shipper trực tuyến';

        if (!activeShipperId) {
          activeShipperId = msg.shipperId;
          connectStomp(activeShipperId);
        }
      }

      if (msg.type === 'UPDATE_LOCATION' && msg.lat && msg.lng) {
        smoothUpdateShipper(msg.lat, msg.lng, msg.name);
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
</body>
</html>
  `;
  }, [
    orderId,
    deliveryData?.id,
    deliveryData?.optimalPickupOrder,
    deliveryData?.pickup1Completed,
    deliveryData?.pickup2Completed,
    isShop1First,
    stop1.name,
    stop1.lat,
    stop1.lng,
    stop1.done,
    stop2.name,
    stop2.lat,
    stop2.lng,
    stop2.done,
    pickup.lat,
    pickup.lng,
    pickup2.lat,
    pickup2.lng,
    delivery.lat,
    delivery.lng,
    shop1Name,
    shop2Name,
    isMultiShop,
    shipperName
  ]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.headerTitleRow}>
          <MapPin size={20} color="#DC2626" />
          <Text style={styles.cardTitle}>Định vị vị trí giao hàng</Text>
        </View>
        <Text style={styles.orderStatusBadge}>
          {hasShipper ? 'Đã tìm thấy Shipper' : 'Chờ Shipper'}
        </Text>
      </View>

      {/* Map Body */}
      {Platform.OS === 'web' ? (
        <View style={styles.mapContainerWeb}>
          {!deliveryData ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <ActivityIndicator size="small" color="#10B981" />
              <Text style={{ marginTop: 8, fontSize: 13, color: '#64748B', fontWeight: '500' }}>
                Đang kết nối GPS định vị đơn hàng...
              </Text>
            </View>
          ) : (
            <iframe
              ref={iframeRef}
              key={`web-map-${orderId}-${deliveryData?.id}-${isShop1First}-${deliveryData?.pickup1Completed}-${deliveryData?.pickup2Completed}`}
              title="shipper-tracking-map"
              width="100%"
              height="100%"
              style={{ border: 0, width: '100%', height: '100%', display: 'block' }}
              srcDoc={leafletSrcDoc}
            />
          )}
        </View>
      ) : (
        <View style={styles.mapContainerMobile}>
          {MapView ? (
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: (pickup.lat + delivery.lat) / 2,
                longitude: (pickup.lng + delivery.lng) / 2,
                latitudeDelta: Math.abs(pickup.lat - delivery.lat) * 2 + 0.02,
                longitudeDelta: Math.abs(pickup.lng - delivery.lng) * 2 + 0.02,
              }}
            >
              {/* Quán ăn Marker 1 (Blue) */}
              <Marker
                coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
                title={isMultiShop ? `Điểm lấy món #${isShop1First ? '1' : '2'}` : "Vị trí quán"}
                description={shop1Name}
              >
                <View style={styles.shopMarkerMobile}>
                  <Store size={18} color="#FFFFFF" />
                </View>
              </Marker>

              {/* Quán ăn Marker 2 (Purple) nếu là đơn 2 quán */}
              {isMultiShop && pickup2.lat && pickup2.lng && (
                <Marker
                  coordinate={{ latitude: pickup2.lat, longitude: pickup2.lng }}
                  title={`Điểm lấy món #${isShop1First ? '2' : '1'}`}
                  description={shop2Name}
                >
                  <View style={[styles.shopMarkerMobile, { backgroundColor: '#7C3AED' }]}>
                    <Store size={18} color="#FFFFFF" />
                  </View>
                </Marker>
              )}

              {/* Khách hàng Marker (Orange) */}
              <Marker
                coordinate={{ latitude: delivery.lat, longitude: delivery.lng }}
                title="Điểm giao hàng"
                description={typeof deliveryAddress === 'string' ? deliveryAddress : (deliveryAddress?.fullAddress || '')}
              >
                <View style={styles.customerMarkerMobile}>
                  <MapPin size={18} color="#FFFFFF" />
                </View>
              </Marker>

              {/* Shipper Marker (Green) */}
              {shipperLocation && (
                <Marker
                  coordinate={{ latitude: shipperLocation.lat, longitude: shipperLocation.lng }}
                  title={shipperName || "Shipper"}
                  description="Đang di chuyển"
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={[styles.shipperMarkerMobile, { transform: [{ rotate: `${shipperLocation.heading || 0}deg` }] }]}>
                    <Navigation size={22} color="#FFFFFF" fill="#FFFFFF" />
                  </View>
                </Marker>
              )}

              {/* Tuyến đường Shipper -> Shop (Màu xanh) */}
              {routeShipperToShop.length > 0 && (
                <Polyline
                  coordinates={routeShipperToShop.map(c => ({ latitude: c[0], longitude: c[1] }))}
                  strokeColor="#3B82F6"
                  strokeWidth={5}
                />
              )}

              {/* Tuyến đường giữa 2 quán (Màu tím) nếu là đơn 2 quán */}
              {routeBetweenShops.length > 0 && (
                <Polyline
                  coordinates={routeBetweenShops.map(c => ({ latitude: c[0], longitude: c[1] }))}
                  strokeColor="#7C3AED"
                  strokeWidth={5}
                />
              )}

              {/* Tuyến đường Shop cuối -> Customer (Màu cam) */}
              {routeShopToCustomer.length > 0 && (
                <Polyline
                  coordinates={routeShopToCustomer.map(c => ({ latitude: c[0], longitude: c[1] }))}
                  strokeColor="#F97316"
                  strokeWidth={5}
                />
              )}
            </MapView>
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#DC2626" />
              <Text style={styles.loadingText}>Đang tải bản đồ...</Text>
            </View>
          )}

          {/* Floating Badge on Mobile */}
          <View style={styles.mobileFloatingBadge}>
            <View style={[styles.mobileDot, { backgroundColor: hasShipper ? '#10B981' : '#94A3B8' }]} />
            <Text style={styles.mobileBadgeText}>
              {hasShipper ? (shipperName ? `Tài xế: ${shipperName}` : 'Shipper trực tuyến') : 'Đang tìm Shipper...'}
            </Text>
          </View>
        </View>
      )}

      {/* Footer Address Info */}
      <View style={styles.cardFooter}>
        {isMultiShop && (
          <View style={styles.multiShopBannerCustomer}>
            <Text style={styles.multiShopBannerText}>
              ⚡ Đơn gồm 2 quán: {stop1.done && stop2.done
                ? '✅ Shipper đã lấy đủ món tại 2 quán, đang trên đường giao đến bạn!'
                : (stop1.done
                  ? `🛵 Shipper đã lấy 1/2 quán, đang ghé ${stop2.name}`
                  : `🛵 Shipper đang di chuyển đến ${stop1.name} để lấy món`)}
            </Text>
          </View>
        )}
        <Text style={styles.footerAddress} numberOfLines={1}>
          📍 Điểm giao: {typeof deliveryAddress === 'string' ? deliveryAddress : (deliveryAddress?.fullAddress || 'Đang cập nhật')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginLeft: 8,
  },
  orderStatusBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  mapContainerWeb: {
    height: 320,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  mapContainerMobile: {
    height: 300,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  shopMarkerMobile: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1D4ED8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 4,
  },
  customerMarkerMobile: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EA580C',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 4,
  },
  shipperMarkerMobile: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 5,
  },
  mobileFloatingBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  mobileDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  mobileBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  cardFooter: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerAddress: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  multiShopBannerCustomer: {
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginBottom: 8,
  },
  multiShopBannerText: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '700',
    lineHeight: 16,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 8,
    color: '#64748B',
    fontSize: 13,
  },
});
