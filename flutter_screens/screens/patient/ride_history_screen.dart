import 'package:flutter/material.dart';
import '../../models/ride_models.dart';
import '../../services/ride_service.dart';
import '../../widgets/ride_card.dart';
import 'ride_detail_screen.dart';

class RideHistoryScreen extends StatefulWidget {
  final RideService rideService;
  const RideHistoryScreen({super.key, required this.rideService});

  @override
  State<RideHistoryScreen> createState() => _RideHistoryScreenState();
}

class _RideHistoryScreenState extends State<RideHistoryScreen> {
  List<Ride> _rides = [];
  bool _isLoading = true;
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _loadRides();
  }

  Future<void> _loadRides() async {
    setState(() => _isLoading = true);
    try {
      _rides = await widget.rideService.getMyRides();
      _rides.sort((a, b) => (b.createdAt ?? DateTime(2000)).compareTo(a.createdAt ?? DateTime(2000)));
      setState(() => _isLoading = false);
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  List<Ride> get _filteredRides {
    if (_filter == 'all') return _rides;
    if (_filter == 'active') return _rides.where((r) => r.isActive).toList();
    if (_filter == 'completed') return _rides.where((r) => r.isCompleted).toList();
    if (_filter == 'cancelled') return _rides.where((r) => r.isCancelled).toList();
    return _rides;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ride History')),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.all(12),
            child: Row(
              children: ['all', 'active', 'completed', 'cancelled'].map((f) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(f[0].toUpperCase() + f.substring(1)),
                  selected: _filter == f,
                  onSelected: (_) => setState(() => _filter = f),
                  selectedColor: const Color(0xFF6366F1).withOpacity(0.2),
                ),
              )).toList(),
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredRides.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.history, size: 48, color: Colors.grey[400]),
                            const SizedBox(height: 12),
                            Text('No rides found', style: TextStyle(color: Colors.grey[600])),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadRides,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: _filteredRides.length,
                          itemBuilder: (context, index) => RideCard(
                            ride: _filteredRides[index],
                            onTap: () async {
                              await Navigator.push(context, MaterialPageRoute(
                                builder: (_) => RideDetailScreen(
                                  rideService: widget.rideService,
                                  rideId: _filteredRides[index].id,
                                ),
                              ));
                              _loadRides();
                            },
                          ),
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
