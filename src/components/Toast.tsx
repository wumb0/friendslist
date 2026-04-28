import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface Props {
  message: string | null;
  onHide: () => void;
}

export function Toast({ message, onHide }: Props) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (!message) return;

    opacity.setValue(0);
    translateY.setValue(16);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 16, duration: 250, useNativeDriver: true }),
      ]).start(() => onHide());
    }, 2500);

    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: theme.isDark ? '#3A3A3C' : '#1C1C1E', opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 106,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
