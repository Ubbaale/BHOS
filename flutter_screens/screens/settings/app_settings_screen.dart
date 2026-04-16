import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../services/biometric_service.dart';
import '../../services/local_cache_service.dart';
import '../../services/auth_service.dart';
import 'delete_account_screen.dart';

class AppSettingsScreen extends StatefulWidget {
  final VoidCallback? onLogout;
  final AuthService? authService;

  const AppSettingsScreen({super.key, this.onLogout, this.authService});

  @override
  State<AppSettingsScreen> createState() => _AppSettingsScreenState();
}

class _AppSettingsScreenState extends State<AppSettingsScreen> {
  final BiometricService _biometricService = BiometricService();
  final LocalCacheService _cacheService = LocalCacheService();

  bool _biometricEnabled = false;
  bool _biometricAvailable = false;
  String _biometricLabel = 'Biometrics';
  bool _pushNotifications = true;
  bool _rideAlerts = true;
  bool _jobAlerts = true;
  bool _darkMode = false;
  DateTime? _lastSync;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    final deviceSupported = await _biometricService.isDeviceSupported;
    final canCheck = await _biometricService.canCheckBiometrics;
    final biometricEnabled = await _biometricService.isBiometricEnabled;
    final label = await _biometricService.getBiometricLabel();
    final lastSync = await _cacheService.getLastSync();

    setState(() {
      _biometricAvailable = deviceSupported && canCheck;
      _biometricEnabled = biometricEnabled;
      _biometricLabel = label;
      _pushNotifications = prefs.getBool('push_notifications') ?? true;
      _rideAlerts = prefs.getBool('ride_alerts') ?? true;
      _jobAlerts = prefs.getBool('job_alerts') ?? true;
      _darkMode = prefs.getBool('dark_mode') ?? false;
      _lastSync = lastSync;
    });
  }

  Future<void> _toggleBiometric(bool value) async {
    HapticFeedback.selectionClick();
    if (value) {
      final authenticated = await _biometricService.authenticate(
        reason: 'Verify your identity to enable $_biometricLabel',
      );
      if (!authenticated) return;
    }
    await _biometricService.setBiometricEnabled(value);
    setState(() => _biometricEnabled = value);
  }

  Future<void> _togglePref(String key, bool value, void Function(bool) setter) async {
    HapticFeedback.selectionClick();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, value);
    setter(value);
  }

  Future<void> _clearCache() async {
    HapticFeedback.mediumImpact();
    final confirmed = await showCupertinoDialog<bool>(
      context: context,
      builder: (context) => CupertinoAlertDialog(
        title: const Text('Clear Cache'),
        content: const Text('This will remove all locally stored data. You\'ll need an internet connection to reload it.'),
        actions: [
          CupertinoDialogAction(
            isDestructiveAction: true,
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Clear'),
          ),
          CupertinoDialogAction(
            isDefaultAction: true,
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _cacheService.clearAll();
      HapticFeedback.heavyImpact();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Cache cleared'), behavior: SnackBarBehavior.floating),
        );
      }
      _loadSettings();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListView(
        children: [
          _sectionHeader('SECURITY'),
          if (_biometricAvailable) ...[
            _switchTile(
              icon: Icons.face,
              iconColor: const Color(0xFF6366F1),
              title: _biometricLabel,
              subtitle: 'Sign in quickly with $_biometricLabel',
              value: _biometricEnabled,
              onChanged: _toggleBiometric,
            ),
            const Divider(height: 1, indent: 72),
          ],
          _navTile(
            icon: Icons.lock_outline,
            iconColor: Colors.blue,
            title: 'Change Password',
            onTap: () {},
          ),

          _sectionHeader('NOTIFICATIONS'),
          _switchTile(
            icon: Icons.notifications_outlined,
            iconColor: Colors.orange,
            title: 'Push Notifications',
            subtitle: 'Receive push notifications',
            value: _pushNotifications,
            onChanged: (v) => _togglePref('push_notifications', v, (val) => setState(() => _pushNotifications = val)),
          ),
          const Divider(height: 1, indent: 72),
          _switchTile(
            icon: Icons.local_taxi_outlined,
            iconColor: Colors.green,
            title: 'Ride Alerts',
            subtitle: 'Updates about your rides',
            value: _rideAlerts,
            onChanged: (v) => _togglePref('ride_alerts', v, (val) => setState(() => _rideAlerts = val)),
          ),
          const Divider(height: 1, indent: 72),
          _switchTile(
            icon: Icons.work_outline,
            iconColor: Colors.purple,
            title: 'Job Alerts',
            subtitle: 'New job opportunities near you',
            value: _jobAlerts,
            onChanged: (v) => _togglePref('job_alerts', v, (val) => setState(() => _jobAlerts = val)),
          ),

          _sectionHeader('APPEARANCE'),
          _switchTile(
            icon: Icons.dark_mode_outlined,
            iconColor: Colors.indigo,
            title: 'Dark Mode',
            subtitle: 'Use dark theme',
            value: _darkMode,
            onChanged: (v) => _togglePref('dark_mode', v, (val) => setState(() => _darkMode = val)),
          ),

          _sectionHeader('DATA & STORAGE'),
          _navTile(
            icon: Icons.cached,
            iconColor: Colors.teal,
            title: 'Clear Cache',
            subtitle: _lastSync != null
                ? 'Last sync: ${_formatDate(_lastSync!)}'
                : 'No cached data',
            onTap: _clearCache,
          ),

          _sectionHeader('ABOUT'),
          _navTile(
            icon: Icons.info_outline,
            iconColor: Colors.grey,
            title: 'App Version',
            subtitle: '2.0.0 (Build 100)',
            onTap: () {},
          ),
          _navTile(
            icon: Icons.description_outlined,
            iconColor: Colors.grey,
            title: 'Terms of Service',
            onTap: () {},
          ),
          _navTile(
            icon: Icons.privacy_tip_outlined,
            iconColor: Colors.grey,
            title: 'Privacy Policy',
            onTap: () {},
          ),
          _navTile(
            icon: Icons.help_outline,
            iconColor: Colors.grey,
            title: 'Help & Support',
            subtitle: 'Get help or contact us',
            onTap: () {},
          ),

          _sectionHeader('ACCOUNT'),
          _navTile(
            icon: Icons.delete_forever,
            iconColor: Colors.red,
            title: 'Delete Account',
            subtitle: 'Permanently delete your account and data',
            onTap: () {
              if (widget.authService != null) {
                Navigator.push(context, MaterialPageRoute(
                  builder: (_) => DeleteAccountScreen(
                    authService: widget.authService!,
                    onAccountDeleted: () {
                      Navigator.of(context).popUntil((route) => route.isFirst);
                      widget.onLogout?.call();
                    },
                  ),
                ));
              }
            },
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  String _formatDate(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
      child: Text(title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey[500], letterSpacing: 0.5)),
    );
  }

  Widget _switchTile({
    required IconData icon,
    required Color iconColor,
    required String title,
    String? subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return ListTile(
      leading: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(color: iconColor.withOpacity(0.12), borderRadius: BorderRadius.circular(8)),
        child: Icon(icon, color: iconColor, size: 20),
      ),
      title: Text(title, style: const TextStyle(fontSize: 15)),
      subtitle: subtitle != null ? Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey[500])) : null,
      trailing: CupertinoSwitch(value: value, onChanged: onChanged, activeColor: const Color(0xFF6366F1)),
    );
  }

  Widget _navTile({
    required IconData icon,
    required Color iconColor,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(color: iconColor.withOpacity(0.12), borderRadius: BorderRadius.circular(8)),
        child: Icon(icon, color: iconColor, size: 20),
      ),
      title: Text(title, style: const TextStyle(fontSize: 15)),
      subtitle: subtitle != null ? Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey[500])) : null,
      trailing: const Icon(Icons.chevron_right, color: Colors.grey),
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
    );
  }
}
