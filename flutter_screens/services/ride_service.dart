import '../models/ride_models.dart';
import 'api_client.dart';

class RideService {
  final ApiClient client;

  RideService({required this.client});

  Future<List<Ride>> getMyRides() async {
    final data = await client.getRaw('/api/mobile/rides');
    final inner = (data is Map && data.containsKey('data')) ? data['data'] : data;
    return (inner as List).map((j) => Ride.fromJson(j)).toList();
  }

  Future<Ride> getRide(int rideId) async {
    final data = await client.get('/api/mobile/rides/$rideId');
    final inner = unwrapMobileResponse(data);
    return Ride.fromJson(inner);
  }

  Future<Ride> bookRide({
    required String pickupAddress,
    String? pickupLat,
    String? pickupLng,
    required String dropoffAddress,
    String? dropoffLat,
    String? dropoffLng,
    String? scheduledTime,
    String? vehicleType,
    String? specialNeeds,
    String? medicalNotes,
    bool isRoundTrip = false,
    String? returnTime,
  }) async {
    final data = await client.post('/api/mobile/rides', {
      'pickupAddress': pickupAddress,
      if (pickupLat != null) 'pickupLat': pickupLat,
      if (pickupLng != null) 'pickupLng': pickupLng,
      'dropoffAddress': dropoffAddress,
      if (dropoffLat != null) 'dropoffLat': dropoffLat,
      if (dropoffLng != null) 'dropoffLng': dropoffLng,
      if (scheduledTime != null) 'scheduledTime': scheduledTime,
      if (vehicleType != null) 'vehicleType': vehicleType,
      if (specialNeeds != null) 'specialNeeds': specialNeeds,
      if (medicalNotes != null) 'medicalNotes': medicalNotes,
      'isRoundTrip': isRoundTrip,
      if (returnTime != null) 'returnTime': returnTime,
    });
    final inner = unwrapMobileResponse(data);
    return Ride.fromJson(inner);
  }

  Future<Ride> cancelRide(int rideId, {String? reason}) async {
    final data = await client.post('/api/mobile/rides/$rideId/cancel', {
      if (reason != null) 'reason': reason,
    });
    final inner = unwrapMobileResponse(data);
    return Ride.fromJson(inner);
  }

  Future<void> rateRide(int rideId, int rating, {String? comment}) async {
    await client.post('/api/mobile/rides/$rideId/rate', {
      'rating': rating,
      if (comment != null) 'comment': comment,
    });
  }

  Future<List<RideMessage>> getMessages(int rideId) async {
    final data = await client.getRaw('/api/mobile/rides/$rideId/messages');
    final inner = (data is Map && data.containsKey('data')) ? data['data'] : data;
    return (inner as List).map((j) => RideMessage.fromJson(j)).toList();
  }

  Future<RideMessage> sendMessage(int rideId, String content) async {
    final data = await client.post('/api/mobile/rides/$rideId/messages', {
      'content': content,
    });
    final inner = unwrapMobileResponse(data);
    return RideMessage.fromJson(inner);
  }

  Future<List<RideEvent>> getRideEvents(int rideId) async {
    final data = await client.getRaw('/api/mobile/rides/$rideId/events');
    final inner = (data is Map && data.containsKey('data')) ? data['data'] : data;
    return (inner as List).map((j) => RideEvent.fromJson(j)).toList();
  }

  Future<List<Ride>> getAvailableRides() async {
    final data = await client.getRaw('/api/mobile/rides/pool');
    final inner = (data is Map && data.containsKey('data')) ? data['data'] : data;
    return (inner as List).map((j) => Ride.fromJson(j)).toList();
  }

  Future<Ride> acceptRide(int rideId) async {
    final data = await client.post('/api/mobile/rides/$rideId/accept');
    final inner = unwrapMobileResponse(data);
    return Ride.fromJson(inner);
  }

  Future<Ride> updateRideStatus(int rideId, String status) async {
    final data = await client.patch('/api/mobile/rides/$rideId/status', {
      'status': status,
    });
    final inner = unwrapMobileResponse(data);
    return Ride.fromJson(inner);
  }

  Future<Ride> completeRide(int rideId, {String? tollActual}) async {
    final data = await client.post('/api/mobile/rides/$rideId/complete', {
      if (tollActual != null) 'tollActual': tollActual,
    });
    final inner = unwrapMobileResponse(data);
    return Ride.fromJson(inner);
  }
}
