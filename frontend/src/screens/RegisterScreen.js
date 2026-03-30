import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { CoomotorLogo } from '../components/CoomotorLogo';

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    document_type: '',
    document_number: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleRegister = async () => {
    if (!form.username.trim() || !form.email.trim() || !form.password.trim()) {
      Alert.alert('Error', 'Usuario, email y contraseña son requeridos');
      return;
    }
    if (form.password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const data = await authAPI.register(form);
      await login(data.user, data.token);
    } catch (error) {
      Alert.alert('Error', error.message || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1565C0" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <CoomotorLogo width={731} height={341} />
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <TextInput
              style={styles.input}
              value={form.full_name}
              onChangeText={(v) => update('full_name', v.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚ\s]/g, ''))}
              placeholder="Nombre Completo"
              placeholderTextColor="rgba(255,255,255,0.7)"
              autoCapitalize="words"
            />

            <TextInput
              style={styles.input}
              value={form.username}
              onChangeText={(v) => update('username', v)}
              placeholder="Ingresa tu nombre de usuario"
              placeholderTextColor="rgba(255,255,255,0.7)"
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              value={form.password}
              onChangeText={(v) => update('password', v)}
              placeholder="Ingresa tu contraseña"
              placeholderTextColor="rgba(255,255,255,0.7)"
              secureTextEntry
            />

            <TextInput
              style={styles.input}
              value={form.document_number}
              onChangeText={(v) => update('document_number', v)}
              placeholder="Ingresa tu documento"
              placeholderTextColor="rgba(255,255,255,0.7)"
              keyboardType="numeric"
            />

            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(v) => update('phone', v)}
              placeholder="Ingresa tu número de teléfono"
              placeholderTextColor="rgba(255,255,255,0.7)"
              keyboardType="phone-pad"
            />

            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(v) => update('email', v)}
              placeholder="Ingresa tu correo electrónico"
              placeholderTextColor="rgba(255,255,255,0.7)"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.registerButton, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#1565C0" />
              ) : (
                <Text style={styles.registerButtonText}>REGISTRARME</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginLinkText}>
                ¿Ya tienes una cuenta?{' '}
                <Text style={styles.loginLinkBold}>Iniciar sesión</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1565C0',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  brandPrefix: {
    color: '#FFFFFF',
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: -8,
    alignSelf: 'flex-start',
    marginLeft: 8,
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  brandSlogan: {
    color: '#FFFFFF',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: -4,
  },
  formContainer: {
    width: '100%',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  registerButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    color: '#1565C0',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1.5,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  loginLinkText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
  },
  loginLinkBold: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});
