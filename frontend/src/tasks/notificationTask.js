import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../services/api';

export const BACKGROUND_NOTIFY_TASK = 'transbus-route-notify';
export const BG_NOTIF_PREFS_KEY = 'bg_notif_prefs';
const BG_LAST_NOTIF_KEY = 'bg_last_notif';

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Debe definirse en el nivel superior del módulo, antes de cualquier render
TaskManager.defineTask(BACKGROUND_NOTIFY_TASK, async () => {
  try {
    const prefsRaw = await AsyncStorage.getItem(BG_NOTIF_PREFS_KEY);
    if (!prefsRaw) return BackgroundFetch.BackgroundFetchResult.NoData;

    const prefs = JSON.parse(prefsRaw); // { routeName, latitude, longitude }
    if (!prefs?.routeName || prefs?.latitude == null) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Cooldown de 5 minutos entre notificaciones
    const lastRaw = await AsyncStorage.getItem(BG_LAST_NOTIF_KEY);
    const last = lastRaw ? parseInt(lastRaw, 10) : 0;
    if (Date.now() - last < 5 * 60 * 1000) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const response = await fetch(`${BASE_URL}/api/drivers/live`);
    if (!response.ok) return BackgroundFetch.BackgroundFetchResult.Failed;

    const { drivers } = await response.json();
    const routeDrivers = drivers.filter(d => d.routeName === prefs.routeName);
    if (routeDrivers.length === 0) return BackgroundFetch.BackgroundFetchResult.NoData;

    let minMinutes = Infinity;
    for (const d of routeDrivers) {
      const dist = haversineKm(d.latitude, d.longitude, prefs.latitude, prefs.longitude);
      const mins = Math.round((dist / 20) * 60);
      if (mins < minMinutes) minMinutes = mins;
    }

    if (minMinutes <= 10) {
      await AsyncStorage.setItem(BG_LAST_NOTIF_KEY, String(Date.now()));
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🚌 Ruta ${prefs.routeName}`,
          body: `Una buseta está a ~${minMinutes} min de tu ubicación`,
          sound: true,
        },
        trigger: null,
      });
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});
