import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { apiRequest } from '@/lib/queryClient';

interface NotificationData {
  type?: string;
  category?: string;
  rideId?: number;
  status?: string;
  url?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleInfo?: string;
  licensePlate?: string;
  fare?: number;
  pickupAddress?: string;
  dropoffAddress?: string;
  estimatedFare?: number;
  distanceMiles?: number;
  timestamp?: number;
}

interface UseCapacitorNotificationsReturn {
  isSupported: boolean;
  isNative: boolean;
  permissionStatus: 'prompt' | 'granted' | 'denied' | 'unknown';
  token: string | null;
  lastNotification: PushNotificationSchema | null;
  requestPermission: () => Promise<boolean>;
  registerForPush: (userType: 'driver' | 'user', driverId?: number) => Promise<void>;
}

export function useCapacitorNotifications(): UseCapacitorNotificationsReturn {
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
  const [token, setToken] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<PushNotificationSchema | null>(null);
  
  const isNative = Capacitor.isNativePlatform();
  const isSupported = isNative && Capacitor.isPluginAvailable('PushNotifications');

  useEffect(() => {
    if (!isSupported) return;

    const checkPermission = async () => {
      try {
        const result = await PushNotifications.checkPermissions();
        if (result.receive === 'granted') {
          setPermissionStatus('granted');
        } else if (result.receive === 'denied') {
          setPermissionStatus('denied');
        } else {
          setPermissionStatus('prompt');
        }
      } catch (error) {
        console.error('Error checking push permission:', error);
        setPermissionStatus('unknown');
      }
    };

    checkPermission();

    PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push registration success, token:', token.value);
      setToken(token.value);
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push notification received:', notification);
      setLastNotification(notification);

      const data = notification.data as NotificationData;
      if (data?.category === 'ride_arrived') {
        if (navigator.vibrate) {
          navigator.vibrate([300, 100, 300, 100, 300]);
        }
      }
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('Push notification action performed:', action);
      const data = action.notification.data as NotificationData;
      const actionId = action.actionId;

      let targetUrl = data?.url || '/';

      if (actionId === 'track' && data?.rideId) {
        targetUrl = `/my-rides?ride=${data.rideId}`;
      } else if (actionId === 'contact' && data?.rideId) {
        targetUrl = `/my-rides?ride=${data.rideId}&chat=true`;
      } else if (actionId === 'rate' && data?.rideId) {
        targetUrl = `/my-rides?ride=${data.rideId}&rate=true`;
      } else if (actionId === 'receipt' && data?.rideId) {
        targetUrl = `/my-rides?ride=${data.rideId}`;
      } else if (actionId === 'rebook') {
        targetUrl = '/book-ride';
      } else if (actionId === 'view' && data?.rideId) {
        targetUrl = data.type === 'ride_request'
          ? `/driver?ride=${data.rideId}`
          : `/my-rides?ride=${data.rideId}`;
      } else if (actionId === 'tap' && data?.url) {
        targetUrl = data.url;
      }

      window.location.href = targetUrl;
    });

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [isSupported]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await PushNotifications.requestPermissions();
      if (result.receive === 'granted') {
        setPermissionStatus('granted');
        await PushNotifications.register();
        return true;
      } else {
        setPermissionStatus('denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting push permission:', error);
      return false;
    }
  }, [isSupported]);

  const registerForPush = useCallback(async (userType: 'driver' | 'user', driverId?: number): Promise<void> => {
    if (!token) {
      console.error('No FCM token available');
      return;
    }

    try {
      await apiRequest('POST', '/api/push/register-native', {
        token,
        platform: Capacitor.getPlatform(),
        userType,
        driverId
      });
      console.log('Native push registration sent to server');
    } catch (error) {
      console.error('Error registering native push:', error);
    }
  }, [token]);

  return {
    isSupported,
    isNative,
    permissionStatus,
    token,
    lastNotification,
    requestPermission,
    registerForPush
  };
}
