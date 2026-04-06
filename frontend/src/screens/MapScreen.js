import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  SafeAreaView,
  Alert,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { getSocket, disconnectSocket } from '../services/socket';

export default function MapScreen({ navigation }) {
  const { user, tracking, toggleTracking } = useAuth();
  const isDriver = user?.role === 'driver';

  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);

  const mapRef = useRef(null);
  const uiWatchRef = useRef(null);

  useEffect(() => {
    requestLocationPermission();

    // Usuarios reciben ubicaciones de conductores en tiempo real
    if (!isDriver) {
      const socket = getSocket();
      socket.emit('user:request_drivers');
      socket.on('drivers:locations', (drivers) => {
        setNearbyDrivers(drivers);
      });
    }

    return () => {
      if (!isDriver) {
        const socket = getSocket();
        socket.off('drivers:locations');
        disconnectSocket();
      }
    };
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permiso de ubicación denegado. Actívalo en Ajustes.');
        setLoading(false);
        return;
      }
      await getCurrentLocation();
    } catch {
      setErrorMsg('No se pudo obtener el permiso de ubicación.');
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(loc.coords);
      await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
      centerMap(loc.coords);
    } catch {
      setErrorMsg('No se pudo obtener la ubicación. Verifica que el GPS esté activado.');
    } finally {
      setLoading(false);
    }
  };

  const reverseGeocode = async (latitude, longitude) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.street, r.district, r.city, r.region].filter(Boolean);
        setAddress(parts.join(', '));
      }
    } catch (_) {}
  };

  const centerMap = (coords) => {
    if (mapRef.current && coords) {
      mapRef.current.animateToRegion({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      }, 800);
    }
  };

  const startUIWatch = async () => {
    if (uiWatchRef.current) return;
    uiWatchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 10 },
      async (loc) => {
        setLocation(loc.coords);
        centerMap(loc.coords);
        await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
      }
    );
  };

  const stopUIWatch = () => {
    if (uiWatchRef.current) {
      uiWatchRef.current.remove();
      uiWatchRef.current = null;
    }
  };

  // Si el tracking ya estaba activo al abrir el mapa, arrancar el watch de UI
  useEffect(() => {
    if (tracking && isDriver) startUIWatch();
    return () => stopUIWatch();
  }, [tracking]);

  const handleToggleTracking = async () => {
    if (tracking) {
      stopUIWatch();
    }
    await toggleTracking(user.id, user.fullName || user.username);
    if (!tracking) {
      await startUIWatch();
    }
  };

  const formatCoords = (coords) => {
    if (!coords) return '—';
    return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
  };

  const initialRegion = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      }
    : {
        latitude: 2.9273,
        longitude: -75.2819,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A237E" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isDriver ? 'Mi Ruta' : 'Conductores Cercanos'}
        </Text>
        <TouchableOpacity onPress={getCurrentLocation} style={styles.refreshBtn}>
          <Text style={styles.refreshIcon}>⟳</Text>
        </TouchableOpacity>
      </View>

      {/* Mapa */}
      <View style={styles.mapContainer}>
        {loading && !location ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#1565C0" />
            <Text style={styles.loadingText}>Obteniendo ubicación...</Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>📍</Text>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={requestLocationPermission}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={true}
            showsScale={true}
            mapType="standard"
          >
            {/* Marcador propio */}
            {location && (
              <Marker
                coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                title="Mi ubicación"
                description={address || 'Ubicación actual'}
              >
                <View style={styles.markerContainer}>
                  <View style={styles.markerDot} />
                  <View style={styles.markerRing} />
                </View>
              </Marker>
            )}

            {/* Marcadores de conductores (solo para usuarios) */}
            {!isDriver && nearbyDrivers.map((driver) => (
              <Marker
                key={driver.driverId}
                coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
                title={`🚌 ${driver.driverName}`}
                description="Conductor activo"
              >
                <View style={styles.driverMarkerContainer}>
                  <Text style={styles.driverMarkerEmoji}>🚌</Text>
                </View>
              </Marker>
            ))}
          </MapView>
        )}

        {location && !loading && !errorMsg && (
          <TouchableOpacity style={styles.centerBtn} onPress={() => centerMap(location)}>
            <Text style={styles.centerBtnIcon}>◎</Text>
          </TouchableOpacity>
        )}

        {/* Badge de conductores activos (solo usuarios) */}
        {!isDriver && (
          <View style={styles.driversBadge}>
            <Text style={styles.driversBadgeText}>
              🚌 {nearbyDrivers.length} conductor{nearbyDrivers.length !== 1 ? 'es' : ''} activo{nearbyDrivers.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Panel info */}
      <View style={styles.infoPanel}>
        <View style={styles.infoPanelHandle} />

        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Text style={styles.infoIconText}>📍</Text>
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Dirección</Text>
            <Text style={styles.infoValue} numberOfLines={2}>
              {loading ? 'Obteniendo...' : address || 'No disponible'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Text style={styles.infoIconText}>🌐</Text>
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Coordenadas</Text>
            <Text style={styles.infoValue}>
              {loading ? 'Obteniendo...' : formatCoords(location)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Botón de seguimiento */}
        <TouchableOpacity
          style={[styles.trackingBtn, tracking && styles.trackingBtnActive]}
          onPress={handleToggleTracking}
        >
          <Text style={styles.trackingBtnText}>
            {isDriver
              ? tracking ? '⏹ Dejar de compartir ubicación' : '▶ Compartir mi ubicación'
              : tracking ? '⏹ Detener seguimiento' : '▶ Activar seguimiento en vivo'}
          </Text>
          {tracking && <View style={styles.trackingDot} />}
        </TouchableOpacity>

        {isDriver && tracking && (
          <Text style={styles.sharingNote}>
            Los pasajeros pueden ver tu posición en tiempo real
          </Text>
        )}

        {!isDriver && (
          <TouchableOpacity style={styles.routesBtn} onPress={() => navigation.navigate('Routes')}>
            <Text style={styles.routesBtnText}>🚌 Ver rutas disponibles</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FF' },
  header: {
    backgroundColor: '#1A237E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    padding: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)',
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', lineHeight: 22 },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
  refreshBtn: {
    padding: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)',
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  refreshIcon: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', lineHeight: 22 },
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  loadingOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#EEF2FF', gap: 14,
  },
  loadingText: { color: '#5C6BC0', fontSize: 15, fontWeight: '500' },
  errorContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12,
  },
  errorIcon: { fontSize: 48 },
  errorText: { color: '#424242', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  retryBtn: {
    marginTop: 8, backgroundColor: '#1565C0',
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24,
  },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  // Marcador propio
  markerContainer: {
    alignItems: 'center', justifyContent: 'center', width: 36, height: 36,
  },
  markerDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#1565C0', borderWidth: 2, borderColor: '#FFFFFF',
    position: 'absolute', zIndex: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },
  markerRing: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(21, 101, 192, 0.2)',
    borderWidth: 1.5, borderColor: 'rgba(21, 101, 192, 0.5)', position: 'absolute',
  },
  // Marcador conductor
  driverMarkerContainer: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  driverMarkerEmoji: { fontSize: 24 },
  // Badge conductores
  driversBadge: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: 'rgba(26, 35, 126, 0.85)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16,
  },
  driversBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  centerBtn: {
    position: 'absolute', bottom: 16, right: 16,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 6,
  },
  centerBtnIcon: { fontSize: 22, color: '#1565C0' },
  // Panel info
  infoPanel: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 8,
  },
  infoPanelHandle: {
    width: 40, height: 4, backgroundColor: '#E0E0E0',
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  infoIcon: {
    width: 36, height: 36, backgroundColor: '#EEF2FF',
    borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  infoIconText: { fontSize: 16 },
  infoContent: { flex: 1 },
  infoLabel: {
    fontSize: 11, color: '#9E9E9E', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3,
  },
  infoValue: { fontSize: 14, color: '#212121', fontWeight: '500', lineHeight: 20 },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginVertical: 4 },
  trackingBtn: {
    marginTop: 12, backgroundColor: '#EEF2FF', borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1.5, borderColor: '#C5CAE9',
  },
  trackingBtnActive: { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' },
  trackingBtnText: { color: '#3949AB', fontWeight: '700', fontSize: 13 },
  trackingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  sharingNote: {
    textAlign: 'center', fontSize: 12, color: '#4CAF50',
    fontWeight: '500', marginTop: 8,
  },
  routesBtn: {
    marginTop: 10, borderRadius: 12, paddingVertical: 11,
    paddingHorizontal: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#C5CAE9', backgroundColor: '#EEF2FF',
  },
  routesBtnText: { color: '#3949AB', fontWeight: '700', fontSize: 13 },
});
