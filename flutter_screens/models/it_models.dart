class ItServiceTicket {
  final String id;
  final String? companyId;
  final String createdBy;
  final String ticketNumber;
  final String title;
  final String description;
  final String category;
  final String priority;
  final String status;
  final DateTime? scheduledDate;
  final String? scheduledTime;
  final String? estimatedDuration;
  final String? siteAddress;
  final String? siteCity;
  final String? siteState;
  final String? siteZipCode;
  final String? siteLat;
  final String? siteLng;
  final String? contactOnSite;
  final String? contactPhone;
  final String? specialInstructions;
  final String? equipmentNeeded;
  final String? assignedTo;
  final String etaStatus;
  final DateTime? checkInTime;
  final DateTime? checkOutTime;
  final String? hoursWorked;
  final String payType;
  final String? payRate;
  final String? totalPay;
  final String? platformFee;
  final String? techPayout;
  final String paymentStatus;
  final List<Map<String, dynamic>> deliverables;
  final int? customerRating;
  final int? techRating;
  final String? customerReview;
  final String? techReview;
  final String routingMode;
  final String? companyApproval;
  final String? companyApprovalNotes;
  final String? disputeReason;
  final DateTime? disputedAt;
  final String? mediationStatus;
  final String? mediationNotes;
  final String? mediationResolution;
  final String? cancellationReason;
  final String? cancellationFee;
  final String paymentTerms;
  final String? platformFeePercent;
  final String? escrowStatus;
  final String? escrowAmount;
  final String? budgetCap;
  final String? overtimeRate;
  final bool? overageApproved;
  final String? overageAmount;
  final String? overageHours;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  ItServiceTicket({
    required this.id,
    this.companyId,
    required this.createdBy,
    required this.ticketNumber,
    required this.title,
    required this.description,
    this.category = 'general',
    this.priority = 'medium',
    this.status = 'open',
    this.scheduledDate,
    this.scheduledTime,
    this.estimatedDuration,
    this.siteAddress,
    this.siteCity,
    this.siteState,
    this.siteZipCode,
    this.siteLat,
    this.siteLng,
    this.contactOnSite,
    this.contactPhone,
    this.specialInstructions,
    this.equipmentNeeded,
    this.assignedTo,
    this.etaStatus = 'none',
    this.checkInTime,
    this.checkOutTime,
    this.hoursWorked,
    this.payType = 'hourly',
    this.payRate,
    this.totalPay,
    this.platformFee,
    this.techPayout,
    this.paymentStatus = 'unpaid',
    this.deliverables = const [],
    this.customerRating,
    this.techRating,
    this.customerReview,
    this.techReview,
    this.routingMode = 'broadcast',
    this.companyApproval,
    this.companyApprovalNotes,
    this.disputeReason,
    this.disputedAt,
    this.mediationStatus,
    this.mediationNotes,
    this.mediationResolution,
    this.cancellationReason,
    this.cancellationFee,
    this.paymentTerms = 'instant',
    this.platformFeePercent,
    this.escrowStatus,
    this.escrowAmount,
    this.budgetCap,
    this.overtimeRate,
    this.overageApproved,
    this.overageAmount,
    this.overageHours,
    this.createdAt,
    this.updatedAt,
  });

  factory ItServiceTicket.fromJson(Map<String, dynamic> json) {
    return ItServiceTicket(
      id: json['id'] ?? '',
      companyId: json['companyId'],
      createdBy: json['createdBy'] ?? '',
      ticketNumber: json['ticketNumber'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      category: json['category'] ?? 'general',
      priority: json['priority'] ?? 'medium',
      status: json['status'] ?? 'open',
      scheduledDate: json['scheduledDate'] != null ? DateTime.tryParse(json['scheduledDate']) : null,
      scheduledTime: json['scheduledTime'],
      estimatedDuration: json['estimatedDuration'],
      siteAddress: json['siteAddress'],
      siteCity: json['siteCity'],
      siteState: json['siteState'],
      siteZipCode: json['siteZipCode'],
      siteLat: json['siteLat'],
      siteLng: json['siteLng'],
      contactOnSite: json['contactOnSite'],
      contactPhone: json['contactPhone'],
      specialInstructions: json['specialInstructions'],
      equipmentNeeded: json['equipmentNeeded'],
      assignedTo: json['assignedTo'],
      etaStatus: json['etaStatus'] ?? 'none',
      checkInTime: json['checkInTime'] != null ? DateTime.tryParse(json['checkInTime']) : null,
      checkOutTime: json['checkOutTime'] != null ? DateTime.tryParse(json['checkOutTime']) : null,
      hoursWorked: json['hoursWorked']?.toString(),
      payType: json['payType'] ?? 'hourly',
      payRate: json['payRate']?.toString(),
      totalPay: json['totalPay']?.toString(),
      platformFee: json['platformFee']?.toString(),
      techPayout: json['techPayout']?.toString(),
      paymentStatus: json['paymentStatus'] ?? 'unpaid',
      deliverables: json['deliverables'] is String
          ? []
          : (json['deliverables'] as List?)?.cast<Map<String, dynamic>>() ?? [],
      customerRating: json['customerRating'],
      techRating: json['techRating'],
      customerReview: json['customerReview'],
      techReview: json['techReview'],
      routingMode: json['routingMode'] ?? 'broadcast',
      companyApproval: json['companyApproval'],
      companyApprovalNotes: json['companyApprovalNotes'],
      disputeReason: json['disputeReason'],
      disputedAt: json['disputedAt'] != null ? DateTime.tryParse(json['disputedAt']) : null,
      mediationStatus: json['mediationStatus'],
      mediationNotes: json['mediationNotes'],
      mediationResolution: json['mediationResolution'],
      cancellationReason: json['cancellationReason'],
      cancellationFee: json['cancellationFee']?.toString(),
      paymentTerms: json['paymentTerms'] ?? 'instant',
      platformFeePercent: json['platformFeePercent']?.toString(),
      escrowStatus: json['escrowStatus'],
      escrowAmount: json['escrowAmount']?.toString(),
      budgetCap: json['budgetCap']?.toString(),
      overtimeRate: json['overtimeRate']?.toString(),
      overageApproved: json['overageApproved'],
      overageAmount: json['overageAmount']?.toString(),
      overageHours: json['overageHours']?.toString(),
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
      updatedAt: json['updatedAt'] != null ? DateTime.tryParse(json['updatedAt']) : null,
    );
  }
}

class ItTechProfile {
  final String id;
  final String userId;
  final String fullName;
  final String email;
  final String phone;
  final String? city;
  final String? state;
  final String? zipCode;
  final List<String> skills;
  final List<String> certifications;
  final String experienceYears;
  final String? bio;
  final String? hourlyRate;
  final String availabilityStatus;
  final String applicationStatus;
  final String? backgroundCheckStatus;
  final int totalJobsCompleted;
  final double averageRating;
  final double reliabilityScore;
  final double timelinessScore;
  final double totalEarnings;
  final int lateCheckIns;
  final int onTimeCheckIns;
  final bool isActive;
  final bool isContractorOnboarded;
  final DateTime? icAgreementSignedAt;
  final String? ssnLast4;
  final String? taxClassification;
  final String? businessName;
  final String? taxAddress;
  final String? taxCity;
  final String? taxState;
  final String? taxZip;
  final DateTime? w9ReceivedAt;
  final List<Map<String, dynamic>> certificationDocs;
  final String accountStatus;
  final int complaintCount;
  final int verifiedComplaintCount;
  final DateTime? suspendedAt;
  final DateTime? suspendedUntil;
  final String? suspensionReason;
  final DateTime? bannedAt;
  final String? banReason;
  final DateTime? createdAt;

  ItTechProfile({
    required this.id,
    required this.userId,
    required this.fullName,
    required this.email,
    required this.phone,
    this.city,
    this.state,
    this.zipCode,
    this.skills = const [],
    this.certifications = const [],
    this.experienceYears = '0-1',
    this.bio,
    this.hourlyRate,
    this.availabilityStatus = 'available',
    this.applicationStatus = 'pending',
    this.backgroundCheckStatus,
    this.totalJobsCompleted = 0,
    this.averageRating = 0,
    this.reliabilityScore = 100,
    this.timelinessScore = 100,
    this.totalEarnings = 0,
    this.lateCheckIns = 0,
    this.onTimeCheckIns = 0,
    this.isActive = true,
    this.isContractorOnboarded = false,
    this.icAgreementSignedAt,
    this.ssnLast4,
    this.taxClassification,
    this.businessName,
    this.taxAddress,
    this.taxCity,
    this.taxState,
    this.taxZip,
    this.w9ReceivedAt,
    this.certificationDocs = const [],
    this.accountStatus = 'active',
    this.complaintCount = 0,
    this.verifiedComplaintCount = 0,
    this.suspendedAt,
    this.suspendedUntil,
    this.suspensionReason,
    this.bannedAt,
    this.banReason,
    this.createdAt,
  });

  factory ItTechProfile.fromJson(Map<String, dynamic> json) {
    return ItTechProfile(
      id: json['id'] ?? '',
      userId: json['userId'] ?? '',
      fullName: json['fullName'] ?? '',
      email: json['email'] ?? '',
      phone: json['phone'] ?? '',
      city: json['city'],
      state: json['state'],
      zipCode: json['zipCode'],
      skills: (json['skills'] as List?)?.cast<String>() ?? [],
      certifications: (json['certifications'] as List?)?.cast<String>() ?? [],
      experienceYears: json['experienceYears'] ?? '0-1',
      bio: json['bio'],
      hourlyRate: json['hourlyRate'],
      availabilityStatus: json['availabilityStatus'] ?? 'available',
      applicationStatus: json['applicationStatus'] ?? 'pending',
      backgroundCheckStatus: json['backgroundCheckStatus'],
      totalJobsCompleted: json['totalJobsCompleted'] ?? 0,
      averageRating: double.tryParse(json['averageRating']?.toString() ?? '0') ?? 0,
      reliabilityScore: double.tryParse(json['reliabilityScore']?.toString() ?? '100') ?? 100,
      timelinessScore: double.tryParse(json['timelinessScore']?.toString() ?? '100') ?? 100,
      totalEarnings: double.tryParse(json['totalEarnings']?.toString() ?? '0') ?? 0,
      lateCheckIns: json['lateCheckIns'] ?? 0,
      onTimeCheckIns: json['onTimeCheckIns'] ?? 0,
      isActive: json['isActive'] ?? true,
      isContractorOnboarded: json['isContractorOnboarded'] ?? false,
      icAgreementSignedAt: json['icAgreementSignedAt'] != null ? DateTime.tryParse(json['icAgreementSignedAt']) : null,
      ssnLast4: json['ssnLast4'],
      taxClassification: json['taxClassification'],
      businessName: json['businessName'],
      taxAddress: json['taxAddress'],
      taxCity: json['taxCity'],
      taxState: json['taxState'],
      taxZip: json['taxZip'],
      w9ReceivedAt: json['w9ReceivedAt'] != null ? DateTime.tryParse(json['w9ReceivedAt']) : null,
      certificationDocs: (json['certificationDocs'] as List?)?.cast<Map<String, dynamic>>() ?? [],
      accountStatus: json['accountStatus'] ?? 'active',
      complaintCount: json['complaintCount'] ?? 0,
      verifiedComplaintCount: json['verifiedComplaintCount'] ?? 0,
      suspendedAt: json['suspendedAt'] != null ? DateTime.tryParse(json['suspendedAt']) : null,
      suspendedUntil: json['suspendedUntil'] != null ? DateTime.tryParse(json['suspendedUntil']) : null,
      suspensionReason: json['suspensionReason'],
      bannedAt: json['bannedAt'] != null ? DateTime.tryParse(json['bannedAt']) : null,
      banReason: json['banReason'],
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
    );
  }
}

class ItTechComplaint {
  final String id;
  final String techUserId;
  final String techProfileId;
  final String? ticketId;
  final String reportedBy;
  final String reason;
  final String category;
  final String description;
  final String? evidence;
  final String status;
  final String? adminReviewedBy;
  final String? adminNotes;
  final String? adminAction;
  final DateTime? reviewedAt;
  final DateTime? createdAt;
  final String? reporterName;
  final String? techName;
  final String? techAccountStatus;
  final String? ticketTitle;

  ItTechComplaint({
    required this.id,
    required this.techUserId,
    required this.techProfileId,
    this.ticketId,
    required this.reportedBy,
    required this.reason,
    required this.category,
    required this.description,
    this.evidence,
    this.status = 'pending',
    this.adminReviewedBy,
    this.adminNotes,
    this.adminAction,
    this.reviewedAt,
    this.createdAt,
    this.reporterName,
    this.techName,
    this.techAccountStatus,
    this.ticketTitle,
  });

  factory ItTechComplaint.fromJson(Map<String, dynamic> json) {
    return ItTechComplaint(
      id: json['id'] ?? '',
      techUserId: json['techUserId'] ?? '',
      techProfileId: json['techProfileId'] ?? '',
      ticketId: json['ticketId'],
      reportedBy: json['reportedBy'] ?? '',
      reason: json['reason'] ?? '',
      category: json['category'] ?? '',
      description: json['description'] ?? '',
      evidence: json['evidence'],
      status: json['status'] ?? 'pending',
      adminReviewedBy: json['adminReviewedBy'],
      adminNotes: json['adminNotes'],
      adminAction: json['adminAction'],
      reviewedAt: json['reviewedAt'] != null ? DateTime.tryParse(json['reviewedAt']) : null,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
      reporterName: json['reporterName'],
      techName: json['techName'],
      techAccountStatus: json['techAccountStatus'],
      ticketTitle: json['ticketTitle'],
    );
  }
}

class ItTicketNote {
  final String id;
  final String ticketId;
  final String authorId;
  final String content;
  final bool isInternal;
  final DateTime? createdAt;
  final String? authorUsername;

  ItTicketNote({
    required this.id,
    required this.ticketId,
    required this.authorId,
    required this.content,
    this.isInternal = false,
    this.createdAt,
    this.authorUsername,
  });

  factory ItTicketNote.fromJson(Map<String, dynamic> json) {
    return ItTicketNote(
      id: json['id'] ?? '',
      ticketId: json['ticketId'] ?? '',
      authorId: json['authorId'] ?? '',
      content: json['content'] ?? '',
      isInternal: json['isInternal'] ?? false,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
      authorUsername: json['authorUsername'],
    );
  }
}

class TechAccountStatus {
  final String accountStatus;
  final int complaintCount;
  final int verifiedComplaintCount;
  final DateTime? suspendedAt;
  final DateTime? suspendedUntil;
  final String? suspensionReason;
  final DateTime? bannedAt;
  final String? banReason;
  final List<Map<String, dynamic>> complaints;

  TechAccountStatus({
    required this.accountStatus,
    this.complaintCount = 0,
    this.verifiedComplaintCount = 0,
    this.suspendedAt,
    this.suspendedUntil,
    this.suspensionReason,
    this.bannedAt,
    this.banReason,
    this.complaints = const [],
  });

  factory TechAccountStatus.fromJson(Map<String, dynamic> json) {
    return TechAccountStatus(
      accountStatus: json['accountStatus'] ?? 'active',
      complaintCount: json['complaintCount'] ?? 0,
      verifiedComplaintCount: json['verifiedComplaintCount'] ?? 0,
      suspendedAt: json['suspendedAt'] != null ? DateTime.tryParse(json['suspendedAt']) : null,
      suspendedUntil: json['suspendedUntil'] != null ? DateTime.tryParse(json['suspendedUntil']) : null,
      suspensionReason: json['suspensionReason'],
      bannedAt: json['bannedAt'] != null ? DateTime.tryParse(json['bannedAt']) : null,
      banReason: json['banReason'],
      complaints: (json['complaints'] as List?)?.cast<Map<String, dynamic>>() ?? [],
    );
  }

  bool get isBlocked => ['on_hold', 'suspended', 'banned'].contains(accountStatus);
}

class ContractorStatus {
  final bool isContractorOnboarded;
  final DateTime? icAgreementSignedAt;
  final String? ssnLast4;
  final String? taxClassification;
  final String? businessName;
  final String? taxAddress;
  final String? taxCity;
  final String? taxState;
  final String? taxZip;
  final DateTime? w9ReceivedAt;
  final List<Map<String, dynamic>> certificationDocs;

  ContractorStatus({
    this.isContractorOnboarded = false,
    this.icAgreementSignedAt,
    this.ssnLast4,
    this.taxClassification,
    this.businessName,
    this.taxAddress,
    this.taxCity,
    this.taxState,
    this.taxZip,
    this.w9ReceivedAt,
    this.certificationDocs = const [],
  });

  factory ContractorStatus.fromJson(Map<String, dynamic> json) {
    return ContractorStatus(
      isContractorOnboarded: json['isContractorOnboarded'] ?? false,
      icAgreementSignedAt: json['icAgreementSignedAt'] != null ? DateTime.tryParse(json['icAgreementSignedAt']) : null,
      ssnLast4: json['ssnLast4'],
      taxClassification: json['taxClassification'],
      businessName: json['businessName'],
      taxAddress: json['taxAddress'],
      taxCity: json['taxCity'],
      taxState: json['taxState'],
      taxZip: json['taxZip'],
      w9ReceivedAt: json['w9ReceivedAt'] != null ? DateTime.tryParse(json['w9ReceivedAt']) : null,
      certificationDocs: (json['certificationDocs'] as List?)?.cast<Map<String, dynamic>>() ?? [],
    );
  }
}
