class CourierDelivery {
  final String id;
  final String? companyId;
  final String? driverId;
  final String status;
  final String packageType;
  final String? packageDescription;
  final String? temperatureRequirement;
  final String? priorityLevel;
  final bool? signatureRequired;
  final double? weightLbs;
  final String pickupAddress;
  final String? pickupCity;
  final String? pickupState;
  final String? pickupZip;
  final double? pickupLat;
  final double? pickupLng;
  final String dropoffAddress;
  final String? dropoffCity;
  final String? dropoffState;
  final String? dropoffZip;
  final double? dropoffLat;
  final double? dropoffLng;
  final String? pickupContactName;
  final String? pickupContactPhone;
  final String? dropoffContactName;
  final String? dropoffContactPhone;
  final String? estimatedFare;
  final String? baseFare;
  final String? mileageCharge;
  final String? surcharges;
  final double? distanceMiles;
  final DateTime? scheduledPickupTime;
  final DateTime? actualPickupTime;
  final DateTime? actualDeliveryTime;
  final DateTime? createdAt;

  CourierDelivery({
    required this.id,
    this.companyId,
    this.driverId,
    required this.status,
    required this.packageType,
    this.packageDescription,
    this.temperatureRequirement,
    this.priorityLevel,
    this.signatureRequired,
    this.weightLbs,
    required this.pickupAddress,
    this.pickupCity,
    this.pickupState,
    this.pickupZip,
    this.pickupLat,
    this.pickupLng,
    required this.dropoffAddress,
    this.dropoffCity,
    this.dropoffState,
    this.dropoffZip,
    this.dropoffLat,
    this.dropoffLng,
    this.pickupContactName,
    this.pickupContactPhone,
    this.dropoffContactName,
    this.dropoffContactPhone,
    this.estimatedFare,
    this.baseFare,
    this.mileageCharge,
    this.surcharges,
    this.distanceMiles,
    this.scheduledPickupTime,
    this.actualPickupTime,
    this.actualDeliveryTime,
    this.createdAt,
  });

  factory CourierDelivery.fromJson(Map<String, dynamic> json) {
    return CourierDelivery(
      id: json['id'].toString(),
      companyId: json['companyId']?.toString(),
      driverId: json['driverId']?.toString(),
      status: json['status'] ?? 'pending',
      packageType: json['packageType'] ?? 'standard',
      packageDescription: json['packageDescription'],
      temperatureRequirement: json['temperatureRequirement'],
      priorityLevel: json['priorityLevel'],
      signatureRequired: json['signatureRequired'],
      weightLbs: (json['weightLbs'] as num?)?.toDouble(),
      pickupAddress: json['pickupAddress'] ?? '',
      pickupCity: json['pickupCity'],
      pickupState: json['pickupState'],
      pickupZip: json['pickupZip'],
      pickupLat: (json['pickupLat'] as num?)?.toDouble(),
      pickupLng: (json['pickupLng'] as num?)?.toDouble(),
      dropoffAddress: json['dropoffAddress'] ?? '',
      dropoffCity: json['dropoffCity'],
      dropoffState: json['dropoffState'],
      dropoffZip: json['dropoffZip'],
      dropoffLat: (json['dropoffLat'] as num?)?.toDouble(),
      dropoffLng: (json['dropoffLng'] as num?)?.toDouble(),
      pickupContactName: json['pickupContactName'],
      pickupContactPhone: json['pickupContactPhone'],
      dropoffContactName: json['dropoffContactName'],
      dropoffContactPhone: json['dropoffContactPhone'],
      estimatedFare: json['estimatedFare'],
      baseFare: json['baseFare'],
      mileageCharge: json['mileageCharge'],
      surcharges: json['surcharges'],
      distanceMiles: (json['distanceMiles'] as num?)?.toDouble(),
      scheduledPickupTime: json['scheduledPickupTime'] != null ? DateTime.tryParse(json['scheduledPickupTime']) : null,
      actualPickupTime: json['actualPickupTime'] != null ? DateTime.tryParse(json['actualPickupTime']) : null,
      actualDeliveryTime: json['actualDeliveryTime'] != null ? DateTime.tryParse(json['actualDeliveryTime']) : null,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
    );
  }
}

class CustodyLogEntry {
  final String id;
  final String deliveryId;
  final String eventType;
  final String? description;
  final double? lat;
  final double? lng;
  final String? temperature;
  final String? signatureUrl;
  final String? photoUrl;
  final String? performedBy;
  final String? integrityHash;
  final DateTime? createdAt;

  CustodyLogEntry({
    required this.id,
    required this.deliveryId,
    required this.eventType,
    this.description,
    this.lat,
    this.lng,
    this.temperature,
    this.signatureUrl,
    this.photoUrl,
    this.performedBy,
    this.integrityHash,
    this.createdAt,
  });

  factory CustodyLogEntry.fromJson(Map<String, dynamic> json) {
    return CustodyLogEntry(
      id: json['id'].toString(),
      deliveryId: json['deliveryId'].toString(),
      eventType: json['eventType'] ?? '',
      description: json['description'],
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      temperature: json['temperature'],
      signatureUrl: json['signatureUrl'],
      photoUrl: json['photoUrl'],
      performedBy: json['performedBy'],
      integrityHash: json['integrityHash'],
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
    );
  }
}
