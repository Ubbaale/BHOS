class Ride {
  final int id;
  final int? patientId;
  final int? driverId;
  final String status;
  final String pickupAddress;
  final String? pickupLat;
  final String? pickupLng;
  final String dropoffAddress;
  final String? dropoffLat;
  final String? dropoffLng;
  final DateTime? scheduledTime;
  final String? vehicleType;
  final String? specialNeeds;
  final String? medicalNotes;
  final bool isRoundTrip;
  final String? returnTime;
  final String? estimatedFare;
  final String? finalFare;
  final String? baseFare;
  final String? distanceFare;
  final String? surgeFare;
  final String? surgeMultiplier;
  final String? tollEstimate;
  final String? tollActual;
  final String? waitTimeFare;
  final String? tipAmount;
  final String? distance;
  final String? estimatedDuration;
  final String? cancelReason;
  final String? cancelledBy;
  final DateTime? acceptedAt;
  final DateTime? arrivedAt;
  final DateTime? pickedUpAt;
  final DateTime? completedAt;
  final DateTime? cancelledAt;
  final int? rating;
  final String? ratingComment;
  final int? driverRating;
  final String? driverRatingComment;
  final String? driverName;
  final String? driverPhone;
  final String? vehicleMake;
  final String? vehicleModel;
  final String? vehicleColor;
  final String? vehiclePlate;
  final String? patientName;
  final String? patientPhone;
  final String? stripePaymentIntentId;
  final String? paymentStatus;
  final DateTime? createdAt;

  Ride({
    required this.id,
    this.patientId,
    this.driverId,
    required this.status,
    required this.pickupAddress,
    this.pickupLat,
    this.pickupLng,
    required this.dropoffAddress,
    this.dropoffLat,
    this.dropoffLng,
    this.scheduledTime,
    this.vehicleType,
    this.specialNeeds,
    this.medicalNotes,
    this.isRoundTrip = false,
    this.returnTime,
    this.estimatedFare,
    this.finalFare,
    this.baseFare,
    this.distanceFare,
    this.surgeFare,
    this.surgeMultiplier,
    this.tollEstimate,
    this.tollActual,
    this.waitTimeFare,
    this.tipAmount,
    this.distance,
    this.estimatedDuration,
    this.cancelReason,
    this.cancelledBy,
    this.acceptedAt,
    this.arrivedAt,
    this.pickedUpAt,
    this.completedAt,
    this.cancelledAt,
    this.rating,
    this.ratingComment,
    this.driverRating,
    this.driverRatingComment,
    this.driverName,
    this.driverPhone,
    this.vehicleMake,
    this.vehicleModel,
    this.vehicleColor,
    this.vehiclePlate,
    this.patientName,
    this.patientPhone,
    this.stripePaymentIntentId,
    this.paymentStatus,
    this.createdAt,
  });

  factory Ride.fromJson(Map<String, dynamic> json) {
    return Ride(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      patientId: json['patientId'] is int ? json['patientId'] : int.tryParse(json['patientId']?.toString() ?? ''),
      driverId: json['driverId'] is int ? json['driverId'] : int.tryParse(json['driverId']?.toString() ?? ''),
      status: json['status'] ?? 'requested',
      pickupAddress: json['pickupAddress'] ?? '',
      pickupLat: json['pickupLat']?.toString(),
      pickupLng: json['pickupLng']?.toString(),
      dropoffAddress: json['dropoffAddress'] ?? '',
      dropoffLat: json['dropoffLat']?.toString(),
      dropoffLng: json['dropoffLng']?.toString(),
      scheduledTime: json['scheduledTime'] != null ? DateTime.tryParse(json['scheduledTime']) : null,
      vehicleType: json['vehicleType'],
      specialNeeds: json['specialNeeds'],
      medicalNotes: json['medicalNotes'],
      isRoundTrip: json['isRoundTrip'] ?? false,
      returnTime: json['returnTime'],
      estimatedFare: json['estimatedFare']?.toString(),
      finalFare: json['finalFare']?.toString(),
      baseFare: json['baseFare']?.toString(),
      distanceFare: json['distanceFare']?.toString(),
      surgeFare: json['surgeFare']?.toString(),
      surgeMultiplier: json['surgeMultiplier']?.toString(),
      tollEstimate: json['tollEstimate']?.toString(),
      tollActual: json['tollActual']?.toString(),
      waitTimeFare: json['waitTimeFare']?.toString(),
      tipAmount: json['tipAmount']?.toString(),
      distance: json['distance']?.toString(),
      estimatedDuration: json['estimatedDuration']?.toString(),
      cancelReason: json['cancelReason'],
      cancelledBy: json['cancelledBy'],
      acceptedAt: json['acceptedAt'] != null ? DateTime.tryParse(json['acceptedAt']) : null,
      arrivedAt: json['arrivedAt'] != null ? DateTime.tryParse(json['arrivedAt']) : null,
      pickedUpAt: json['pickedUpAt'] != null ? DateTime.tryParse(json['pickedUpAt']) : null,
      completedAt: json['completedAt'] != null ? DateTime.tryParse(json['completedAt']) : null,
      cancelledAt: json['cancelledAt'] != null ? DateTime.tryParse(json['cancelledAt']) : null,
      rating: json['rating'],
      ratingComment: json['ratingComment'],
      driverRating: json['driverRating'],
      driverRatingComment: json['driverRatingComment'],
      driverName: json['driverName'],
      driverPhone: json['driverPhone'],
      vehicleMake: json['vehicleMake'],
      vehicleModel: json['vehicleModel'],
      vehicleColor: json['vehicleColor'],
      vehiclePlate: json['vehiclePlate'],
      patientName: json['patientName'],
      patientPhone: json['patientPhone'],
      stripePaymentIntentId: json['stripePaymentIntentId'],
      paymentStatus: json['paymentStatus'],
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
    );
  }

  bool get isActive => ['requested', 'accepted', 'driver_enroute', 'arrived', 'picked_up', 'in_progress'].contains(status);
  bool get isCompleted => status == 'completed';
  bool get isCancelled => status == 'cancelled';
  String get displayFare => finalFare ?? estimatedFare ?? '—';
}

class RideMessage {
  final int id;
  final int rideId;
  final int senderId;
  final String content;
  final String? senderName;
  final String? senderRole;
  final DateTime? createdAt;

  RideMessage({
    required this.id,
    required this.rideId,
    required this.senderId,
    required this.content,
    this.senderName,
    this.senderRole,
    this.createdAt,
  });

  factory RideMessage.fromJson(Map<String, dynamic> json) {
    return RideMessage(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      rideId: json['rideId'] is int ? json['rideId'] : int.tryParse(json['rideId']?.toString() ?? '0') ?? 0,
      senderId: json['senderId'] is int ? json['senderId'] : int.tryParse(json['senderId']?.toString() ?? '0') ?? 0,
      content: json['content'] ?? '',
      senderName: json['senderName'],
      senderRole: json['senderRole'],
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
    );
  }
}

class RideEvent {
  final String type;
  final String? description;
  final DateTime? timestamp;

  RideEvent({required this.type, this.description, this.timestamp});

  factory RideEvent.fromJson(Map<String, dynamic> json) {
    return RideEvent(
      type: json['type'] ?? '',
      description: json['description'],
      timestamp: json['timestamp'] != null ? DateTime.tryParse(json['timestamp']) : null,
    );
  }
}

class FareEstimate {
  final String baseFare;
  final String distanceFare;
  final String? surgeFare;
  final String? surgeMultiplier;
  final String? tollEstimate;
  final String totalEstimate;
  final String? distance;
  final String? duration;

  FareEstimate({
    required this.baseFare,
    required this.distanceFare,
    this.surgeFare,
    this.surgeMultiplier,
    this.tollEstimate,
    required this.totalEstimate,
    this.distance,
    this.duration,
  });

  factory FareEstimate.fromJson(Map<String, dynamic> json) {
    return FareEstimate(
      baseFare: json['baseFare']?.toString() ?? '0',
      distanceFare: json['distanceFare']?.toString() ?? '0',
      surgeFare: json['surgeFare']?.toString(),
      surgeMultiplier: json['surgeMultiplier']?.toString(),
      tollEstimate: json['tollEstimate']?.toString(),
      totalEstimate: json['totalEstimate']?.toString() ?? '0',
      distance: json['distance']?.toString(),
      duration: json['duration']?.toString(),
    );
  }
}

class SurgeZone {
  final String id;
  final String name;
  final double lat;
  final double lng;
  final double multiplier;
  final double radius;

  SurgeZone({
    required this.id,
    required this.name,
    required this.lat,
    required this.lng,
    required this.multiplier,
    required this.radius,
  });

  factory SurgeZone.fromJson(Map<String, dynamic> json) {
    return SurgeZone(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? '',
      lat: double.tryParse(json['lat']?.toString() ?? '0') ?? 0,
      lng: double.tryParse(json['lng']?.toString() ?? '0') ?? 0,
      multiplier: double.tryParse(json['multiplier']?.toString() ?? '1') ?? 1,
      radius: double.tryParse(json['radius']?.toString() ?? '0') ?? 0,
    );
  }
}
