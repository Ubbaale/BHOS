import 'package:flutter/material.dart';
import 'services/api_client.dart';
import 'services/auth_service.dart';
import 'services/ride_service.dart';
import 'services/driver_service.dart';
import 'services/job_service.dart';
import 'services/push_notification_service.dart';
import 'services/it_api_service.dart';
import 'services/courier_api_service.dart';
import 'models/auth_models.dart';
import 'screens/auth/login_screen.dart';
import 'screens/patient/patient_home_screen.dart';
import 'screens/driver/driver_dashboard_screen.dart';
import 'screens/tech/tech_dashboard_screen.dart';
import 'screens/company/company_ticket_list_screen.dart';
import 'screens/courier/courier_dashboard_screen.dart';

const String kBaseUrl = 'https://app.carehubapp.com';
const String kAppStoreId = 'id6444679914';
const String kPlayStoreId = 'com.fieldhcp.app';

class CareHubApp extends StatefulWidget {
  const CareHubApp({super.key});

  @override
  State<CareHubApp> createState() => _CareHubAppState();
}

class _CareHubAppState extends State<CareHubApp> {
  late final ApiClient _apiClient;
  late final AuthService _authService;
  late final RideService _rideService;
  late final DriverService _driverService;
  late final JobService _jobService;
  late final PushNotificationService _pushService;
  late final ItApiService _itApiService;
  late final CourierApiService _courierApiService;

  User? _currentUser;
  bool _isInitialized = false;

  @override
  void initState() {
    super.initState();
    _apiClient = ApiClient(
      baseUrl: kBaseUrl,
      onTokenExpired: () => setState(() => _currentUser = null),
    );
    _authService = AuthService(client: _apiClient);
    _rideService = RideService(client: _apiClient);
    _driverService = DriverService(client: _apiClient);
    _jobService = JobService(client: _apiClient);
    _pushService = PushNotificationService(client: _apiClient);
    _itApiService = ItApiService(
      baseUrl: kBaseUrl,
      getAuthToken: () => _apiClient.accessToken ?? '',
    );
    _courierApiService = CourierApiService(
      baseUrl: kBaseUrl,
      getAuthToken: () => _apiClient.accessToken ?? '',
    );
    _initialize();
  }

  Future<void> _initialize() async {
    setState(() => _isInitialized = true);
  }

  void _onLoginSuccess(String role) async {
    try {
      final user = await _authService.getMe();
      setState(() => _currentUser = user);
    } catch (e) {
      setState(() => _currentUser = null);
    }
  }

  void _onLogout() {
    _apiClient.clearTokens();
    setState(() => _currentUser = null);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CareHub',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF6366F1),
        useMaterial3: true,
        fontFamily: 'SF Pro Display',
        appBarTheme: const AppBarTheme(
          centerTitle: true,
          elevation: 0,
        ),
        cardTheme: CardTheme(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.shade200),
          ),
        ),
      ),
      home: !_isInitialized
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : _currentUser == null
              ? LoginScreen(
                  authService: _authService,
                  onLoginSuccess: _onLoginSuccess,
                )
              : _buildHomeForRole(_currentUser!.role),
    );
  }

  Widget _buildHomeForRole(String role) {
    switch (role) {
      case 'driver':
        return DriverDashboardScreen(
          rideService: _rideService,
          driverService: _driverService,
          authService: _authService,
          user: _currentUser!,
          onLogout: _onLogout,
        );
      case 'it_tech':
        return TechDashboardScreen(apiService: _itApiService);
      case 'it_company':
        return CompanyTicketListScreen(apiService: _itApiService);
      case 'courier':
        return CourierDashboardScreen(apiService: _courierApiService);
      default:
        return PatientHomeScreen(
          rideService: _rideService,
          authService: _authService,
          user: _currentUser!,
          onLogout: _onLogout,
        );
    }
  }
}
