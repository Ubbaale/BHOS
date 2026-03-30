import '../models/auth_models.dart';
import 'api_client.dart';

class AuthService {
  final ApiClient client;

  AuthService({required this.client});

  Future<AuthTokens> login(String email, String password) async {
    final response = await client.post('/api/mobile/auth/login', {
      'username': email,
      'password': password,
    });
    final tokens = AuthTokens.fromJson(response);
    client.setTokens(tokens.accessToken, tokens.refreshToken);
    return tokens;
  }

  Future<AuthTokens> register({
    required String email,
    required String password,
    required String fullName,
    required String role,
    String? phone,
  }) async {
    final response = await client.post('/api/mobile/auth/register', {
      'username': email,
      'password': password,
      'fullName': fullName,
      'role': role,
      if (phone != null) 'phone': phone,
    });
    final tokens = AuthTokens.fromJson(response);
    client.setTokens(tokens.accessToken, tokens.refreshToken);
    return tokens;
  }

  Future<User> getMe() async {
    final response = await client.get('/api/mobile/auth/me');
    final data = unwrapMobileResponse(response);
    return User.fromJson(data);
  }

  Future<void> logout() async {
    try {
      await client.post('/api/mobile/auth/logout');
    } catch (_) {}
    client.clearTokens();
  }

  Future<AuthTokens> refreshToken() async {
    final response = await client.post('/api/mobile/auth/refresh');
    final tokens = AuthTokens.fromJson(response);
    client.setTokens(tokens.accessToken, tokens.refreshToken);
    return tokens;
  }

  Future<String> getWsToken() async {
    final response = await client.get('/api/mobile/auth/ws-token');
    final data = unwrapMobileResponse(response);
    return data['token'] ?? '';
  }

  Future<void> requestPasswordReset(String email) async {
    await client.post('/api/auth/forgot-password', {'email': email});
  }

  Future<void> verifyResetCode(String email, String code) async {
    await client.post('/api/auth/verify-reset-code', {
      'email': email,
      'code': code,
    });
  }

  Future<void> resetPassword(String email, String code, String newPassword) async {
    await client.post('/api/auth/reset-password', {
      'email': email,
      'code': code,
      'newPassword': newPassword,
    });
  }
}
