import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  BackHandler,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Image } from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';

export default function UserDashboard({ navigation }) {
  const { user, logout, tracking, toggleTracking } = useAuth();
  const isDriver = user?.role === 'driver';
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [exitModalVisible, setExitModalVisible] = useState(false);

  useEffect(() => {
    fetchLocation();
  }, []);

  const handleExitIntent = () => setExitModalVisible(true);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        handleExitIntent();
        return true;
      });
      return () => sub.remove();
    }, [])
  );

  const fetchLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permiso de ubicación denegado');
        setLocationLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(loc.coords);

      // Reverse geocode for short address
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (results.length > 0) {
          const r = results[0];
          const parts = [r.street, r.district || r.city].filter(Boolean);
          setAddress(parts.join(', '));
        }
      } catch (_) {}
    } catch {
      setLocationError('GPS no disponible');
    } finally {
      setLocationLoading(false);
    }
  };

  const mapRegion = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      }
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A237E" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>
            ¡Hola, {user?.username}!
          </Text>
          <Text style={styles.headerSubtitle}>Coomotor — Tu mejor compañía</Text>
        </View>
        <TouchableOpacity onPress={handleExitIntent} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Section label */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📍 Mi Ubicación</Text>
          {!locationLoading && !locationError && (
            <TouchableOpacity onPress={fetchLocation}>
              <Text style={styles.sectionAction}>Actualizar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Map preview card — tappable to expand */}
        <TouchableOpacity
          style={styles.mapCard}
          onPress={() => navigation.navigate('MapScreen')}
          activeOpacity={0.92}
        >
          {/* Map preview */}
          <View style={styles.mapPreviewWrapper}>
            {locationLoading ? (
              <View style={styles.mapPlaceholder}>
                <ActivityIndicator size="large" color="#1565C0" />
                <Text style={styles.mapPlaceholderText}>Obteniendo ubicación GPS...</Text>
              </View>
            ) : locationError ? (
              <View style={styles.mapPlaceholder}>
                <Text style={styles.mapErrorIcon}>📡</Text>
                <Text style={styles.mapPlaceholderText}>{locationError}</Text>
                <TouchableOpacity onPress={fetchLocation} style={styles.retrySmall}>
                  <Text style={styles.retrySmallText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : mapRegion ? (
              <MapView
                style={styles.mapPreview}

                region={mapRegion}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                pointerEvents="none"
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
                mapType="standard"
              >
                <Marker
                  coordinate={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                  }}
                >
                  <View style={styles.markerContainer}>
                    <View style={styles.markerDot} />
                    <View style={styles.markerRing} />
                  </View>
                </Marker>
              </MapView>
            ) : null}

            {/* Expand overlay hint */}
            {!locationLoading && !locationError && (
              <View style={styles.expandHint}>
                <Text style={styles.expandHintText}>Toca para expandir ↗</Text>
              </View>
            )}
          </View>

          {/* Address bar */}
          <View style={styles.addressBar}>
            <View style={styles.addressDot} />
            <View style={styles.addressContent}>
              {locationLoading ? (
                <Text style={styles.addressText}>Localizando...</Text>
              ) : locationError ? (
                <Text style={styles.addressErrorText}>Ubicación no disponible</Text>
              ) : (
                <>
                  <Text style={styles.addressText} numberOfLines={1}>
                    {address || 'Ubicación obtenida'}
                  </Text>
                  {location && (
                    <Text style={styles.coordsText}>
                      {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                    </Text>
                  )}
                </>
              )}
            </View>
            <Text style={styles.addressChevron}>›</Text>
          </View>
        </TouchableOpacity>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Accesos Rápidos</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('MapScreen')}
          >
            <Text style={styles.actionEmoji}>🗺️</Text>
            <Text style={styles.actionLabel}>Ver mapa</Text>
          </TouchableOpacity>

          {user?.role !== 'driver' && (
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('Routes')}
            >
              <Text style={styles.actionEmoji}>🚌</Text>
              <Text style={styles.actionLabel}>Rutas</Text>
            </TouchableOpacity>
          )}

          {isDriver && (
            <TouchableOpacity
              style={[styles.actionCard, tracking && styles.actionCardActive]}
              onPress={() => toggleTracking(user.id, user.fullName || user.username)}
            >
              <Text style={styles.actionEmoji}>{tracking ? '⏹️' : '📡'}</Text>
              <Text style={[styles.actionLabel, tracking && styles.actionLabelActive]}>
                {tracking ? 'Compartiendo' : 'Compartir\nubicación'}
              </Text>
              {tracking && <View style={styles.actionActiveDot} />}
            </TouchableOpacity>
          )}

        </View>

        {/* User info card → abre Ajustes */}
        <TouchableOpacity style={styles.userCard} onPress={() => navigation.navigate('Settings')} activeOpacity={0.85}>
          {user?.profilePhoto ? (
            <Image source={{ uri: user.profilePhoto }} style={styles.userAvatarImg} />
          ) : (
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {(user?.fullName || user?.username || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.fullName || user?.username}</Text>
            <Text style={styles.userEmail}>{user?.email || ''}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {user?.role === 'driver' ? '🚌 Conductor' : '👤 Usuario'}
              </Text>
            </View>
            {user?.role === 'driver' && (
              <Text style={styles.assignedRoute}>
                🗺️ Ruta {user?.assignedRoute || 'Sin asignar'}
              </Text>
            )}
          </View>
          <Text style={styles.chevronSettings}>›</Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>Versión 0.0.10 — Coomotor © 2027</Text>
      </ScrollView>

      <Modal transparent animationType="fade" visible={exitModalVisible} onRequestClose={() => setExitModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>¿Qué deseas hacer?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setExitModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnLogout} onPress={() => { setExitModalVisible(false); logout(); }}>
                <Text style={styles.modalBtnText}>Cerrar sesión</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnExit} onPress={() => { setExitModalVisible(false); BackHandler.exitApp(); }}>
                <Text style={styles.modalBtnText}>Salir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4FF',
  },
  header: {
    backgroundColor: '#1A237E',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerGreeting: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A237E',
    marginBottom: 12,
  },
  sectionAction: {
    fontSize: 13,
    color: '#1565C0',
    fontWeight: '600',
  },
  // Map card
  mapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#1A237E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  mapPreviewWrapper: {
    height: 190,
    position: 'relative',
  },
  mapPreview: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  mapPlaceholderText: {
    color: '#5C6BC0',
    fontSize: 14,
    fontWeight: '500',
  },
  mapErrorIcon: {
    fontSize: 36,
  },
  retrySmall: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
  },
  retrySmallText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  expandHint: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(26, 35, 126, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  expandHintText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
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
    borderWidth: 2.5,
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
  // Address bar
  addressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  addressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1565C0',
  },
  addressContent: {
    flex: 1,
  },
  addressText: {
    fontSize: 13,
    color: '#212121',
    fontWeight: '500',
  },
  addressErrorText: {
    fontSize: 13,
    color: '#9E9E9E',
  },
  coordsText: {
    fontSize: 11,
    color: '#9E9E9E',
    marginTop: 2,
  },
  addressChevron: {
    fontSize: 20,
    color: '#BDBDBD',
    fontWeight: '300',
  },
  // Quick actions grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    gap: 6,
  },
  actionCardDisabled: {
    opacity: 0.6,
  },
  actionCardActive: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: '#A5D6A7',
  },
  actionLabelActive: {
    color: '#2E7D32',
  },
  actionActiveDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  actionEmoji: {
    fontSize: 28,
  },
  actionLabel: {
    fontSize: 13,
    color: '#212121',
    fontWeight: '600',
  },
  actionBadge: {
    fontSize: 10,
    color: '#9E9E9E',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  // User card
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  userAvatarImg: {
    width: 52, height: 52, borderRadius: 26,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1A237E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
    gap: 3,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#212121',
  },
  userEmail: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 2,
  },
  roleBadgeText: {
    fontSize: 11,
    color: '#3949AB',
    fontWeight: '600',
  },
  assignedRoute: {
    fontSize: 11,
    color: '#3949AB',
    fontWeight: '600',
    marginTop: 3,
  },
  chevronSettings: {
    fontSize: 24,
    color: '#BDBDBD',
  },
  footerNote: {
    color: '#BDBDBD',
    fontSize: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    width: '82%',
    alignItems: 'center',
    elevation: 6,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A237E',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  modalBtnCancelText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  modalBtnLogout: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#1565C0',
    alignItems: 'center',
  },
  modalBtnExit: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#C62828',
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
});
