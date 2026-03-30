import 'package:flutter/material.dart';
import '../models/ride_models.dart';

class FareBreakdownWidget extends StatelessWidget {
  final Ride ride;
  final bool compact;

  const FareBreakdownWidget({
    super.key,
    required this.ride,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final items = <_FareItem>[];
    if (ride.baseFare != null) items.add(_FareItem('Base Fare', ride.baseFare!));
    if (ride.distanceFare != null) items.add(_FareItem('Distance', ride.distanceFare!));
    if (ride.surgeFare != null && ride.surgeFare != '0') {
      items.add(_FareItem('Surge (${ride.surgeMultiplier ?? '?'}x)', ride.surgeFare!));
    }
    if (ride.tollEstimate != null && ride.tollEstimate != '0') {
      items.add(_FareItem('Tolls (est)', ride.tollEstimate!));
    }
    if (ride.tollActual != null && ride.tollActual != '0') {
      items.add(_FareItem('Tolls (actual)', ride.tollActual!));
    }
    if (ride.waitTimeFare != null && ride.waitTimeFare != '0') {
      items.add(_FareItem('Wait Time', ride.waitTimeFare!));
    }
    if (ride.tipAmount != null && ride.tipAmount != '0') {
      items.add(_FareItem('Tip', ride.tipAmount!));
    }

    if (compact && items.isEmpty) {
      return Text('\$${ride.displayFare}',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ...items.map((item) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(item.label, style: TextStyle(color: Colors.grey[600], fontSize: compact ? 12 : 14)),
              Text('\$${item.amount}', style: TextStyle(fontSize: compact ? 12 : 14)),
            ],
          ),
        )),
        if (items.isNotEmpty) ...[
          const Divider(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Total', style: TextStyle(fontWeight: FontWeight.bold, fontSize: compact ? 13 : 15)),
              Text('\$${ride.displayFare}',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: compact ? 13 : 15, color: const Color(0xFF6366F1))),
            ],
          ),
        ],
      ],
    );
  }
}

class _FareItem {
  final String label;
  final String amount;
  _FareItem(this.label, this.amount);
}
