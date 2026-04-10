import { Router, type IRouter } from "express";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { db, meetingsTable, meetingAttendeesTable, staffTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/meetings", requireAuth, async (req, res) => {
  try {
    const { homeId, status, upcoming } = req.query;
    const conditions: any[] = [];

    if (homeId) conditions.push(eq(meetingsTable.homeId, Number(homeId)));
    if (status) conditions.push(eq(meetingsTable.status, String(status)));
    if (upcoming === "true") conditions.push(gte(meetingsTable.startTime, new Date()));

    let query = db.select().from(meetingsTable).orderBy(desc(meetingsTable.startTime)).$dynamic();
    if (conditions.length > 0) query = query.where(and(...conditions));

    const meetings = await query;

    const meetingsWithAttendees = await Promise.all(
      meetings.map(async (m) => {
        const attendees = await db.select({
          id: meetingAttendeesTable.id,
          meetingId: meetingAttendeesTable.meetingId,
          staffId: meetingAttendeesTable.staffId,
          name: meetingAttendeesTable.name,
          email: meetingAttendeesTable.email,
          rsvpStatus: meetingAttendeesTable.rsvpStatus,
          attended: meetingAttendeesTable.attended,
          staffName: sql<string>`COALESCE(concat(${staffTable.firstName}, ' ', ${staffTable.lastName}), ${meetingAttendeesTable.name})`,
        })
          .from(meetingAttendeesTable)
          .leftJoin(staffTable, eq(meetingAttendeesTable.staffId, staffTable.id))
          .where(eq(meetingAttendeesTable.meetingId, m.id));

        const [organizer] = m.organizerId
          ? await db.select().from(staffTable).where(eq(staffTable.id, m.organizerId))
          : [null];

        return {
          ...m,
          attendees,
          organizerName: organizer ? `${organizer.firstName} ${organizer.lastName}` : "Unknown",
        };
      })
    );

    res.json(meetingsWithAttendees);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/meetings", requireAuth, async (req, res) => {
  try {
    const { title, description, homeId, organizerId, meetingType, startTime, endTime, meetingLink, meetingProvider, isRecurring, recurringPattern, notes, attendees } = req.body;

    if (!title || !startTime || !endTime) {
      return res.status(400).json({ error: "title, startTime, and endTime are required" });
    }

    const [meeting] = await db.insert(meetingsTable).values({
      title,
      description,
      homeId: homeId || null,
      organizerId: organizerId || null,
      meetingType: meetingType || "team",
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      meetingLink: meetingLink || null,
      meetingProvider: meetingProvider || "internal",
      isRecurring: isRecurring || false,
      recurringPattern: recurringPattern || null,
      notes: notes || null,
    }).returning();

    if (attendees && Array.isArray(attendees) && attendees.length > 0) {
      await db.insert(meetingAttendeesTable).values(
        attendees.map((a: any) => ({
          meetingId: meeting.id,
          staffId: a.staffId || null,
          name: a.name || null,
          email: a.email || null,
        }))
      );
    }

    res.status(201).json(meeting);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/meetings/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [meeting] = await db.select().from(meetingsTable).where(eq(meetingsTable.id, id));
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });

    const attendees = await db.select({
      id: meetingAttendeesTable.id,
      meetingId: meetingAttendeesTable.meetingId,
      staffId: meetingAttendeesTable.staffId,
      name: meetingAttendeesTable.name,
      email: meetingAttendeesTable.email,
      rsvpStatus: meetingAttendeesTable.rsvpStatus,
      attended: meetingAttendeesTable.attended,
      staffName: sql<string>`COALESCE(concat(${staffTable.firstName}, ' ', ${staffTable.lastName}), ${meetingAttendeesTable.name})`,
    })
      .from(meetingAttendeesTable)
      .leftJoin(staffTable, eq(meetingAttendeesTable.staffId, staffTable.id))
      .where(eq(meetingAttendeesTable.meetingId, id));

    res.json({ ...meeting, attendees });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/meetings/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, description, meetingType, startTime, endTime, meetingLink, meetingProvider, status, notes } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (meetingType !== undefined) updateData.meetingType = meetingType;
    if (startTime !== undefined) updateData.startTime = new Date(startTime);
    if (endTime !== undefined) updateData.endTime = new Date(endTime);
    if (meetingLink !== undefined) updateData.meetingLink = meetingLink;
    if (meetingProvider !== undefined) updateData.meetingProvider = meetingProvider;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const [meeting] = await db.update(meetingsTable).set(updateData).where(eq(meetingsTable.id, id)).returning();
    res.json(meeting);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/meetings/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(meetingAttendeesTable).where(eq(meetingAttendeesTable.meetingId, id));
    await db.delete(meetingsTable).where(eq(meetingsTable.id, id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/meetings/:id/rsvp", requireAuth, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id, 10);
    const { staffId, rsvpStatus } = req.body;

    const [existing] = await db.select().from(meetingAttendeesTable)
      .where(and(eq(meetingAttendeesTable.meetingId, meetingId), eq(meetingAttendeesTable.staffId, staffId)));

    if (existing) {
      const [updated] = await db.update(meetingAttendeesTable)
        .set({ rsvpStatus })
        .where(eq(meetingAttendeesTable.id, existing.id))
        .returning();
      return res.json(updated);
    }

    const [attendee] = await db.insert(meetingAttendeesTable)
      .values({ meetingId, staffId, rsvpStatus })
      .returning();
    res.json(attendee);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
