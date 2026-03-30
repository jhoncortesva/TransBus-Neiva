import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TouchableOpacity, TextInput, Alert, ScrollView, Modal,
  ActivityIndicator, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

export default function SettingsScreen({ navigation }) {
  const { user, updateUser } = useAuth();

  const [passwordModal, setPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingPhoto, setLoadingPhoto] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Todos los campos son obligatorios');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas nuevas no coinciden');
      return;
    }
    setLoadingPassword(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      Alert.alert('Éxito', 'Contraseña actualizada correctamente');
      setPasswordModal(false);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo actualizar la contraseña');
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleChangePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para cambiar la foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (result.canceled) return;

    setLoadingPhoto(true);
    try {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      await authAPI.updatePhoto(base64);
      await updateUser({ profilePhoto: base64 });
      Alert.alert('Éxito', 'Foto de perfil actualizada');
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo actualizar la foto');
    } finally {
      setLoadingPhoto(false);
    }
  };

  const initial = (user?.fullName || user?.username || 'U')[0].toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A237E" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajustes</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Foto de perfil */}
        <View style={styles.profileSection}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={handleChangePhoto} disabled={loadingPhoto}>
            {user?.profilePhoto ? (
              <Image source={{ uri: user.profilePhoto }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
            )}
            <View style={styles.avatarEditBtn}>
              {loadingPhoto
                ? <ActivityIndicator size="small" color="#1565C0" />
                : <Text style={styles.avatarEditIcon}>📷</Text>
              }
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{user?.fullName || user?.username}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
        </View>

        {/* Opciones */}
        <Text style={styles.sectionLabel}>Cuenta</Text>
        <View style={styles.optionsCard}>

          <TouchableOpacity style={styles.option} onPress={() => setPasswordModal(true)}>
            <Text style={styles.optionIcon}>🔑</Text>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Cambiar contraseña</Text>
              <Text style={styles.optionSub}>Actualiza tu contraseña de acceso</Text>
            </View>
            <Text style={styles.optionChevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.option} onPress={() => Alert.alert('Soporte', 'Próximamente podrás contactar a soporte desde aquí.')}>
            <Text style={styles.optionIcon}>📞</Text>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Soporte</Text>
              <Text style={styles.optionSub}>Contáctanos si tienes algún problema</Text>
            </View>
            <Text style={styles.optionChevron}>›</Text>
          </TouchableOpacity>

        </View>

      </ScrollView>

      {/* Modal cambiar contraseña */}
      <Modal transparent animationType="slide" visible={passwordModal} onRequestClose={() => setPasswordModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Cambiar contraseña</Text>

            <TextInput
              style={styles.modalInput}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Contraseña actual"
              placeholderTextColor="#9E9E9E"
              secureTextEntry
            />
            <TextInput
              style={styles.modalInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Nueva contraseña"
              placeholderTextColor="#9E9E9E"
              secureTextEntry
            />
            <TextInput
              style={styles.modalInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirmar nueva contraseña"
              placeholderTextColor="#9E9E9E"
              secureTextEntry
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setPasswordModal(false)}>
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirm} onPress={handleChangePassword} disabled={loadingPassword}>
                {loadingPassword
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.modalBtnConfirmText}>Guardar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  content: { padding: 20, gap: 16 },
  profileSection: { alignItems: 'center', paddingVertical: 16, gap: 6 },
  avatarWrapper: { position: 'relative', marginBottom: 4 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#1565C0', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1565C0', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  avatarImage: {
    width: 88, height: 88, borderRadius: 44,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  avatarText: { color: '#FFFFFF', fontSize: 36, fontWeight: 'bold' },
  avatarEditBtn: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 5,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
  },
  avatarEditIcon: { fontSize: 16 },
  profileName: { fontSize: 18, fontWeight: '700', color: '#1A237E' },
  profileEmail: { fontSize: 13, color: '#757575' },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#9E9E9E',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: -8,
  },
  optionsCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  option: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  optionIcon: { fontSize: 22 },
  optionContent: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '600', color: '#212121' },
  optionSub: { fontSize: 12, color: '#9E9E9E', marginTop: 2 },
  optionChevron: { fontSize: 22, color: '#BDBDBD' },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginHorizontal: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1A237E', marginBottom: 4 },
  modalInput: {
    backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 14, color: '#212121',
  },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtnCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#F0F0F0', alignItems: 'center',
  },
  modalBtnCancelText: { fontSize: 14, color: '#555', fontWeight: '500' },
  modalBtnConfirm: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#1565C0', alignItems: 'center',
  },
  modalBtnConfirmText: { fontSize: 14, color: '#FFFFFF', fontWeight: '600' },
});
