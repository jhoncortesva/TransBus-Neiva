import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  StatusBar, TouchableOpacity, ActivityIndicator, ScrollView, Alert, AppState,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSocket } from '../services/socket';
import { routesAPI, authAPI } from '../services/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const MAP_REGION = {
  latitude: 2.9435,
  longitude: -75.2820,
  latitudeDelta: 0.075,
  longitudeDelta: 0.040,
};

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

export default function RouteDetailScreen({ navigation, route }) {
  const { route: routeData } = route.params;
  const mapRef = useRef(null);

  // Route coords loaded from API
  const [fullRoute, setFullRoute] = useState(null);

  // UI state
  const [userLocation, setUserLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [timeEstimate, setTimeEstimate] = useState(null);
  const [activeRoute, setActiveRoute] = useState('both');
  const [poisExpanded, setPoisExpanded] = useState(false);
  const [notifActive, setNotifActive] = useState(false);
  const notifKey = `notif_route_${routeData.name}`;

  // Derived map data from API response
  const idaCoords = fullRoute?.ida_coords || [];
  const vueltaCoords = fullRoute?.vuelta_coords || [];
  const pois = (fullRoute?.pois || []).map((p, i) => ({ id: i, ...p }));
  const hasMapData = idaCoords.length > 0;

  // Parse start/end labels from description "A → B"
  const descParts = (routeData.description || '').split('→').map(s => s.trim());
  const startLabel = descParts[0] || 'Inicio';
  const endLabel = descParts[1] || 'Final';

  const toggleRoute = (r) => setActiveRoute(prev => prev === r ? 'both' : r);

  const toggleNotifications = async () => {
    if (notifActive) {
      setNotifActive(false);
      AsyncStorage.setItem(notifKey, 'false');
      authAPI.removePushSub(routeData.name).catch(() => {});
      return;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Activa los permisos de notificación en Ajustes del dispositivo.');
      return;
    }

    // Obtener Expo push token para notificaciones en segundo plano
    let pushToken = null;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '74b5fe2e-5f86-4366-9774-98e9dae9e51d',
      });
      pushToken = tokenData.data;
    } catch (err) {
      // ignore — push no disponible en este entorno
    }

    // Obtener ubicación actual para detección de proximidad
    let lat = userLocation?.latitude;
    let lon = userLocation?.longitude;
    if (lat == null) {
      try {
        const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = result.coords.latitude;
        lon = result.coords.longitude;
      } catch {}
    }

    // Registrar suscripción en el servidor
    if (pushToken && lat != null) {
      authAPI.savePushSub({
        push_token: pushToken,
        route_name: routeData.name,
        latitude: lat,
        longitude: lon,
      }).catch(() => {});
    }

    setNotifActive(true);
    AsyncStorage.setItem(notifKey, 'true');
    Alert.alert(
      'Notificaciones activas',
      pushToken
        ? 'Recibirás una alerta cuando una buseta esté a 10 minutos, incluso con la app cerrada.'
        : 'Recibirás alertas mientras la app esté abierta.'
    );
  };


  const focusPOI = (poi) => {
    mapRef.current?.animateToRegion({
      latitude: poi.latitude,
      longitude: poi.longitude,
      latitudeDelta: 0.004,
      longitudeDelta: 0.004,
    }, 800);
  };

  const idaColor    = activeRoute === 'vuelta' ? 'rgba(76,175,80,0.15)'  : '#4CAF50';
  const vueltaColor = activeRoute === 'ida'    ? 'rgba(244,67,54,0.15)'  :
                      activeRoute === 'vuelta' ? '#F44336'                : 'rgba(244,67,54,0.5)';

  useEffect(() => {
    // Load full route with coords from API
    routesAPI.getById(routeData.id).then((data) => setFullRoute(data.route)).catch(() => {});

    // Location
    getLocation();

    // Socket
    const socket = getSocket();

    const requestDrivers = () => socket.emit('user:request_drivers');

    requestDrivers(); // Petición inicial
    socket.on('connect', requestDrivers); // Re-pedir al reconectar
    socket.on('drivers:locations', (drivers) => {
      setNearbyDrivers(drivers.filter(d => d.routeName === routeData.name));
    });

    // Re-pedir conductores cada vez que la app vuelve al primer plano
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') requestDrivers();
    });

    AsyncStorage.getItem(notifKey).then((val) => {
      if (val === 'true') setNotifActive(true);
    });

    return () => {
      socket.off('connect', requestDrivers);
      socket.off('drivers:locations');
      appStateSub.remove();
    };
  }, []);

  useEffect(() => {
    if (userLocation && nearbyDrivers.length > 0) {
      let minDist = Infinity;
      nearbyDrivers.forEach((d) => {
        const dist = haversineKm(d.latitude, d.longitude, userLocation.latitude, userLocation.longitude);
        if (dist < minDist) minDist = dist;
      });
      setTimeEstimate({ minutes: Math.round((minDist / 20) * 60), distKm: minDist.toFixed(2) });
    } else {
      setTimeEstimate(null);
    }
  }, [userLocation, nearbyDrivers]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation(loc.coords);
    } catch (_) {}
    finally { setLoadingLocation(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A237E" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ruta {routeData.name}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.mapContainer}>
        <MapView ref={mapRef} style={styles.map} initialRegion={MAP_REGION} showsCompass mapType="standard">
          {hasMapData && (
            <>
              <Polyline coordinates={idaCoords}    strokeColor={idaColor}    strokeWidth={4} />
              <Polyline coordinates={vueltaCoords} strokeColor={vueltaColor} strokeWidth={4} />
              <Marker coordinate={idaCoords[0]} title="Inicio IDA / Final VUELTA" description={startLabel} pinColor="#4CAF50" />
              <Marker coordinate={idaCoords[idaCoords.length - 1]} title="Final IDA / Inicio VUELTA" description={endLabel} pinColor="#F44336" />
            </>
          )}

          {userLocation && (
            <Marker coordinate={{ latitude: userLocation.latitude, longitude: userLocation.longitude }} title="Mi ubicación">
              <View style={styles.userMarker}>
                <View style={styles.userMarkerDot} />
                <View style={styles.userMarkerRing} />
              </View>
            </Marker>
          )}

          {nearbyDrivers.map((d) => (
            <Marker key={d.driverId} coordinate={{ latitude: d.latitude, longitude: d.longitude }} title={`🚌 ${d.driverName}`}>
              <View style={styles.driverMarker}>
                <Text style={styles.driverEmoji}>🚌</Text>
              </View>
            </Marker>
          ))}

          {pois.map((poi) => (
            <Marker
              key={poi.id}
              coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
              title={poi.name}
              pinColor="#9C27B0"
            />
          ))}
        </MapView>

        {loadingLocation && (
          <View style={styles.locationBadge}>
            <ActivityIndicator size="small" color="#1565C0" />
            <Text style={styles.locationBadgeText}>Localizando...</Text>
          </View>
        )}
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHandle} />
        <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.estimateRow}>
          <Text style={styles.estimateIcon}>⏱</Text>
          <View style={styles.estimateContent}>
            <Text style={styles.estimateLabel}>Tiempo estimado de llegada</Text>
            {nearbyDrivers.length === 0 ? (
              <Text style={styles.estimateValue}>Sin conductores activos en esta ruta</Text>
            ) : timeEstimate ? (
              <Text style={styles.estimateValue}>
                ~{timeEstimate.minutes} min · {timeEstimate.distKm} km del conductor más cercano
              </Text>
            ) : (
              <Text style={styles.estimateValue}>Calculando...</Text>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          style={[styles.notifBtn, notifActive && styles.notifBtnActive]}
          onPress={toggleNotifications}
        >
          <Text style={styles.notifBtnIcon}>{notifActive ? '🔔' : '🔕'}</Text>
          <Text style={[styles.notifBtnText, notifActive && styles.notifBtnTextActive]}>
            {notifActive ? 'Notificaciones activas' : 'Activar notificaciones de buseta'}
          </Text>
          {notifActive && <View style={styles.notifDot} />}
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.legendTitle}>Referencias del mapa</Text>
        <View style={styles.legendGrid}>
          {hasMapData && (
            <>
              <TouchableOpacity style={[styles.legendItem, activeRoute === 'ida' && styles.legendItemActive]} onPress={() => toggleRoute('ida')}>
                <View style={[styles.legendLine, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.legendText}>IDA{'\n'}{startLabel} →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.legendItem, activeRoute === 'vuelta' && styles.legendItemActive]} onPress={() => toggleRoute('vuelta')}>
                <View style={[styles.legendLine, { backgroundColor: '#F44336' }]} />
                <Text style={styles.legendText}>VUELTA{'\n'}{endLabel} →</Text>
              </TouchableOpacity>
            </>
          )}
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#1565C0' }]} />
            <Text style={styles.legendText}>Mi{'\n'}ubicación</Text>
          </View>
          <View style={styles.legendItem}>
            <Text style={{ fontSize: 16 }}>🚌</Text>
            <Text style={styles.legendText}>Conductor{'\n'}activo</Text>
          </View>
        </View>

        {pois.length > 0 && (
          <>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.poisHeader} onPress={() => setPoisExpanded(p => !p)}>
              <View style={styles.poisHeaderLeft}>
                <View style={styles.poisDot} />
                <Text style={styles.poisTitle}>Puntos de Interés</Text>
                <View style={styles.poisBadge}>
                  <Text style={styles.poisBadgeText}>{pois.length}</Text>
                </View>
              </View>
              <Text style={styles.poisChevron}>{poisExpanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {poisExpanded && (
              <View style={styles.poisList}>
                {pois.map((poi) => (
                  <TouchableOpacity key={poi.id} style={styles.poiItem} onPress={() => focusPOI(poi)}>
                    <View style={styles.poiIcon}>
                      <View style={styles.poiPin} />
                    </View>
                    <Text style={styles.poiName}>{poi.name}</Text>
                    <Text style={styles.poiChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF' },
  header: {
    backgroundColor: '#1A237E', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    padding: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)',
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', lineHeight: 22 },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  locationBadge: {
    position: 'absolute', top: 12, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, elevation: 4,
  },
  locationBadgeText: { fontSize: 13, color: '#1565C0', fontWeight: '500' },
  userMarker: { alignItems: 'center', justifyContent: 'center', width: 36, height: 36 },
  userMarkerDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#1565C0', borderWidth: 2, borderColor: '#FFFFFF',
    position: 'absolute', zIndex: 2, elevation: 4,
  },
  userMarkerRing: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(21,101,192,0.2)',
    borderWidth: 1.5, borderColor: 'rgba(21,101,192,0.5)', position: 'absolute',
  },
  driverMarker: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  driverEmoji: { fontSize: 22 },
  panel: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 8,
  },
  panelHandle: {
    width: 40, height: 4, backgroundColor: '#E0E0E0',
    borderRadius: 2, alignSelf: 'center', marginBottom: 14,
  },
  estimateRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  estimateIcon: { fontSize: 26, marginTop: 2 },
  estimateContent: { flex: 1 },
  estimateLabel: { fontSize: 11, color: '#9E9E9E', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  estimateValue: { fontSize: 14, color: '#212121', fontWeight: '600', lineHeight: 20 },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginBottom: 14 },
  legendTitle: { fontSize: 11, color: '#9E9E9E', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, width: '47%', padding: 4, borderRadius: 6 },
  legendItemActive: { backgroundColor: 'rgba(0,0,0,0.07)' },
  legendLine: { width: 18, height: 4, borderRadius: 2, marginTop: 7 },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  legendText: { fontSize: 12, color: '#424242', lineHeight: 17, flex: 1 },
  notifBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F5F5F5', borderRadius: 12, paddingVertical: 12,
    paddingHorizontal: 14, borderWidth: 1.5, borderColor: '#E0E0E0',
    marginBottom: 14,
  },
  notifBtnActive: { backgroundColor: '#FFF8E1', borderColor: '#FFB300' },
  notifBtnIcon: { fontSize: 18 },
  notifBtnText: { flex: 1, fontSize: 13, color: '#616161', fontWeight: '600' },
  notifBtnTextActive: { color: '#E65100' },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFB300' },
  poisHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 10,
  },
  poisHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  poisDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#9C27B0' },
  poisTitle: { fontSize: 11, color: '#9E9E9E', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  poisBadge: { backgroundColor: '#F3E5F5', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  poisBadgeText: { fontSize: 11, color: '#9C27B0', fontWeight: '700' },
  poisChevron: { fontSize: 10, color: '#9E9E9E' },
  poisList: { marginBottom: 8 },
  poiItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  poiIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3E5F5', alignItems: 'center', justifyContent: 'center',
  },
  poiPin: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#9C27B0' },
  poiName: { flex: 1, fontSize: 13, color: '#212121', fontWeight: '500' },
  poiChevron: { fontSize: 18, color: '#BDBDBD' },
});
