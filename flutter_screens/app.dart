import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'services/api_client.dart';
import 'services/auth_service.dart';
import 'services/ride_service.dart';
import 'services/driver_service.dart';
import 'services/job_service.dart';
import 'services/push_notification_service.dart';
import 'services/it_api_service.dart';
import 'services/courier_api_service.dart';
import 'services/biometric_service.dart';
import 'services/haptic_service.dart';
import 'services/local_cache_service.dart';
import 'models/auth_models.dart';
import 'screens/auth/login_screen.dart';
import 'screens/onboarding/onboarding_screen.dart';
import 'screens/patient/patient_home_screen.dart';
import 'screens/driver/driver_dashboard_screen.dart';
import 'screens/tech/tech_dashboard_screen.dart';
import 'screens/company/company_ticket_list_screen.dart';
import 'screens/courier/courier_dashboard_screen.dart';
import 'widgets/connectivity_wrapper.dart';

const String kBaseUrl = 'https://app.carehubapp.com';
const String kAppStoreId = 'id6444679914';
const String kPlayStoreId = 'com.fieldhcp.app';

class CareHubApp extends StatefulWidget {
  const CareHubApp({super.key});

  @override
  State<CareHubApp> createState() => _CareHubAppState();
}

class _CareHubAppState extends State<CareHubApp> with WidgetsBindingObserver {
  late final ApiClient _apiClient;
  late final AuthService _authService;
  late final RideService _rideService;
  late final DriverService _driverService;
  late final JobService _jobService;
  late final PushNotificationService _pushService;
  late final ItApiService _itApiService;
  late final CourierApiService _courierApiService;
  late final BiometricService _biometricService;
  late final LocalCacheService _cacheService;

  User? _currentUser;
  bool _isInitialized = false;
  bool _showOnboarding = false;
  bool _needsBiometricAuth = false;
  bool _isDarkMode = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
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
    _biometricService = BiometricService();
    _cacheService = LocalCacheService();
    _initialize();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _currentUser != null) {
      _checkBiometricOnResume();
    }
  }

  Future<void> _checkBiometricOnResume() async {
    final enabled = await _biometricService.isBiometricEnabled;
    if (enabled) {
      setState(() => _needsBiometricAuth = true);
      final authenticated = await _biometricService.authenticate();
      if (authenticated) {
        setState(() => _needsBiometricAuth = false);
      }
    }
  }

  Future<void> _initialize() async {
    final prefs = await SharedPreferences.getInstance();
    final onboardingComplete = prefs.getBool('onboarding_complete') ?? false;
    final isDark = prefs.getBool('dark_mode') ?? false;

    setState(() {
      _showOnboarding = !onboardingComplete;
      _isDarkMode = isDark;
      _isInitialized = true;
    });
  }

  void _onOnboardingComplete() {
    HapticService.success();
    setState(() => _showOnboarding = false);
  }

  void _onLoginSuccess(String role) async {
    HapticService.success();
    try {
      final user = await _authService.getMe();
      setState(() => _currentUser = user);
      await _pushService.registerDevice();
      await _cacheService.updateLastSync();
    } catch (e) {
      setState(() => _currentUser = null);
    }
  }

  void _onLogout() {
    HapticService.buttonTap();
    _apiClient.clearTokens();
    _cacheService.clearAll();
    setState(() => _currentUser = null);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CareHub',
      debugShowCheckedModeBanner: false,
      themeMode: _isDarkMode ? ThemeMode.dark : ThemeMode.light,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF6366F1),
        useMaterial3: true,
        fontFamily: 'SF Pro Display',
        brightness: Brightness.light,
        appBarTheme: const AppBarTheme(
          centerTitle: true,
          elevation: 0,
          systemOverlayStyle: SystemUiOverlayStyle.dark,
        ),
        cardTheme: CardTheme(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.shade200),
          ),
        ),
        pageTransitionsTheme: const PageTransitionsTheme(
          builders: {
            TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
            TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
          },
        ),
      ),
      darkTheme: ThemeData(
        colorSchemeSeed: const Color(0xFF6366F1),
        useMaterial3: true,
        fontFamily: 'SF Pro Display',
        brightness: Brightness.dark,
        appBarTheme: const AppBarTheme(
          centerTitle: true,
          elevation: 0,
          systemOverlayStyle: SystemUiOverlayStyle.light,
        ),
        cardTheme: CardTheme(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.shade800),
          ),
        ),
        pageTransitionsTheme: const PageTransitionsTheme(
          builders: {
            TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
            TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
          },
        ),
      ),
      home: !_isInitialized
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : ConnectivityWrapper(
              child: _buildMainContent(),
            ),
    );
  }

  Widget _buildMainContent() {
    if (_showOnboarding) {
      return OnboardingScreen(onComplete: _onOnboardingComplete);
    }
    if (_needsBiometricAuth) {
      return _buildBiometricLockScreen();
    }
    if (_currentUser == null) {
      return LoginScreen(
        authService: _authService,
        biometricService: _biometricService,
        onLoginSuccess: _onLoginSuccess,
      );
    }
    return _buildHomeForRole(_currentUser!.role);
  }

  Widget _buildBiometricLockScreen() {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: const Color(0xFF6366F1).withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.lock_outline, size: 48, color: Color(0xFF6366F1)),
              ),
              const SizedBox(height: 24),
              const Text('CareHub is Locked', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text('Authenticate to continue', style: TextStyle(color: Colors.grey[600])),
              const SizedBox(height: 32),
              ElevatedButton.icon(
                onPressed: () async {
                  HapticService.buttonTap();
                  final ok = await _biometricService.authenticate();
                  if (ok) setState(() => _needsBiometricAuth = false);
                },
                icon: const Icon(Icons.fingerprint),
                label: const Text('Unlock'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6366F1),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
        ),
      ),
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
