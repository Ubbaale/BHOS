import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class LocalCacheService {
  static const String _ridesKey = 'cached_rides';
  static const String _profileKey = 'cached_profile';
  static const String _jobsKey = 'cached_jobs';
  static const String _lastSyncKey = 'last_sync_timestamp';
  static const Duration _cacheExpiry = Duration(hours: 1);

  Future<void> cacheData(String key, dynamic data) async {
    final prefs = await SharedPreferences.getInstance();
    final cacheEntry = {
      'data': data,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };
    await prefs.setString(key, jsonEncode(cacheEntry));
  }

  Future<T?> getCachedData<T>(String key, T Function(dynamic json) fromJson) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(key);
    if (raw == null) return null;

    try {
      final entry = jsonDecode(raw);
      final timestamp = DateTime.fromMillisecondsSinceEpoch(entry['timestamp']);
      if (DateTime.now().difference(timestamp) > _cacheExpiry) return null;
      return fromJson(entry['data']);
    } catch (_) {
      return null;
    }
  }

  Future<void> cacheRides(List<Map<String, dynamic>> rides) async {
    await cacheData(_ridesKey, rides);
  }

  Future<List<Map<String, dynamic>>?> getCachedRides() async {
    return await getCachedData(_ridesKey, (data) {
      return (data as List).cast<Map<String, dynamic>>();
    });
  }

  Future<void> cacheProfile(Map<String, dynamic> profile) async {
    await cacheData(_profileKey, profile);
  }

  Future<Map<String, dynamic>?> getCachedProfile() async {
    return await getCachedData(_profileKey, (data) => data as Map<String, dynamic>);
  }

  Future<void> cacheJobs(List<Map<String, dynamic>> jobs) async {
    await cacheData(_jobsKey, jobs);
  }

  Future<void> updateLastSync() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_lastSyncKey, DateTime.now().millisecondsSinceEpoch);
  }

  Future<DateTime?> getLastSync() async {
    final prefs = await SharedPreferences.getInstance();
    final ts = prefs.getInt(_lastSyncKey);
    return ts != null ? DateTime.fromMillisecondsSinceEpoch(ts) : null;
  }

  Future<void> clearAll() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_ridesKey);
    await prefs.remove(_profileKey);
    await prefs.remove(_jobsKey);
    await prefs.remove(_lastSyncKey);
  }
}
