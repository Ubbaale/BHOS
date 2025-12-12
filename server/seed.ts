import { db } from "./db";
import { jobs } from "@shared/schema";

const seedJobs = [
  // California
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
  // Massachusetts
  {
    title: "RN - Emergency Department",
    facility: "Massachusetts General Hospital",
    location: "Boston, MA",
    lat: "42.3601",
    lng: "-71.0589",
    pay: "$60-75/hr",
    shift: "Day Shift",
    urgency: "immediate",
    requirements: ["RN License", "TNCC", "ACLS"],
  },
  {
    title: "CNA - Long Term Care",
    facility: "Cape Cod Senior Living",
    location: "Cape Cod, MA",
    lat: "41.6688",
    lng: "-70.2962",
    pay: "$24-30/hr",
    shift: "Evening Shift",
    urgency: "within_24hrs",
    requirements: ["CNA Certification", "CPR"],
  },
  // New York
  {
    title: "RN - Pediatrics",
    facility: "NYU Langone Medical Center",
    location: "New York, NY",
    lat: "40.7128",
    lng: "-74.0060",
    pay: "$58-70/hr",
    shift: "Night Shift",
    urgency: "immediate",
    requirements: ["RN License", "PALS", "Pediatric Experience"],
  },
  {
    title: "Medical Assistant",
    facility: "Buffalo Medical Group",
    location: "Buffalo, NY",
    lat: "42.8864",
    lng: "-78.8784",
    pay: "$22-28/hr",
    shift: "Day Shift",
    urgency: "scheduled",
    requirements: ["MA Certification", "EHR Experience"],
  },
  // Texas
  {
    title: "RN - Cardiac Care",
    facility: "Houston Methodist Hospital",
    location: "Houston, TX",
    lat: "29.7604",
    lng: "-95.3698",
    pay: "$52-65/hr",
    shift: "Day Shift",
    urgency: "within_24hrs",
    requirements: ["RN License", "ACLS", "Cardiac Experience"],
  },
  {
    title: "CNA - Rehabilitation",
    facility: "Dallas Rehab Center",
    location: "Dallas, TX",
    lat: "32.7767",
    lng: "-96.7970",
    pay: "$20-26/hr",
    shift: "Evening Shift",
    urgency: "scheduled",
    requirements: ["CNA Certification", "Rehabilitation Experience"],
  },
  // Florida
  {
    title: "RN - Oncology",
    facility: "Moffitt Cancer Center",
    location: "Tampa, FL",
    lat: "27.9506",
    lng: "-82.4572",
    pay: "$55-68/hr",
    shift: "Day Shift",
    urgency: "immediate",
    requirements: ["RN License", "Oncology Certification", "Chemo Certified"],
  },
  {
    title: "LPN - Senior Care",
    facility: "Miami Senior Living",
    location: "Miami, FL",
    lat: "25.7617",
    lng: "-80.1918",
    pay: "$32-40/hr",
    shift: "Night Shift",
    urgency: "within_24hrs",
    requirements: ["LPN License", "Geriatric Experience"],
  },
  // Illinois
  {
    title: "RN - Labor & Delivery",
    facility: "Northwestern Memorial Hospital",
    location: "Chicago, IL",
    lat: "41.8781",
    lng: "-87.6298",
    pay: "$58-72/hr",
    shift: "Night Shift",
    urgency: "immediate",
    requirements: ["RN License", "NRP", "L&D Experience"],
  },
  // Washington
  {
    title: "CNA - Home Health",
    facility: "Seattle Home Care",
    location: "Seattle, WA",
    lat: "47.6062",
    lng: "-122.3321",
    pay: "$25-32/hr",
    shift: "Flexible",
    urgency: "scheduled",
    requirements: ["CNA Certification", "Home Care Experience"],
  },
  // Arizona
  {
    title: "RN - Telemetry",
    facility: "Banner University Medical Center",
    location: "Phoenix, AZ",
    lat: "33.4484",
    lng: "-112.0740",
    pay: "$50-62/hr",
    shift: "Day Shift",
    urgency: "within_24hrs",
    requirements: ["RN License", "Telemetry Experience", "ACLS"],
  },
  // Georgia
  {
    title: "LPN - Clinic",
    facility: "Emory Healthcare",
    location: "Atlanta, GA",
    lat: "33.7490",
    lng: "-84.3880",
    pay: "$30-38/hr",
    shift: "Day Shift",
    urgency: "scheduled",
    requirements: ["LPN License", "Clinic Experience"],
  },
  // Colorado
  {
    title: "RN - OR",
    facility: "UCHealth University of Colorado Hospital",
    location: "Denver, CO",
    lat: "39.7392",
    lng: "-104.9903",
    pay: "$55-68/hr",
    shift: "Day Shift",
    urgency: "immediate",
    requirements: ["RN License", "OR Experience", "BLS"],
  },
  // Ohio
  {
    title: "CNA - Hospital",
    facility: "Cleveland Clinic",
    location: "Cleveland, OH",
    lat: "41.4993",
    lng: "-81.6944",
    pay: "$22-28/hr",
    shift: "Evening Shift",
    urgency: "within_24hrs",
    requirements: ["CNA Certification", "Hospital Experience"],
  },
];

async function seed() {
  console.log("Seeding database with jobs across US...");
  
  // Clear existing jobs and reseed
  await db.delete(jobs);
  console.log("Cleared existing jobs");
  
  for (const job of seedJobs) {
    await db.insert(jobs).values(job);
    console.log(`Added job: ${job.title} in ${job.location}`);
  }
  
  console.log(`Seeding complete! Added ${seedJobs.length} jobs across the US.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
