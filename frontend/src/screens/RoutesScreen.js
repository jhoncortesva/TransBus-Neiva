import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  StatusBar, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { routesAPI } from '../services/api';

const FAVORITES_KEY = 'coomotor_favorite_routes';

export default function RoutesScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState(new Set());
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadRoutes = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await routesAPI.getAll();
      setRoutes(data.routes);
    } catch {
      setError('No se pudieron cargar las rutas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRoutes();
    AsyncStorage.getItem(FAVORITES_KEY).then((val) => {
      if (val) setFavorites(new Set(JSON.parse(val)));
    });
  }, []);

  const toggleFavorite = async (id) => {
    const next = new Set(favorites);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFavorites(next);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
  };

  const filtered = routes.filter((route) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      route.name.toLowerCase().includes(q) ||
      (route.description || '').toLowerCase().includes(q) ||
      (route.stops || '').toLowerCase().includes(q)
    );
  });

  const sorted = [
    ...filtered.filter((r) => favorites.has(r.id)),
    ...filtered.filter((r) => !favorites.has(r.id)),
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A237E" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rutas disponibles</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por número o sitio..."
          placeholderTextColor="#9E9E9E"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color="#1565C0" size="large" style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity onPress={() => loadRoutes()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadRoutes(true)} colors={['#1565C0']} />
          }
        >
          {sorted.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🚌</Text>
              <Text style={styles.emptyText}>
                {query ? `No se encontraron rutas para "${query}"` : 'No hay rutas disponibles'}
              </Text>
            </View>
          ) : (
            sorted.map((route) => {
              const isFav = favorites.has(route.id);
              const badgeText = route.name.split(' ')[0];
              return (
                <TouchableOpacity
                  key={route.id}
                  style={styles.routeCard}
                  onPress={() => navigation.navigate('RouteDetail', { route })}
                  activeOpacity={0.85}
                >
                  <View style={[styles.routeBadge, { backgroundColor: route.color || '#1565C0' }]}>
                    <Text style={styles.routeBadgeText}>{badgeText}</Text>
                  </View>
                  <View style={styles.routeInfo}>
                    <Text style={styles.routeName}>{route.name}</Text>
                    <Text style={styles.routeDescription}>{route.description}</Text>
                    <Text style={styles.routeStops} numberOfLines={2}>{route.stops}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => toggleFavorite(route.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.starBtn}
                  >
                    <Text style={[styles.star, isFav && styles.starActive]}>
                      {isFav ? '★' : '☆'}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FF' },
  header: {
    backgroundColor: '#1A237E',
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    padding: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)',
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', lineHeight: 22 },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 14,
    marginBottom: 4, borderRadius: 12, paddingHorizontal: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#212121' },
  clearBtn: { fontSize: 14, color: '#9E9E9E', paddingLeft: 8 },
  content: { padding: 16, gap: 14 },
  routeCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  routeBadge: {
    width: 56, height: 56, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  routeBadgeText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  routeInfo: { flex: 1, gap: 3 },
  routeName: { fontSize: 16, fontWeight: '700', color: '#1A237E' },
  routeDescription: { fontSize: 13, color: '#424242', fontWeight: '500' },
  routeStops: { fontSize: 11, color: '#9E9E9E', marginTop: 2 },
  starBtn: { paddingLeft: 4 },
  star: { fontSize: 24, color: '#BDBDBD' },
  starActive: { color: '#FFC107' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 14, color: '#9E9E9E', textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#1565C0', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8,
  },
  retryText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});
