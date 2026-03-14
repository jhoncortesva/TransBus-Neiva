import React from 'react';
import { Image, StyleSheet } from 'react-native';

// Imagen principal (fondo azul): frontend/assets/logo.png
// Imagen alternativa (fondo blanco): frontend/assets/logo_login.png
const defaultSource = require('../../assets/logo.png');
const loginSource = require('../../assets/logo_login.png');

export const CoomotorLogo = ({ width = 200, height = 140, variant = 'default', style }) => {
  const source = variant === 'login' ? loginSource : defaultSource;
  return (
    <Image
      source={source}
      style={[{ width, height }, styles.image, style]}
      resizeMode="contain"
    />
  );
};

const styles = StyleSheet.create({
  image: {
    alignSelf: 'center',
  },
});
