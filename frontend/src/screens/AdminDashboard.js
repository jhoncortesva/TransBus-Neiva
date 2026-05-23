import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../context/AuthContext';
import { driversAPI, routesAPI } from '../services/api';

const DOCUMENT_TYPES = ['CC', 'CE', 'TI', 'PASAPORTE'];

const ROUTE_COLORS = [
  '#1565C0', '#E65100', '#6A1B9A', '#2E7D32',
  '#C62828', '#00695C', '#F9A825', '#4527A0',
];

const MAP_REGION = {
  latitude: 2.9435, longitude: -75.2820,
  latitudeDelta: 0.075, longitudeDelta: 0.040,
};

const initialDriverForm = {
  full_name: '', document_type: 'CC', document_number: '',
  email: '', phone: '', bus_plate: '', assigned_route: '',
  username: '', password: '',
};

const initialRouteForm = {
  name: '', description: '', stops: '', color: '#1565C0',
};

// ─── KML Parser ──────────────────────────────────────────────────────────────
function parseKML(kmlText) {
  const ida = [];
  const vuelta = [];
  const pois = [];

  const placemarkRegex = /<Placemark[\s\S]*?<\/Placemark>/gi;
  let match;
  while ((match = placemarkRegex.exec(kmlText)) !== null) {
    const block = match[0];
    const nameMatch = /<name>\s*([\s\S]*?)\s*<\/name>/i.exec(block);
    const rawName = nameMatch ? nameMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/s, '$1').trim() : '';

    if (/<LineString/i.test(block)) {
      const coordsMatch = /<coordinates>\s*([\s\S]*?)\s*<\/coordinates>/i.exec(block);
      if (coordsMatch) {
        const coords = coordsMatch[1].trim().split(/\s+/).reduce((acc, c) => {
          const parts = c.split(',');
          const lon = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lon)) acc.push({ latitude: lat, longitude: lon });
          return acc;
        }, []);
        if (rawName.toUpperCase().includes('IDA')) ida.push(...coords);
        else if (rawName.toUpperCase().includes('VUELTA')) vuelta.push(...coords);
      }
    } else if (/<Point/i.test(block)) {
      const coordsMatch = /<coordinates>\s*([\s\S]*?)\s*<\/coordinates>/i.exec(block);
      if (coordsMatch) {
        const parts = coordsMatch[1].trim().split(',');
        const lon = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lon)) pois.push({ name: rawName, latitude: lat, longitude: lon });
      }
    }
  }

  return { ida, vuelta, pois };
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('register'); // 'register' | 'list' | 'routes'

  // ── Driver form state ─────────────────────────────────────────────────────
  const [form, setForm] = useState(initialDriverForm);
  const [licenseFile, setLicenseFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [docTypeModal, setDocTypeModal] = useState(false);
  const [routeModal, setRouteModal] = useState(false);

  // ── Edit driver state ─────────────────────────────────────────────────────
  const [editModal, setEditModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editDocTypeModal, setEditDocTypeModal] = useState(false);
  const [editRouteModal, setEditRouteModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  // ── Routes tab state ──────────────────────────────────────────────────────
  const [routes, setRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [routeTabView, setRouteTabView] = useState('list'); // 'list' | 'form'
  const [editingRoute, setEditingRoute] = useState(null);
  const [routeForm, setRouteForm] = useState(initialRouteForm);
  const [kmlFile, setKmlFile] = useState(null);
  const [parsedKml, setParsedKml] = useState(null); // { ida, vuelta, pois }
  const [savingRoute, setSavingRoute] = useState(false);

  const updateEdit = (field, value) => setEditForm((prev) => ({ ...prev, [field]: value }));
  const updateRoute = (field, value) => setRouteForm((prev) => ({ ...prev, [field]: value }));

  // ── Load routes (used by driver pickers + routes tab) ─────────────────────
  const loadRoutes = async (quiet = false) => {
    if (!quiet) setLoadingRoutes(true);
    try {
      const data = await routesAPI.getAll();
      setRoutes(data.routes);
    } catch {
      if (!quiet) Alert.alert('Error', 'No se pudieron cargar las rutas');
    } finally {
      setLoadingRoutes(false);
    }
  };

  // Load routes on mount for picker modals
  useEffect(() => { loadRoutes(true); }, []);

  // ── Driver list ───────────────────────────────────────────────────────────
  const loadDrivers = async () => {
    setLoadingDrivers(true);
    try {
      const data = await driversAPI.getAll();
      setDrivers(data.drivers);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los conductores');
    } finally {
      setLoadingDrivers(false);
    }
  };

  useEffect(() => {
    if (tab === 'list') loadDrivers();
    if (tab === 'routes') loadRoutes();
  }, [tab]);

  // ── Driver form handlers ──────────────────────────────────────────────────
  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const pickLicense = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) setLicenseFile(result.assets[0]);
    } catch {
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const handleRegisterDriver = async () => {
    const required = ['full_name', 'document_type', 'document_number', 'email', 'phone', 'bus_plate', 'assigned_route', 'username', 'password'];
    for (const field of required) {
      if (!form[field]?.trim()) {
        Alert.alert('Error', 'Todos los campos son requeridos, incluyendo la ruta asignada');
        return;
      }
    }
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));
      if (licenseFile) {
        formData.append('license_pdf', { uri: licenseFile.uri, type: 'application/pdf', name: licenseFile.name || 'license.pdf' });
      }
      const data = await driversAPI.create(formData);
      Alert.alert(
        '✅ Conductor Registrado',
        `Conductor: ${data.driver.full_name}\n\nCredenciales de acceso:\nUsuario: ${data.credentials.username}\nContraseña: ${data.credentials.password}\n\nComparte estas credenciales con el conductor.`,
        [{ text: 'Entendido', onPress: () => { setForm(initialDriverForm); setLicenseFile(null); } }]
      );
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo registrar el conductor');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (driver) => {
    setEditingDriver(driver);
    setEditForm({
      full_name: driver.full_name || '', document_type: driver.document_type || 'CC',
      document_number: driver.document_number || '', email: driver.email || '',
      phone: driver.phone || '', bus_plate: driver.bus_plate || '',
      assigned_route: driver.assigned_route || '', new_password: '',
    });
    setEditModal(true);
  };

  const handleUpdateDriver = async () => {
    const required = ['full_name', 'document_type', 'document_number', 'email', 'phone', 'bus_plate', 'assigned_route'];
    for (const field of required) {
      if (!editForm[field]?.trim()) {
        Alert.alert('Error', 'Todos los campos son requeridos, incluyendo la ruta asignada');
        return;
      }
    }
    if (editForm.new_password && editForm.new_password.trim().length < 6) {
      Alert.alert('Error', 'La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    setEditLoading(true);
    try {
      const payload = { ...editForm };
      if (!payload.new_password?.trim()) delete payload.new_password;
      await driversAPI.update(editingDriver.id, payload);
      Alert.alert('✅ Conductor actualizado', 'Los datos se guardaron correctamente.');
      setEditModal(false);
      loadDrivers();
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo actualizar el conductor');
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    Alert.alert(
      'Confirmar',
      `¿${currentStatus ? 'Desactivar' : 'Activar'} este conductor?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await driversAPI.toggleStatus(id);
              loadDrivers();
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  // ── Routes tab handlers ───────────────────────────────────────────────────
  const openNewRouteForm = () => {
    setEditingRoute(null);
    setRouteForm(initialRouteForm);
    setKmlFile(null);
    setParsedKml(null);
    setRouteTabView('form');
  };

  const openEditRouteForm = (route) => {
    setEditingRoute(route);
    setRouteForm({
      name: route.name,
      description: route.description || '',
      stops: route.stops || '',
      color: route.color || '#1565C0',
    });
    setKmlFile(null);
    setParsedKml(null);
    setRouteTabView('form');
  };

  const pickKML = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.google-earth.kml+xml', 'text/xml', 'application/xml', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setKmlFile(asset);
      setParsedKml(null);
      try {
        const content = await FileSystem.readAsStringAsync(asset.uri);
        const parsed = parseKML(content);
        if (parsed.ida.length === 0 && parsed.vuelta.length === 0 && parsed.pois.length === 0) {
          Alert.alert('KML vacío', 'No se encontraron líneas IDA/VUELTA ni puntos de interés. Asegúrate de que los placemarks tengan "IDA" o "VUELTA" en su nombre.');
          return;
        }
        setParsedKml(parsed);
        Alert.alert(
          'KML importado',
          `IDA: ${parsed.ida.length} puntos\nVUELTA: ${parsed.vuelta.length} puntos\nPOIs: ${parsed.pois.length}`
        );
      } catch {
        Alert.alert('Error', 'No se pudo leer el archivo KML');
      }
    } catch {
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const handleSaveRoute = async () => {
    if (!routeForm.name.trim()) {
      Alert.alert('Error', 'El nombre de la ruta es requerido');
      return;
    }
    setSavingRoute(true);
    try {
      const payload = { ...routeForm };
      // Only include coords when a KML was imported (backend preserves existing ones otherwise)
      if (parsedKml) {
        payload.ida_coords = parsedKml.ida;
        payload.vuelta_coords = parsedKml.vuelta;
        payload.pois = parsedKml.pois;
      } else if (!editingRoute) {
        payload.ida_coords = [];
        payload.vuelta_coords = [];
        payload.pois = [];
      }
      if (editingRoute) {
        await routesAPI.update(editingRoute.id, payload);
        Alert.alert('✅ Ruta actualizada');
      } else {
        await routesAPI.create(payload);
        Alert.alert('✅ Ruta creada');
      }
      setRouteTabView('list');
      loadRoutes();
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo guardar la ruta');
    } finally {
      setSavingRoute(false);
    }
  };

  const handleDeleteRoute = (route) => {
    Alert.alert(
      'Eliminar ruta',
      `¿Eliminar la ruta "${route.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await routesAPI.delete(route.id);
              loadRoutes();
            } catch (error) {
              Alert.alert('Error', error.message || 'No se pudo eliminar la ruta');
            }
          },
        },
      ]
    );
  };

  // ── Map preview region ────────────────────────────────────────────────────
  const previewHasData = parsedKml && (parsedKml.ida.length > 0 || parsedKml.vuelta.length > 0);
  const previewRegion = (() => {
    if (!previewHasData) return MAP_REGION;
    const all = [...(parsedKml.ida), ...(parsedKml.vuelta)];
    if (!all.length) return MAP_REGION;
    const lats = all.map(c => c.latitude);
    const lons = all.map(c => c.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: (maxLat - minLat) * 1.4 + 0.005,
      longitudeDelta: (maxLon - minLon) * 1.4 + 0.005,
    };
  })();

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderDriver = ({ item }) => (
    <View style={styles.driverCard}>
      <View style={styles.driverInfo}>
        <Text style={styles.driverName}>{item.full_name}</Text>
        <Text style={styles.driverDetail}>🪪 {item.document_type}: {item.document_number}</Text>
        <Text style={styles.driverDetail}>🚌 Placa: {item.bus_plate}</Text>
        <Text style={styles.driverDetail}>🗺️ Ruta: {item.assigned_route || 'Sin asignar'}</Text>
        <Text style={styles.driverDetail}>📱 {item.phone}</Text>
        <Text style={styles.driverDetail}>👤 Usuario: {item.username}</Text>
      </View>
      <View style={styles.driverActions}>
        <TouchableOpacity
          style={[styles.statusBtn, item.is_active ? styles.activeBtn : styles.inactiveBtn]}
          onPress={() => handleToggleStatus(item.id, item.is_active)}
        >
          <Text style={styles.statusBtnText}>{item.is_active ? 'Activo' : 'Inactivo'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(item)}>
          <Text style={styles.editBtnText}>✏️ Editar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRouteItem = (route) => (
    <View key={route.id} style={styles.routeCard}>
      <View style={[styles.routeColorDot, { backgroundColor: route.color || '#1565C0' }]} />
      <View style={styles.routeInfo}>
        <Text style={styles.routeName}>{route.name}</Text>
        <Text style={styles.routeDesc} numberOfLines={1}>{route.description}</Text>
      </View>
      <View style={styles.routeActions}>
        <TouchableOpacity style={styles.routeEditBtn} onPress={() => openEditRouteForm(route)}>
          <Text style={styles.routeEditBtnText}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.routeDeleteBtn} onPress={() => handleDeleteRoute(route)}>
          <Text style={styles.routeDeleteBtnText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A237E" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Panel Administrador</Text>
          <Text style={styles.headerSub}>TransBus Neiva — {user?.username}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'register' && styles.tabActive]}
          onPress={() => setTab('register')}
        >
          <Text style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>➕ Conductor</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'list' && styles.tabActive]}
          onPress={() => setTab('list')}
        >
          <Text style={[styles.tabText, tab === 'list' && styles.tabTextActive]}>📋 Conductores</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'routes' && styles.tabActive]}
          onPress={() => setTab('routes')}
        >
          <Text style={[styles.tabText, tab === 'routes' && styles.tabTextActive]}>🗺️ Rutas</Text>
        </TouchableOpacity>
      </View>

      {/* ── Register Driver ── */}
      {tab === 'register' && (
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Registrar Nuevo Conductor</Text>

          <Text style={styles.label}>Nombre Completo *</Text>
          <TextInput style={styles.input} value={form.full_name} onChangeText={(v) => update('full_name', v)} placeholder="Nombre completo del conductor" />

          <Text style={styles.label}>Tipo de Documento *</Text>
          <TouchableOpacity style={styles.picker} onPress={() => setDocTypeModal(true)}>
            <Text style={styles.pickerText}>{form.document_type}</Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Número de Documento *</Text>
          <TextInput style={styles.input} value={form.document_number} onChangeText={(v) => update('document_number', v)} placeholder="Número de documento" keyboardType="numeric" />

          <Text style={styles.label}>Correo Electrónico *</Text>
          <TextInput style={styles.input} value={form.email} onChangeText={(v) => update('email', v)} placeholder="correo@ejemplo.com" keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.label}>Número de Celular *</Text>
          <TextInput style={styles.input} value={form.phone} onChangeText={(v) => update('phone', v)} placeholder="Número de celular" keyboardType="phone-pad" />

          <Text style={styles.label}>Placa del Bus *</Text>
          <TextInput style={styles.input} value={form.bus_plate} onChangeText={(v) => update('bus_plate', v.toUpperCase())} placeholder="ABC123" autoCapitalize="characters" />

          <Text style={styles.label}>Ruta Asignada *</Text>
          <TouchableOpacity style={styles.picker} onPress={() => setRouteModal(true)}>
            <Text style={[styles.pickerText, !form.assigned_route && { color: '#9E9E9E' }]}>
              {form.assigned_route || 'Seleccionar ruta...'}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          <View style={styles.divider} />
          <Text style={styles.sectionSubtitle}>Credenciales de Acceso</Text>

          <Text style={styles.label}>Usuario *</Text>
          <TextInput style={styles.input} value={form.username} onChangeText={(v) => update('username', v)} placeholder="Nombre de usuario" autoCapitalize="none" />

          <Text style={styles.label}>Contraseña *</Text>
          <TextInput style={styles.input} value={form.password} onChangeText={(v) => update('password', v)} placeholder="Contraseña temporal" secureTextEntry />

          <Text style={styles.label}>Licencia de Conducción (PDF)</Text>
          <TouchableOpacity style={styles.fileButton} onPress={pickLicense}>
            <Text style={styles.fileButtonText}>{licenseFile ? `📄 ${licenseFile.name}` : '📎 Seleccionar PDF de licencia'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.submitButton, loading && styles.buttonDisabled]} onPress={handleRegisterDriver} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>REGISTRAR CONDUCTOR</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Drivers List ── */}
      {tab === 'list' && (
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadDrivers}>
            <Text style={styles.refreshText}>🔄 Actualizar lista</Text>
          </TouchableOpacity>
          {loadingDrivers ? (
            <ActivityIndicator color="#1565C0" size="large" style={{ marginTop: 40 }} />
          ) : drivers.length === 0 ? (
            <Text style={styles.emptyText}>No hay conductores registrados</Text>
          ) : (
            <FlatList data={drivers} renderItem={renderDriver} keyExtractor={(item) => item.id} contentContainerStyle={{ padding: 16 }} />
          )}
        </View>
      )}

      {/* ── Routes Tab ── */}
      {tab === 'routes' && routeTabView === 'list' && (
        <View style={{ flex: 1 }}>
          <View style={styles.routesListHeader}>
            <Text style={styles.sectionTitle}>Rutas</Text>
            <TouchableOpacity style={styles.newRouteBtn} onPress={openNewRouteForm}>
              <Text style={styles.newRouteBtnText}>+ Nueva Ruta</Text>
            </TouchableOpacity>
          </View>
          {loadingRoutes ? (
            <ActivityIndicator color="#1565C0" size="large" style={{ marginTop: 40 }} />
          ) : routes.length === 0 ? (
            <Text style={styles.emptyText}>No hay rutas registradas</Text>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {routes.map(renderRouteItem)}
            </ScrollView>
          )}
        </View>
      )}

      {tab === 'routes' && routeTabView === 'form' && (
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formBackRow}>
            <TouchableOpacity onPress={() => setRouteTabView('list')} style={styles.formBackBtn}>
              <Text style={styles.formBackBtnText}>← Volver</Text>
            </TouchableOpacity>
            <Text style={styles.sectionTitle}>{editingRoute ? 'Editar Ruta' : 'Nueva Ruta'}</Text>
          </View>

          <Text style={styles.label}>Nombre de la Ruta *</Text>
          <TextInput style={styles.input} value={routeForm.name} onChangeText={(v) => updateRoute('name', v)} placeholder="Ej: 247 (28)" />

          <Text style={styles.label}>Descripción</Text>
          <TextInput style={styles.input} value={routeForm.description} onChangeText={(v) => updateRoute('description', v)} placeholder="Origen → Destino" />

          <Text style={styles.label}>Paradas principales</Text>
          <TextInput style={styles.input} value={routeForm.stops} onChangeText={(v) => updateRoute('stops', v)} placeholder="Parada 1 · Parada 2 · Parada 3" />

          <Text style={styles.label}>Color de la ruta</Text>
          <View style={styles.colorRow}>
            {ROUTE_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorSwatch, { backgroundColor: c }, routeForm.color === c && styles.colorSwatchSelected]}
                onPress={() => updateRoute('color', c)}
              />
            ))}
          </View>

          <View style={styles.divider} />
          <Text style={styles.sectionSubtitle}>Trazado de la Ruta (KML)</Text>
          <Text style={styles.kmlHint}>
            Exporta tu ruta desde Google My Maps como KML. Nombra las líneas "IDA" y "VUELTA" para que sean reconocidas automáticamente.
          </Text>

          <TouchableOpacity style={styles.fileButton} onPress={pickKML}>
            <Text style={styles.fileButtonText}>
              {kmlFile ? `📍 ${kmlFile.name}` : '📂 Seleccionar archivo KML'}
            </Text>
          </TouchableOpacity>

          {parsedKml && (
            <View style={styles.kmlSummary}>
              <Text style={styles.kmlSummaryText}>
                ✅ IDA: {parsedKml.ida.length} pts · VUELTA: {parsedKml.vuelta.length} pts · POIs: {parsedKml.pois.length}
              </Text>
            </View>
          )}

          {previewHasData && (
            <View style={styles.mapPreviewContainer}>
              <Text style={styles.mapPreviewLabel}>Vista previa</Text>
              <MapView style={styles.mapPreview} region={previewRegion} scrollEnabled={false} zoomEnabled={false} mapType="standard">
                {parsedKml.ida.length > 0 && <Polyline coordinates={parsedKml.ida} strokeColor="#4CAF50" strokeWidth={3} />}
                {parsedKml.vuelta.length > 0 && <Polyline coordinates={parsedKml.vuelta} strokeColor="#F44336" strokeWidth={3} />}
                {parsedKml.pois.map((poi, i) => (
                  <Marker key={i} coordinate={{ latitude: poi.latitude, longitude: poi.longitude }} title={poi.name} pinColor="#9C27B0" />
                ))}
              </MapView>
              <View style={styles.mapLegend}>
                <View style={styles.mapLegendItem}><View style={[styles.mapLegendLine, { backgroundColor: '#4CAF50' }]} /><Text style={styles.mapLegendText}>IDA</Text></View>
                <View style={styles.mapLegendItem}><View style={[styles.mapLegendLine, { backgroundColor: '#F44336' }]} /><Text style={styles.mapLegendText}>VUELTA</Text></View>
                <View style={styles.mapLegendItem}><View style={[styles.mapLegendDot, { backgroundColor: '#9C27B0' }]} /><Text style={styles.mapLegendText}>POI</Text></View>
              </View>
            </View>
          )}

          {editingRoute && !parsedKml && (
            <View style={styles.kmlNote}>
              <Text style={styles.kmlNoteText}>ℹ️ Sin nuevo KML: se conservan las coordenadas actuales de la ruta.</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, savingRoute && styles.buttonDisabled]}
            onPress={handleSaveRoute}
            disabled={savingRoute}
          >
            {savingRoute ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>{editingRoute ? 'GUARDAR CAMBIOS' : 'CREAR RUTA'}</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Modals ── */}
      <Modal visible={docTypeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tipo de Documento</Text>
            {DOCUMENT_TYPES.map((type) => (
              <TouchableOpacity key={type} style={styles.modalOption} onPress={() => { update('document_type', type); setDocTypeModal(false); }}>
                <Text style={[styles.modalOptionText, form.document_type === type && styles.modalOptionActive]}>{type}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setDocTypeModal(false)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={routeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ruta Asignada</Text>
            {routes.length === 0 ? (
              <Text style={styles.modalEmptyText}>No hay rutas disponibles</Text>
            ) : (
              routes.map((r) => (
                <TouchableOpacity key={r.id} style={styles.modalOption} onPress={() => { update('assigned_route', r.name); setRouteModal(false); }}>
                  <Text style={[styles.modalOptionText, form.assigned_route === r.name && styles.modalOptionActive]}>🚌 {r.name}</Text>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setRouteModal(false)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={editModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.editModalContent]}>
            <View style={styles.editModalHeader}>
              <Text style={styles.modalTitle}>Editar Conductor</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <Text style={styles.editModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Nombre Completo *</Text>
              <TextInput style={styles.input} value={editForm.full_name} onChangeText={(v) => updateEdit('full_name', v)} placeholder="Nombre completo" />

              <Text style={styles.label}>Tipo de Documento *</Text>
              <TouchableOpacity style={styles.picker} onPress={() => setEditDocTypeModal(true)}>
                <Text style={styles.pickerText}>{editForm.document_type}</Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Número de Documento *</Text>
              <TextInput style={styles.input} value={editForm.document_number} onChangeText={(v) => updateEdit('document_number', v)} placeholder="Número de documento" keyboardType="numeric" />

              <Text style={styles.label}>Correo Electrónico *</Text>
              <TextInput style={styles.input} value={editForm.email} onChangeText={(v) => updateEdit('email', v)} placeholder="correo@ejemplo.com" keyboardType="email-address" autoCapitalize="none" />

              <Text style={styles.label}>Número de Celular *</Text>
              <TextInput style={styles.input} value={editForm.phone} onChangeText={(v) => updateEdit('phone', v)} placeholder="Número de celular" keyboardType="phone-pad" />

              <Text style={styles.label}>Placa del Bus *</Text>
              <TextInput style={styles.input} value={editForm.bus_plate} onChangeText={(v) => updateEdit('bus_plate', v.toUpperCase())} placeholder="ABC123" autoCapitalize="characters" />

              <Text style={styles.label}>Ruta Asignada *</Text>
              <TouchableOpacity style={styles.picker} onPress={() => setEditRouteModal(true)}>
                <Text style={[styles.pickerText, !editForm.assigned_route && { color: '#9E9E9E' }]}>
                  {editForm.assigned_route || 'Seleccionar ruta...'}
                </Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </TouchableOpacity>

              <View style={styles.divider} />
              <Text style={styles.sectionSubtitle}>Cambiar Contraseña</Text>

              <Text style={styles.label}>Nueva Contraseña (opcional)</Text>
              <TextInput style={styles.input} value={editForm.new_password} onChangeText={(v) => updateEdit('new_password', v)} placeholder="Dejar vacío para no cambiar" secureTextEntry />

              <TouchableOpacity style={[styles.submitButton, editLoading && styles.buttonDisabled]} onPress={handleUpdateDriver} disabled={editLoading}>
                {editLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>GUARDAR CAMBIOS</Text>}
              </TouchableOpacity>
              <View style={{ height: 16 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={editDocTypeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tipo de Documento</Text>
            {DOCUMENT_TYPES.map((type) => (
              <TouchableOpacity key={type} style={styles.modalOption} onPress={() => { updateEdit('document_type', type); setEditDocTypeModal(false); }}>
                <Text style={[styles.modalOptionText, editForm.document_type === type && styles.modalOptionActive]}>{type}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setEditDocTypeModal(false)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={editRouteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ruta Asignada</Text>
            {routes.length === 0 ? (
              <Text style={styles.modalEmptyText}>No hay rutas disponibles</Text>
            ) : (
              routes.map((r) => (
                <TouchableOpacity key={r.id} style={styles.modalOption} onPress={() => { updateEdit('assigned_route', r.name); setEditRouteModal(false); }}>
                  <Text style={[styles.modalOptionText, editForm.assigned_route === r.name && styles.modalOptionActive]}>🚌 {r.name}</Text>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setEditRouteModal(false)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FF' },
  header: {
    backgroundColor: '#1A237E', paddingHorizontal: 20, paddingVertical: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  logoutText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8EAF6' },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#1565C0' },
  tabText: { fontSize: 12, color: '#9E9E9E', fontWeight: '500' },
  tabTextActive: { color: '#1565C0', fontWeight: '700' },
  formContent: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A237E', marginBottom: 16 },
  sectionSubtitle: { fontSize: 15, fontWeight: '600', color: '#1565C0', marginBottom: 12 },
  divider: { height: 1, backgroundColor: '#E8EAF6', marginVertical: 16 },
  label: { fontSize: 13, color: '#424242', fontWeight: '500', marginBottom: 5 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E0E0',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: '#212121', marginBottom: 14,
  },
  picker: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E0E0',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  pickerText: { fontSize: 14, color: '#212121' },
  pickerArrow: { fontSize: 12, color: '#757575' },
  fileButton: {
    backgroundColor: '#E8EAF6', borderRadius: 8, padding: 13,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: '#C5CAE9', borderStyle: 'dashed',
  },
  fileButtonText: { color: '#3949AB', fontSize: 14 },
  submitButton: { backgroundColor: '#1565C0', paddingVertical: 15, borderRadius: 10, alignItems: 'center' },
  buttonDisabled: { opacity: 0.7 },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, letterSpacing: 1 },
  // Drivers list
  refreshBtn: { margin: 16, alignSelf: 'flex-end' },
  refreshText: { color: '#1565C0', fontSize: 13 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#9E9E9E', fontSize: 15 },
  driverCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 15, fontWeight: 'bold', color: '#1A237E', marginBottom: 4 },
  driverDetail: { fontSize: 12, color: '#616161', marginBottom: 2 },
  driverActions: { alignItems: 'flex-end', gap: 8, marginLeft: 10 },
  statusBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  activeBtn: { backgroundColor: '#E8F5E9' },
  inactiveBtn: { backgroundColor: '#FFEBEE' },
  statusBtnText: { fontSize: 12, fontWeight: '600', color: '#424242' },
  editBtn: { backgroundColor: '#E8EAF6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  editBtnText: { fontSize: 12, fontWeight: '600', color: '#3949AB' },
  // Routes list
  routesListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  newRouteBtn: { backgroundColor: '#1565C0', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  newRouteBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  routeCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  routeColorDot: { width: 14, height: 14, borderRadius: 7 },
  routeInfo: { flex: 1 },
  routeName: { fontSize: 15, fontWeight: '700', color: '#1A237E' },
  routeDesc: { fontSize: 12, color: '#757575', marginTop: 2 },
  routeActions: { flexDirection: 'row', gap: 6 },
  routeEditBtn: { backgroundColor: '#E8EAF6', padding: 8, borderRadius: 8 },
  routeEditBtnText: { fontSize: 16 },
  routeDeleteBtn: { backgroundColor: '#FFEBEE', padding: 8, borderRadius: 8 },
  routeDeleteBtnText: { fontSize: 16 },
  // Route form
  formBackRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  formBackBtn: { paddingVertical: 4 },
  formBackBtnText: { color: '#1565C0', fontSize: 14, fontWeight: '600' },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorSwatchSelected: { borderWidth: 3, borderColor: '#212121' },
  kmlHint: { fontSize: 12, color: '#757575', marginBottom: 12, lineHeight: 17 },
  kmlSummary: { backgroundColor: '#E8F5E9', borderRadius: 8, padding: 10, marginTop: -12, marginBottom: 14 },
  kmlSummaryText: { fontSize: 13, color: '#2E7D32', fontWeight: '500' },
  kmlNote: { backgroundColor: '#E3F2FD', borderRadius: 8, padding: 10, marginBottom: 14 },
  kmlNoteText: { fontSize: 12, color: '#1565C0' },
  mapPreviewContainer: { marginBottom: 20 },
  mapPreviewLabel: { fontSize: 12, color: '#9E9E9E', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  mapPreview: { height: 200, borderRadius: 12, overflow: 'hidden' },
  mapLegend: { flexDirection: 'row', gap: 16, marginTop: 8 },
  mapLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapLegendLine: { width: 16, height: 3, borderRadius: 2 },
  mapLegendDot: { width: 10, height: 10, borderRadius: 5 },
  mapLegendText: { fontSize: 11, color: '#616161' },
  // Edit modal
  editModalContent: { maxHeight: '92%' },
  editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  editModalClose: { fontSize: 18, color: '#9E9E9E', paddingHorizontal: 4 },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A237E', marginBottom: 16, textAlign: 'center' },
  modalOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  modalOptionText: { fontSize: 15, color: '#424242', textAlign: 'center' },
  modalOptionActive: { color: '#1565C0', fontWeight: '700' },
  modalCancel: { paddingVertical: 14, marginTop: 4 },
  modalCancelText: { fontSize: 15, color: '#F44336', textAlign: 'center', fontWeight: '600' },
  modalEmptyText: { fontSize: 14, color: '#9E9E9E', textAlign: 'center', paddingVertical: 16 },
});
