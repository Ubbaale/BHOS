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
  type PatientAccount, type SurgePricing,
  users, jobs, tickets, rides, rideEvents, driverProfiles, patientProfiles, nativePushTokens, rideMessages, tripShares, rideRatings, patientAccounts, surgePricing
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, ne, and, lt, isNull } from "drizzle-orm";

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
  createRide(ride: InsertRide): Promise<Ride>;
  updateRideStatus(id: number, status: string): Promise<Ride | undefined>;
  assignDriver(rideId: number, driverId: number): Promise<Ride | undefined>;
  
  getRideEvents(rideId: number): Promise<RideEvent[]>;
  createRideEvent(event: InsertRideEvent): Promise<RideEvent>;
  
  getAvailableDrivers(): Promise<DriverProfile[]>;
  getAllDrivers(): Promise<DriverProfile[]>;
  getDriver(id: number): Promise<DriverProfile | undefined>;
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
  updateDriverRating(driverId: number, newRating: number): Promise<void>;
  
  // Patient accounts
  getPatientAccount(phone: string): Promise<PatientAccount | undefined>;
  recordEmergencyOverride(patientPhone: string): Promise<void>;
  
  // Driver location tracking
  updateDriverLocation(driverId: number, lat: string, lng: string): Promise<DriverProfile | undefined>;
  getNearbyDrivers(lat: number, lng: number, radiusMiles?: number): Promise<DriverProfile[]>;
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

  async createRide(insertRide: InsertRide): Promise<Ride> {
    const [ride] = await db.insert(rides).values(insertRide).returning();
    return ride;
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
    return db.select().from(driverProfiles).where(
      and(
        eq(driverProfiles.isAvailable, true),
        eq(driverProfiles.applicationStatus, "approved")
      )
    );
  }

  async getAllDrivers(): Promise<DriverProfile[]> {
    return db.select().from(driverProfiles).orderBy(desc(driverProfiles.createdAt));
  }

  async getDriver(id: number): Promise<DriverProfile | undefined> {
    const [driver] = await db.select().from(driverProfiles).where(eq(driverProfiles.id, id));
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
}

export const storage = new DatabaseStorage();
