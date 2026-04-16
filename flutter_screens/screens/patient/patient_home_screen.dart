import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../models/auth_models.dart';
import '../../models/ride_models.dart';
import '../../services/ride_service.dart';
import '../../services/auth_service.dart';
import '../../services/haptic_service.dart';
import '../../services/native_share_service.dart';
import '../../widgets/ride_card.dart';
import '../../widgets/connectivity_wrapper.dart';
import '../settings/app_settings_screen.dart';
import 'book_ride_screen.dart';
import 'ride_detail_screen.dart';
import 'ride_history_screen.dart';
import '../jobs/job_list_screen.dart';
import '../caregiver/caregiver_portal_screen.dart';

class PatientHomeScreen extends StatefulWidget {
  final RideService rideService;
  final AuthService authService;
  final User user;
  final VoidCallback onLogout;

  const PatientHomeScreen({
    super.key,
    required this.rideService,
    required this.authService,
    required this.user,
    required this.onLogout,
  });

  @override
  State<PatientHomeScreen> createState() => _PatientHomeScreenState();
}

class _PatientHomeScreenState extends State<PatientHomeScreen> with TickerProviderStateMixin {
  int _currentIndex = 0;
  List<Ride> _rides = [];
  bool _isLoading = true;
  String? _error;
  late AnimationController _fabAnimController;
  late Animation<double> _fabScaleAnim;

  @override
  void initState() {
    super.initState();
    _fabAnimController = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
    _fabScaleAnim = CurvedAnimation(parent: _fabAnimController, curve: Curves.elasticOut);
    _loadRides();
    _fabAnimController.forward();
  }

  @override
  void dispose() {
    _fabAnimController.dispose();
    super.dispose();
  }

  Future<void> _loadRides() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      _rides = await widget.rideService.getMyRides();
      HapticService.pullToRefresh();
      setState(() => _isLoading = false);
    } catch (e) {
      setState(() { _error = e.toString(); _isLoading = false; });
    }
  }

  List<Ride> get _activeRides => _rides.where((r) => r.isActive).toList();

  @override
  Widget build(BuildContext context) {
    final pages = [
      _buildHomePage(),
      RideHistoryScreen(rideService: widget.rideService),
      _buildAccountPage(),
    ];
    return Scaffold(
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 200),
        child: pages[_currentIndex],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) {
          HapticService.selectionClick();
          setState(() => _currentIndex = i);
        },
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.history), label: 'Rides'),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Account'),
        ],
      ),
      floatingActionButton: _currentIndex == 0
          ? ScaleTransition(
              scale: _fabScaleAnim,
              child: FloatingActionButton.extended(
                onPressed: () async {
                  HapticService.buttonTap();
                  await Navigator.push(context, MaterialPageRoute(
                    builder: (_) => BookRideScreen(rideService: widget.rideService),
                  ));
                  _loadRides();
                },
                icon: const Icon(Icons.add),
                label: const Text('Book Ride'),
                backgroundColor: const Color(0xFF6366F1),
                foregroundColor: Colors.white,
              ),
            )
          : null,
    );
  }

  Widget _buildHomePage() {
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _loadRides,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Hero(
                          tag: 'user_avatar',
                          child: CircleAvatar(
                            radius: 24,
                            backgroundColor: const Color(0xFF6366F1).withOpacity(0.15),
                            child: Text(
                              (widget.user.fullName ?? widget.user.username).substring(0, 1).toUpperCase(),
                              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF6366F1)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Welcome back,', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                              Text(widget.user.fullName ?? widget.user.username,
                                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.share_outlined),
                          onPressed: () => NativeShareService.shareAppInvite(),
                          tooltip: 'Invite friends',
                        ),
                        IconButton(
                          icon: const Icon(Icons.notifications_outlined),
                          onPressed: () {
                            HapticService.buttonTap();
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    Row(
                      children: [
                        _quickAction(Icons.local_taxi, 'Book Ride', () async {
                          HapticService.buttonTap();
                          await Navigator.push(context, MaterialPageRoute(
                            builder: (_) => BookRideScreen(rideService: widget.rideService),
                          ));
                          _loadRides();
                        }),
                        const SizedBox(width: 12),
                        _quickAction(Icons.work_outline, 'Jobs', () {
                          HapticService.buttonTap();
                          Navigator.push(context, MaterialPageRoute(
                            builder: (_) => JobListScreen(baseUrl: ''),
                          ));
                        }),
                        const SizedBox(width: 12),
                        _quickAction(Icons.family_restroom, 'Caregiver', () {
                          HapticService.buttonTap();
                          Navigator.push(context, MaterialPageRoute(
                            builder: (_) => CaregiverPortalScreen(rideService: widget.rideService),
                          ));
                        }),
                      ],
                    ),
                    const SizedBox(height: 24),
                    const Text('Active Rides', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ),
            if (_isLoading)
              const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))
            else if (_error != null)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.cloud_off, size: 48, color: Colors.grey[400]),
                      const SizedBox(height: 12),
                      Text('Unable to load rides', style: TextStyle(color: Colors.red[700])),
                      const SizedBox(height: 8),
                      Text('Pull down to try again', style: TextStyle(color: Colors.grey[500], fontSize: 13)),
                      const SizedBox(height: 16),
                      ElevatedButton.icon(
                        onPressed: _loadRides,
                        icon: const Icon(Icons.refresh, size: 18),
                        label: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              )
            else if (_activeRides.isEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Container(
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      color: Colors.grey[50],
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      children: [
                        Icon(Icons.local_taxi, size: 48, color: Colors.grey[400]),
                        const SizedBox(height: 12),
                        Text('No active rides', style: TextStyle(color: Colors.grey[600], fontSize: 15)),
                        const SizedBox(height: 4),
                        Text('Book a ride to get started', style: TextStyle(color: Colors.grey[400], fontSize: 13)),
                      ],
                    ),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final ride = _activeRides[index];
                      return Dismissible(
                        key: Key('ride_${ride.id}'),
                        direction: DismissDirection.endToStart,
                        background: Container(
                          alignment: Alignment.centerRight,
                          padding: const EdgeInsets.only(right: 20),
                          margin: const EdgeInsets.only(bottom: 8),
                          decoration: BoxDecoration(
                            color: Colors.blue[50],
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(Icons.share, color: Colors.blue[600]),
                        ),
                        confirmDismiss: (direction) async {
                          HapticService.mediumImpact();
                          NativeShareService.shareRideDetails(
                            rideId: ride.id.toString(),
                            driverName: ride.driverName ?? 'Finding driver...',
                            vehicleInfo: ride.vehicleInfo ?? '',
                            pickupAddress: ride.pickupAddress,
                            dropoffAddress: ride.dropoffAddress,
                          );
                          return false;
                        },
                        child: RideCard(
                          ride: ride,
                          onTap: () async {
                            HapticService.buttonTap();
                            await Navigator.push(context, MaterialPageRoute(
                              builder: (_) => RideDetailScreen(
                                rideService: widget.rideService,
                                rideId: ride.id,
                              ),
                            ));
                            _loadRides();
                          },
                        ),
                      );
                    },
                    childCount: _activeRides.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _quickAction(IconData icon, String label, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            color: const Color(0xFF6366F1).withOpacity(0.08),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              Icon(icon, color: const Color(0xFF6366F1), size: 28),
              const SizedBox(height: 6),
              Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            ],
          ),
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
            child: Hero(
              tag: 'user_avatar',
              child: CircleAvatar(
                radius: 40,
                backgroundColor: const Color(0xFF6366F1).withOpacity(0.15),
                child: Text(
                  (widget.user.fullName ?? widget.user.username).substring(0, 1).toUpperCase(),
                  style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Color(0xFF6366F1)),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Center(child: Text(widget.user.fullName ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold))),
          Center(child: Text(widget.user.username, style: TextStyle(color: Colors.grey[600]))),
          const SizedBox(height: 32),
          _accountTile(Icons.person_outline, 'Edit Profile', () {
            HapticService.buttonTap();
          }),
          _accountTile(Icons.payment, 'Payment Methods', () {
            HapticService.buttonTap();
          }),
          _accountTile(Icons.family_restroom, 'Caregiver Portal', () {
            HapticService.buttonTap();
            Navigator.push(context, MaterialPageRoute(
              builder: (_) => CaregiverPortalScreen(rideService: widget.rideService),
            ));
          }),
          _accountTile(Icons.settings_outlined, 'App Settings', () {
            HapticService.buttonTap();
            Navigator.push(context, MaterialPageRoute(
              builder: (_) => const AppSettingsScreen(),
            ));
          }),
          _accountTile(Icons.share_outlined, 'Invite Friends', () {
            NativeShareService.shareAppInvite();
          }),
          _accountTile(Icons.description_outlined, 'Terms of Service', () {
            HapticService.buttonTap();
          }),
          _accountTile(Icons.privacy_tip_outlined, 'Privacy Policy', () {
            HapticService.buttonTap();
          }),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () async {
                HapticService.buttonTap();
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
