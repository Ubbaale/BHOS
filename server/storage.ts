import { 
  type User, type InsertUser,
  type Job, type InsertJob,
  type Ticket, type InsertTicket,
  type Ride, type InsertRide,
  type RideEvent, type InsertRideEvent,
  type DriverProfile, type InsertDriverProfile,
  type PatientProfile, type InsertPatientProfile,
  type NativePushToken,
  users, jobs, tickets, rides, rideEvents, driverProfiles, patientProfiles, nativePushTokens
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, ne, and } from "drizzle-orm";

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
  
  getPatient(id: number): Promise<PatientProfile | undefined>;
  createPatient(patient: InsertPatientProfile): Promise<PatientProfile>;
  
  saveNativePushToken(token: string, platform: string, userType: string, driverId?: number): Promise<void>;
  getNativePushTokens(userType?: string): Promise<NativePushToken[]>;
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
    const [ride] = await db.update(rides)
      .set({ status, updatedAt: new Date() })
      .where(eq(rides.id, id))
      .returning();
    return ride;
  }

  async assignDriver(rideId: number, driverId: number): Promise<Ride | undefined> {
    const [ride] = await db.update(rides)
      .set({ driverId, status: "accepted", updatedAt: new Date() })
      .where(eq(rides.id, rideId))
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
}

export const storage = new DatabaseStorage();
