import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiClient {
  final String baseUrl;
  String? _accessToken;
  String? _refreshToken;
  final Future<void> Function()? onTokenExpired;

  ApiClient({
    required this.baseUrl,
    this.onTokenExpired,
  });

  void setTokens(String accessToken, String refreshToken) {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
  }

  void clearTokens() {
    _accessToken = null;
    _refreshToken = null;
  }

  bool get isAuthenticated => _accessToken != null;
  String? get accessToken => _accessToken;

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
  };

  Future<Map<String, dynamic>> get(String path) async {
    final response = await http.get(Uri.parse('$baseUrl$path'), headers: _headers);
    return _handleResponse(response);
  }

  Future<dynamic> getRaw(String path) async {
    final response = await http.get(Uri.parse('$baseUrl$path'), headers: _headers);
    if (response.statusCode == 401) {
      final refreshed = await _tryRefresh();
      if (refreshed) {
        final retry = await http.get(Uri.parse('$baseUrl$path'), headers: _headers);
        return _handleRawResponse(retry);
      }
      onTokenExpired?.call();
      throw ApiException('Session expired. Please log in again.', 401);
    }
    return _handleRawResponse(response);
  }

  Future<Map<String, dynamic>> post(String path, [Map<String, dynamic>? body]) async {
    final response = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body) async {
    final response = await http.patch(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> delete(String path) async {
    final response = await http.delete(Uri.parse('$baseUrl$path'), headers: _headers);
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> _handleResponse(http.Response response) async {
    if (response.statusCode == 401) {
      final refreshed = await _tryRefresh();
      if (refreshed) {
        return jsonDecode(response.body);
      }
      onTokenExpired?.call();
      throw ApiException('Session expired. Please log in again.', 401);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final body = jsonDecode(response.body);
      throw ApiException(body['message'] ?? body['error'] ?? 'Request failed', response.statusCode);
    }
    if (response.body.isEmpty) return {};
    return jsonDecode(response.body);
  }

  dynamic _handleRawResponse(http.Response response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final body = jsonDecode(response.body);
      throw ApiException(body['message'] ?? 'Request failed', response.statusCode);
    }
    if (response.body.isEmpty) return {};
    return jsonDecode(response.body);
  }

  Future<bool> _tryRefresh() async {
    if (_refreshToken == null) return false;
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/mobile/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': _refreshToken}),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final inner = data['data'] ?? data;
        _accessToken = inner['accessToken'];
        _refreshToken = inner['refreshToken'] ?? _refreshToken;
        return true;
      }
    } catch (_) {}
    return false;
  }
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  ApiException(this.message, this.statusCode);

  @override
  String toString() => message;
}

Map<String, dynamic> unwrapMobileResponse(Map<String, dynamic> response) {
  return response['data'] ?? response;
}
