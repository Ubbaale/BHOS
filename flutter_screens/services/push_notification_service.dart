import 'api_client.dart';

class PushNotificationService {
  final ApiClient client;

  PushNotificationService({required this.client});

  Future<void> registerToken(String fcmToken, {String platform = 'android'}) async {
    await client.post('/api/mobile/push/register', {
      'token': fcmToken,
      'platform': platform,
    });
  }

  Future<void> registerNativeToken(String token, {String platform = 'android'}) async {
    await client.post('/api/push/register-native', {
      'token': token,
      'platform': platform,
    });
  }
}
