import React from 'react';
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
        tabBarActiveTintColor: '#FACC15',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      <Tab.Screen 
        name="Trang chủ" 
        component={HomeScreen} 
        options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tab.Screen 
        name="Lịch sử" 
        component={HistoryScreen} 
        options={{ tabBarIcon: ({ color, size }) => <Clock color={color} size={size} /> }}
      />
      <Tab.Screen 
        name="Ví tiền" 
        component={WalletScreen} 
        options={{ tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { shipper, isLoading } = useShipper();

  if (isLoading) return null;

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ShipperProvider>
          <AppNavigator />
        </ShipperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
