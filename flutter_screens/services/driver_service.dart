import '../models/driver_models.dart';
import 'api_client.dart';

class DriverService {
  final ApiClient client;

  DriverService({required this.client});

  Future<DriverProfile> getProfile() async {
    final data = await client.get('/api/mobile/driver/profile');
    final inner = unwrapMobileResponse(data);
    return DriverProfile.fromJson(inner);
  }

  Future<void> updateLocation(double lat, double lng) async {
    await client.post('/api/mobile/driver/location', {
      'lat': lat.toString(),
      'lng': lng.toString(),
    });
  }

  Future<void> setAvailability(bool available) async {
    await client.patch('/api/mobile/driver/availability', {
      'isAvailable': available,
    });
  }

  Future<DriverEarnings> getEarnings() async {
    final data = await client.get('/api/mobile/driver/earnings');
    final inner = unwrapMobileResponse(data);
    return DriverEarnings.fromJson(inner);
  }

  Future<void> applyAsDriver({
    required String fullName,
    required String phone,
    required String licenseNumber,
    required String licenseState,
    required String licenseExpiry,
    required String vehicleMake,
    required String vehicleModel,
    required String vehicleYear,
    required String vehicleColor,
    required String vehiclePlate,
    required String vehicleType,
    String? insuranceProvider,
    String? insurancePolicyNumber,
    String? insuranceExpiry,
  }) async {
    await client.post('/api/mobile/driver/apply', {
      'fullName': fullName,
      'phone': phone,
      'licenseNumber': licenseNumber,
      'licenseState': licenseState,
      'licenseExpiry': licenseExpiry,
      'vehicleMake': vehicleMake,
      'vehicleModel': vehicleModel,
      'vehicleYear': vehicleYear,
      'vehicleColor': vehicleColor,
      'vehiclePlate': vehiclePlate,
      'vehicleType': vehicleType,
      if (insuranceProvider != null) 'insuranceProvider': insuranceProvider,
      if (insurancePolicyNumber != null) 'insurancePolicyNumber': insurancePolicyNumber,
      if (insuranceExpiry != null) 'insuranceExpiry': insuranceExpiry,
    });
  }
}
