class DriverProfile {
  final int id;
  final int userId;
  final String? fullName;
  final String? phone;
  final String? email;
  final String? licenseNumber;
  final String? licenseState;
  final String? licenseExpiry;
  final String? insuranceProvider;
  final String? insurancePolicyNumber;
  final String? insuranceExpiry;
  final String? vehicleMake;
  final String? vehicleModel;
  final String? vehicleYear;
  final String? vehicleColor;
  final String? vehiclePlate;
  final String? vehicleType;
  final String? vehicleVin;
  final String? backgroundCheckStatus;
  final String? backgroundCheckDate;
  final String? inspectionStatus;
  final String? inspectionDate;
  final String approvalStatus;
  final double averageRating;
  final int totalTrips;
  final double totalEarnings;
  final bool isActive;
  final bool isAvailable;
  final String? currentLat;
  final String? currentLng;
  final String? profilePhoto;
  final String? ssnLast4;
  final String? taxClassification;
  final DateTime? icAgreementSignedAt;
  final DateTime? createdAt;

  DriverProfile({
    required this.id,
    required this.userId,
    this.fullName,
    this.phone,
    this.email,
    this.licenseNumber,
    this.licenseState,
    this.licenseExpiry,
    this.insuranceProvider,
    this.insurancePolicyNumber,
    this.insuranceExpiry,
    this.vehicleMake,
    this.vehicleModel,
    this.vehicleYear,
    this.vehicleColor,
    this.vehiclePlate,
    this.vehicleType,
    this.vehicleVin,
    this.backgroundCheckStatus,
    this.backgroundCheckDate,
    this.inspectionStatus,
    this.inspectionDate,
    this.approvalStatus = 'pending',
    this.averageRating = 0,
    this.totalTrips = 0,
    this.totalEarnings = 0,
    this.isActive = true,
    this.isAvailable = false,
    this.currentLat,
    this.currentLng,
    this.profilePhoto,
    this.ssnLast4,
    this.taxClassification,
    this.icAgreementSignedAt,
    this.createdAt,
  });

  factory DriverProfile.fromJson(Map<String, dynamic> json) {
    return DriverProfile(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      userId: json['userId'] is int ? json['userId'] : int.tryParse(json['userId']?.toString() ?? '0') ?? 0,
      fullName: json['fullName'],
      phone: json['phone'],
      email: json['email'],
      licenseNumber: json['licenseNumber'],
      licenseState: json['licenseState'],
      licenseExpiry: json['licenseExpiry'],
      insuranceProvider: json['insuranceProvider'],
      insurancePolicyNumber: json['insurancePolicyNumber'],
      insuranceExpiry: json['insuranceExpiry'],
      vehicleMake: json['vehicleMake'],
      vehicleModel: json['vehicleModel'],
      vehicleYear: json['vehicleYear'],
      vehicleColor: json['vehicleColor'],
      vehiclePlate: json['vehiclePlate'],
      vehicleType: json['vehicleType'],
      vehicleVin: json['vehicleVin'],
      backgroundCheckStatus: json['backgroundCheckStatus'],
      backgroundCheckDate: json['backgroundCheckDate'],
      inspectionStatus: json['inspectionStatus'],
      inspectionDate: json['inspectionDate'],
      approvalStatus: json['approvalStatus'] ?? 'pending',
      averageRating: double.tryParse(json['averageRating']?.toString() ?? '0') ?? 0,
      totalTrips: json['totalTrips'] ?? 0,
      totalEarnings: double.tryParse(json['totalEarnings']?.toString() ?? '0') ?? 0,
      isActive: json['isActive'] ?? true,
      isAvailable: json['isAvailable'] ?? false,
      currentLat: json['currentLat']?.toString(),
      currentLng: json['currentLng']?.toString(),
      profilePhoto: json['profilePhoto'],
      ssnLast4: json['ssnLast4'],
      taxClassification: json['taxClassification'],
      icAgreementSignedAt: json['icAgreementSignedAt'] != null ? DateTime.tryParse(json['icAgreementSignedAt']) : null,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
    );
  }

  bool get isApproved => approvalStatus == 'approved';
  bool get isPending => approvalStatus == 'pending';
  String get vehicleDisplay => [vehicleYear, vehicleMake, vehicleModel].where((v) => v != null).join(' ');
}

class DriverEarnings {
  final double totalEarnings;
  final double weeklyEarnings;
  final double pendingPayout;
  final int totalTrips;
  final int weeklyTrips;
  final double averageTripFare;
  final double totalTips;
  final double totalTolls;
  final List<EarningsEntry> recentTrips;
  final List<MonthlyEarnings> monthlyBreakdown;

  DriverEarnings({
    this.totalEarnings = 0,
    this.weeklyEarnings = 0,
    this.pendingPayout = 0,
    this.totalTrips = 0,
    this.weeklyTrips = 0,
    this.averageTripFare = 0,
    this.totalTips = 0,
    this.totalTolls = 0,
    this.recentTrips = const [],
    this.monthlyBreakdown = const [],
  });

  factory DriverEarnings.fromJson(Map<String, dynamic> json) {
    return DriverEarnings(
      totalEarnings: double.tryParse(json['totalEarnings']?.toString() ?? '0') ?? 0,
      weeklyEarnings: double.tryParse(json['weeklyEarnings']?.toString() ?? '0') ?? 0,
      pendingPayout: double.tryParse(json['pendingPayout']?.toString() ?? '0') ?? 0,
      totalTrips: json['totalTrips'] ?? 0,
      weeklyTrips: json['weeklyTrips'] ?? 0,
      averageTripFare: double.tryParse(json['averageTripFare']?.toString() ?? '0') ?? 0,
      totalTips: double.tryParse(json['totalTips']?.toString() ?? '0') ?? 0,
      totalTolls: double.tryParse(json['totalTolls']?.toString() ?? '0') ?? 0,
      recentTrips: (json['recentTrips'] as List?)?.map((e) => EarningsEntry.fromJson(e)).toList() ?? [],
      monthlyBreakdown: (json['monthlyBreakdown'] as List?)?.map((e) => MonthlyEarnings.fromJson(e)).toList() ?? [],
    );
  }
}

class EarningsEntry {
  final int rideId;
  final String? patientName;
  final String fare;
  final String? tip;
  final String? toll;
  final String? payout;
  final DateTime? completedAt;

  EarningsEntry({
    required this.rideId,
    this.patientName,
    required this.fare,
    this.tip,
    this.toll,
    this.payout,
    this.completedAt,
  });

  factory EarningsEntry.fromJson(Map<String, dynamic> json) {
    return EarningsEntry(
      rideId: json['rideId'] ?? 0,
      patientName: json['patientName'],
      fare: json['fare']?.toString() ?? '0',
      tip: json['tip']?.toString(),
      toll: json['toll']?.toString(),
      payout: json['payout']?.toString(),
      completedAt: json['completedAt'] != null ? DateTime.tryParse(json['completedAt']) : null,
    );
  }
}

class MonthlyEarnings {
  final String month;
  final double total;
  final int trips;

  MonthlyEarnings({required this.month, required this.total, required this.trips});

  factory MonthlyEarnings.fromJson(Map<String, dynamic> json) {
    return MonthlyEarnings(
      month: json['month'] ?? '',
      total: double.tryParse(json['total']?.toString() ?? '0') ?? 0,
      trips: json['trips'] ?? 0,
    );
  }
}
