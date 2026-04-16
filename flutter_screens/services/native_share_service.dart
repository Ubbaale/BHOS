import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

class NativeShareService {
  static Future<void> shareRideDetails({
    required String rideId,
    required String driverName,
    required String vehicleInfo,
    required String pickupAddress,
    required String dropoffAddress,
    String? estimatedArrival,
  }) async {
    HapticFeedback.mediumImpact();
    final buffer = StringBuffer();
    buffer.writeln('🚗 CareHub Ride Update');
    buffer.writeln('');
    buffer.writeln('Driver: $driverName');
    buffer.writeln('Vehicle: $vehicleInfo');
    buffer.writeln('From: $pickupAddress');
    buffer.writeln('To: $dropoffAddress');
    if (estimatedArrival != null) {
      buffer.writeln('ETA: $estimatedArrival');
    }
    buffer.writeln('');
    buffer.writeln('Track live: https://app.carehubapp.com/ride/$rideId/track');
    buffer.writeln('');
    buffer.writeln('Shared via CareHub');

    await Share.share(buffer.toString(), subject: 'My CareHub Ride');
  }

  static Future<void> shareJobPosting({
    required String jobTitle,
    required String facility,
    required String location,
    required String payRate,
  }) async {
    HapticFeedback.mediumImpact();
    final text = '''
💼 Healthcare Job Opportunity

Position: $jobTitle
Facility: $facility
Location: $location
Pay: $payRate

Apply on CareHub: https://app.carehubapp.com/jobs

Shared via CareHub''';

    await Share.share(text, subject: 'Job Opportunity: $jobTitle');
  }

  static Future<void> shareTripSafety({
    required String driverName,
    required String vehicleInfo,
    required String licensePlate,
    required String pickupAddress,
    required String dropoffAddress,
    required String liveTrackUrl,
  }) async {
    HapticFeedback.heavyImpact();
    final text = '''
📍 I'm sharing my CareHub ride with you for safety.

Driver: $driverName
Vehicle: $vehicleInfo
Plate: $licensePlate
From: $pickupAddress
To: $dropoffAddress

Track my ride live: $liveTrackUrl

If anything seems wrong, call 911.
Shared via CareHub Safety''';

    await Share.share(text, subject: 'CareHub Trip Safety Share');
  }

  static Future<void> shareAppInvite() async {
    HapticFeedback.lightImpact();
    const text = '''
I'm using CareHub for medical transportation and healthcare staffing. Check it out!

📱 Download:
iOS: https://apps.apple.com/app/id6444679914
Android: https://play.google.com/store/apps/details?id=com.fieldhcp.app''';

    await Share.share(text, subject: 'Try CareHub');
  }
}
