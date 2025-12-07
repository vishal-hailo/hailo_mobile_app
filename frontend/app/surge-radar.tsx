import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
// API_URL from environment variable
const API_URL = 'http://localhost:3001';
const { width } = Dimensions.get('window');

export default function SurgeRadarScreen() {
  const router = useRouter();
  const { originLat, originLng, destLat, destLng, routeName } = useLocalSearchParams();
  const [surgeData, setSurgeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSurgeData();
  }, []);

  const loadSurgeData = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.post(
        `${API_URL}/api/v1/commute/time-suggestions`,
        {
          origin: {
            latitude: parseFloat(originLat as string),
            longitude: parseFloat(originLng as string),
          },
          destination: {
            latitude: parseFloat(destLat as string),
            longitude: parseFloat(destLng as string),
          },
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSurgeData(response.data);
    } catch (error) {
      console.error('Load surge data error:', error);
      Alert.alert('Error', 'Failed to load time suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleBookOptimal = async () => {
    if (!surgeData?.bestSlot) return;

    const oLat = Array.isArray(originLat) ? originLat[0] : originLat;
    const oLng = Array.isArray(originLng) ? originLng[0] : originLng;
    const dLat = Array.isArray(destLat) ? destLat[0] : destLat;
    const dLng = Array.isArray(destLng) ? destLng[0] : destLng;

    const deepLink = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${oLat}&pickup[longitude]=${oLng}&dropoff[latitude]=${dLat}&dropoff[longitude]=${dLng}`;

    try {
      const supported = await Linking.canOpenURL(deepLink);
      if (supported) {
        await Linking.openURL(deepLink);
        router.replace('/success');
      } else {
        Alert.alert('Error', 'Cannot open Uber app');
      }
    } catch (error) {
      console.error('Book optimal error:', error);
    }
  };

  const getColorForTraffic = (level: string) => {
    if (level === 'low') return '#10B981';
    if (level === 'medium') return '#F59E0B';
    return '#EF4444';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading insights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Surge Radar</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* 1. Status Header */}
        <View style={styles.statusCard}>
          <View style={[styles.statusIcon, {
            backgroundColor: surgeData?.bestSlot?.multiplier > 1.1 ? '#FEE2E2' : '#ECFDF5'
          }]}>
            <Ionicons
              name={surgeData?.bestSlot?.multiplier > 1.1 ? "trending-up" : "shield-checkmark"}
              size={32}
              color={surgeData?.bestSlot?.multiplier > 1.1 ? "#EF4444" : "#10B981"}
            />
          </View>
          <Text style={styles.statusTitle}>
            {surgeData?.bestSlot?.multiplier > 1.1 ? "Surge is Active" : "Fair Fare Active"}
          </Text>
          <Text style={styles.statusSub}>
            {surgeData?.bestSlot?.multiplier > 1.1
              ? "Demand is higher than usual."
              : "Prices are standard right now."}
          </Text>
        </View>

        {surgeData && (
          <View style={styles.optionsContainer}>
            {/* Option A: NOW */}
            <TouchableOpacity
              style={[styles.optionCard, styles.optionCardSelected]}
              onPress={() => { }} // Could track selection
            >
              <View style={styles.optionHeader}>
                <Text style={styles.optionTitle}>Book Now</Text>
                {surgeData.suggestions[0].multiplier <= 1.1 && (
                  <View style={styles.badgeGreen}>
                    <Text style={styles.badgeText}>Best Value</Text>
                  </View>
                )}
              </View>
              <View style={styles.optionRow}>
                <Text style={styles.optionPrice}>₹{surgeData.suggestions[0].estimate}</Text>
                <Text style={styles.optionTime}>Picking up in 3 mins</Text>
              </View>
              <TouchableOpacity style={styles.bookButton} onPress={handleBookOptimal}>
                <Text style={styles.bookButtonText}>Request Ride</Text>
              </TouchableOpacity>
            </TouchableOpacity>

            {/* Option B: LATER (Only if savings exist) */}
            {surgeData.potentialSaving > 0 && (
              <View style={styles.optionCard}>
                <View style={styles.optionHeader}>
                  <Text style={styles.optionTitle}>Book Later</Text>
                  <View style={styles.badgeOrange}>
                    <Text style={styles.badgeText}>Save ₹{surgeData.potentialSaving}</Text>
                  </View>
                </View>
                <Text style={styles.laterSub}>
                  Wait until {surgeData.bestSlot.displayTime}
                </Text>
                <View style={styles.optionRow}>
                  <Text style={styles.optionPrice}>₹{surgeData.bestSlot.estimate}</Text>
                  <Text style={styles.optionTime}>{surgeData.bestSlot.timeLabel} later</Text>
                </View>
                <TouchableOpacity style={styles.notifyButton}>
                  <Ionicons name="notifications-outline" size={20} color="#4B5563" />
                  <Text style={styles.notifyButtonText}>Set Reminder</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 24,
    color: '#1F2937',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  content: {
    flex: 1,
    padding: 20,
  },

  // Status Card
  statusCard: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 4,
  },
  statusSub: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },

  // Options
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  optionCardSelected: {
    borderColor: '#FF6B35',
    borderWidth: 2,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  badgeGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeOrange: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  optionPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
    marginRight: 8,
  },
  optionTime: {
    fontSize: 14,
    color: '#6B7280',
  },
  laterSub: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },

  // Buttons
  bookButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  notifyButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  notifyButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
});
