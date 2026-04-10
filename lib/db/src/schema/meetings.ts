import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const meetingsTable = pgTable("meetings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  homeId: integer("home_id"),
  organizerId: integer("organizer_id"),
  meetingType: text("meeting_type").notNull().default("team"),
  status: text("status").notNull().default("scheduled"),
  meetingLink: text("meeting_link"),
  meetingProvider: text("meeting_provider").default("internal"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  isRecurring: boolean("is_recurring").default(false),
  recurringPattern: text("recurring_pattern"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const meetingAttendeesTable = pgTable("meeting_attendees", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull(),
  staffId: integer("staff_id"),
  name: text("name"),
  email: text("email"),
  rsvpStatus: text("rsvp_status").default("pending"),
  attended: boolean("attended").default(false),
});
