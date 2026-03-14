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
  Platform,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

export default function MapScreen({ navigation }) {
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [tracking, setTracking] = useState(false);
  const mapRef = useRef(null);
  const watchRef = useRef(null);

  useEffect(() => {
    requestLocationPermission();
    return () => {
      if (watchRef.current) watchRef.current.remove();
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (_) {
      // silently fail — address is optional
    }
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

  const toggleTracking = async () => {
    if (tracking) {
      if (watchRef.current) watchRef.current.remove();
      watchRef.current = null;
      setTracking(false);
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Activa el permiso de ubicación en Ajustes.');
      return;
    }

    setTracking(true);
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 10 },
      async (loc) => {
        setLocation(loc.coords);
        centerMap(loc.coords);
        await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
      }
    );
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
        latitude: 3.8801,    // Neiva, Huila — sede de Coomotor
        longitude: -76.5000,
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
        <Text style={styles.headerTitle}>Mi Ubicación</Text>
        <TouchableOpacity onPress={getCurrentLocation} style={styles.refreshBtn}>
          <Text style={styles.refreshIcon}>⟳</Text>
        </TouchableOpacity>
      </View>

      {/* Map */}
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
            {location && (
              <Marker
                coordinate={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                }}
                title="Mi ubicación"
                description={address || 'Ubicación actual'}
              >
                <View style={styles.markerContainer}>
                  <View style={styles.markerDot} />
                  <View style={styles.markerRing} />
                </View>
              </Marker>
            )}
          </MapView>
        )}

        {/* Center button */}
        {location && !loading && !errorMsg && (
          <TouchableOpacity style={styles.centerBtn} onPress={() => centerMap(location)}>
            <Text style={styles.centerBtnIcon}>◎</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Info panel */}
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

        {location?.altitude != null && (
          <>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Text style={styles.infoIconText}>⛰️</Text>
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Altitud</Text>
                <Text style={styles.infoValue}>{Math.round(location.altitude)} m.s.n.m</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.divider} />

        {/* Tracking toggle */}
        <TouchableOpacity
          style={[styles.trackingBtn, tracking && styles.trackingBtnActive]}
          onPress={toggleTracking}
        >
          <Text style={styles.trackingBtnText}>
            {tracking ? '⏹ Detener seguimiento en vivo' : '▶ Activar seguimiento en vivo'}
          </Text>
          {tracking && <View style={styles.trackingDot} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
  },
  header: {
    backgroundColor: '#1A237E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  refreshBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 22,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    gap: 14,
  },
  loadingText: {
    color: '#5C6BC0',
    fontSize: 15,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorText: {
    color: '#424242',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: '#1565C0',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  // Custom marker
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  markerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1565C0',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    position: 'absolute',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  markerRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(21, 101, 192, 0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(21, 101, 192, 0.5)',
    position: 'absolute',
  },
  centerBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  centerBtnIcon: {
    fontSize: 22,
    color: '#1565C0',
  },
  // Info panel
  infoPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  infoPanelHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  infoIcon: {
    width: 36,
    height: 36,
    backgroundColor: '#EEF2FF',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconText: {
    fontSize: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#9E9E9E',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '500',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginVertical: 4,
  },
  trackingBtn: {
    marginTop: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#C5CAE9',
  },
  trackingBtnActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
  },
  trackingBtnText: {
    color: '#3949AB',
    fontWeight: '700',
    fontSize: 13,
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
});
