import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './apiClient';

export const BACKGROUND_LOCATION_TASK = 'SHIPPER_BACKGROUND_LOCATION';
const SESSION_KEY = 'shipper_session';

// Đăng ký task ở top-level (bắt buộc của Expo)
if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('[BG Location]', error.message);
      return;
    }
    if (data?.locations?.length > 0) {
      const latest = data.locations[data.locations.length - 1];
      if (!latest?.coords) return;

      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const { shipper, deliveryId } = JSON.parse(raw);
        if (shipper?.id) {
          await apiClient.patch(`/tracking/shippers/${shipper.id}/location`, {
            lat: latest.coords.latitude,
            lng: latest.coords.longitude,
            headingDeg: latest.coords.heading,
            speedMs: latest.coords.speed,
            accuracyM: latest.coords.accuracy,
            deviceTimestamp: latest.timestamp,
            deliveryId: deliveryId || null,
            isOnline: true,
          });
        }
      } catch (_) {
        // Silent — đừng crash background task
      }
    }
  });
}

export async function startBackgroundTracking(shipperId) {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return { success: false, reason: 'foreground_denied' };

    const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
    if (isRunning) return { success: true, alreadyRunning: true };

    let bgGranted = false;
    try {
      const bg = await Location.requestBackgroundPermissionsAsync();
      bgGranted = bg.status === 'granted';
    } catch (_) {}

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,      // 5 giây gửi 1 lần
      distanceInterval: 10,    // hoặc khi dịch chuyển >= 10m
      showsBackgroundLocationIndicator: true,
      pausesLocationUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'Shipper App - Đang giao hàng',
        notificationBody: 'Vị trí của bạn đang được chia sẻ với khách hàng',
        notificationColor: '#FF6B35',
      },
    });

    console.log('[BG Location] Đã bật tracking GPS nền');
    return { success: true, bgGranted };
  } catch (err) {
    console.warn('[BG Location] Lỗi:', err.message);
    return { success: false, error: err.message };
  }
}

export async function stopBackgroundTracking() {
  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('[BG Location] Đã dừng tracking GPS');
    }
  } catch (_) {}
}
