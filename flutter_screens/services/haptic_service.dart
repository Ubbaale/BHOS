import 'package:flutter/services.dart';

class HapticService {
  static void lightImpact() => HapticFeedback.lightImpact();
  static void mediumImpact() => HapticFeedback.mediumImpact();
  static void heavyImpact() => HapticFeedback.heavyImpact();
  static void selectionClick() => HapticFeedback.selectionClick();
  static void vibrate() => HapticFeedback.vibrate();

  static void success() => HapticFeedback.mediumImpact();
  static void error() => HapticFeedback.heavyImpact();
  static void warning() => HapticFeedback.lightImpact();

  static void buttonTap() => HapticFeedback.lightImpact();
  static void toggle() => HapticFeedback.selectionClick();
  static void pullToRefresh() => HapticFeedback.mediumImpact();
  static void rideAccepted() => HapticFeedback.heavyImpact();
  static void notification() => HapticFeedback.mediumImpact();
}
