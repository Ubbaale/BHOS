import 'package:flutter/material.dart';
import '../../models/ride_models.dart';
import '../../services/ride_service.dart';
import 'ride_tracking_screen.dart';

class RideDetailScreen extends StatefulWidget {
  final RideService rideService;
  final int rideId;

  const RideDetailScreen({
    super.key,
    required this.rideService,
    required this.rideId,
  });

  @override
  State<RideDetailScreen> createState() => _RideDetailScreenState();
}

class _RideDetailScreenState extends State<RideDetailScreen> {
  Ride? _ride;
  List<RideEvent> _events = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final ride = await widget.rideService.getRide(widget.rideId);
      List<RideEvent> events = [];
      try { events = await widget.rideService.getRideEvents(widget.rideId); } catch (_) {}
      setState(() { _ride = ride; _events = events; _isLoading = false; });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_ride != null ? 'Ride #${_ride!.id}' : 'Ride Detail'),
        actions: [
          if (_ride != null && _ride!.isActive)
            TextButton(
              onPressed: () => Navigator.push(context, MaterialPageRoute(
                builder: (_) => RideTrackingScreen(rideService: widget.rideService, rideId: widget.rideId),
              )),
              child: const Text('Track'),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _ride == null
              ? const Center(child: Text('Ride not found'))
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      _statusHeader(),
                      const SizedBox(height: 20),
                      _locationCard(),
                      const SizedBox(height: 16),
                      if (_ride!.driverName != null) ...[
                        _driverCard(),
                        const SizedBox(height: 16),
                      ],
                      _fareCard(),
                      const SizedBox(height: 16),
                      if (_events.isNotEmpty) _timelineCard(),
                      const SizedBox(height: 16),
                      if (_ride!.isCompleted && _ride!.rating == null) _rateButton(),
                    ],
                  ),
                ),
    );
  }

  Widget _statusHeader() {
    final ride = _ride!;
    Color statusColor;
    IconData statusIcon;
    switch (ride.status) {
      case 'completed': statusColor = Colors.green; statusIcon = Icons.check_circle; break;
      case 'cancelled': statusColor = Colors.red; statusIcon = Icons.cancel; break;
      case 'requested': statusColor = Colors.blue; statusIcon = Icons.schedule; break;
      default: statusColor = Colors.orange; statusIcon = Icons.directions_car;
    }
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: statusColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: statusColor.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Icon(statusIcon, color: statusColor, size: 32),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(ride.status.replaceAll('_', ' ').toUpperCase(),
                    style: TextStyle(fontWeight: FontWeight.bold, color: statusColor, fontSize: 16)),
                if (ride.createdAt != null)
                  Text('${ride.createdAt!.month}/${ride.createdAt!.day}/${ride.createdAt!.year}',
                      style: TextStyle(color: Colors.grey[600], fontSize: 13)),
              ],
            ),
          ),
          Text('\$${ride.displayFare}', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: statusColor)),
        ],
      ),
    );
  }

  Widget _locationCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Route', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 12),
            Row(
              children: [
                Column(
                  children: [
                    const Icon(Icons.trip_origin, color: Colors.green, size: 16),
                    Container(width: 1, height: 24, color: Colors.grey[300]),
                    const Icon(Icons.location_on, color: Colors.red, size: 16),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_ride!.pickupAddress, style: const TextStyle(fontSize: 13)),
                      const SizedBox(height: 16),
                      Text(_ride!.dropoffAddress, style: const TextStyle(fontSize: 13)),
                    ],
                  ),
                ),
              ],
            ),
            if (_ride!.distance != null) ...[
              const Divider(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _infoChip(Icons.straighten, '${_ride!.distance} mi'),
                  if (_ride!.estimatedDuration != null) _infoChip(Icons.schedule, '${_ride!.estimatedDuration} min'),
                  if (_ride!.vehicleType != null) _infoChip(Icons.directions_car, _ride!.vehicleType!),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _infoChip(IconData icon, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: Colors.grey),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(color: Colors.grey[700], fontSize: 12)),
      ],
    );
  }

  Widget _driverCard() {
    final ride = _ride!;
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: const Color(0xFF6366F1).withOpacity(0.15),
          child: const Icon(Icons.person, color: Color(0xFF6366F1)),
        ),
        title: Text(ride.driverName!, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text([ride.vehicleColor, ride.vehicleMake, ride.vehicleModel]
            .where((v) => v != null).join(' ')),
        trailing: ride.driverRating != null
            ? Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.star, color: Colors.amber, size: 18),
                  Text('${ride.driverRating}', style: const TextStyle(fontWeight: FontWeight.bold)),
                ],
              )
            : null,
      ),
    );
  }

  Widget _fareCard() {
    final ride = _ride!;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Fare Breakdown', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 12),
            if (ride.baseFare != null) _fareRow('Base Fare', '\$${ride.baseFare}'),
            if (ride.distanceFare != null) _fareRow('Distance', '\$${ride.distanceFare}'),
            if (ride.surgeFare != null && ride.surgeFare != '0') _fareRow('Surge (${ride.surgeMultiplier}x)', '\$${ride.surgeFare}'),
            if (ride.tollEstimate != null && ride.tollEstimate != '0') _fareRow('Tolls (est)', '\$${ride.tollEstimate}'),
            if (ride.tollActual != null && ride.tollActual != '0') _fareRow('Tolls (actual)', '\$${ride.tollActual}'),
            if (ride.waitTimeFare != null && ride.waitTimeFare != '0') _fareRow('Wait Time', '\$${ride.waitTimeFare}'),
            if (ride.tipAmount != null && ride.tipAmount != '0') _fareRow('Tip', '\$${ride.tipAmount}'),
            const Divider(),
            _fareRow('Total', '\$${ride.displayFare}', bold: true),
          ],
        ),
      ),
    );
  }

  Widget _fareRow(String label, String value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[700], fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
          Text(value, style: TextStyle(fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
        ],
      ),
    );
  }

  Widget _timelineCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Timeline', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 12),
            ..._events.map((e) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Icon(Icons.circle, size: 8, color: Colors.grey[400]),
                  const SizedBox(width: 8),
                  Expanded(child: Text(e.description ?? e.type, style: const TextStyle(fontSize: 13))),
                  if (e.timestamp != null)
                    Text('${e.timestamp!.hour}:${e.timestamp!.minute.toString().padLeft(2, '0')}',
                        style: TextStyle(color: Colors.grey[500], fontSize: 12)),
                ],
              ),
            )),
          ],
        ),
      ),
    );
  }

  Widget _rateButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: _showRatingDialog,
        icon: const Icon(Icons.star),
        label: const Text('Rate This Ride'),
        style: ElevatedButton.styleFrom(backgroundColor: Colors.amber, foregroundColor: Colors.black),
      ),
    );
  }

  Future<void> _showRatingDialog() async {
    int rating = 5;
    final commentController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Rate Your Ride'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (i) => IconButton(
                  icon: Icon(i < rating ? Icons.star : Icons.star_border, color: Colors.amber, size: 32),
                  onPressed: () => setDialogState(() => rating = i + 1),
                )),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: commentController,
                maxLines: 3,
                decoration: const InputDecoration(hintText: 'Leave a comment (optional)', border: OutlineInputBorder()),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Submit')),
          ],
        ),
      ),
    );
    if (confirmed == true) {
      try {
        await widget.rideService.rateRide(widget.rideId, rating,
            comment: commentController.text.isNotEmpty ? commentController.text : null);
        _loadData();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Rating submitted!'), backgroundColor: Colors.green),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
          );
        }
      }
    }
  }
}
