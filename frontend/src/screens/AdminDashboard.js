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
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../context/AuthContext';
import { driversAPI } from '../services/api';

const DOCUMENT_TYPES = ['CC', 'CE', 'TI', 'PASAPORTE'];

const initialForm = {
  full_name: '',
  document_type: 'CC',
  document_number: '',
  email: '',
  phone: '',
  bus_plate: '',
  username: '',
  password: '',
};

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('register'); // 'register' | 'list'
  const [form, setForm] = useState(initialForm);
  const [licenseFile, setLicenseFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [docTypeModal, setDocTypeModal] = useState(false);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const pickLicense = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setLicenseFile(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const handleRegisterDriver = async () => {
    const required = ['full_name', 'document_type', 'document_number', 'email', 'phone', 'bus_plate', 'username', 'password'];
    for (const field of required) {
      if (!form[field]?.trim()) {
        Alert.alert('Error', 'Todos los campos son requeridos');
        return;
      }
    }

    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));

      if (licenseFile) {
        formData.append('license_pdf', {
          uri: licenseFile.uri,
          type: 'application/pdf',
          name: licenseFile.name || 'license.pdf',
        });
      }

      const data = await driversAPI.create(formData);

      Alert.alert(
        '✅ Conductor Registrado',
        `Conductor: ${data.driver.full_name}\n\nCredenciales de acceso:\nUsuario: ${data.credentials.username}\nContraseña: ${data.credentials.password}\n\nComparte estas credenciales con el conductor.`,
        [{ text: 'Entendido', onPress: () => { setForm(initialForm); setLicenseFile(null); } }]
      );
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo registrar el conductor');
    } finally {
      setLoading(false);
    }
  };

  const loadDrivers = async () => {
    setLoadingDrivers(true);
    try {
      const data = await driversAPI.getAll();
      setDrivers(data.drivers);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los conductores');
    } finally {
      setLoadingDrivers(false);
    }
  };

  useEffect(() => {
    if (tab === 'list') loadDrivers();
  }, [tab]);

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

  const renderDriver = ({ item }) => (
    <View style={styles.driverCard}>
      <View style={styles.driverInfo}>
        <Text style={styles.driverName}>{item.full_name}</Text>
        <Text style={styles.driverDetail}>🪪 {item.document_type}: {item.document_number}</Text>
        <Text style={styles.driverDetail}>🚌 Placa: {item.bus_plate}</Text>
        <Text style={styles.driverDetail}>📱 {item.phone}</Text>
        <Text style={styles.driverDetail}>👤 Usuario: {item.username}</Text>
      </View>
      <TouchableOpacity
        style={[styles.statusBtn, item.is_active ? styles.activeBtn : styles.inactiveBtn]}
        onPress={() => handleToggleStatus(item.id, item.is_active)}
      >
        <Text style={styles.statusBtnText}>{item.is_active ? 'Activo' : 'Inactivo'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A237E" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Panel Administrador</Text>
          <Text style={styles.headerSub}>Coomotor — {user?.username}</Text>
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
          <Text style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>
            ➕ Registrar Conductor
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'list' && styles.tabActive]}
          onPress={() => setTab('list')}
        >
          <Text style={[styles.tabText, tab === 'list' && styles.tabTextActive]}>
            📋 Conductores
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'register' ? (
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Registrar Nuevo Conductor</Text>

          {/* Full name */}
          <Text style={styles.label}>Nombre Completo *</Text>
          <TextInput
            style={styles.input}
            value={form.full_name}
            onChangeText={(v) => update('full_name', v)}
            placeholder="Nombre completo del conductor"
          />

          {/* Document type */}
          <Text style={styles.label}>Tipo de Documento *</Text>
          <TouchableOpacity style={styles.picker} onPress={() => setDocTypeModal(true)}>
            <Text style={styles.pickerText}>{form.document_type}</Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          {/* Document number */}
          <Text style={styles.label}>Número de Documento *</Text>
          <TextInput
            style={styles.input}
            value={form.document_number}
            onChangeText={(v) => update('document_number', v)}
            placeholder="Número de documento"
            keyboardType="numeric"
          />

          {/* Email */}
          <Text style={styles.label}>Correo Electrónico *</Text>
          <TextInput
            style={styles.input}
            value={form.email}
            onChangeText={(v) => update('email', v)}
            placeholder="correo@ejemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Phone */}
          <Text style={styles.label}>Número de Celular *</Text>
          <TextInput
            style={styles.input}
            value={form.phone}
            onChangeText={(v) => update('phone', v)}
            placeholder="Número de celular"
            keyboardType="phone-pad"
          />

          {/* Bus plate */}
          <Text style={styles.label}>Placa del Bus *</Text>
          <TextInput
            style={styles.input}
            value={form.bus_plate}
            onChangeText={(v) => update('bus_plate', v.toUpperCase())}
            placeholder="ABC123"
            autoCapitalize="characters"
          />

          {/* Divider */}
          <View style={styles.divider} />
          <Text style={styles.sectionSubtitle}>Credenciales de Acceso</Text>

          {/* Username */}
          <Text style={styles.label}>Usuario *</Text>
          <TextInput
            style={styles.input}
            value={form.username}
            onChangeText={(v) => update('username', v)}
            placeholder="Nombre de usuario"
            autoCapitalize="none"
          />

          {/* Password */}
          <Text style={styles.label}>Contraseña *</Text>
          <TextInput
            style={styles.input}
            value={form.password}
            onChangeText={(v) => update('password', v)}
            placeholder="Contraseña temporal"
            secureTextEntry
          />

          {/* License PDF */}
          <Text style={styles.label}>Licencia de Conducción (PDF)</Text>
          <TouchableOpacity style={styles.fileButton} onPress={pickLicense}>
            <Text style={styles.fileButtonText}>
              {licenseFile ? `📄 ${licenseFile.name}` : '📎 Seleccionar PDF de licencia'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.buttonDisabled]}
            onPress={handleRegisterDriver}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>REGISTRAR CONDUCTOR</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadDrivers}>
            <Text style={styles.refreshText}>🔄 Actualizar lista</Text>
          </TouchableOpacity>
          {loadingDrivers ? (
            <ActivityIndicator color="#1565C0" size="large" style={{ marginTop: 40 }} />
          ) : drivers.length === 0 ? (
            <Text style={styles.emptyText}>No hay conductores registrados</Text>
          ) : (
            <FlatList
              data={drivers}
              renderItem={renderDriver}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
            />
          )}
        </View>
      )}

      {/* Document type modal */}
      <Modal visible={docTypeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tipo de Documento</Text>
            {DOCUMENT_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={styles.modalOption}
                onPress={() => { update('document_type', type); setDocTypeModal(false); }}
              >
                <Text style={[styles.modalOptionText, form.document_type === type && styles.modalOptionActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setDocTypeModal(false)}>
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
    backgroundColor: '#1A237E',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  logoutText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8EAF6' },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#1565C0' },
  tabText: { fontSize: 13, color: '#9E9E9E', fontWeight: '500' },
  tabTextActive: { color: '#1565C0', fontWeight: '700' },
  formContent: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A237E', marginBottom: 16 },
  sectionSubtitle: { fontSize: 15, fontWeight: '600', color: '#1565C0', marginBottom: 12 },
  divider: { height: 1, backgroundColor: '#E8EAF6', marginVertical: 16 },
  label: { fontSize: 13, color: '#424242', fontWeight: '500', marginBottom: 5 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#212121',
    marginBottom: 14,
  },
  picker: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: { fontSize: 14, color: '#212121' },
  pickerArrow: { fontSize: 12, color: '#757575' },
  fileButton: {
    backgroundColor: '#E8EAF6',
    borderRadius: 8,
    padding: 13,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#C5CAE9',
    borderStyle: 'dashed',
  },
  fileButtonText: { color: '#3949AB', fontSize: 14 },
  submitButton: {
    backgroundColor: '#1565C0',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, letterSpacing: 1 },
  // Drivers list
  refreshBtn: { margin: 16, alignSelf: 'flex-end' },
  refreshText: { color: '#1565C0', fontSize: 13 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#9E9E9E', fontSize: 15 },
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 15, fontWeight: 'bold', color: '#1A237E', marginBottom: 4 },
  driverDetail: { fontSize: 12, color: '#616161', marginBottom: 2 },
  statusBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginLeft: 10 },
  activeBtn: { backgroundColor: '#E8F5E9' },
  inactiveBtn: { backgroundColor: '#FFEBEE' },
  statusBtnText: { fontSize: 12, fontWeight: '600', color: '#424242' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A237E', marginBottom: 16, textAlign: 'center' },
  modalOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  modalOptionText: { fontSize: 15, color: '#424242', textAlign: 'center' },
  modalOptionActive: { color: '#1565C0', fontWeight: '700' },
  modalCancel: { paddingVertical: 14, marginTop: 4 },
  modalCancelText: { fontSize: 15, color: '#F44336', textAlign: 'center', fontWeight: '600' },
});
