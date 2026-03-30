import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  StatusBar, TouchableOpacity, ActivityIndicator, ScrollView,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { getSocket } from '../services/socket';

// ─── Calibración base ────────────────────────────────────────────────────────
// Puntos confirmados:
//   Claretiano (Calle 51): 2.9605383, -75.27236
//   CC Los Comuneros (Carrera 2, ~Calle 8): 2.9259786, -75.291883
//
// Espaciado derivado:
//   Δlat por calle  ≈ (2.9605383 - 2.9259786) / (51 - 8) = 0.000804° (~89m)
//   Δlon por carrera ≈ 0.003° (~333m) — carreras aumentan hacia el este
//
// Longitudes de carreras:
//   Carrera 1  ≈ -75.2949  Carrera 2  ≈ -75.2919 (Comuneros)
//   Carrera 3  ≈ -75.2889  Carrera 4  ≈ -75.2859
//   Carrera 5  ≈ -75.2829  Carrera 8  ≈ -75.2739
//   Claretiano ≈ -75.2724  (entre Carrera 8 y 9)
//
// Latitudes de calles:
//   Calle 4  ≈ 2.9228   Calle 5  ≈ 2.9236   Calle 8  ≈ 2.9260
//   Calle 50 ≈ 2.9597   Calle 64 ≈ 2.9710
// ─────────────────────────────────────────────────────────────────────────────

// IDA (verde):
// Claretiano → Calle 50 oeste → norte a Calle 64 → Calle 64 oeste a Carrera 1
// → Carrera 1 sur → Carrera 2 sur → CC Los Comuneros
// → Calle 4 este → Calle 5 → Calle 2 Este → Calle 3 → Barrio Sur Orientales
const IDA_COORDS = [
  { latitude: 2.9605383, longitude: -75.27236  }, // Claretiano (Calle 51) ✓
  { latitude: 2.96004,   longitude: -75.27486  }, // Popular ✓
  { latitude: 2.95975,   longitude: -75.27602  }, // Calle 51 ✓
  { latitude: 2.95885,   longitude: -75.27987  }, // Calle 51 → giro en Carrera 23 ✓
  { latitude: 2.9577,    longitude: -75.28001  }, // Calle 50 (inicio) ✓
  { latitude: 2.95723,   longitude: -75.28126  }, // Calle 50 ✓
  { latitude: 2.95607,   longitude: -75.28416  }, // Calle 50 ✓
  { latitude: 2.95494,   longitude: -75.28591  }, // Calle 50 ✓
  { latitude: 2.95379,   longitude: -75.28789  }, // Calle 50 continúa oeste ✓
  { latitude: 2.95526,   longitude: -75.28857  }, // Sube por Carrera 16 ✓
  { latitude: 2.95692,   longitude: -75.28925  }, // Carrera 7 ✓
  { latitude: 2.95921,   longitude: -75.28856  }, // Olímpica Carrera 7 ✓
  { latitude: 2.96106,   longitude: -75.28803  }, // Carrera 7 ✓
  { latitude: 2.96135,   longitude: -75.28875  }, // CAIMI Calle 64 ✓
  { latitude: 2.96334,   longitude: -75.2962   }, // Giro a Carrera 1 ✓
  { latitude: 2.96209,   longitude: -75.29652  }, // Carrera 1 bajando ✓
  { latitude: 2.96028,   longitude: -75.29681  }, // Carrera 1 ✓
  { latitude: 2.95372,   longitude: -75.29784  }, // Carrera 1 ✓
  { latitude: 2.9501,    longitude: -75.29825  }, // Carrera 1 ✓
  { latitude: 2.94445,   longitude: -75.29805  }, // Carrera 1 ✓
  { latitude: 2.94206,   longitude: -75.29791  }, // USCO ✓
  { latitude: 2.93778,   longitude: -75.29601  }, // Puente Pastrana → Carrera 2 ✓
  { latitude: 2.93496,   longitude: -75.29479  }, // Carrera 2 ✓
  { latitude: 2.93321,   longitude: -75.29395  }, // Carrera 2 ✓
  { latitude: 2.93133,   longitude: -75.29374  }, // Carrera 2 ✓
  { latitude: 2.92916,   longitude: -75.29294  }, // Carrera 2 ✓
  { latitude: 2.92695,   longitude: -75.29203  }, // Carrera 2 ✓
  { latitude: 2.92361,   longitude: -75.29074  }, // Carrera 2 ✓
  { latitude: 2.92311,   longitude: -75.29072  }, // Entrada glorieta ✓
  { latitude: 2.92279,   longitude: -75.2899   }, // Glorieta ✓
  { latitude: 2.92354,   longitude: -75.28751  }, // Calle 4 ✓
  { latitude: 2.92414,   longitude: -75.28583  }, // Calle 4 ✓
  { latitude: 2.9268,    longitude: -75.28643  }, // Carrera 7 ✓
  { latitude: 2.92724,   longitude: -75.28562  }, // Carrera 7 vuelta ✓
  { latitude: 2.92562,   longitude: -75.28504  }, // Carrera 8 ✓
  { latitude: 2.92447,   longitude: -75.27115  }, // Barrio Sur Orientales (fin IDA) ✓
];

// VUELTA (roja):
// Barrio Sur Orientales → Calle 4 oeste → norte a Calle 8 → Calle 8 oeste
// → sur a Calle 5 → Calle 5 oeste a Carrera 5
// → Carrera 5 norte → Calle 64 → Calle 50 este → Calle 51 → Claretiano
const VUELTA_COORDS = [
  { latitude: 2.92447,   longitude: -75.27115  }, // Barrio Sur Orientales (inicio VUELTA) ✓
  { latitude: 2.92585,   longitude: -75.28519  }, // Carrera 8 ✓
  { latitude: 2.92724,   longitude: -75.28562  }, // Carrera 8 ✓
  { latitude: 2.92698,   longitude: -75.2865   }, // Carrera 7 ✓
  { latitude: 2.92773,   longitude: -75.28669  }, // Carrera 7 ✓
  { latitude: 2.92925,   longitude: -75.28715  }, // Carrera 7 ✓
  { latitude: 2.93052,   longitude: -75.28746  }, // Carrera 7 ✓
  { latitude: 2.93005,   longitude: -75.28873  }, // Calle 11 ✓
  { latitude: 2.92968,   longitude: -75.28992  }, // Calle 11 → Carrera 5 ✓
  { latitude: 2.93036,   longitude: -75.29016  }, // Carrera 5 ✓
  { latitude: 2.93169,   longitude: -75.29063  }, // Carrera 5 ✓
  { latitude: 2.9343,    longitude: -75.29159  }, // Carrera 5 ✓
  { latitude: 2.93541,   longitude: -75.29475  }, // Avenida Segunda ✓
  { latitude: 2.93672,   longitude: -75.29533  }, // Avenida Segunda ✓
  { latitude: 2.93818,   longitude: -75.29599  }, // Avenida Segunda ✓
  { latitude: 2.94041,   longitude: -75.29695  }, // Avenida Segunda ✓
  { latitude: 2.94133,   longitude: -75.29762  }, // Avenida Segunda ✓
  { latitude: 2.94175,   longitude: -75.29755  }, // Puente USCO ✓
  { latitude: 2.94747,   longitude: -75.29611  }, // Puente USCO ✓
  { latitude: 2.96051,   longitude: -75.29299  }, // Norte av. Segunda ✓
  { latitude: 2.96087,   longitude: -75.29441  }, // Calle 59 → Carrera 1d ✓
  { latitude: 2.96264,   longitude: -75.29398  }, // Calle 64 ✓
  { latitude: 2.9624,    longitude: -75.29328  }, // Único ✓
  { latitude: 2.96135,   longitude: -75.28875  }, // CAIMI Calle 64 (= IDA) ✓
  { latitude: 2.96109,   longitude: -75.28818  }, // Carrera 7 ✓
  { latitude: 2.96021,   longitude: -75.28848  }, // Andinos Burger (= IDA) ✓
  { latitude: 2.95948,   longitude: -75.28868  }, // The Luxury Ice ✓
  { latitude: 2.9568,    longitude: -75.28945  }, // Carrera 7 ✓
  { latitude: 2.95526,   longitude: -75.28857  }, // Carrera 16 (= IDA) ✓
  { latitude: 2.95379,   longitude: -75.28789  }, // Calle 50 (= IDA) ✓
  { latitude: 2.95494,   longitude: -75.28591  }, // Calle 50 ✓
  { latitude: 2.95607,   longitude: -75.28416  }, // Calle 50 ✓
  { latitude: 2.95723,   longitude: -75.28126  }, // Calle 50 ✓
  { latitude: 2.9577,    longitude: -75.28001  }, // Calle 50 inicio (= IDA) ✓
  { latitude: 2.95885,   longitude: -75.27987  }, // Carrera 23 (= IDA) ✓
  { latitude: 2.95975,   longitude: -75.27602  }, // Calle 51 ✓
  { latitude: 2.96004,   longitude: -75.27486  }, // Popular ✓
  { latitude: 2.9605383, longitude: -75.27236  }, // Claretiano (fin VUELTA) ✓
];

// Los dos puntos terminales son compartidos entre IDA y VUELTA
const CLARETIANO  = IDA_COORDS[0];                      // Inicio IDA = Final VUELTA
const CAÑA_BRAVA  = IDA_COORDS[IDA_COORDS.length - 1]; // Final IDA  = Inicio VUELTA

const POINTS_OF_INTEREST = [
  { id: 1, name: 'USCO Sede Central',  latitude: 2.94199, longitude: -75.29852 },
  { id: 2, name: 'UNICO Outlet Neiva', latitude: 2.96188, longitude: -75.29339 },
  { id: 3, name: 'Homecenter Neiva',   latitude: 2.95397, longitude: -75.28666 },
  { id: 4, name: 'Comfamiliar Huila',  latitude: 2.93006, longitude: -75.28945 },
];

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

  const [userLocation, setUserLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [timeEstimate, setTimeEstimate] = useState(null);
  const [activeRoute, setActiveRoute] = useState('both');
  const [poisExpanded, setPoisExpanded] = useState(false);

  const toggleRoute = (route) =>
    setActiveRoute(prev => prev === route ? 'both' : route);

  const focusPOI = (poi) => {
    mapRef.current?.animateToRegion({
      latitude: poi.latitude,
      longitude: poi.longitude,
      latitudeDelta: 0.004,
      longitudeDelta: 0.004,
    }, 800);
  };

  const idaColor    = activeRoute === 'vuelta' ? 'rgba(76,175,80,0.15)'   : '#4CAF50';
  const vueltaColor = activeRoute === 'ida'    ? 'rgba(244,67,54,0.15)'   :
                      activeRoute === 'vuelta' ? '#F44336'                 : 'rgba(244,67,54,0.5)';

  useEffect(() => {
    getLocation();
    const socket = getSocket();
    socket.emit('user:request_drivers');
    socket.on('drivers:locations', setNearbyDrivers);
    return () => { socket.off('drivers:locations'); };
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
          <Polyline coordinates={IDA_COORDS}    strokeColor={idaColor}    strokeWidth={4} />
          <Polyline coordinates={VUELTA_COORDS} strokeColor={vueltaColor} strokeWidth={4} />

          <Marker coordinate={CLARETIANO}  title="Inicio IDA / Final VUELTA" description="Colegio Claretiano — Calle 51" pinColor="#4CAF50" />
          <Marker coordinate={CAÑA_BRAVA}  title="Final IDA / Inicio VUELTA" description="Barrio Sur Orientales — Sur Orientales" pinColor="#F44336" />

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

          {POINTS_OF_INTEREST.map((poi) => (
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

        <Text style={styles.legendTitle}>Referencias del mapa</Text>
        <View style={styles.legendGrid}>
          <TouchableOpacity style={[styles.legendItem, activeRoute === 'ida' && styles.legendItemActive]} onPress={() => toggleRoute('ida')}>
            <View style={[styles.legendLine, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>IDA{'\n'}Claretiano → Barrio Sur Orientales</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.legendItem, activeRoute === 'vuelta' && styles.legendItemActive]} onPress={() => toggleRoute('vuelta')}>
            <View style={[styles.legendLine, { backgroundColor: '#F44336' }]} />
            <Text style={styles.legendText}>VUELTA{'\n'}Barrio Sur Orientales → Claretiano</Text>
          </TouchableOpacity>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#1565C0' }]} />
            <Text style={styles.legendText}>Mi{'\n'}ubicación</Text>
          </View>
          <View style={styles.legendItem}>
            <Text style={{ fontSize: 16 }}>🚌</Text>
            <Text style={styles.legendText}>Conductor{'\n'}activo</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.poisHeader} onPress={() => setPoisExpanded(p => !p)}>
          <View style={styles.poisHeaderLeft}>
            <View style={styles.poisDot} />
            <Text style={styles.poisTitle}>Puntos de Interés</Text>
            <View style={styles.poisBadge}>
              <Text style={styles.poisBadgeText}>{POINTS_OF_INTEREST.length}</Text>
            </View>
          </View>
          <Text style={styles.poisChevron}>{poisExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {poisExpanded && (
          <View style={styles.poisList}>
            {POINTS_OF_INTEREST.map((poi) => (
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
  // Puntos de interés
  poisHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 10,
  },
  poisHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  poisDot: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: '#9C27B0',
  },
  poisTitle: { fontSize: 11, color: '#9E9E9E', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  poisBadge: {
    backgroundColor: '#F3E5F5', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1,
  },
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
  poiPin: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#9C27B0',
  },
  poiName: { flex: 1, fontSize: 13, color: '#212121', fontWeight: '500' },
  poiChevron: { fontSize: 18, color: '#BDBDBD' },
});
