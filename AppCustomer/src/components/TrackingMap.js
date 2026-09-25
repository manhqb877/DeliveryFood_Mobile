import React, { useEffect, useState, useRef } from 'react';
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

export default function TrackingMap({ orderId, orderStatus, deliveryAddress, shopName }) {
  const [deliveryData, setDeliveryData] = useState(null);
  const [shipperLocation, setShipperLocation] = useState(null);
  const [shipperName, setShipperName] = useState('');
  const [routeShopToCustomer, setRouteShopToCustomer] = useState([]);
  const [routeShipperToShop, setRouteShipperToShop] = useState([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef(null);
  const iframeRef = useRef(null);

  // Fallback coordinates (TP.HCM)
  const defaultPickup = { lat: 10.7733, lng: 106.6977 };
  const defaultDelivery = { lat: 10.8016, lng: 106.6392 };

  const pickup = {
    lat: deliveryData?.pickupLat || defaultPickup.lat,
    lng: deliveryData?.pickupLng || defaultPickup.lng,
  };

  const delivery = {
    lat: deliveryData?.deliveryLat || (typeof deliveryAddress === 'object' ? deliveryAddress?.latitude : null) || defaultDelivery.lat,
    lng: deliveryData?.deliveryLng || (typeof deliveryAddress === 'object' ? deliveryAddress?.longitude : null) || defaultDelivery.lng,
  };

  // Helper fetch route từ VietMap
  const fetchVietmapRoute = async (from, to) => {
    try {
      const url = `https://maps.vietmap.vn/api/route?api-version=1.1&apikey=${VIETMAP_API_KEY}&point=${from.lat},${from.lng}&point=${to.lat},${to.lng}&vehicle=motorcycle&points_encoded=false`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.paths && data.paths.length > 0) {
        return data.paths[0].points.coordinates.map((c) => [c[1], c[0]]);
      }
    } catch (e) {
      console.warn('Vietmap route error:', e);
    }
    return [];
  };

  // 1. Fetch thông tin Delivery của đơn hàng & Polling real-time
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

          // Lấy toạ độ hiện tại của Shipper (fallback nếu websocket chưa nhận được)
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

                // Cập nhật vị trí mượt mà sang iframe qua postMessage (không reload bản đồ!)
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
        // Chưa có delivery data
      } finally {
        setLoading(false);
      }
    };

    fetchDeliveryInfo();
    intervalId = setInterval(fetchDeliveryInfo, 3000); // Polling mỗi 3 giây

    return () => clearInterval(intervalId);
  }, [orderId]);

  // 2. Fetch tuyến đường đường đi (Shop -> Customer & Shipper -> Shop)
  useEffect(() => {
    let isMounted = true;

    const loadRoutes = async () => {
      if (pickup.lat && delivery.lat) {
        const route1 = await fetchVietmapRoute(pickup, delivery);
        if (isMounted && route1.length > 0) {
          setRouteShopToCustomer(route1);
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
              type: 'SET_ROUTE_CUSTOMER',
              route: route1,
            }, '*');
          }
        }
      }

      if (shipperLocation && pickup.lat) {
        const route2 = await fetchVietmapRoute(shipperLocation, pickup);
        if (isMounted && route2.length > 0) {
          setRouteShipperToShop(route2);
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
              type: 'SET_ROUTE_SHOP',
              route: route2,
            }, '*');
          }
        }
      }
    };

    loadRoutes();
    return () => { isMounted = false; };
  }, [pickup.lat, pickup.lng, delivery.lat, delivery.lng, shipperLocation?.lat, shipperLocation?.lng]);

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

  // Leaflet HTML chuẩn dùng Google Maps tile và tích hợp trực tiếp STOMP WebSocket real-time
  const leafletSrcDoc = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/sockjs-client/1.6.1/sockjs.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/stomp.js/2.3.3/stomp.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .badge-overlay {
      position: absolute;
      top: 14px;
      left: 14px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(8px);
      padding: 6px 14px;
      border-radius: 9999px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 700;
      color: #334155;
    }
    .badge-dot {
      width: 10px;
      height: 10px;
      border-radius: 5px;
      background: #94A3B8;
      position: relative;
    }
    .badge-dot.pulse {
      background: #10B981;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      animation: pulse 1.6s infinite cubic-bezier(0.66, 0, 0, 1);
    }
    @keyframes pulse {
      to { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
    }
  </style>
</head>
<body>
  <div class="badge-overlay">
    <div id="badge-dot" class="badge-dot ${hasShipper ? 'pulse' : ''}"></div>
    <span id="badge-text">${hasShipper ? (shipperName ? 'Tài xế: ' + shipperName : 'Shipper trực tuyến') : 'Đang tìm Shipper...'}</span>
  </div>
  <div id="map"></div>

  <script>
    var pickupLat = ${pickup.lat};
    var pickupLng = ${pickup.lng};
    var deliveryLat = ${delivery.lat};
    var deliveryLng = ${delivery.lng};

    var map = L.map('map', { zoomControl: true }).setView([(pickupLat + deliveryLat) / 2, (pickupLng + deliveryLng) / 2], 13);
    
    // Google Maps Layer sắc nét như bản Web
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 19,
      attribution: '&copy; Google Maps'
    }).addTo(map);

    function createCustomIcon(bgColor, size, svgIcon) {
      return L.divIcon({
        html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:' + (size/2) + 'px;background-color:' + bgColor + ';border:3px solid white;box-shadow:0 4px 6px -1px rgba(0,0,0,0.3);display:flex;justify-content:center;align-items:center;color:white;">' + svgIcon + '</div>',
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
      });
    }

    var storeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>';
    var customerSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
    var shipperSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>';

    var shopIcon = createCustomIcon('#1D4ED8', 38, storeSvg);
    var customerIcon = createCustomIcon('#EA580C', 38, customerSvg);
    var shipperIcon = createCustomIcon('#10B981', 44, shipperSvg);

    // Shop Marker
    var shopMarker = L.marker([pickupLat, pickupLng], { icon: shopIcon }).addTo(map);
    shopMarker.bindPopup('<b>Vị trí quán</b><br/>${shopName || "Quán ăn"}');

    // Customer Marker
    var customerMarker = L.marker([deliveryLat, deliveryLng], { icon: customerIcon }).addTo(map);
    customerMarker.bindPopup('<b>Điểm giao hàng</b><br/>${typeof deliveryAddress === 'string' ? deliveryAddress : (deliveryAddress?.fullAddress || '')}');

    var bounds = L.latLngBounds([[pickupLat, pickupLng], [deliveryLat, deliveryLng]]);
    map.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });

    // Polyline Shop -> Customer (Orange)
    var routeCustomerLine = L.polyline([[pickupLat, pickupLng], [deliveryLat, deliveryLng]], {
      color: '#F97316',
      weight: 5,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    // Shipper Marker & Route
    var shipperMarker = null;
    var routeShipperLine = null;

    function smoothUpdateShipper(lat, lng, name) {
      if (!shipperMarker) {
        shipperMarker = L.marker([lat, lng], { icon: shipperIcon, zIndexOffset: 1000 }).addTo(map);
        shipperMarker.bindPopup('<b>' + (name || 'Shipper') + '</b><br/>Đang di chuyển');
      } else {
        shipperMarker.setLatLng([lat, lng]);
      }

      // Cập nhật đường nối từ Shipper đến Quán mượt mà
      if (!routeShipperLine) {
        routeShipperLine = L.polyline([[lat, lng], [pickupLat, pickupLng]], {
          color: '#3B82F6',
          weight: 5,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);
      } else {
        routeShipperLine.setLatLngs([[lat, lng], [pickupLat, pickupLng]]);
      }
    }

    // Kết nối STOMP WebSocket trực tiếp (Real-time như bản Web)
    var activeShipperId = ${deliveryData?.shipperId || 'null'};
    var stompClient = null;

    function connectStomp(sId) {
      if (!sId || stompClient) return;
      try {
        var wsHost = window.location.hostname || 'localhost';
        var socket = new SockJS('http://' + wsHost + ':8084/ws');
        stompClient = Stomp.over(socket);
        stompClient.debug = null;
        stompClient.connect({}, function() {
          console.log('[AppCustomer Tracking] STOMP connected for shipper:', sId);
          var dot = document.getElementById('badge-dot');
          var text = document.getElementById('badge-text');
          if (dot) dot.className = 'badge-dot pulse';
          if (text) text.innerText = 'Shipper trực tuyến';

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

    // Lắng nghe postMessage từ React để cập nhật tức thì (KHÔNG reload iframe)
    window.addEventListener('message', function(event) {
      var msg = event.data;
      if (!msg) return;

      if (msg.type === 'SET_SHIPPER_ID' && msg.shipperId) {
        if (!activeShipperId) {
          activeShipperId = msg.shipperId;
          connectStomp(activeShipperId);
        }
      }

      if (msg.type === 'UPDATE_LOCATION' && msg.lat && msg.lng) {
        smoothUpdateShipper(msg.lat, msg.lng, msg.name);
      }

      if (msg.type === 'SET_ROUTE_CUSTOMER' && msg.route && msg.route.length > 0) {
        routeCustomerLine.setLatLngs(msg.route);
      }

      if (msg.type === 'SET_ROUTE_SHOP' && msg.route && msg.route.length > 0) {
        if (!routeShipperLine) {
          routeShipperLine = L.polyline(msg.route, {
            color: '#3B82F6',
            weight: 5,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);
        } else {
          routeShipperLine.setLatLngs(msg.route);
        }
      }
    });

    // Invalidate size sau khi load để đảm bảo tile tải đủ 100%
    setTimeout(function() {
      map.invalidateSize();
    }, 200);
  </script>
</body>
</html>
  `;

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
          <iframe
            ref={iframeRef}
            key={`web-map-${orderId}`}
            title="shipper-tracking-map"
            width="100%"
            height="100%"
            style={{ border: 0, width: '100%', height: '100%', display: 'block' }}
            srcDoc={leafletSrcDoc}
          />
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
              {/* Quán ăn Marker (Blue) */}
              <Marker
                coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
                title="Vị trí quán"
                description={shopName || "Quán ăn"}
              >
                <View style={styles.shopMarkerMobile}>
                  <Store size={18} color="#FFFFFF" />
                </View>
              </Marker>

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

              {/* Tuyến đường Shop -> Customer */}
              {routeShopToCustomer.length > 0 ? (
                <Polyline
                  coordinates={routeShopToCustomer.map(c => ({ latitude: c[0], longitude: c[1] }))}
                  strokeColor="#F97316"
                  strokeWidth={4}
                />
              ) : (
                <Polyline
                  coordinates={[
                    { latitude: pickup.lat, longitude: pickup.lng },
                    { latitude: delivery.lat, longitude: delivery.lng }
                  ]}
                  strokeColor="#F97316"
                  strokeWidth={3}
                  lineDashPattern={[6, 6]}
                />
              )}

              {/* Tuyến đường Shipper -> Shop */}
              {routeShipperToShop.length > 0 && (
                <Polyline
                  coordinates={routeShipperToShop.map(c => ({ latitude: c[0], longitude: c[1] }))}
                  strokeColor="#3B82F6"
                  strokeWidth={4}
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
    height: 300,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  mapContainerMobile: {
    height: 280,
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
