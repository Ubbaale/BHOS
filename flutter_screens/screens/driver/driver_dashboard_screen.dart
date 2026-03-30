import 'dart:async';
import 'package:flutter/material.dart';
import '../../models/auth_models.dart';
import '../../models/ride_models.dart';
import '../../models/driver_models.dart';
import '../../services/ride_service.dart';
import '../../services/driver_service.dart';
import '../../services/auth_service.dart';
import '../../widgets/ride_card.dart';
import 'active_ride_screen.dart';
import 'available_rides_screen.dart';
import 'driver_earnings_screen.dart';

class DriverDashboardScreen extends StatefulWidget {
  final RideService rideService;
  final DriverService driverService;
  final AuthService authService;
  final User user;
  final VoidCallback onLogout;

  const DriverDashboardScreen({
    super.key,
    required this.rideService,
    required this.driverService,
    required this.authService,
    required this.user,
    required this.onLogout,
  });

  @override
  State<DriverDashboardScreen> createState() => _DriverDashboardScreenState();
}

class _DriverDashboardScreenState extends State<DriverDashboardScreen> {
  int _currentIndex = 0;
  DriverProfile? _profile;
  List<Ride> _myRides = [];
  bool _isLoading = true;
  bool _isAvailable = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final results = await Future.wait([
        widget.driverService.getProfile(),
        widget.rideService.getMyRides(),
      ]);
      setState(() {
        _profile = results[0] as DriverProfile;
        _myRides = results[1] as List<Ride>;
        _isAvailable = _profile?.isAvailable ?? false;
        _isLoading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _isLoading = false; });
    }
  }

  List<Ride> get _activeRides => _myRides.where((r) => r.isActive).toList();

  Future<void> _toggleAvailability() async {
    final newValue = !_isAvailable;
    setState(() => _isAvailable = newValue);
    try {
      await widget.driverService.setAvailability(newValue);
    } catch (e) {
      setState(() => _isAvailable = !newValue);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      _buildHomePage(),
      AvailableRidesScreen(rideService: widget.rideService, onAccepted: _loadData),
      DriverEarningsScreen(driverService: widget.driverService),
      _buildAccountPage(),
    ];
    return Scaffold(
      body: pages[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        type: BottomNavigationBarType.fixed,
        onTap: (i) => setState(() => _currentIndex = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.local_taxi), label: 'Available'),
          BottomNavigationBarItem(icon: Icon(Icons.account_balance_wallet), label: 'Earnings'),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Account'),
        ],
      ),
    );
  }

  Widget _buildHomePage() {
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _loadData,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, style: TextStyle(color: Colors.red[700])),
                        const SizedBox(height: 16),
                        ElevatedButton(onPressed: _loadData, child: const Text('Retry')),
                      ],
                    ),
                  )
                : ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      Row(
                        children: [
                          CircleAvatar(
                            radius: 24,
                            backgroundColor: const Color(0xFF6366F1).withOpacity(0.15),
                            child: const Icon(Icons.directions_car, color: Color(0xFF6366F1)),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(widget.user.fullName ?? widget.user.username,
                                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                                Text(_profile?.vehicleDisplay ?? 'Driver',
                                    style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                              ],
                            ),
                          ),
                          Switch(
                            value: _isAvailable,
                            onChanged: (_) => _toggleAvailability(),
                            activeColor: Colors.green,
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: _isAvailable ? Colors.green.withOpacity(0.1) : Colors.grey.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.circle, size: 10, color: _isAvailable ? Colors.green : Colors.grey),
                            const SizedBox(width: 6),
                            Text(_isAvailable ? 'Online - Accepting Rides' : 'Offline',
                                style: TextStyle(color: _isAvailable ? Colors.green[700] : Colors.grey[600], fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                      if (_profile != null && !_profile!.isApproved) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.orange[50],
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.orange[200]!),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.warning_amber, color: Colors.orange[700]),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _profile!.isPending ? 'Your account is pending approval.' : 'Your account is not yet approved.',
                                  style: TextStyle(color: Colors.orange[800]),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          _statCard('Rating', _profile?.averageRating.toStringAsFixed(1) ?? '—', Icons.star, Colors.amber),
                          const SizedBox(width: 8),
                          _statCard('Trips', _profile?.totalTrips.toString() ?? '0', Icons.route, Colors.blue),
                          const SizedBox(width: 8),
                          _statCard('Earnings', '\$${_profile?.totalEarnings.toStringAsFixed(0) ?? '0'}', Icons.attach_money, Colors.green),
                        ],
                      ),
                      const SizedBox(height: 24),
                      const Text('Active Rides', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 12),
                      if (_activeRides.isEmpty)
                        Container(
                          padding: const EdgeInsets.all(32),
                          decoration: BoxDecoration(
                            color: Colors.grey[50],
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Column(
                            children: [
                              Icon(Icons.inbox, size: 48, color: Colors.grey[400]),
                              const SizedBox(height: 12),
                              Text('No active rides', style: TextStyle(color: Colors.grey[600])),
                              const SizedBox(height: 4),
                              Text('Go online to receive ride requests', style: TextStyle(color: Colors.grey[400], fontSize: 13)),
                            ],
                          ),
                        )
                      else
                        ..._activeRides.map((ride) => RideCard(
                          ride: ride,
                          isDriver: true,
                          onTap: () async {
                            await Navigator.push(context, MaterialPageRoute(
                              builder: (_) => ActiveRideScreen(rideService: widget.rideService, rideId: ride.id),
                            ));
                            _loadData();
                          },
                        )),
                    ],
                  ),
      ),
    );
  }

  Widget _statCard(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 6),
            Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
            Text(label, style: TextStyle(color: Colors.grey[600], fontSize: 11)),
          ],
        ),
      ),
    );
  }

  Widget _buildAccountPage() {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const SizedBox(height: 20),
          Center(
            child: CircleAvatar(
              radius: 40,
              backgroundColor: const Color(0xFF6366F1).withOpacity(0.15),
              child: const Icon(Icons.directions_car, size: 36, color: Color(0xFF6366F1)),
            ),
          ),
          const SizedBox(height: 12),
          Center(child: Text(widget.user.fullName ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold))),
          Center(child: Text(widget.user.username, style: TextStyle(color: Colors.grey[600]))),
          if (_profile != null) ...[
            const SizedBox(height: 4),
            Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: _profile!.isApproved ? Colors.green.withOpacity(0.1) : Colors.orange.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _profile!.approvalStatus.toUpperCase(),
                  style: TextStyle(
                    color: _profile!.isApproved ? Colors.green : Colors.orange,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 32),
          _accountTile(Icons.person_outline, 'Edit Profile', () {}),
          _accountTile(Icons.directions_car, 'Vehicle Info', () {}),
          _accountTile(Icons.description, 'Documents', () {}),
          _accountTile(Icons.account_balance, 'Payout Settings', () {}),
          _accountTile(Icons.gavel, 'Contractor Agreement', () {}),
          _accountTile(Icons.description_outlined, 'Terms of Service', () {}),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () async {
                await widget.authService.logout();
                widget.onLogout();
              },
              icon: const Icon(Icons.logout, color: Colors.red),
              label: const Text('Sign Out', style: TextStyle(color: Colors.red)),
              style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.red)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _accountTile(IconData icon, String title, VoidCallback onTap) {
    return ListTile(
      leading: Icon(icon, color: Colors.grey[700]),
      title: Text(title),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}
