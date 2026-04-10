const API = `${import.meta.env.BASE_URL}api`;

export interface PinStatus {
  hasPinSet: boolean;
  lastUpdated: string | null;
  staffId: number;
  staffName: string;
}

export interface PinVerifyResult {
  success: boolean;
  pinVerificationToken: string;
  expiresIn: number;
}

export async function getPinStatus(): Promise<PinStatus> {
  const res = await fetch(`${API}/staff/med-pin/status`);
  if (!res.ok) throw new Error("Failed to get PIN status");
  return res.json();
}

export async function setPin(pin: string, currentPin?: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API}/staff/med-pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin, currentPin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to set PIN");
  return data;
}

export async function verifyPin(pin: string): Promise<PinVerifyResult> {
  const res = await fetch(`${API}/staff/med-pin/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "PIN verification failed");
  return data;
}

export async function getPinAttempts(staffId?: number): Promise<any[]> {
  const url = staffId ? `${API}/staff/med-pin/attempts?staffId=${staffId}` : `${API}/staff/med-pin/attempts`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to get PIN attempts");
  return res.json();
}
