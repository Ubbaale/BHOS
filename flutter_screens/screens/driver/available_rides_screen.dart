import 'package:flutter/material.dart';
import '../../models/ride_models.dart';
import '../../services/ride_service.dart';
import '../../widgets/ride_card.dart';
import 'active_ride_screen.dart';

class AvailableRidesScreen extends StatefulWidget {
  final RideService rideService;
  final VoidCallback? onAccepted;

  const AvailableRidesScreen({
    super.key,
    required this.rideService,
    this.onAccepted,
  });

  @override
  State<AvailableRidesScreen> createState() => _AvailableRidesScreenState();
}

class _AvailableRidesScreenState extends State<AvailableRidesScreen> {
  List<Ride> _rides = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadRides();
  }

  Future<void> _loadRides() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      _rides = await widget.rideService.getAvailableRides();
      setState(() => _isLoading = false);
    } catch (e) {
      setState(() { _error = e.toString(); _isLoading = false; });
    }
  }

  Future<void> _acceptRide(Ride ride) async {
    try {
      await widget.rideService.acceptRide(ride.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Ride accepted!'), backgroundColor: Colors.green),
        );
        widget.onAccepted?.call();
        Navigator.push(context, MaterialPageRoute(
          builder: (_) => ActiveRideScreen(rideService: widget.rideService, rideId: ride.id),
        ));
        _loadRides();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Available Rides')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!, style: TextStyle(color: Colors.red[700])),
                      const SizedBox(height: 16),
                      ElevatedButton(onPressed: _loadRides, child: const Text('Retry')),
                    ],
                  ),
                )
              : _rides.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.search_off, size: 48, color: Colors.grey[400]),
                          const SizedBox(height: 12),
                          Text('No available rides', style: TextStyle(color: Colors.grey[600])),
                          const SizedBox(height: 4),
                          Text('Pull down to refresh', style: TextStyle(color: Colors.grey[400], fontSize: 13)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadRides,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _rides.length,
                        itemBuilder: (context, index) {
                          final ride = _rides[index];
                          return RideCard(
                            ride: ride,
                            isDriver: true,
                            actionLabel: 'Accept Ride',
                            onAction: () => _acceptRide(ride),
                          );
                        },
                      ),
                    ),
    );
  }
}
