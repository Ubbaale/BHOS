import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/courier_models.dart';

class CourierApiService {
  final String baseUrl;
  final String Function() getAuthToken;

  CourierApiService({required this.baseUrl, required this.getAuthToken});

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${getAuthToken()}',
  };

  Future<Map<String, dynamic>> _get(String path) async {
    final response = await http.get(Uri.parse('$baseUrl$path'), headers: _headers);
    if (response.statusCode != 200) {
      final body = jsonDecode(response.body);
      throw Exception(body['message'] ?? 'Request failed');
    }
    return jsonDecode(response.body);
  }

  Future<dynamic> _getRaw(String path) async {
    final response = await http.get(Uri.parse('$baseUrl$path'), headers: _headers);
    if (response.statusCode != 200) {
      final body = jsonDecode(response.body);
      throw Exception(body['message'] ?? 'Request failed');
    }
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> _post(String path, [Map<String, dynamic>? body]) async {
    final response = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    if (response.statusCode != 200 && response.statusCode != 201) {
      final respBody = jsonDecode(response.body);
      throw Exception(respBody['message'] ?? 'Request failed');
    }
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> _patch(String path, Map<String, dynamic> body) async {
    final response = await http.patch(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    if (response.statusCode != 200) {
      final respBody = jsonDecode(response.body);
      throw Exception(respBody['message'] ?? 'Request failed');
    }
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> createCompany(Map<String, dynamic> data) async {
    return await _post('/api/courier/companies', data);
  }

  Future<Map<String, dynamic>> getMyCompany() async {
    return await _get('/api/courier/companies/mine');
  }

  Future<Map<String, dynamic>> updateCompany(String id, Map<String, dynamic> data) async {
    return await _patch('/api/courier/companies/$id', data);
  }

  Future<Map<String, dynamic>> getFareEstimate(Map<String, dynamic> data) async {
    return await _post('/api/courier/fare-estimate', data);
  }

  Future<CourierDelivery> createDelivery(Map<String, dynamic> data) async {
    final result = await _post('/api/courier/deliveries', data);
    return CourierDelivery.fromJson(result);
  }

  Future<List<CourierDelivery>> getDeliveries() async {
    final data = await _getRaw('/api/courier/deliveries');
    return (data as List).map((d) => CourierDelivery.fromJson(d)).toList();
  }

  Future<List<CourierDelivery>> getDeliveryPool() async {
    final data = await _getRaw('/api/courier/deliveries/pool');
    return (data as List).map((d) => CourierDelivery.fromJson(d)).toList();
  }

  Future<List<CourierDelivery>> getActiveDeliveries() async {
    final data = await _getRaw('/api/courier/deliveries/active');
    return (data as List).map((d) => CourierDelivery.fromJson(d)).toList();
  }

  Future<CourierDelivery> acceptDelivery(String id) async {
    final data = await _post('/api/courier/deliveries/$id/accept');
    return CourierDelivery.fromJson(data);
  }

  Future<CourierDelivery> updateDeliveryStatus(String id, String status) async {
    final data = await _patch('/api/courier/deliveries/$id/status', {'status': status});
    return CourierDelivery.fromJson(data);
  }

  Future<Map<String, dynamic>> addCustodyLog(String deliveryId, Map<String, dynamic> data) async {
    return await _post('/api/courier/deliveries/$deliveryId/custody-log', data);
  }

  Future<List<CustodyLogEntry>> getCustodyLog(String deliveryId) async {
    final data = await _getRaw('/api/courier/deliveries/$deliveryId/custody-log');
    return (data as List).map((e) => CustodyLogEntry.fromJson(e)).toList();
  }

  Future<CourierDelivery> getDeliveryDetail(String id) async {
    final data = await _get('/api/courier/deliveries/$id');
    return CourierDelivery.fromJson(data);
  }

  Future<List<CourierDelivery>> getDriverHistory() async {
    final data = await _getRaw('/api/courier/deliveries/driver/history');
    return (data as List).map((d) => CourierDelivery.fromJson(d)).toList();
  }
}
