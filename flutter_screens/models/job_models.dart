class Job {
  final int id;
  final String title;
  final String? description;
  final String? company;
  final String? location;
  final String? lat;
  final String? lng;
  final String? salary;
  final String? jobType;
  final String? specialty;
  final String? requirements;
  final String? benefits;
  final String? contactEmail;
  final String? contactPhone;
  final int? postedBy;
  final bool isActive;
  final DateTime? createdAt;
  final DateTime? expiresAt;

  Job({
    required this.id,
    required this.title,
    this.description,
    this.company,
    this.location,
    this.lat,
    this.lng,
    this.salary,
    this.jobType,
    this.specialty,
    this.requirements,
    this.benefits,
    this.contactEmail,
    this.contactPhone,
    this.postedBy,
    this.isActive = true,
    this.createdAt,
    this.expiresAt,
  });

  factory Job.fromJson(Map<String, dynamic> json) {
    return Job(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      title: json['title'] ?? '',
      description: json['description'],
      company: json['company'],
      location: json['location'],
      lat: json['lat']?.toString(),
      lng: json['lng']?.toString(),
      salary: json['salary'],
      jobType: json['jobType'],
      specialty: json['specialty'],
      requirements: json['requirements'],
      benefits: json['benefits'],
      contactEmail: json['contactEmail'],
      contactPhone: json['contactPhone'],
      postedBy: json['postedBy'],
      isActive: json['isActive'] ?? true,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
      expiresAt: json['expiresAt'] != null ? DateTime.tryParse(json['expiresAt']) : null,
    );
  }
}

class ExternalJob {
  final String id;
  final String title;
  final String? company;
  final String? location;
  final String? description;
  final String? salary;
  final String? url;
  final String? source;
  final DateTime? postedAt;

  ExternalJob({
    required this.id,
    required this.title,
    this.company,
    this.location,
    this.description,
    this.salary,
    this.url,
    this.source,
    this.postedAt,
  });

  factory ExternalJob.fromJson(Map<String, dynamic> json) {
    return ExternalJob(
      id: json['id']?.toString() ?? '',
      title: json['title'] ?? '',
      company: json['company'],
      location: json['location'],
      description: json['description'],
      salary: json['salary'],
      url: json['url'],
      source: json['source'],
      postedAt: json['postedAt'] != null ? DateTime.tryParse(json['postedAt']) : null,
    );
  }
}
