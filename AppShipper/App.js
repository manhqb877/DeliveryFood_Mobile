import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ShipperProvider, useShipper } from './src/context/ShipperContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import CameraScreen from './src/screens/CameraScreen';

// IMPORTANT: Background location task phải được import ở top-level
import './src/lib/backgroundLocation';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Clock, Wallet } from 'lucide-react-native';
import HistoryScreen from './src/screens/HistoryScreen';
import WalletScreen from './src/screens/WalletScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#D97706',
        tabBarInactiveTintColor: '#64748B',
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 1,
          paddingBottom: 0,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          height: Platform.OS === 'web' ? 68 : (Platform.OS === 'ios' ? 82 : 64),
          paddingBottom: Platform.OS === 'web' ? 10 : (Platform.OS === 'ios' ? 24 : 8),
          paddingTop: 6,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
          elevation: 4,
        },
      }}
    >
      <Tab.Screen 
        name="Trang chủ" 
        component={HomeScreen} 
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Home color={color} size={20} strokeWidth={focused ? 2.2 : 1.8} />
          ),
        }}
      />
      <Tab.Screen 
        name="Lịch sử" 
        component={HistoryScreen} 
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Clock color={color} size={20} strokeWidth={focused ? 2.2 : 1.8} />
          ),
        }}
      />
      <Tab.Screen 
        name="Ví tiền" 
        component={WalletScreen} 
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Wallet color={color} size={20} strokeWidth={focused ? 2.2 : 1.8} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[AppShipper ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>⚠️</Text>
          <Text style={styles.errorTitle}>Đã xảy ra sự cố hiển thị</Text>
          <Text style={styles.errorDesc}>{this.state.error?.message || 'Vui lòng bấm tải lại trang để tiếp tục'}</Text>
          <TouchableOpacity
            style={styles.errorBtn}
            onPress={() => {
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.location.reload();
              } else {
                this.setState({ hasError: false, error: null });
              }
            }}
          >
            <Text style={styles.errorBtnText}>Tải lại trang</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

function AppNavigator() {
  const { shipper, isLoading } = useShipper();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!shipper ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
            <Stack.Screen name="Camera" component={CameraScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.appRoot}>
      <View style={Platform.OS === 'web' ? styles.webWrapper : styles.mobileWrapper}>
        <SafeAreaProvider>
          <ErrorBoundary>
            <ShipperProvider>
              <AppNavigator />
            </ShipperProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    height: Platform.OS === 'web' ? '100vh' : '100%',
    backgroundColor: Platform.OS === 'web' ? '#E2E8F0' : '#FFFFFF',
  },
  webWrapper: {
    flex: 1,
    height: '100%',
    width: '100%',
    maxWidth: 480,
    marginHorizontal: 'auto',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
  },
  mobileWrapper: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 320,
  },
  errorBtn: {
    backgroundColor: '#FFB800',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorBtnText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
});
