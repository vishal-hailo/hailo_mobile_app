import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  Animated,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';


// API_URL from environment variable
const API_URL = 'http://localhost:3001';

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [locations, setLocations] = useState([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pulseAnim] = useState(new Animated.Value(1));



  useEffect(() => {
    loadData();
    startPulseAnimation();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const loadData = async () => {
    try {
      setError(null);
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        setUser(JSON.parse(userStr));
      }

      // Load user's saved locations
      const token = await AsyncStorage.getItem('authToken');
      const locationsResponse = await axios.get(`${API_URL}/api/v1/locations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const userLocations = locationsResponse.data || [];
      setLocations(userLocations);

      if (userLocations.length === 0) {
        setLoading(false);
        return;
      }

      // Generate common routes from saved locations
      await generateRoutes(userLocations);

    } catch (error: any) {
      console.error('Load error:', error);
      if (error.response?.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        await AsyncStorage.clear();
        router.replace('/auth/phone');
      } else if (error.code === 'ERR_NETWORK' || error.message.includes('Network')) {
        setError('No internet connection. Pull to refresh when online.');
      } else {
        setError('Failed to load data. Pull to refresh to try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const generateRoutes = async (userLocations: any[]) => {
    const token = await AsyncStorage.getItem('authToken');
    const generatedRoutes = [];

    // Find Home and Office locations
    const homeLocation = userLocations.find(loc => loc.type === 'HOME');
    const officeLocation = userLocations.find(loc => loc.type === 'OFFICE');

    // If both Home and Office exist, create bidirectional routes
    if (homeLocation && officeLocation) {
      // Home to Office
      try {
        const toWorkResponse = await axios.post(
          `${API_URL}/api/v1/commute/search`,
          {
            mode: 'EXPLORER',
            origin: { latitude: homeLocation.latitude, longitude: homeLocation.longitude },
            destination: { latitude: officeLocation.latitude, longitude: officeLocation.longitude },
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        generatedRoutes.push({
          id: 'home-to-office',
          title: 'Go to Work',
          from: homeLocation,
          to: officeLocation,
          estimate: toWorkResponse.data,
          icon: 'briefcase',
        });
      } catch (error) {
        console.error('Load home-to-office estimate error:', error);
      }

      // Office to Home
      try {
        const toHomeResponse = await axios.post(
          `${API_URL}/api/v1/commute/search`,
          {
            mode: 'EXPLORER',
            origin: { latitude: officeLocation.latitude, longitude: officeLocation.longitude },
            destination: { latitude: homeLocation.latitude, longitude: homeLocation.longitude },
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        generatedRoutes.push({
          id: 'office-to-home',
          title: 'Go Home',
          from: officeLocation,
          to: homeLocation,
          estimate: toHomeResponse.data,
          icon: 'home',
        });
      } catch (error) {
        console.error('Load office-to-home estimate error:', error);
      }
    }

    // Add other common routes (first 3 OTHER locations)
    const otherLocations = userLocations.filter(loc => loc.type === 'OTHER').slice(0, 3);
    if (homeLocation) {
      for (const otherLoc of otherLocations) {
        try {
          const response = await axios.post(
            `${API_URL}/api/v1/commute/search`,
            {
              mode: 'EXPLORER',
              origin: { latitude: homeLocation.latitude, longitude: homeLocation.longitude },
              destination: { latitude: otherLoc.latitude, longitude: otherLoc.longitude },
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          generatedRoutes.push({
            id: `home-to-${otherLoc.id}`,
            title: `To ${otherLoc.label}`,
            from: homeLocation,
            to: otherLoc,
            estimate: response.data,
            icon: 'location',
          });
        } catch (error) {
          console.error(`Load route to ${otherLoc.label} error:`, error);
        }
      }
    }

    setRoutes(generatedRoutes);
  };

  const handleSmartBook = async (estimate: any) => {
    if (!estimate) return;

    try {
      const token = await AsyncStorage.getItem('authToken');
      await axios.post(
        `${API_URL}/api/v1/commute/handoff`,
        { commuteLogId: estimate.commuteLogId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const supported = await Linking.canOpenURL(estimate.deepLinkUrl);
      if (supported) {
        await Linking.openURL(estimate.deepLinkUrl);
      } else {
        Alert.alert('Error', 'Cannot open Uber app. Please install Uber.');
      }
    } catch (error) {
      console.error('Smart book error:', error);
      Alert.alert('Error', 'Failed to open Uber. Please try again.');
    }
  };

  const handleViewSurgeRadar = (route: any) => {
    router.push({
      pathname: '/surge-radar',
      params: {
        originLat: route.from.latitude,
        originLng: route.from.longitude,
        destLat: route.to.latitude,
        destLng: route.to.longitude,
        routeName: `${route.from.label} → ${route.to.label}`,
      },
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getSurgeEmoji = (surgePercent?: number) => {
    if (!surgePercent || surgePercent < 5) return '🟢';
    if (surgePercent < 15) return '🟡';
    return '🔴';
  };

  const handleQuickSearch = () => {
    router.push('/plan-ride');
  };

  // Show UI regardless of saved locations - quick search is always available
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF6B35']}
            tintColor="#FF6B35"
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {getGreeting()}, {user?.name || 'there'}!
            </Text>
            <Text style={styles.time}>
              {new Date().toLocaleTimeString('en-US', {
                weekday: 'long',
                day: 'numeric',
                month: 'short'
              })}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/locations-manager')}
          >
            <Ionicons name="person-circle-outline" size={32} color="#4B5563" />
          </TouchableOpacity>
        </View>

        {/* 1. Main Action: Search */}
        <TouchableOpacity style={styles.heroSearch} onPress={handleQuickSearch}>
          <Text style={styles.heroTitle}>Where to?</Text>
          <View style={styles.heroInputLike}>
            <Ionicons name="search" size={20} color="#1F2937" />
            <Text style={styles.heroPlaceholder}>Search destination</Text>
            <View style={styles.timeBadge}>
              <Ionicons name="time" size={12} color="#FFFFFF" />
              <Text style={styles.timeBadgeText}>Now</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* 2. Quick Shortcuts (Horizontal) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Favorites</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shortcutScroll}>
            <TouchableOpacity style={styles.shortcutItem} onPress={() => router.push('/plan-ride')}>
              <View style={[styles.shortcutIcon, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="home" size={24} color="#0284C7" />
              </View>
              <Text style={styles.shortcutLabel}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutItem} onPress={() => router.push('/plan-ride')}>
              <View style={[styles.shortcutIcon, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="briefcase" size={24} color="#16A34A" />
              </View>
              <Text style={styles.shortcutLabel}>Work</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutItem} onPress={() => router.push('/plan-ride')}>
              <View style={[styles.shortcutIcon, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="barbell" size={24} color="#DC2626" />
              </View>
              <Text style={styles.shortcutLabel}>Gym</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutItem} onPress={() => router.push('/plan-ride')}>
              <View style={[styles.shortcutIcon, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="airplane" size={24} color="#EA580C" />
              </View>
              <Text style={styles.shortcutLabel}>Airport</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutItem} onPress={() => router.push('/locations-manager')}>
              <View style={[styles.shortcutIcon, { backgroundColor: '#F3F4F6' }]}>
                <Ionicons name="add" size={24} color="#4B5563" />
              </View>
              <Text style={styles.shortcutLabel}>More</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* 3. Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent</Text>
          {/* Mock Data for aesthetics - in real app, fetch from history */}
          <View style={styles.recentList}>
            <TouchableOpacity style={styles.recentItem} onPress={() => router.push('/plan-ride')}>
              <Ionicons name="location-outline" size={24} color="#6B7280" style={styles.recentIcon} />
              <View style={styles.recentInfo}>
                <Text style={styles.recentLabel}>Bandra Station</Text>
                <Text style={styles.recentSub}>Bandra West</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.recentItem} onPress={() => router.push('/plan-ride')}>
              <Ionicons name="location-outline" size={24} color="#6B7280" style={styles.recentIcon} />
              <View style={styles.recentInfo}>
                <Text style={styles.recentLabel}>High Street Phoenix</Text>
                <Text style={styles.recentSub}>Lower Parel</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.recentItem} onPress={() => router.push('/plan-ride')}>
              <Ionicons name="location-outline" size={24} color="#6B7280" style={styles.recentIcon} />
              <View style={styles.recentInfo}>
                <Text style={styles.recentLabel}>Juhu Beach</Text>
                <Text style={styles.recentSub}>Vile Parle</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. Commute Routes (Existing Logic, reimagined) */}
        {routes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Commute Suggestions</Text>
            {routes.map((route) => (
              <TouchableOpacity
                key={route.id}
                style={styles.commuteCard}
                onPress={() => handleViewSurgeRadar(route)}
              >
                <View style={[styles.commuteIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name={route.icon} size={24} color="#2563EB" />
                </View>
                <View style={styles.commuteInfo}>
                  <Text style={styles.commuteLabel}>{route.title}</Text>
                  <Text style={styles.commuteSub}>
                    {route.estimate.etaMinutes} mins • {getSurgeEmoji(route.estimate.surgePercent)}
                  </Text>
                </View>
                <View style={styles.commutePrice}>
                  <Text style={styles.commutePriceText}>₹{route.estimate.estimateMin}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  time: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  profileButton: {
    padding: 4,
  },

  // Hero Search
  heroSearch: {
    margin: 20,
    padding: 24,
    backgroundColor: '#F3F4F6', // Lighter background for the container
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 16,
  },
  heroInputLike: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  heroPlaceholder: {
    flex: 1,
    fontSize: 18,
    color: '#1F2937',
    fontWeight: '600',
    marginLeft: 12,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  timeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 20,
    marginBottom: 12,
  },

  // Shortcuts
  shortcutScroll: {
    paddingLeft: 20,
  },
  shortcutItem: {
    alignItems: 'center',
    marginRight: 20,
    width: 60,
  },
  shortcutIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  shortcutLabel: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },

  // Recent
  recentList: {
    paddingHorizontal: 20,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  recentIcon: {
    marginRight: 16,
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 8,
  },
  recentInfo: {
    flex: 1,
  },
  recentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  recentSub: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },

  // Commute Cards (Re-styled)
  commuteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  commuteIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  commuteInfo: {
    flex: 1,
  },
  commuteLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  commuteSub: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  commutePrice: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  commutePriceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  quickSearchIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickSearchContent: {
    flex: 1,
  },
  quickSearchTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  quickSearchHint: {
    fontSize: 14,
    color: '#6B7280',
  },
  noLocationsPrompt: {
    backgroundColor: '#F9FAFB',
    marginHorizontal: 24,
    marginBottom: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '# E5E7EB',
    borderStyle: 'dashed',
  },
  noLocationsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  addLocationLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addLocationLinkText: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
  },
});
