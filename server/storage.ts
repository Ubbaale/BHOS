import { 
  type User, type InsertUser,
  type Job, type InsertJob,
  type Ticket, type InsertTicket,
  type Ride, type InsertRide,
  type RideEvent, type InsertRideEvent,
  type DriverProfile, type InsertDriverProfile,
  type PatientProfile, type InsertPatientProfile,
  type NativePushToken,
  type RideMessage, type InsertRideMessage,
  type TripShare, type InsertTripShare,
  type RideRating, type InsertRideRating,
  type PatientAccount, type SurgePricing, type AnnualEarnings,
  type IncidentReport, type InsertIncidentReport,
  type DriverPayout,
  type Facility, type InsertFacility,
  type FacilityStaff, type InsertFacilityStaff,
  type CaregiverPatient, type InsertCaregiverPatient,
  type TollZone,
  users, jobs, tickets, rides, rideEvents, driverProfiles, patientProfiles, nativePushTokens, rideMessages, tripShares, rideRatings, patientAccounts, surgePricing, annualEarnings, contractorAgreements, incidentReports, driverPayouts,
  facilities, facilityStaff, caregiverPatients, tollZones
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, ne, and, lt, isNull, inArray } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAllJobs(): Promise<Job[]>;
  getAvailableJobs(): Promise<Job[]>;
  getJob(id: number): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJobStatus(id: number, status: string): Promise<Job | undefined>;
  
  getAllTickets(): Promise<Ticket[]>;
  getTicket(id: string): Promise<Ticket | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;

  getAllRides(): Promise<Ride[]>;
  getActiveRides(): Promise<Ride[]>;
  getRide(id: number): Promise<Ride | undefined>;
  createRide(ride: InsertRide & { trackingToken?: string; trackingTokenExpiresAt?: Date }): Promise<Ride>;
  updateRideStatus(id: number, status: string): Promise<Ride | undefined>;
  assignDriver(rideId: number, driverId: number): Promise<Ride | undefined>;
  expireTrackingToken(rideId: number): Promise<void>;
  
  getRideEvents(rideId: number): Promise<RideEvent[]>;
  createRideEvent(event: InsertRideEvent): Promise<RideEvent>;
  
  getAvailableDrivers(): Promise<DriverProfile[]>;
  getAllDrivers(): Promise<DriverProfile[]>;
  getDriver(id: number): Promise<DriverProfile | undefined>;
  getDriverByUserId(userId: string): Promise<DriverProfile | undefined>;
  createDriver(driver: InsertDriverProfile): Promise<DriverProfile>;
  updateDriverAvailability(id: number, isAvailable: boolean): Promise<DriverProfile | undefined>;
  updateDriverApplicationStatus(id: number, status: string, rejectionReason?: string): Promise<DriverProfile | undefined>;
  updateDriverKyc(id: number, kycData: Partial<InsertDriverProfile>): Promise<DriverProfile | undefined>;
  updateDriverKycStatus(id: number, kycStatus: string, kycNotes?: string): Promise<DriverProfile | undefined>;
  
  getPatient(id: number): Promise<PatientProfile | undefined>;
  createPatient(patient: InsertPatientProfile): Promise<PatientProfile>;
  
  saveNativePushToken(token: string, platform: string, userType: string, driverId?: number): Promise<void>;
  getNativePushTokens(userType?: string): Promise<NativePushToken[]>;
  
  getRideMessages(rideId: number): Promise<RideMessage[]>;
  createRideMessage(message: InsertRideMessage): Promise<RideMessage>;
  
  getTripShares(rideId: number): Promise<TripShare[]>;
  getTripShareByCode(shareCode: string): Promise<TripShare | undefined>;
  createTripShare(tripShare: Omit<InsertTripShare, 'shareCode'> & { shareCode: string }): Promise<TripShare>;
  deactivateTripShare(id: number): Promise<TripShare | undefined>;
  
  setRideVerificationCode(rideId: number, code: string): Promise<Ride | undefined>;
  updateRideEta(rideId: number, eta: Date): Promise<Ride | undefined>;
  
  // Cancellation and policies
  cancelRide(rideId: number, cancelledBy: string, reason: string | undefined, cancellationFee: string): Promise<Ride | undefined>;
  updatePatientAccountBalance(patientPhone: string, amount: number): Promise<void>;
  incrementDriverCancellations(driverId: number): Promise<void>;
  incrementPatientCancellations(patientPhone: string): Promise<void>;
  
  // Surge pricing
  getActiveSurgePricing(dayOfWeek: number, hour: number): Promise<SurgePricing | undefined>;
  
  // Traffic and delays
  updateRideDelay(rideId: number, delayMinutes: number, reason: string | undefined, newEta: Date | undefined): Promise<Ride | undefined>;
  
  // Journey monitoring
  getAbandonedRides(staleMinutes?: number): Promise<Ride[]>;
  markRideAbandoned(id: number): Promise<Ride | undefined>;
  updateRideTolls(id: number, actualTolls: string): Promise<Ride | undefined>;
  updateRideTraffic(id: number, trafficCondition: string, delayMinutes: number, delayReason?: string): Promise<Ride | undefined>;
  
  // Complete ride with commission calculation
  completeRide(rideId: number, finalFare: string, actualTolls: string, actualDistanceMiles: string): Promise<Ride | undefined>;
  incrementDriverCompletedRides(driverId: number): Promise<void>;
  
  // Tips
  addTip(rideId: number, tipAmount: string): Promise<Ride | undefined>;
  
  // Driver earnings
  getDriverEarnings(driverId: number): Promise<{ totalEarnings: string; totalTips: string; totalRides: number }>;
  
  // Ratings
  createRideRating(rating: InsertRideRating): Promise<RideRating>;
  getRideRating(rideId: number, ratedBy: string): Promise<RideRating | undefined>;
  updateDriverRating(driverId: number, newRating: number): Promise<void>;
  
  // Patient accounts
  getPatientAccount(phone: string): Promise<PatientAccount | undefined>;
  recordEmergencyOverride(patientPhone: string): Promise<void>;
  
  // Driver location tracking
  updateDriverLocation(driverId: number, lat: string, lng: string): Promise<DriverProfile | undefined>;
  getNearbyDrivers(lat: number, lng: number, radiusMiles?: number): Promise<DriverProfile[]>;
  
  // Contractor onboarding
  updateDriverContractorInfo(driverId: number, info: {
    ssnLast4: string;
    taxClassification: string;
    businessName?: string;
    taxAddress?: string;
    taxCity?: string;
    taxState?: string;
    taxZip?: string;
    isContractorOnboarded: boolean;
    contractorAgreementSignedAt: Date;
  }): Promise<DriverProfile | undefined>;
  createContractorAgreement(data: { driverId: number; agreementVersion: string; ipAddress: string; userAgent: string }): Promise<void>;
  
  // Annual earnings and 1099
  getOrCalculateAnnualEarnings(driverId: number, taxYear: number): Promise<{
    totalGrossEarnings: string;
    totalTips: string;
    totalTolls: string;
    totalRides: number;
    totalMiles: string;
  }>;
  mark1099Generated(driverId: number, taxYear: number): Promise<void>;
  getDriverTaxYears(driverId: number): Promise<number[]>;
  
  // Admin: Incident Reports
  getAllIncidentReports(): Promise<IncidentReport[]>;
  getIncidentReport(id: number): Promise<IncidentReport | undefined>;
  createIncidentReport(report: InsertIncidentReport & { evidenceUrls?: string[] }): Promise<IncidentReport>;
  updateIncidentReport(id: number, data: Partial<IncidentReport>): Promise<IncidentReport | undefined>;
  getIncidentReportsByRide(rideId: number): Promise<IncidentReport[]>;
  
  // Admin: Patient Account Management
  getAllPatientAccounts(): Promise<PatientAccount[]>;
  updatePatientAccountStatus(phone: string, status: string, reason?: string): Promise<PatientAccount | undefined>;
  
  // Admin: Driver Account Management
  updateDriverAccountStatus(driverId: number, status: string, reason?: string): Promise<DriverProfile | undefined>;

  // Ride history
  getRidesByPhone(phone: string): Promise<Ride[]>;
  getRidesByPatientId(patientId: number): Promise<Ride[]>;

  // Driver Payouts
  getDriverPayouts(driverId: number): Promise<DriverPayout[]>;
  createDriverPayout(data: { driverId: number; amount: string; fee: string; netAmount: string; method: string; status: string }): Promise<DriverPayout>;
  updateDriverPayoutStatus(payoutId: number, status: string, stripeTransferId?: string, failureReason?: string): Promise<DriverPayout | undefined>;
  updateDriverStripeConnect(driverId: number, accountId: string): Promise<DriverProfile | undefined>;
  updateDriverStripeConnectOnboarded(driverId: number, onboarded: boolean): Promise<DriverProfile | undefined>;
  updateDriverPayoutPreference(driverId: number, preference: string): Promise<DriverProfile | undefined>;

  // Facilities
  createFacility(facility: InsertFacility): Promise<Facility>;
  getFacility(id: number): Promise<Facility | undefined>;
  getFacilities(): Promise<Facility[]>;

  // Facility Staff
  createFacilityStaff(staff: InsertFacilityStaff): Promise<FacilityStaff>;
  getFacilityStaff(facilityId: number): Promise<FacilityStaff[]>;
  getStaffByUserId(userId: string): Promise<(FacilityStaff & { facility?: Facility }) | undefined>;

  // Caregiver Patients
  addCaregiverPatient(caregiverId: string, patient: InsertCaregiverPatient): Promise<CaregiverPatient>;
  getCaregiverPatients(caregiverId: string): Promise<CaregiverPatient[]>;
  getCaregiverPatient(id: number): Promise<CaregiverPatient | undefined>;
  updateCaregiverPatient(id: number, data: Partial<InsertCaregiverPatient>): Promise<CaregiverPatient | undefined>;
  removeCaregiverPatient(id: number): Promise<void>;

  // Ride wait time
  startRideWait(rideId: number): Promise<Ride | undefined>;
  endRideWait(rideId: number): Promise<Ride | undefined>;

  // Rides by facility
  getRidesByFacility(facilityId: number): Promise<Ride[]>;

  // Toll zones
  getTollZones(): Promise<TollZone[]>;
  seedTollZones(zones: Array<{ name: string; tollAmount: string; lat: string; lng: string; radiusMiles: string }>): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllJobs(): Promise<Job[]> {
    return db.select().from(jobs);
  }

  async getAvailableJobs(): Promise<Job[]> {
    return db.select().from(jobs).where(eq(jobs.status, "available"));
  }

  async getJob(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobs).values(insertJob).returning();
    return job;
  }

  async updateJobStatus(id: number, status: string): Promise<Job | undefined> {
    const [job] = await db.update(jobs).set({ status }).where(eq(jobs.id, id)).returning();
    return job;
  }

  async getAllTickets(): Promise<Ticket[]> {
    return db.select().from(tickets);
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
    return ticket;
  }

  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    const [ticket] = await db.insert(tickets).values(insertTicket).returning();
    return ticket;
  }

  async getAllRides(): Promise<Ride[]> {
    return db.select().from(rides).orderBy(desc(rides.createdAt));
  }

  async getActiveRides(): Promise<Ride[]> {
    return db.select().from(rides).where(
      and(
        ne(rides.status, "completed"),
        ne(rides.status, "cancelled")
      )
    ).orderBy(desc(rides.createdAt));
  }

  async getRide(id: number): Promise<Ride | undefined> {
    const [ride] = await db.select().from(rides).where(eq(rides.id, id));
    return ride;
  }

  async createRide(insertRide: InsertRide & { trackingToken?: string; trackingTokenExpiresAt?: Date }): Promise<Ride> {
    const [ride] = await db.insert(rides).values(insertRide as any).returning();
    return ride;
  }
  
  async expireTrackingToken(rideId: number): Promise<void> {
    await db.update(rides)
      .set({ 
        trackingToken: null, 
        trackingTokenExpiresAt: null 
      })
      .where(eq(rides.id, rideId));
  }

  async updateRideStatus(id: number, status: string): Promise<Ride | undefined> {
    const now = new Date();
    const updateData: Record<string, any> = { 
      status, 
      updatedAt: now,
      lastActivityAt: now,
      isAbandonedWarning: false
    };
    
    if (status === "in_progress") {
      updateData.actualPickupTime = now;
    } else if (status === "completed") {
      updateData.actualDropoffTime = now;
    }
    
    const [ride] = await db.update(rides)
      .set(updateData)
      .where(eq(rides.id, id))
      .returning();
    return ride;
  }

  async getAbandonedRides(staleMinutes: number = 30): Promise<Ride[]> {
    const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
    return db.select().from(rides).where(
      and(
        eq(rides.status, "in_progress"),
        lt(rides.lastActivityAt, cutoff)
      )
    );
  }

  async markRideAbandoned(id: number): Promise<Ride | undefined> {
    const [ride] = await db.update(rides)
      .set({ isAbandonedWarning: true })
      .where(eq(rides.id, id))
      .returning();
    return ride;
  }

  async updateRideTolls(id: number, actualTolls: string): Promise<Ride | undefined> {
    const [ride] = await db.update(rides)
      .set({ actualTolls, updatedAt: new Date() })
      .where(eq(rides.id, id))
      .returning();
    return ride;
  }

  async updateRideTraffic(id: number, trafficCondition: string, delayMinutes: number, delayReason?: string): Promise<Ride | undefined> {
    const [ride] = await db.update(rides)
      .set({ trafficCondition, delayMinutes, delayReason, updatedAt: new Date(), lastActivityAt: new Date() })
      .where(eq(rides.id, id))
      .returning();
    return ride;
  }

  async assignDriver(rideId: number, driverId: number): Promise<Ride | undefined> {
    // Only assign if ride is still in "requested" status (prevents race condition at DB level)
    const [ride] = await db.update(rides)
      .set({ driverId, status: "accepted", updatedAt: new Date() })
      .where(and(
        eq(rides.id, rideId),
        eq(rides.status, "requested"),
        isNull(rides.driverId)
      ))
      .returning();
    return ride;
  }

  async getRideEvents(rideId: number): Promise<RideEvent[]> {
    return db.select().from(rideEvents)
      .where(eq(rideEvents.rideId, rideId))
      .orderBy(desc(rideEvents.createdAt));
  }

  async createRideEvent(insertEvent: InsertRideEvent): Promise<RideEvent> {
    const [event] = await db.insert(rideEvents).values(insertEvent).returning();
    return event;
  }

  async getAvailableDrivers(): Promise<DriverProfile[]> {
    const drivers = await db.select().from(driverProfiles).where(
      and(
        eq(driverProfiles.isAvailable, true),
        eq(driverProfiles.applicationStatus, "approved")
      )
    );
    const now = new Date();
    return drivers.filter(d => {
      if (d.driversLicenseExpiry && new Date(d.driversLicenseExpiry) < now) return false;
      if (d.insuranceExpiry && new Date(d.insuranceExpiry) < now) return false;
      if (d.vehicleInspectionExpiry && new Date(d.vehicleInspectionExpiry) < now) return false;
      if (d.backgroundCheckStatus === "failed") return false;
      return true;
    });
  }

  async getAllDrivers(): Promise<DriverProfile[]> {
    return db.select().from(driverProfiles).orderBy(desc(driverProfiles.createdAt));
  }

  async getDriver(id: number): Promise<DriverProfile | undefined> {
    const [driver] = await db.select().from(driverProfiles).where(eq(driverProfiles.id, id));
    return driver;
  }

  async getDriverByUserId(userId: string): Promise<DriverProfile | undefined> {
    const [driver] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, userId));
    return driver;
  }

  async createDriver(insertDriver: InsertDriverProfile): Promise<DriverProfile> {
    const [driver] = await db.insert(driverProfiles).values(insertDriver).returning();
    return driver;
  }

  async updateDriverAvailability(id: number, isAvailable: boolean): Promise<DriverProfile | undefined> {
    const [driver] = await db.update(driverProfiles)
      .set({ isAvailable })
      .where(eq(driverProfiles.id, id))
      .returning();
    return driver;
  }

  async updateDriverApplicationStatus(id: number, status: string, rejectionReason?: string): Promise<DriverProfile | undefined> {
    const [driver] = await db.update(driverProfiles)
      .set({ applicationStatus: status, rejectionReason })
      .where(eq(driverProfiles.id, id))
      .returning();
    return driver;
  }

  async updateDriverKyc(id: number, kycData: Partial<InsertDriverProfile>): Promise<DriverProfile | undefined> {
    const [driver] = await db.update(driverProfiles)
      .set(kycData as any)
      .where(eq(driverProfiles.id, id))
      .returning();
    return driver;
  }

  async updateDriverKycStatus(id: number, kycStatus: string, kycNotes?: string): Promise<DriverProfile | undefined> {
    const updateData: any = { kycStatus, kycNotes };
    if (kycStatus === "approved") {
      updateData.kycVerifiedAt = new Date();
    }
    const [driver] = await db.update(driverProfiles)
      .set(updateData)
      .where(eq(driverProfiles.id, id))
      .returning();
    return driver;
  }

  async getPatient(id: number): Promise<PatientProfile | undefined> {
    const [patient] = await db.select().from(patientProfiles).where(eq(patientProfiles.id, id));
    return patient;
  }

  async createPatient(insertPatient: InsertPatientProfile): Promise<PatientProfile> {
    const [patient] = await db.insert(patientProfiles).values(insertPatient).returning();
    return patient;
  }

  async saveNativePushToken(token: string, platform: string, userType: string, driverId?: number): Promise<void> {
    await db
      .insert(nativePushTokens)
      .values({ token, platform, userType, driverId })
      .onConflictDoUpdate({
        target: nativePushTokens.token,
        set: { platform, userType, driverId },
      });
  }

  async getNativePushTokens(userType?: string): Promise<NativePushToken[]> {
    if (userType) {
      return db.select().from(nativePushTokens).where(eq(nativePushTokens.userType, userType));
    }
    return db.select().from(nativePushTokens);
  }

  async getRideMessages(rideId: number): Promise<RideMessage[]> {
    return db.select().from(rideMessages)
      .where(eq(rideMessages.rideId, rideId))
      .orderBy(rideMessages.createdAt);
  }

  async createRideMessage(message: InsertRideMessage): Promise<RideMessage> {
    const [rideMessage] = await db.insert(rideMessages).values(message).returning();
    return rideMessage;
  }

  async getTripShares(rideId: number): Promise<TripShare[]> {
    return db.select().from(tripShares)
      .where(and(eq(tripShares.rideId, rideId), eq(tripShares.isActive, true)));
  }

  async getTripShareByCode(shareCode: string): Promise<TripShare | undefined> {
    const [share] = await db.select().from(tripShares)
      .where(and(eq(tripShares.shareCode, shareCode), eq(tripShares.isActive, true)));
    return share;
  }

  async createTripShare(tripShare: Omit<InsertTripShare, 'shareCode'> & { shareCode: string }): Promise<TripShare> {
    const [share] = await db.insert(tripShares).values(tripShare as any).returning();
    return share;
  }

  async deactivateTripShare(id: number): Promise<TripShare | undefined> {
    const [share] = await db.update(tripShares)
      .set({ isActive: false })
      .where(eq(tripShares.id, id))
      .returning();
    return share;
  }

  async setRideVerificationCode(rideId: number, code: string): Promise<Ride | undefined> {
    const [ride] = await db.update(rides)
      .set({ verificationCode: code })
      .where(eq(rides.id, rideId))
      .returning();
    return ride;
  }

  async updateRideEta(rideId: number, eta: Date): Promise<Ride | undefined> {
    const [ride] = await db.update(rides)
      .set({ estimatedArrivalTime: eta })
      .where(eq(rides.id, rideId))
      .returning();
    return ride;
  }

  async cancelRide(rideId: number, cancelledBy: string, reason: string | undefined, cancellationFee: string): Promise<Ride | undefined> {
    const [ride] = await db.update(rides)
      .set({ 
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy,
        cancellationReason: reason || null,
        cancellationFee
      })
      .where(eq(rides.id, rideId))
      .returning();
    return ride;
  }

  async updatePatientAccountBalance(patientPhone: string, amount: number): Promise<void> {
    const [existing] = await db.select().from(patientAccounts).where(eq(patientAccounts.patientPhone, patientPhone));
    
    // Calculate balance tier status based on thresholds:
    // Green ($0-$25): good_standing
    // Yellow ($25-$75): warning
    // Orange ($75-$150): restricted
    // Red ($150+): blocked
    const getAccountStatus = (balance: number): string => {
      if (balance >= 150) return "blocked";
      if (balance >= 75) return "restricted";
      if (balance >= 25) return "warning";
      return "good_standing";
    };
    
    if (existing) {
      const newBalance = parseFloat(existing.outstandingBalance || "0") + amount;
      const newStatus = getAccountStatus(newBalance);
      await db.update(patientAccounts)
        .set({ 
          outstandingBalance: newBalance.toString(),
          accountStatus: newStatus
        })
        .where(eq(patientAccounts.patientPhone, patientPhone));
    } else {
      const newStatus = getAccountStatus(amount);
      await db.insert(patientAccounts).values({
        patientPhone,
        outstandingBalance: amount.toString(),
        accountStatus: newStatus
      });
    }
  }

  async incrementDriverCancellations(driverId: number): Promise<void> {
    const [driver] = await db.select().from(driverProfiles).where(eq(driverProfiles.id, driverId));
    if (driver) {
      const current = driver.cancellationCount || 0;
      await db.update(driverProfiles)
        .set({ cancellationCount: current + 1 })
        .where(eq(driverProfiles.id, driverId));
    }
  }

  async incrementPatientCancellations(patientPhone: string): Promise<void> {
    const [existing] = await db.select().from(patientAccounts).where(eq(patientAccounts.patientPhone, patientPhone));
    
    if (existing) {
      const current = existing.cancellationCount || 0;
      await db.update(patientAccounts)
        .set({ cancellationCount: current + 1 })
        .where(eq(patientAccounts.patientPhone, patientPhone));
    } else {
      await db.insert(patientAccounts).values({
        patientPhone,
        cancellationCount: 1,
        outstandingBalance: "0",
        accountStatus: "good_standing"
      });
    }
  }

  async getActiveSurgePricing(dayOfWeek: number, hour: number): Promise<SurgePricing | undefined> {
    const [pricing] = await db.select().from(surgePricing)
      .where(and(
        eq(surgePricing.dayOfWeek, dayOfWeek),
        eq(surgePricing.startHour, hour),
        eq(surgePricing.isActive, true)
      ));
    return pricing;
  }

  async updateRideDelay(rideId: number, delayMinutes: number, reason: string | undefined, newEta: Date | undefined): Promise<Ride | undefined> {
    const updateData: Partial<Ride> = {
      delayMinutes,
      trafficCondition: reason || null
    };
    if (newEta) {
      updateData.estimatedArrivalTime = newEta;
    }
    const [ride] = await db.update(rides)
      .set(updateData)
      .where(eq(rides.id, rideId))
      .returning();
    return ride;
  }

  async completeRide(rideId: number, finalFare: string, actualTolls: string, actualDistanceMiles: string): Promise<Ride | undefined> {
    // Get ride to check payment type for commission rate
    const [existingRide] = await db.select().from(rides).where(eq(rides.id, rideId));
    if (!existingRide) return undefined;
    
    // Calculate platform fee: 15% for self-pay, 10% for insurance
    const fareAmount = parseFloat(finalFare);
    const feePercent = existingRide.paymentType === "insurance" ? 10 : 15;
    const platformFee = (fareAmount * feePercent / 100).toFixed(2);
    const driverEarnings = (fareAmount - parseFloat(platformFee)).toFixed(2);
    
    const [ride] = await db.update(rides)
      .set({ 
        status: "completed",
        finalFare,
        actualTolls,
        actualDistanceMiles,
        paymentStatus: "pending",
        platformFeePercent: feePercent.toString(),
        platformFee,
        driverEarnings,
        actualDropoffTime: new Date()
      })
      .where(eq(rides.id, rideId))
      .returning();
    return ride;
  }
  
  async addTip(rideId: number, tipAmount: string): Promise<Ride | undefined> {
    const [existingRide] = await db.select().from(rides).where(eq(rides.id, rideId));
    if (!existingRide) return undefined;
    
    // Tips go 100% to driver
    const currentEarnings = parseFloat(existingRide.driverEarnings || "0");
    const newEarnings = (currentEarnings + parseFloat(tipAmount)).toFixed(2);
    
    const [ride] = await db.update(rides)
      .set({ 
        tipAmount,
        tipPaidAt: new Date(),
        driverEarnings: newEarnings
      })
      .where(eq(rides.id, rideId))
      .returning();
    return ride;
  }

  async updateRidePayment(rideId: number, paymentData: { paymentStatus: string; stripePaymentIntentId: string; paidAmount: string }): Promise<Ride | undefined> {
    const [ride] = await db.update(rides)
      .set({
        paymentStatus: paymentData.paymentStatus,
        stripePaymentIntentId: paymentData.stripePaymentIntentId,
        paidAmount: paymentData.paidAmount,
        updatedAt: new Date()
      })
      .where(eq(rides.id, rideId))
      .returning();
    return ride;
  }

  async updateRideTip(rideId: number, tipAmount: string): Promise<Ride | undefined> {
    const [existingRide] = await db.select().from(rides).where(eq(rides.id, rideId));
    if (!existingRide) return undefined;
    
    const currentEarnings = parseFloat(existingRide.driverEarnings || "0");
    const newEarnings = (currentEarnings + parseFloat(tipAmount)).toFixed(2);
    
    const [ride] = await db.update(rides)
      .set({ 
        tipAmount,
        tipPaidAt: new Date(),
        driverEarnings: newEarnings
      })
      .where(eq(rides.id, rideId))
      .returning();
    return ride;
  }

  async addDriverTipEarnings(driverId: number, tipAmount: number): Promise<void> {
    // Tips are tracked via rides table, no additional update needed
    // This method is kept for API compatibility
    console.log(`Tip of $${tipAmount} recorded for driver ${driverId}`);
  }
  
  async getDriverEarnings(driverId: number): Promise<{ totalEarnings: string; totalTips: string; totalRides: number }> {
    const driverRides = await db.select().from(rides)
      .where(and(
        eq(rides.driverId, driverId),
        eq(rides.status, "completed")
      ));
    
    let totalEarnings = 0;
    let totalTips = 0;
    
    for (const ride of driverRides) {
      totalEarnings += parseFloat(ride.driverEarnings || "0");
      totalTips += parseFloat(ride.tipAmount || "0");
    }
    
    return {
      totalEarnings: totalEarnings.toFixed(2),
      totalTips: totalTips.toFixed(2),
      totalRides: driverRides.length
    };
  }

  async incrementDriverCompletedRides(driverId: number): Promise<void> {
    const [driver] = await db.select().from(driverProfiles).where(eq(driverProfiles.id, driverId));
    if (driver) {
      const current = driver.totalRidesCompleted || 0;
      await db.update(driverProfiles)
        .set({ totalRidesCompleted: current + 1 })
        .where(eq(driverProfiles.id, driverId));
    }
  }

  async createRideRating(rating: InsertRideRating): Promise<RideRating> {
    const [rideRating] = await db.insert(rideRatings).values(rating).returning();
    return rideRating;
  }

  async getRideRating(rideId: number, ratedBy: string): Promise<RideRating | undefined> {
    const [rating] = await db.select().from(rideRatings)
      .where(and(eq(rideRatings.rideId, rideId), eq(rideRatings.ratedBy, ratedBy)));
    return rating;
  }

  async updateDriverRating(driverId: number, newRating: number): Promise<void> {
    const [driver] = await db.select().from(driverProfiles).where(eq(driverProfiles.id, driverId));
    if (driver) {
      const currentRating = parseFloat(driver.averageRating || "5");
      const totalRatings = driver.totalRatings || 0;
      const newTotalRatings = totalRatings + 1;
      const newAverageRating = ((currentRating * totalRatings) + newRating) / newTotalRatings;
      
      await db.update(driverProfiles)
        .set({ 
          averageRating: newAverageRating.toFixed(2),
          totalRatings: newTotalRatings
        })
        .where(eq(driverProfiles.id, driverId));
    }
  }

  async getPatientAccount(phone: string): Promise<PatientAccount | undefined> {
    const [account] = await db.select().from(patientAccounts).where(eq(patientAccounts.patientPhone, phone));
    return account;
  }

  async recordEmergencyOverride(patientPhone: string): Promise<void> {
    const [existing] = await db.select().from(patientAccounts).where(eq(patientAccounts.patientPhone, patientPhone));
    
    if (existing) {
      const currentCount = existing.emergencyOverrideCount || 0;
      await db.update(patientAccounts)
        .set({ 
          emergencyOverrideCount: currentCount + 1,
          lastEmergencyOverride: new Date()
        })
        .where(eq(patientAccounts.patientPhone, patientPhone));
    }
  }

  async updateDriverLocation(driverId: number, lat: string, lng: string): Promise<DriverProfile | undefined> {
    const [driver] = await db.update(driverProfiles)
      .set({ currentLat: lat, currentLng: lng })
      .where(eq(driverProfiles.id, driverId))
      .returning();
    return driver;
  }

  async getNearbyDrivers(lat: number, lng: number, radiusMiles: number = 25): Promise<DriverProfile[]> {
    const allDrivers = await db.select().from(driverProfiles)
      .where(and(
        eq(driverProfiles.isAvailable, true),
        eq(driverProfiles.applicationStatus, "approved"),
        eq(driverProfiles.kycStatus, "approved")
      ));
    
    return allDrivers.filter(driver => {
      if (!driver.currentLat || !driver.currentLng) return false;
      const distance = this.calculateDistance(
        lat, lng,
        parseFloat(driver.currentLat), parseFloat(driver.currentLng)
      );
      return distance <= radiusMiles;
    });
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  async updateDriverContractorInfo(driverId: number, info: {
    ssnLast4: string;
    taxClassification: string;
    businessName?: string;
    taxAddress?: string;
    taxCity?: string;
    taxState?: string;
    taxZip?: string;
    isContractorOnboarded: boolean;
    contractorAgreementSignedAt: Date;
  }): Promise<DriverProfile | undefined> {
    const [driver] = await db.update(driverProfiles)
      .set({
        ssnLast4: info.ssnLast4,
        taxClassification: info.taxClassification,
        businessName: info.businessName,
        taxAddress: info.taxAddress,
        taxCity: info.taxCity,
        taxState: info.taxState,
        taxZip: info.taxZip,
        isContractorOnboarded: info.isContractorOnboarded,
        contractorAgreementSignedAt: info.contractorAgreementSignedAt
      })
      .where(eq(driverProfiles.id, driverId))
      .returning();
    return driver;
  }

  async createContractorAgreement(data: { driverId: number; agreementVersion: string; ipAddress: string; userAgent: string }): Promise<void> {
    await db.insert(contractorAgreements).values({
      driverId: data.driverId,
      agreementVersion: data.agreementVersion,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent
    });
  }

  async getOrCalculateAnnualEarnings(driverId: number, taxYear: number): Promise<{
    totalGrossEarnings: string;
    totalTips: string;
    totalTolls: string;
    totalRides: number;
    totalMiles: string;
  }> {
    // Check if we have cached earnings
    const [existing] = await db.select().from(annualEarnings)
      .where(and(eq(annualEarnings.driverId, driverId), eq(annualEarnings.taxYear, taxYear)));
    
    // Calculate from rides data
    const startDate = new Date(taxYear, 0, 1);
    const endDate = new Date(taxYear + 1, 0, 1);
    
    const driverRides = await db.select().from(rides)
      .where(and(
        eq(rides.driverId, driverId),
        eq(rides.status, "completed")
      ));
    
    // Filter by year (since we don't have date comparison in drizzle easily)
    const yearRides = driverRides.filter(r => {
      const rideDate = r.actualDropoffTime || r.createdAt;
      return rideDate && rideDate >= startDate && rideDate < endDate;
    });
    
    const totalGross = yearRides.reduce((sum, r) => sum + parseFloat(r.driverEarnings || "0"), 0);
    const totalTips = yearRides.reduce((sum, r) => sum + parseFloat(r.tipAmount || "0"), 0);
    const totalTolls = yearRides.reduce((sum, r) => sum + parseFloat(r.actualTolls || "0"), 0);
    const totalMiles = yearRides.reduce((sum, r) => sum + parseFloat(r.actualDistanceMiles || r.distanceMiles || "0"), 0);
    
    const result = {
      totalGrossEarnings: totalGross.toFixed(2),
      totalTips: totalTips.toFixed(2),
      totalTolls: totalTolls.toFixed(2),
      totalRides: yearRides.length,
      totalMiles: totalMiles.toFixed(1)
    };
    
    // Update or create cached record
    if (existing) {
      await db.update(annualEarnings)
        .set({
          totalGrossEarnings: result.totalGrossEarnings,
          totalTips: result.totalTips,
          totalTolls: result.totalTolls,
          totalRides: result.totalRides,
          totalMiles: result.totalMiles,
          lastCalculatedAt: new Date()
        })
        .where(eq(annualEarnings.id, existing.id));
    } else {
      await db.insert(annualEarnings).values({
        driverId,
        taxYear,
        totalGrossEarnings: result.totalGrossEarnings,
        totalTips: result.totalTips,
        totalTolls: result.totalTolls,
        totalRides: result.totalRides,
        totalMiles: result.totalMiles
      });
    }
    
    return result;
  }

  async mark1099Generated(driverId: number, taxYear: number): Promise<void> {
    const [existing] = await db.select().from(annualEarnings)
      .where(and(eq(annualEarnings.driverId, driverId), eq(annualEarnings.taxYear, taxYear)));
    
    if (existing) {
      await db.update(annualEarnings)
        .set({
          form1099Generated: true,
          form1099GeneratedAt: new Date(),
          form1099DownloadCount: (existing.form1099DownloadCount || 0) + 1
        })
        .where(eq(annualEarnings.id, existing.id));
    }
  }

  async getDriverTaxYears(driverId: number): Promise<number[]> {
    // Get all years where the driver has completed rides
    const driverRides = await db.select().from(rides)
      .where(and(
        eq(rides.driverId, driverId),
        eq(rides.status, "completed")
      ));
    
    const years = new Set<number>();
    driverRides.forEach(r => {
      const rideDate = r.actualDropoffTime || r.createdAt;
      if (rideDate) {
        years.add(rideDate.getFullYear());
      }
    });
    
    return Array.from(years).sort((a, b) => b - a);
  }

  // Admin: Incident Reports
  async getAllIncidentReports(): Promise<IncidentReport[]> {
    return db.select().from(incidentReports).orderBy(desc(incidentReports.createdAt));
  }

  async getIncidentReport(id: number): Promise<IncidentReport | undefined> {
    const [report] = await db.select().from(incidentReports).where(eq(incidentReports.id, id));
    return report;
  }

  async createIncidentReport(report: InsertIncidentReport & { evidenceUrls?: string[] }): Promise<IncidentReport> {
    const [created] = await db.insert(incidentReports).values({
      rideId: report.rideId,
      reporterId: report.reporterId,
      reporterType: report.reporterType,
      reporterName: report.reporterName,
      reporterPhone: report.reporterPhone,
      reporterEmail: report.reporterEmail,
      category: report.category,
      severity: report.severity || "medium",
      description: report.description,
      location: report.location,
      incidentDate: report.incidentDate,
      evidenceUrls: report.evidenceUrls || [],
    }).returning();
    return created;
  }

  async updateIncidentReport(id: number, data: Partial<IncidentReport>): Promise<IncidentReport | undefined> {
    const updateData: Partial<IncidentReport> = { ...data, updatedAt: new Date() };
    if (data.status === "resolved" || data.status === "closed") {
      updateData.resolvedAt = new Date();
    }
    const [updated] = await db.update(incidentReports)
      .set(updateData)
      .where(eq(incidentReports.id, id))
      .returning();
    return updated;
  }

  async getIncidentReportsByRide(rideId: number): Promise<IncidentReport[]> {
    return db.select().from(incidentReports)
      .where(eq(incidentReports.rideId, rideId))
      .orderBy(desc(incidentReports.createdAt));
  }

  // Admin: Patient Account Management
  async getAllPatientAccounts(): Promise<PatientAccount[]> {
    return db.select().from(patientAccounts).orderBy(desc(patientAccounts.createdAt));
  }

  async updatePatientAccountStatus(phone: string, status: string, reason?: string): Promise<PatientAccount | undefined> {
    const [existing] = await db.select().from(patientAccounts).where(eq(patientAccounts.patientPhone, phone));
    
    if (!existing) {
      // Create new patient account with the status
      const [created] = await db.insert(patientAccounts).values({
        patientPhone: phone,
        accountStatus: status,
        suspensionReason: reason,
        suspendedAt: status === "blocked" || status === "restricted" ? new Date() : null
      }).returning();
      return created;
    }
    
    const [updated] = await db.update(patientAccounts)
      .set({
        accountStatus: status,
        suspensionReason: reason,
        suspendedAt: status === "blocked" || status === "restricted" ? new Date() : null
      })
      .where(eq(patientAccounts.patientPhone, phone))
      .returning();
    return updated;
  }

  // Admin: Driver Account Management
  async updateDriverAccountStatus(driverId: number, status: string, reason?: string): Promise<DriverProfile | undefined> {
    const [updated] = await db.update(driverProfiles)
      .set({
        accountStatus: status,
        suspensionReason: reason
      })
      .where(eq(driverProfiles.id, driverId))
      .returning();
    return updated;
  }

  // Driver Payout Methods
  async getDriverPayouts(driverId: number): Promise<DriverPayout[]> {
    return db.select().from(driverPayouts)
      .where(eq(driverPayouts.driverId, driverId))
      .orderBy(desc(driverPayouts.requestedAt));
  }

  async createDriverPayout(data: { driverId: number; amount: string; fee: string; netAmount: string; method: string; status: string }): Promise<DriverPayout> {
    const [payout] = await db.insert(driverPayouts)
      .values({
        driverId: data.driverId,
        amount: data.amount,
        fee: data.fee,
        netAmount: data.netAmount,
        method: data.method,
        status: data.status,
        requestedAt: new Date()
      })
      .returning();
    return payout;
  }

  async updateDriverPayoutStatus(payoutId: number, status: string, stripeTransferId?: string, failureReason?: string): Promise<DriverPayout | undefined> {
    const updateData: any = { status };
    if (stripeTransferId) updateData.stripeTransferId = stripeTransferId;
    if (failureReason) updateData.failureReason = failureReason;
    if (status === "processing") updateData.processedAt = new Date();
    if (status === "completed") updateData.completedAt = new Date();
    
    const [updated] = await db.update(driverPayouts)
      .set(updateData)
      .where(eq(driverPayouts.id, payoutId))
      .returning();
    return updated;
  }

  async updateDriverStripeConnect(driverId: number, accountId: string): Promise<DriverProfile | undefined> {
    const [updated] = await db.update(driverProfiles)
      .set({ stripeConnectAccountId: accountId })
      .where(eq(driverProfiles.id, driverId))
      .returning();
    return updated;
  }

  async updateDriverStripeConnectOnboarded(driverId: number, onboarded: boolean): Promise<DriverProfile | undefined> {
    const [updated] = await db.update(driverProfiles)
      .set({ stripeConnectOnboarded: onboarded })
      .where(eq(driverProfiles.id, driverId))
      .returning();
    return updated;
  }

  async getRidesByPhone(phone: string): Promise<Ride[]> {
    return db.select().from(rides)
      .where(eq(rides.patientPhone, phone))
      .orderBy(desc(rides.createdAt));
  }

  async getRidesByPatientId(patientId: number): Promise<Ride[]> {
    return db.select().from(rides)
      .where(eq(rides.patientId, patientId))
      .orderBy(desc(rides.createdAt));
  }

  async updateDriverPayoutPreference(driverId: number, preference: string): Promise<DriverProfile | undefined> {
    const [updated] = await db.update(driverProfiles)
      .set({ payoutPreference: preference })
      .where(eq(driverProfiles.id, driverId))
      .returning();
    return updated;
  }

  async createFacility(facility: InsertFacility): Promise<Facility> {
    const [created] = await db.insert(facilities).values(facility).returning();
    return created;
  }

  async getFacility(id: number): Promise<Facility | undefined> {
    const [facility] = await db.select().from(facilities).where(eq(facilities.id, id));
    return facility;
  }

  async getFacilities(): Promise<Facility[]> {
    return db.select().from(facilities).where(eq(facilities.isActive, true)).orderBy(desc(facilities.createdAt));
  }

  async createFacilityStaff(staff: InsertFacilityStaff): Promise<FacilityStaff> {
    const [created] = await db.insert(facilityStaff).values(staff).returning();
    return created;
  }

  async getFacilityStaff(facilityId: number): Promise<FacilityStaff[]> {
    return db.select().from(facilityStaff)
      .where(and(eq(facilityStaff.facilityId, facilityId), eq(facilityStaff.isActive, true)));
  }

  async getStaffByUserId(userId: string): Promise<(FacilityStaff & { facility?: Facility }) | undefined> {
    const [staff] = await db.select().from(facilityStaff)
      .where(and(eq(facilityStaff.userId, userId), eq(facilityStaff.isActive, true)));
    if (!staff) return undefined;
    const facility = await this.getFacility(staff.facilityId);
    return { ...staff, facility: facility || undefined };
  }

  async addCaregiverPatient(caregiverId: string, patient: InsertCaregiverPatient): Promise<CaregiverPatient> {
    const [created] = await db.insert(caregiverPatients).values({ ...patient, caregiverId }).returning();
    return created;
  }

  async getCaregiverPatients(caregiverId: string): Promise<CaregiverPatient[]> {
    return db.select().from(caregiverPatients)
      .where(and(eq(caregiverPatients.caregiverId, caregiverId), eq(caregiverPatients.isActive, true)))
      .orderBy(desc(caregiverPatients.createdAt));
  }

  async getCaregiverPatient(id: number): Promise<CaregiverPatient | undefined> {
    const [patient] = await db.select().from(caregiverPatients).where(eq(caregiverPatients.id, id));
    return patient;
  }

  async updateCaregiverPatient(id: number, data: Partial<InsertCaregiverPatient>): Promise<CaregiverPatient | undefined> {
    const [updated] = await db.update(caregiverPatients).set(data).where(eq(caregiverPatients.id, id)).returning();
    return updated;
  }

  async removeCaregiverPatient(id: number): Promise<void> {
    await db.update(caregiverPatients).set({ isActive: false }).where(eq(caregiverPatients.id, id));
  }

  async startRideWait(rideId: number): Promise<Ride | undefined> {
    const [updated] = await db.update(rides)
      .set({ waitStartedAt: new Date() })
      .where(eq(rides.id, rideId))
      .returning();
    return updated;
  }

  async endRideWait(rideId: number): Promise<Ride | undefined> {
    const ride = await this.getRide(rideId);
    if (!ride || !ride.waitStartedAt) return ride;
    const waitMs = new Date().getTime() - new Date(ride.waitStartedAt).getTime();
    const waitMinutes = Math.ceil(waitMs / 60000);
    const [updated] = await db.update(rides)
      .set({ waitEndedAt: new Date(), waitTimeMinutes: waitMinutes })
      .where(eq(rides.id, rideId))
      .returning();
    return updated;
  }

  async getRidesByFacility(facilityId: number): Promise<Ride[]> {
    return db.select().from(rides)
      .where(eq(rides.facilityId, facilityId))
      .orderBy(desc(rides.createdAt));
  }

  async getTollZones(): Promise<TollZone[]> {
    return db.select().from(tollZones).where(eq(tollZones.isActive, true));
  }

  async seedTollZones(zones: Array<{ name: string; tollAmount: string; lat: string; lng: string; radiusMiles: string }>): Promise<void> {
    const existing = await db.select().from(tollZones);
    if (existing.length > 0) return;
    for (const zone of zones) {
      await db.insert(tollZones).values(zone);
    }
  }
}

export const storage = new DatabaseStorage();
