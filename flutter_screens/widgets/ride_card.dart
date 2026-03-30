import 'package:flutter/material.dart';
import '../models/ride_models.dart';

class RideCard extends StatelessWidget {
  final Ride ride;
  final VoidCallback? onTap;
  final bool isDriver;
  final String? actionLabel;
  final VoidCallback? onAction;

  const RideCard({
    super.key,
    required this.ride,
    this.onTap,
    this.isDriver = false,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _statusIcon(),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Ride #${ride.id}',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        if (ride.createdAt != null)
                          Text(
                            '${ride.createdAt!.month}/${ride.createdAt!.day}/${ride.createdAt!.year}',
                            style: TextStyle(color: Colors.grey[500], fontSize: 11),
                          ),
                      ],
                    ),
                  ),
                  _statusChip(),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Column(
                    children: [
                      const Icon(Icons.trip_origin, color: Colors.green, size: 14),
                      Container(width: 1, height: 16, color: Colors.grey[300]),
                      const Icon(Icons.location_on, color: Colors.red, size: 14),
                    ],
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(ride.pickupAddress, maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 13)),
                        const SizedBox(height: 10),
                        Text(ride.dropoffAddress, maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 13)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  if (ride.vehicleType != null) ...[
                    Icon(Icons.directions_car, size: 14, color: Colors.grey[500]),
                    const SizedBox(width: 4),
                    Text(ride.vehicleType!, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                    const SizedBox(width: 12),
                  ],
                  if (ride.distance != null) ...[
                    Icon(Icons.straighten, size: 14, color: Colors.grey[500]),
                    const SizedBox(width: 4),
                    Text('${ride.distance} mi', style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                    const SizedBox(width: 12),
                  ],
                  const Spacer(),
                  Text(
                    '\$${ride.displayFare}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF6366F1)),
                  ),
                ],
              ),
              if (isDriver && ride.patientName != null) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.person, size: 14, color: Colors.grey[500]),
                    const SizedBox(width: 4),
                    Text(ride.patientName!, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                  ],
                ),
              ],
              if (!isDriver && ride.driverName != null) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.person, size: 14, color: Colors.grey[500]),
                    const SizedBox(width: 4),
                    Text('Driver: ${ride.driverName}', style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                  ],
                ),
              ],
              if (ride.isRoundTrip) ...[
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.purple.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text('ROUND TRIP', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.purple)),
                ),
              ],
              if (actionLabel != null) ...[
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: onAction,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6366F1),
                      foregroundColor: Colors.white,
                    ),
                    child: Text(actionLabel!),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _statusIcon() {
    Color color;
    IconData icon;
    switch (ride.status) {
      case 'requested': color = Colors.blue; icon = Icons.schedule; break;
      case 'accepted': color = Colors.purple; icon = Icons.check_circle; break;
      case 'driver_enroute': color = Colors.orange; icon = Icons.directions_car; break;
      case 'arrived': color = Colors.orange; icon = Icons.location_on; break;
      case 'picked_up': case 'in_progress': color = Colors.blue; icon = Icons.airline_seat_recline_normal; break;
      case 'completed': color = Colors.green; icon = Icons.check_circle; break;
      case 'cancelled': color = Colors.red; icon = Icons.cancel; break;
      default: color = Colors.grey; icon = Icons.help;
    }
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(icon, size: 20, color: color),
    );
  }

  Widget _statusChip() {
    Color color;
    switch (ride.status) {
      case 'requested': color = Colors.blue; break;
      case 'accepted': case 'driver_enroute': case 'arrived': case 'picked_up': case 'in_progress':
        color = Colors.orange; break;
      case 'completed': color = Colors.green; break;
      case 'cancelled': color = Colors.red; break;
      default: color = Colors.grey;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        ride.status.replaceAll('_', ' ').toUpperCase(),
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: color),
      ),
    );
  }
}
