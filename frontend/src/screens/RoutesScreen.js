import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  StatusBar, TouchableOpacity, ScrollView,
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

      <ScrollView contentContainerStyle={styles.content}>
        {ROUTES.map((route) => (
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
        ))}
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
  content: { padding: 20, gap: 14 },
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
});
