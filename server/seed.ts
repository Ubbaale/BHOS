import { db } from "./db";
import { jobs } from "@shared/schema";

const seedJobs = [
  {
    title: "Registered Nurse - ICU",
    facility: "Memorial Hospital",
    location: "Los Angeles, CA",
    lat: "34.0522",
    lng: "-118.2437",
    pay: "$55-65/hr",
    shift: "Night Shift",
    urgency: "immediate",
    requirements: ["RN License", "BLS", "ACLS"],
  },
  {
    title: "CNA - Long Term Care",
    facility: "Sunrise Senior Living",
    location: "San Diego, CA",
    lat: "32.7157",
    lng: "-117.1611",
    pay: "$22-28/hr",
    shift: "Day Shift",
    urgency: "within_24hrs",
    requirements: ["CNA Certification", "CPR"],
  },
  {
    title: "LPN - Home Health",
    facility: "HomeCare Plus",
    location: "San Francisco, CA",
    lat: "37.7749",
    lng: "-122.4194",
    pay: "$35-42/hr",
    shift: "Flexible",
    urgency: "scheduled",
    requirements: ["LPN License", "Home Care Experience"],
  },
  {
    title: "Medical Assistant",
    facility: "Family Medical Clinic",
    location: "Sacramento, CA",
    lat: "38.5816",
    lng: "-121.4944",
    pay: "$20-26/hr",
    shift: "Day Shift",
    urgency: "within_24hrs",
    requirements: ["MA Certification", "EHR Experience"],
  },
  {
    title: "RN - Emergency Department",
    facility: "County General Hospital",
    location: "Fresno, CA",
    lat: "36.7378",
    lng: "-119.7871",
    pay: "$58-70/hr",
    shift: "Evening Shift",
    urgency: "immediate",
    requirements: ["RN License", "TNCC", "ACLS"],
  },
  {
    title: "CNA - Rehabilitation Center",
    facility: "Valley Rehab Center",
    location: "Oakland, CA",
    lat: "37.8044",
    lng: "-122.2712",
    pay: "$24-30/hr",
    shift: "Day Shift",
    urgency: "scheduled",
    requirements: ["CNA Certification", "Rehabilitation Experience"],
  },
  {
    title: "RN - Pediatrics",
    facility: "Children's Medical Center",
    location: "San Jose, CA",
    lat: "37.3382",
    lng: "-121.8863",
    pay: "$52-62/hr",
    shift: "Night Shift",
    urgency: "within_24hrs",
    requirements: ["RN License", "PALS", "Pediatric Experience"],
  },
];

async function seed() {
  console.log("Seeding database with jobs...");
  
  const existingJobs = await db.select().from(jobs);
  
  if (existingJobs.length > 0) {
    console.log(`Database already has ${existingJobs.length} jobs. Skipping seed.`);
    process.exit(0);
  }
  
  for (const job of seedJobs) {
    await db.insert(jobs).values(job);
    console.log(`Added job: ${job.title} at ${job.facility}`);
  }
  
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
