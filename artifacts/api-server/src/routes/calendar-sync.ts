import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, meetingsTable, patientAppointmentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { getUncachableGoogleCalendarClient } from "../googleCalendarClient";

const router: IRouter = Router();

router.get("/calendar/status", requireAuth, async (_req, res) => {
  try {
    const calendar = await getUncachableGoogleCalendarClient();
    const calendarList = await calendar.calendarList.list();
    res.json({
      connected: true,
      calendars: calendarList.data.items?.map(c => ({
        id: c.id,
        summary: c.summary,
        primary: c.primary,
      })) || [],
    });
  } catch (e: any) {
    res.json({ connected: false, error: e.message });
  }
});

router.get("/calendar/events", requireAuth, async (req, res) => {
  try {
    const calendar = await getUncachableGoogleCalendarClient();
    const { calendarId, timeMin, timeMax } = req.query;

    const now = new Date();
    const response = await calendar.events.list({
      calendarId: (calendarId as string) || "primary",
      timeMin: (timeMin as string) || now.toISOString(),
      timeMax: (timeMax as string) || new Date(now.getTime() + 30 * 86400000).toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: "startTime",
    });

    res.json(response.data.items || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/calendar/sync-meeting", requireAuth, async (req, res) => {
  try {
    const { meetingId, calendarId } = req.body;
    if (!meetingId) return res.status(400).json({ error: "meetingId required" });

    const [meeting] = await db.select().from(meetingsTable).where(eq(meetingsTable.id, meetingId));
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });

    const calendar = await getUncachableGoogleCalendarClient();

    const event = await calendar.events.insert({
      calendarId: calendarId || "primary",
      requestBody: {
        summary: meeting.title,
        description: meeting.description || "",
        start: {
          dateTime: new Date(meeting.startTime).toISOString(),
          timeZone: "America/New_York",
        },
        end: {
          dateTime: new Date(meeting.endTime).toISOString(),
          timeZone: "America/New_York",
        },
        conferenceData: meeting.meetingLink ? undefined : undefined,
        source: {
          title: "BHOS Meeting",
          url: meeting.meetingLink || undefined,
        },
      },
    });

    res.json({
      success: true,
      googleEventId: event.data.id,
      htmlLink: event.data.htmlLink,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/calendar/sync-appointment", requireAuth, async (req, res) => {
  try {
    const { appointmentId, calendarId } = req.body;
    if (!appointmentId) return res.status(400).json({ error: "appointmentId required" });

    const [appt] = await db.select().from(patientAppointmentsTable).where(eq(patientAppointmentsTable.id, appointmentId));
    if (!appt) return res.status(404).json({ error: "Appointment not found" });

    const calendar = await getUncachableGoogleCalendarClient();

    const startDateTime = new Date(appt.scheduledAt);
    const endDateTime = appt.endTime ? new Date(appt.endTime) : new Date(startDateTime.getTime() + 60 * 60000);

    const event = await calendar.events.insert({
      calendarId: calendarId || "primary",
      requestBody: {
        summary: `${appt.appointmentType} - ${appt.provider || "Provider"}`,
        description: [
          appt.notes || "",
          appt.location ? `Location: ${appt.location}` : "",
          appt.provider ? `Provider: ${appt.provider}` : "",
        ].filter(Boolean).join("\n"),
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: "America/New_York",
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: "America/New_York",
        },
        location: appt.location || undefined,
      },
    });

    res.json({
      success: true,
      googleEventId: event.data.id,
      htmlLink: event.data.htmlLink,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/calendar/create-event", requireAuth, async (req, res) => {
  try {
    const { summary, description, startTime, endTime, location, calendarId } = req.body;
    if (!summary || !startTime || !endTime) {
      return res.status(400).json({ error: "summary, startTime, and endTime required" });
    }

    const calendar = await getUncachableGoogleCalendarClient();

    const event = await calendar.events.insert({
      calendarId: calendarId || "primary",
      requestBody: {
        summary,
        description: description || "",
        start: {
          dateTime: new Date(startTime).toISOString(),
          timeZone: "America/New_York",
        },
        end: {
          dateTime: new Date(endTime).toISOString(),
          timeZone: "America/New_York",
        },
        location: location || undefined,
      },
    });

    res.json({
      success: true,
      googleEventId: event.data.id,
      htmlLink: event.data.htmlLink,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
