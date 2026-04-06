import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../models/it_models.dart';

class ItApiService {
  final String baseUrl;
  final String Function() getAuthToken;

  ItApiService({required this.baseUrl, required this.getAuthToken});

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

  Future<Map<String, dynamic>> _delete(String path) async {
    final response = await http.delete(Uri.parse('$baseUrl$path'), headers: _headers);
    if (response.statusCode != 200) {
      final body = jsonDecode(response.body);
      throw Exception(body['message'] ?? 'Request failed');
    }
    return jsonDecode(response.body);
  }

  // ============ TECH DASHBOARD ============

  Future<List<ItServiceTicket>> getAvailableTickets() async {
    final data = await _getRaw('/api/it/tech/available-tickets');
    return (data as List).map((j) => ItServiceTicket.fromJson(j)).toList();
  }

  Future<List<ItServiceTicket>> getMyJobs() async {
    final data = await _getRaw('/api/it/tech/my-jobs');
    return (data as List).map((j) => ItServiceTicket.fromJson(j)).toList();
  }

  Future<ItServiceTicket> acceptTicket(String ticketId) async {
    final data = await _post('/api/it/tech/accept-ticket/$ticketId');
    return ItServiceTicket.fromJson(data);
  }

  Future<ItServiceTicket> updateEta(String ticketId, String etaStatus) async {
    final data = await _patch('/api/it/tech/eta/$ticketId', {'etaStatus': etaStatus});
    return ItServiceTicket.fromJson(data);
  }

  Future<Map<String, dynamic>> checkIn(String ticketId, double lat, double lng) async {
    return await _post('/api/it/tech/checkin/$ticketId', {'lat': lat.toString(), 'lng': lng.toString()});
  }

  Future<Map<String, dynamic>> checkOut(String ticketId) async {
    return await _post('/api/it/tech/checkout/$ticketId');
  }

  Future<Map<String, dynamic>> sendLocationPing(String ticketId, double lat, double lng) async {
    return await _post('/api/it/tech/location-ping/$ticketId', {'lat': lat, 'lng': lng});
  }

  Future<Map<String, dynamic>> getLocationStatus(String ticketId) async {
    return await _get('/api/it/tech/location-status/$ticketId');
  }

  Future<Map<String, dynamic>> captureSignature(String ticketId, String signatureDataUrl, String signedName) async {
    return await _post('/api/it/tickets/$ticketId/signature', {
      'signatureDataUrl': signatureDataUrl,
      'signedName': signedName,
    });
  }

  Future<Map<String, dynamic>> addDeliverables(String ticketId, String notes, List<String> urls) async {
    return await _post('/api/it/tech/deliverables/$ticketId', {'notes': notes, 'urls': urls});
  }

  Future<ItServiceTicket> completeTicket(String ticketId) async {
    final data = await _post('/api/it/tech/complete-ticket/$ticketId');
    return ItServiceTicket.fromJson(data);
  }

  Future<Map<String, dynamic>> rateCustomer(String ticketId, int rating, String? review) async {
    return await _post('/api/it/tech/rate-customer/$ticketId', {
      'rating': rating,
      if (review != null) 'review': review,
    });
  }

  Future<Map<String, dynamic>> reportDelay(String ticketId, int delayMinutes, String reason) async {
    return await _post('/api/it/tech/report-delay/$ticketId', {
      'delayMinutes': delayMinutes,
      'reason': reason,
    });
  }

  Future<Map<String, dynamic>> setMileage(String ticketId, double miles) async {
    return await _post('/api/it/tech/mileage/$ticketId', {'miles': miles});
  }

  // ============ ACCOUNT STATUS ============

  Future<TechAccountStatus> getAccountStatus() async {
    final data = await _get('/api/it/tech/account-status');
    return TechAccountStatus.fromJson(data);
  }

  // ============ EARNINGS ============

  Future<Map<String, dynamic>> getEarnings() async {
    return await _get('/api/it/tech/earnings');
  }

  Future<Map<String, dynamic>> getPaymentHistory() async {
    return await _get('/api/it/tech/payment-history');
  }

  Future<Map<String, dynamic>> getTaxYears() async {
    return await _get('/api/it/tech/tax-years');
  }

  Future<Map<String, dynamic>> get1099(int year) async {
    return await _get('/api/it/tech/1099/$year');
  }

  // ============ CONTRACTOR ONBOARDING ============

  Future<ContractorStatus> getContractorStatus() async {
    final data = await _get('/api/it/tech/contractor-status');
    return ContractorStatus.fromJson(data);
  }

  Future<Map<String, dynamic>> getIcAgreementText() async {
    return await _get('/api/it/tech/ic-agreement-text');
  }

  Future<Map<String, dynamic>> signIcAgreement(String legalName) async {
    return await _post('/api/it/tech/sign-ic-agreement', {'legalName': legalName});
  }

  Future<Map<String, dynamic>> submitContractorOnboarding({
    required String ssnLast4,
    required String taxClassification,
    String? businessName,
    required String taxAddress,
    required String taxCity,
    required String taxState,
    required String taxZip,
  }) async {
    return await _post('/api/it/tech/contractor-onboarding', {
      'ssnLast4': ssnLast4,
      'taxClassification': taxClassification,
      if (businessName != null) 'businessName': businessName,
      'taxAddress': taxAddress,
      'taxCity': taxCity,
      'taxState': taxState,
      'taxZip': taxZip,
    });
  }

  // ============ CERTIFICATIONS ============

  Future<Map<String, dynamic>> uploadCertification(File file, String name, String? issuer, String? expiry) async {
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/api/it/tech/certifications/upload'));
    request.headers['Authorization'] = 'Bearer ${getAuthToken()}';
    request.fields['name'] = name;
    if (issuer != null) request.fields['issuer'] = issuer;
    if (expiry != null) request.fields['expiry'] = expiry;
    request.files.add(await http.MultipartFile.fromPath('certFile', file.path));
    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    if (response.statusCode != 200) throw Exception('Upload failed');
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> deleteCertification(String certId) async {
    return await _delete('/api/it/tech/certifications/$certId');
  }

  // ============ COMPANY ROUTES ============

  Future<List<ItServiceTicket>> getCompanyTickets() async {
    final data = await _getRaw('/api/it/tickets');
    return (data as List).map((j) => ItServiceTicket.fromJson(j)).toList();
  }

  Future<Map<String, dynamic>> getTicketDetail(String ticketId) async {
    return await _get('/api/it/tickets/$ticketId');
  }

  Future<Map<String, dynamic>> createTicket(Map<String, dynamic> ticketData) async {
    return await _post('/api/it/tickets', ticketData);
  }

  Future<Map<String, dynamic>> reportTech(String techUserId, String ticketId, String category, String reason, String description) async {
    return await _post('/api/it/tech/$techUserId/report', {
      'ticketId': ticketId,
      'category': category,
      'reason': reason,
      'description': description,
    });
  }

  Future<Map<String, dynamic>> requestMediation(String ticketId) async {
    return await _post('/api/it/tickets/$ticketId/request-mediation');
  }

  Future<Map<String, dynamic>> fundEscrow(String ticketId) async {
    return await _post('/api/it/tickets/$ticketId/fund-escrow');
  }

  Future<Map<String, dynamic>> rateTicket(String ticketId, int rating, String? review) async {
    return await _post('/api/it/tickets/$ticketId/rate', {
      'rating': rating,
      if (review != null) 'review': review,
    });
  }

  Future<Map<String, dynamic>> approveWork(String ticketId, String? notes) async {
    return await _post('/api/it/tickets/$ticketId/approve', {
      if (notes != null) 'notes': notes,
    });
  }

  Future<Map<String, dynamic>> cancelTicket(String ticketId, String reason) async {
    return await _post('/api/it/tickets/$ticketId/cancel', {'reason': reason});
  }

  Future<Map<String, dynamic>> getCompanyPaymentHistory() async {
    return await _get('/api/it/company/payment-history');
  }

  Future<Map<String, dynamic>> addTicketNote(String ticketId, String content) async {
    return await _post('/api/it/tickets/$ticketId/notes', {'content': content});
  }
}
