import 'package:flutter/material.dart';
import '../../models/driver_models.dart';
import '../../services/driver_service.dart';

class DriverEarningsScreen extends StatefulWidget {
  final DriverService driverService;
  const DriverEarningsScreen({super.key, required this.driverService});

  @override
  State<DriverEarningsScreen> createState() => _DriverEarningsScreenState();
}

class _DriverEarningsScreenState extends State<DriverEarningsScreen> {
  DriverEarnings? _earnings;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadEarnings();
  }

  Future<void> _loadEarnings() async {
    setState(() => _isLoading = true);
    try {
      _earnings = await widget.driverService.getEarnings();
      setState(() => _isLoading = false);
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Earnings')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _earnings == null
              ? const Center(child: Text('Could not load earnings'))
              : RefreshIndicator(
                  onRefresh: _loadEarnings,
                  child: ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      _earningsOverview(),
                      const SizedBox(height: 20),
                      _weeklyCard(),
                      const SizedBox(height: 20),
                      const Text('Recent Trips', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 12),
                      if (_earnings!.recentTrips.isEmpty)
                        Center(child: Text('No trips yet', style: TextStyle(color: Colors.grey[500])))
                      else
                        ..._earnings!.recentTrips.map(_tripRow),
                      if (_earnings!.monthlyBreakdown.isNotEmpty) ...[
                        const SizedBox(height: 24),
                        const Text('Monthly Breakdown', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 12),
                        ..._earnings!.monthlyBreakdown.map(_monthRow),
                      ],
                    ],
                  ),
                ),
    );
  }

  Widget _earningsOverview() {
    final e = _earnings!;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          const Text('Total Earnings', style: TextStyle(color: Colors.white70, fontSize: 14)),
          const SizedBox(height: 4),
          Text('\$${e.totalEarnings.toStringAsFixed(2)}',
              style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _miniStat('Trips', e.totalTrips.toString()),
              _miniStat('Avg Fare', '\$${e.averageTripFare.toStringAsFixed(2)}'),
              _miniStat('Tips', '\$${e.totalTips.toStringAsFixed(2)}'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _miniStat(String label, String value) {
    return Column(
      children: [
        Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
        Text(label, style: const TextStyle(color: Colors.white60, fontSize: 11)),
      ],
    );
  }

  Widget _weeklyCard() {
    final e = _earnings!;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('This Week', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('\$${e.weeklyEarnings.toStringAsFixed(2)}',
                          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF6366F1))),
                      Text('${e.weeklyTrips} trips', style: TextStyle(color: Colors.grey[600])),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.green.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: [
                      Text('\$${e.pendingPayout.toStringAsFixed(2)}',
                          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green)),
                      const Text('Pending', style: TextStyle(fontSize: 11, color: Colors.green)),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _tripRow(EarningsEntry entry) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Colors.green.withOpacity(0.1),
          child: const Icon(Icons.directions_car, color: Colors.green, size: 20),
        ),
        title: Text('Ride #${entry.rideId}', style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(entry.patientName ?? 'Patient'),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('\$${entry.payout ?? entry.fare}', style: const TextStyle(fontWeight: FontWeight.bold)),
            if (entry.tip != null && entry.tip != '0')
              Text('+\$${entry.tip} tip', style: const TextStyle(color: Colors.green, fontSize: 11)),
          ],
        ),
      ),
    );
  }

  Widget _monthRow(MonthlyEarnings month) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(month.month, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('${month.trips} trips'),
        trailing: Text('\$${month.total.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ),
    );
  }
}
