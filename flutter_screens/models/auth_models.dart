class User {
  final int id;
  final String username;
  final String role;
  final String? fullName;
  final String? phone;
  final bool emailVerified;
  final List<String> permissions;
  final String? tosAcceptedAt;
  final String? tosVersion;

  User({
    required this.id,
    required this.username,
    required this.role,
    this.fullName,
    this.phone,
    this.emailVerified = false,
    this.permissions = const [],
    this.tosAcceptedAt,
    this.tosVersion,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      username: json['username'] ?? '',
      role: json['role'] ?? 'user',
      fullName: json['fullName'],
      phone: json['phone'],
      emailVerified: json['emailVerified'] ?? json['email_verified'] ?? false,
      permissions: (json['permissions'] as List?)?.cast<String>() ?? [],
      tosAcceptedAt: json['tosAcceptedAt'],
      tosVersion: json['tosVersion'],
    );
  }

  bool get isAdmin => role == 'admin';
  bool get isDriver => role == 'driver';
  bool get isPatient => role == 'patient' || role == 'user';
  bool get isItTech => role == 'it_tech';
  bool get isItCompany => role == 'it_company';

  bool hasPermission(String permission) {
    if (permissions.isEmpty) return true;
    return permissions.contains(permission);
  }
}

class AuthTokens {
  final String accessToken;
  final String refreshToken;
  final User user;

  AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  factory AuthTokens.fromJson(Map<String, dynamic> json) {
    final data = json['data'] ?? json;
    return AuthTokens(
      accessToken: data['accessToken'] ?? '',
      refreshToken: data['refreshToken'] ?? '',
      user: User.fromJson(data['user'] ?? {}),
    );
  }
}
