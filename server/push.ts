import webpush from "web-push";
import { db } from "./db";
import { pushSubscriptions } from "@shared/schema";
import { eq } from "drizzle-orm";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:support@carehubapp.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
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

export async function sendPushNotification(
  title: string,
  body: string,
  url?: string,
  targetUserType?: string
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
    icon: "/icon-192.png",
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
  appointmentTime: Date
): Promise<void> {
  const formattedTime = appointmentTime.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  
  await sendPushNotification(
    "New Ride Request",
    `Pickup: ${pickupAddress} at ${formattedTime}`,
    "/driver",
    "driver"
  );
}

export async function notifyPatientOfRideUpdate(
  status: string,
  driverName?: string
): Promise<void> {
  const statusMessages: Record<string, string> = {
    accepted: `Your ride has been accepted${driverName ? ` by ${driverName}` : ""}`,
    driver_enroute: "Your driver is on the way",
    arrived: "Your driver has arrived at the pickup location",
    in_progress: "Your ride is in progress",
    completed: "Your ride has been completed. Thank you!",
    cancelled: "Your ride has been cancelled",
  };

  const message = statusMessages[status] || `Ride status updated: ${status}`;
  
  await sendPushNotification(
    "Ride Update",
    message,
    "/book-ride",
    "user"
  );
}
