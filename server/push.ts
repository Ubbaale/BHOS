import webpush from "web-push";
import { db } from "./db";
import { pushSubscriptions, itCompanies } from "@shared/schema";
import { eq } from "drizzle-orm";

const VAPID_PUBLIC_KEY = (process.env.VAPID_PUBLIC_KEY || "").trim();
const VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || "").trim();

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      "mailto:support@carehubapp.com",
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
  } catch (error) {
    console.error("Failed to initialize VAPID:", error);
  }
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export async function saveSubscription(
  endpoint: string,
  p256dh: string,
  auth: string,
  userType: string = "user",
  driverId?: number
): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values({ endpoint, p256dh, auth, userType, driverId })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { p256dh, auth, userType, driverId },
    });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

interface RichNotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  renotify?: boolean;
  silent?: boolean;
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string; icon?: string }>;
  data?: Record<string, any>;
  category?: string;
  timestamp?: number;
}

export async function sendPushNotification(
  title: string,
  body: string,
  url?: string,
  targetUserType?: string,
  options?: Partial<RichNotificationPayload>
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log("VAPID keys not configured, skipping push notification");
    return;
  }

  const subscriptions = await db.select().from(pushSubscriptions);
  
  const filteredSubs = targetUserType 
    ? subscriptions.filter(sub => sub.userType === targetUserType)
    : subscriptions;

  const payload = JSON.stringify({
    title,
    body,
    url: url || "/",
    icon: options?.icon || "/icon-192.png",
    badge: options?.badge || "/icon-192.png",
    image: options?.image,
    tag: options?.tag,
    renotify: options?.renotify ?? true,
    silent: options?.silent ?? false,
    requireInteraction: options?.requireInteraction ?? false,
    actions: options?.actions || [],
    data: {
      url: url || "/",
      category: options?.category || "general",
      timestamp: options?.timestamp || Date.now(),
      ...options?.data,
    },
  });

  const sendPromises = filteredSubs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload
      );
    } catch (error: any) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        await removeSubscription(sub.endpoint);
      } else {
        console.error("Push notification error:", error);
      }
    }
  });

  await Promise.all(sendPromises);
}

export async function notifyDriversOfNewRide(
  pickupAddress: string,
  appointmentTime: Date,
  rideDetails?: {
    rideId?: number;
    dropoffAddress?: string;
    distanceMiles?: number;
    estimatedFare?: number;
    vehicleType?: string;
    mobilityNeeds?: string[];
  }
): Promise<void> {
  const formattedTime = appointmentTime.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const distanceText = rideDetails?.distanceMiles 
    ? ` · ${rideDetails.distanceMiles.toFixed(1)} mi` 
    : "";
  const fareText = rideDetails?.estimatedFare 
    ? ` · $${rideDetails.estimatedFare.toFixed(2)}` 
    : "";
  
  await sendPushNotification(
    "New ride request",
    `${pickupAddress}${distanceText}${fareText}\n${formattedTime}`,
    rideDetails?.rideId ? `/driver?ride=${rideDetails.rideId}` : "/driver",
    "driver",
    {
      tag: `ride-request-${rideDetails?.rideId || Date.now()}`,
      renotify: true,
      requireInteraction: true,
      category: "ride_request",
      actions: [
        { action: "view", title: "View details" },
        { action: "dismiss", title: "Dismiss" },
      ],
      data: {
        type: "ride_request",
        rideId: rideDetails?.rideId,
        pickupAddress,
        dropoffAddress: rideDetails?.dropoffAddress,
        distanceMiles: rideDetails?.distanceMiles,
        estimatedFare: rideDetails?.estimatedFare,
        vehicleType: rideDetails?.vehicleType,
        appointmentTime: appointmentTime.toISOString(),
      },
    }
  );
}

interface RideNotificationContext {
  rideId?: number;
  driverName?: string;
  driverPhone?: string;
  vehicleInfo?: string;
  licensePlate?: string;
  eta?: number;
  pickupAddress?: string;
  dropoffAddress?: string;
  fare?: number;
  rating?: number;
  driverPhoto?: string;
}

export async function notifyPatientOfRideUpdate(
  status: string,
  driverName?: string,
  context?: RideNotificationContext
): Promise<void> {
  const notifications: Record<string, { title: string; body: string; actions: Array<{ action: string; title: string }>; requireInteraction: boolean; category: string }> = {
    accepted: {
      title: `${context?.driverName || driverName || "Your driver"} is assigned`,
      body: context?.vehicleInfo 
        ? `${context.vehicleInfo}${context.licensePlate ? ` · ${context.licensePlate}` : ""}\nOn the way to pick you up`
        : "Your driver has been assigned and will head to your pickup location.",
      actions: [
        { action: "track", title: "Track driver" },
        { action: "contact", title: "Contact" },
      ],
      requireInteraction: true,
      category: "ride_accepted",
    },
    driver_enroute: {
      title: "Driver on the way",
      body: context?.eta 
        ? `${context.driverName || "Your driver"} is ${context.eta} min away`
        : `${context?.driverName || "Your driver"} is heading to your pickup`,
      actions: [
        { action: "track", title: "Track" },
        { action: "contact", title: "Contact" },
      ],
      requireInteraction: false,
      category: "ride_enroute",
    },
    arrived: {
      title: "Driver has arrived",
      body: context?.vehicleInfo 
        ? `Look for ${context.vehicleInfo}${context.licensePlate ? ` · ${context.licensePlate}` : ""}`
        : `${context?.driverName || "Your driver"} is waiting at the pickup`,
      actions: [
        { action: "contact", title: "Contact driver" },
      ],
      requireInteraction: true,
      category: "ride_arrived",
    },
    in_progress: {
      title: "Ride in progress",
      body: context?.dropoffAddress 
        ? `Heading to ${context.dropoffAddress}`
        : "You're on your way to your destination",
      actions: [
        { action: "track", title: "View trip" },
      ],
      requireInteraction: false,
      category: "ride_active",
    },
    completed: {
      title: "Trip completed",
      body: context?.fare 
        ? `$${context.fare.toFixed(2)} · ${context.dropoffAddress || "Destination reached"}\nRate your ride`
        : "You've arrived. Rate your experience.",
      actions: [
        { action: "rate", title: "Rate ride" },
        { action: "receipt", title: "View receipt" },
      ],
      requireInteraction: true,
      category: "ride_completed",
    },
    cancelled: {
      title: "Ride cancelled",
      body: "Your ride has been cancelled. You can book a new ride anytime.",
      actions: [
        { action: "rebook", title: "Book again" },
      ],
      requireInteraction: false,
      category: "ride_cancelled",
    },
  };

  const notif = notifications[status] || {
    title: "Ride update",
    body: `Status: ${status}`,
    actions: [],
    requireInteraction: false,
    category: "ride_update",
  };

  const rideUrl = context?.rideId ? `/my-rides?ride=${context.rideId}` : "/my-rides";

  await sendPushNotification(
    notif.title,
    notif.body,
    rideUrl,
    "user",
    {
      tag: `ride-${context?.rideId || "update"}-${status}`,
      renotify: true,
      requireInteraction: notif.requireInteraction,
      category: notif.category,
      actions: notif.actions,
      data: {
        type: "ride_update",
        status,
        rideId: context?.rideId,
        driverName: context?.driverName || driverName,
        driverPhone: context?.driverPhone,
        vehicleInfo: context?.vehicleInfo,
        licensePlate: context?.licensePlate,
        fare: context?.fare,
      },
    }
  );
}

export async function notifyItCompanyOfTicketUpdate(
  companyOwnerId: string,
  ticketNumber: string,
  title: string,
  status: string,
  techName?: string
) {
  const statusMessages: Record<string, string> = {
    accepted: `${techName || "A technician"} has accepted ticket ${ticketNumber}: ${title}`,
    in_progress: `Work has started on ticket ${ticketNumber}: ${title}`,
    resolved: `Ticket ${ticketNumber} has been resolved: ${title}`,
    completed: `Ticket ${ticketNumber} is complete: ${title}`,
  };

  const body = statusMessages[status] || `Ticket ${ticketNumber} status updated to ${status}`;

  console.log(`IT ticket update notification for company owner ${companyOwnerId}: ${body}`);
}

export async function notifyItTechsOfNewTicket(
  ticketNumber: string,
  title: string,
  category: string,
  priority: string,
  location?: string
) {
  const priorityLabel = priority.charAt(0).toUpperCase() + priority.slice(1);
  const locationInfo = location ? ` in ${location}` : "";

  await sendPushNotification(
    `New IT Ticket: ${priorityLabel} Priority`,
    `${title}${locationInfo} (${ticketNumber})`,
    "/it-tech",
    "it_tech",
    {
      tag: `it-new-ticket-${ticketNumber}`,
      renotify: true,
      requireInteraction: priority === "urgent" || priority === "high",
      category: "it_new_ticket",
      actions: [
        { action: "view", title: "View Details" },
        { action: "accept", title: "Accept Job" },
      ],
      data: {
        type: "it_new_ticket",
        ticketNumber,
        category,
        priority,
      },
    }
  );
}
