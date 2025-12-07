import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SplashAnimation from '../components/SplashAnimation';

export default function SplashScreen() {
  const router = useRouter();
  const [animationFinished, setAnimationFinished] = React.useState(false);

  useEffect(() => {
    if (animationFinished) {
      checkAuth();
    }
  }, [animationFinished]);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const onboardingCompleted = await AsyncStorage.getItem('onboardingCompleted');

      if (token) {
        router.replace('/(tabs)/home');
      } else if (onboardingCompleted) {
        router.replace('/auth/phone');
      } else {
        router.replace('/onboarding');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      router.replace('/onboarding');
    }
  };

  if (!animationFinished) {
    return <SplashAnimation onAnimationComplete={() => setAnimationFinished(true)} />;
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  version: {
    position: 'absolute',
    bottom: 40,
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.7,
  },
});
