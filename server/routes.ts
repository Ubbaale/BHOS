import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertJobSchema, insertTicketSchema } from "@shared/schema";
import { z } from "zod";
import { sendIssueNotification, FileAttachment } from "./email";
import multer from "multer";
import path from "path";

const FIELDHCP_API_URL = "https://admin.carehubapp.com/APIs/Employer/JobSearch";
const FIELDHCP_AUTH_TOKEN = process.env.FIELDHCP_AUTH_TOKEN || "";
const FIELDHCP_USERNAME = process.env.FIELDHCP_USERNAME || "";
const FIELDHCP_PASSWORD = process.env.FIELDHCP_PASSWORD || "";
const getFieldHcpBasicAuth = () => Buffer.from(`${FIELDHCP_USERNAME}:${FIELDHCP_PASSWORD}`).toString("base64");

const clients: Set<WebSocket> = new Set();

function broadcastJobUpdate(type: "add" | "remove" | "update", job: any) {
  const message = JSON.stringify({ type, job });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPG, and PDF files are allowed.'));
    }
  }
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/jobs" });
  
  wss.on("connection", (ws) => {
    clients.add(ws);
    console.log("WebSocket client connected");
    
    ws.on("close", () => {
      clients.delete(ws);
      console.log("WebSocket client disconnected");
    });
  });
  
  app.get("/api/jobs", async (_req, res) => {
    try {
      const jobs = await storage.getAvailableJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  app.post("/api/external-jobs", async (req, res) => {
    try {
      const { latitude = 39.8283, longitude = -98.5795, pageSize = 100 } = req.body;
      
      const response = await fetch(FIELDHCP_API_URL, {
        method: "POST",
        headers: {
          "accept": "*/*",
          "authorization": `token ${FIELDHCP_AUTH_TOKEN}`,
          "Authorization": `Basic ${getFieldHcpBasicAuth()}`,
          "content-type": "application/json; charset=utf-8",
          "origin": "https://app.carehubapp.com",
          "referer": "https://app.carehubapp.com/"
        },
        body: JSON.stringify({
          currentPage: 1,
          pageSize: pageSize,
          Saved: false,
          filters: {
            SubcategoryIDs: null,
            HourlyRates: null,
            SearchString: null,
            RadiusKm: null,
            Latitude: latitude,
            Longitude: longitude
          }
        })
      });

      if (!response.ok) {
        throw new Error(`FieldHCP API error: ${response.status}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching external jobs:", error);
      res.status(500).json({ message: "Failed to fetch external jobs", error: String(error) });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  app.post("/api/jobs", async (req, res) => {
    try {
      const parsed = insertJobSchema.parse(req.body);
      const job = await storage.createJob(parsed);
      broadcastJobUpdate("add", job);
      res.status(201).json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid job data", errors: error.errors });
      }
      console.error("Error creating job:", error);
      res.status(500).json({ message: "Failed to create job" });
    }
  });

  app.patch("/api/jobs/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status || !["available", "filled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'available' or 'filled'" });
      }
      
      const job = await storage.updateJobStatus(id, status);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      if (status === "filled") {
        broadcastJobUpdate("remove", job);
      } else {
        broadcastJobUpdate("add", job);
      }
      
      res.json(job);
    } catch (error) {
      console.error("Error updating job status:", error);
      res.status(500).json({ message: "Failed to update job status" });
    }
  });

  app.get("/api/tickets", async (_req, res) => {
    try {
      const tickets = await storage.getAllTickets();
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  app.post("/api/tickets", upload.single('attachment'), async (req, res) => {
    try {
      const parsed = insertTicketSchema.parse(req.body);
      const ticketId = "CH" + Math.random().toString(36).substring(2, 7).toUpperCase();
      const ticket = await storage.createTicket({ ...parsed, id: ticketId });
      
      let attachment: FileAttachment | undefined;
      if (req.file) {
        attachment = {
          content: req.file.buffer.toString('base64'),
          filename: path.basename(req.file.originalname),
          type: req.file.mimetype,
          disposition: 'attachment'
        };
      }
      
      sendIssueNotification({
        ticketId: ticketId,
        category: parsed.category,
        priority: parsed.priority,
        description: parsed.description,
        email: parsed.email
      }, attachment);
      
      res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid ticket data", errors: error.errors });
      }
      console.error("Error creating ticket:", error);
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  return httpServer;
}
