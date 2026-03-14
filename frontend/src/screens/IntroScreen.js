import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { CoomotorLogo } from '../components/CoomotorLogo';

export default function IntroScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1565C0" />

      {/* Logo Area */}
      <View style={styles.logoArea}>
        <CoomotorLogo width={731} height={341} />
      </View>

      {/* Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>YA TENGO UNA CUENTA</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Register')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>QUIERO HACER PARTE</Text>
        </TouchableOpacity>
      </View>
            {/* Brand Name */}
      <View style={styles.brandContainer}>
        <Text style={styles.brandName}></Text>
        <Text style={styles.brandSlogan}></Text>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1565C0',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  logoArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonsContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#1565C0',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1,
  },
  brandContainer: {
    alignItems: 'center',
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: 'bold',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  brandSlogan: {
    color: '#FFFFFF',
    fontSize: 14,
    fontStyle: 'italic',
    letterSpacing: 0.5,
    marginTop: -4,
  },
});
