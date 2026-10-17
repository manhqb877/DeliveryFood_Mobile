import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Home, ShoppingBasket, User, Receipt } from 'lucide-react-native';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CartProvider, useCart } from './src/context/CartContext';
import { NotificationProvider } from './src/context/NotificationContext';
import NotificationToast from './src/components/NotificationToast';

import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import ForgotPasswordScreen from './src/screens/auth/ForgotPasswordScreen';
import HomeScreen from './src/screens/home/HomeScreen';
import ShopDetailScreen from './src/screens/shop/ShopDetailScreen';
import ProfileScreen from './src/screens/profile/ProfileScreen';
import AddressListScreen from './src/screens/profile/AddressListScreen';
import ChangePasswordScreen from './src/screens/profile/ChangePasswordScreen';
import OrderHistoryScreen from './src/screens/order/OrderHistoryScreen';
import OrderDetailScreen from './src/screens/order/OrderDetailScreen';
import CartScreen from './src/screens/cart/CartScreen';
import CheckoutScreen from './src/screens/order/CheckoutScreen';
import ChatScreen from './src/screens/chat/ChatScreen';
import NotificationScreen from './src/screens/notification/NotificationScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator
function MainTabs() {
  const { allCartsTotalCount, totalCount } = useCart();
  const badgeCount = allCartsTotalCount !== undefined ? allCartsTotalCount : totalCount;

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
          fontWeight: '700',
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
          tabBarIcon: ({ color }) => <Home color={color} size={20} strokeWidth={2.2} />,
        }}
      />
      <Tab.Screen
        name="Giỏ hàng"
        component={CartScreen}
        options={{
          tabBarIcon: ({ color }) => <ShoppingBasket color={color} size={20} strokeWidth={2.2} />,
          tabBarBadge: badgeCount > 0 ? badgeCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#F59E0B',
            color: '#000000',
            fontSize: 10,
            fontWeight: '800',
          },
        }}
      />
      <Tab.Screen
        name="Đơn hàng"
        component={OrderHistoryScreen}
        options={{
          tabBarIcon: ({ color }) => <Receipt color={color} size={20} strokeWidth={1.9} />,
        }}
      />
      <Tab.Screen
        name="Tài khoản"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => <User color={color} size={20} strokeWidth={1.9} />,
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
    console.error('AppCustomer ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Đã xảy ra lỗi giao diện</Text>
          <Text style={styles.errorDesc}>{this.state.error?.message || String(this.state.error)}</Text>
          <TouchableOpacity style={styles.errorBtn} onPress={() => this.setState({ hasError: false, error: null })}>
            <Text style={styles.errorBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// Root Navigation Switcher
function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB700" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          // Chưa đăng nhập -> Vào thẳng màn Đăng nhập
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : (
          // Đã đăng nhập -> Vào Main Tabs và các Stack chi tiết
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="ShopDetail" component={ShopDetailScreen} />
            <Stack.Screen name="Cart" component={CartScreen} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="AddressList" component={AddressListScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
            <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="Notifications" component={NotificationScreen} />
          </>
        )}
      </Stack.Navigator>
      <NotificationToast />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.appRoot}>
      <View style={Platform.OS === 'web' ? styles.webWrapper : styles.mobileWrapper}>
        <SafeAreaProvider>
          <ErrorBoundary>
            <AuthProvider>
              <NotificationProvider>
                <CartProvider>
                  <RootNavigator />
                </CartProvider>
              </NotificationProvider>
            </AuthProvider>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
  },
  errorBtnText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
});
