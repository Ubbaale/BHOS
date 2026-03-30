import 'package:flutter/material.dart';

class EtaControls extends StatelessWidget {
  final String currentStatus;
  final Future<void> Function(String status) onUpdateEta;

  const EtaControls({
    super.key,
    required this.currentStatus,
    required this.onUpdateEta,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('ETA Status', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Row(
              children: [
                _etaButton(context, 'en_route', 'En Route', Icons.directions_car, Colors.blue),
                const SizedBox(width: 8),
                _etaButton(context, 'arriving', 'Arriving', Icons.near_me, Colors.orange),
                const SizedBox(width: 8),
                _etaButton(context, 'on_site', 'On Site', Icons.location_on, Colors.green),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _etaButton(BuildContext context, String status, String label, IconData icon, Color color) {
    final isActive = currentStatus == status;
    return Expanded(
      child: OutlinedButton.icon(
        onPressed: isActive
            ? null
            : () async {
                try {
                  await onUpdateEta(status);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Status: $label'), backgroundColor: color),
                  );
                } catch (e) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
                  );
                }
              },
        icon: Icon(icon, size: 16),
        label: Text(label, style: const TextStyle(fontSize: 11)),
        style: OutlinedButton.styleFrom(
          backgroundColor: isActive ? color.withOpacity(0.15) : null,
          foregroundColor: isActive ? color : Colors.grey[700],
          side: BorderSide(color: isActive ? color : Colors.grey[300]!),
          padding: const EdgeInsets.symmetric(vertical: 10),
        ),
      ),
    );
  }
}
