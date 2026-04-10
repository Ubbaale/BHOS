import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Application from "expo-application";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

export function getDeviceFingerprint(): string {
  const parts = [
    Device.brand || "unknown",
    Device.modelName || "unknown",
    Device.osName || Platform.OS,
    Device.osVersion || "unknown",
    Device.deviceName || "device",
  ];
  let hash = 0;
  const str = parts.join("-");
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `dev_${Math.abs(hash).toString(36)}_${Platform.OS}`;
}

export function getDeviceInfo() {
  return {
    deviceId: getDeviceFingerprint(),
    deviceName: Device.deviceName || Device.modelName || `${Platform.OS} Device`,
    platform: `${Device.brand || ""} ${Device.modelName || Platform.OS}`.trim(),
    osVersion: `${Device.osName || Platform.OS} ${Device.osVersion || ""}`.trim(),
    appVersion: Application.nativeApplicationVersion || "1.0.0",
  };
}

export type DeviceStatus = "pending" | "approved" | "revoked" | "blocked" | "not_registered" | "no_staff" | "unknown";

export interface DeviceStatusResult {
  enrolled: boolean;
  status: DeviceStatus;
  message: string;
  enrollment?: any;
}

export async function registerDevice(token: string): Promise<DeviceStatusResult> {
  const info = getDeviceInfo();
  const resp = await fetch(`${API_BASE}/devices/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(info),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Registration failed" }));
    throw new Error(err.error || "Device registration failed");
  }

  const data = await resp.json();
  return {
    enrolled: true,
    status: data.enrollment?.status || "pending",
    message: data.message,
    enrollment: data.enrollment,
  };
}

export async function checkDeviceStatus(token: string): Promise<DeviceStatusResult> {
  const info = getDeviceInfo();
  const resp = await fetch(`${API_BASE}/devices/my-status`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "X-Device-Id": info.deviceId,
    },
  });

  if (!resp.ok) {
    throw new Error("Failed to check device status");
  }

  return resp.json();
}
