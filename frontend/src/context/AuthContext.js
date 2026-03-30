import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { getSocket } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const watchRef = useRef(null);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    await AsyncStorage.setItem('token', userToken);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
  };

  const updateUser = async (updatedFields) => {
    const updated = { ...user, ...updatedFields };
    setUser(updated);
    await AsyncStorage.setItem('user', JSON.stringify(updated));
  };

  const logout = async () => {
    if (watchRef.current) watchRef.current.remove();
    watchRef.current = null;
    setTracking(false);
    setUser(null);
    setToken(null);
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
  };

  const toggleTracking = async (userId, userName) => {
    if (tracking) {
      if (watchRef.current) watchRef.current.remove();
      watchRef.current = null;
      setTracking(false);
      getSocket().emit('driver:stop_location', { driverId: userId });
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Activa el permiso de ubicación en Ajustes.');
      return;
    }

    setTracking(true);
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 10 },
      (loc) => {
        getSocket().emit('driver:update_location', {
          driverId: userId,
          driverName: userName,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    );
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser, tracking, toggleTracking }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
