import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  StatusBar, TouchableOpacity, ScrollView, TextInput,
} from 'react-native';

const ROUTES = [
  {
    id: '247',
    name: '247 (28)',
    description: 'Colegio Claretiano → Barrio Sur Orientales',
    stops: 'USCO · Gaitán · Las Américas · Los Párques · Sur Orientales',
    color: '#1565C0',
  },
];

export default function RoutesScreen({ navigation }) {
  const [query, setQuery] = useState('');

  const filtered = ROUTES.filter((route) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      route.id.toLowerCase().includes(q) ||
      route.name.toLowerCase().includes(q) ||
      route.description.toLowerCase().includes(q) ||
      route.stops.toLowerCase().includes(q)
    );
  });

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

      <ScrollView contentContainerStyle={styles.content}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🚌</Text>
            <Text style={styles.emptyText}>No se encontraron rutas para "{query}"</Text>
          </View>
        ) : (
          filtered.map((route) => (
            <TouchableOpacity
              key={route.id}
              style={styles.routeCard}
              onPress={() => navigation.navigate('RouteDetail', { route })}
              activeOpacity={0.85}
            >
              <View style={[styles.routeBadge, { backgroundColor: route.color }]}>
                <Text style={styles.routeBadgeText}>{route.id}</Text>
              </View>
              <View style={styles.routeInfo}>
                <Text style={styles.routeName}>{route.name}</Text>
                <Text style={styles.routeDescription}>{route.description}</Text>
                <Text style={styles.routeStops} numberOfLines={2}>{route.stops}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
  searchInput: {
    flex: 1, paddingVertical: 12, fontSize: 14, color: '#212121',
  },
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
  chevron: { fontSize: 24, color: '#BDBDBD' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 14, color: '#9E9E9E', textAlign: 'center' },
});
