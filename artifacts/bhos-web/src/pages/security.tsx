import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  MapPin,
  Clock,
  Eye,
  UserX,
  AlertTriangle,
  Monitor,
  Fingerprint,
  Globe,
  Save,
  RefreshCw,
  Trash2,
  Activity,
  Lock,
  KeyRound,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PinSetupDialog } from "@/components/PinVerificationDialog";
import { getPinStatus, getPinAttempts, type PinStatus } from "@/lib/medPassPin";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SecuritySettings {
  id: number;
  sessionTimeoutMinutes: number;
  geofenceEnabled: boolean;
  geofenceRadiusMeters: number;
  biometricRequired: boolean;
  biometricForControlledSubstances: boolean;
  requireDevicePasscode: boolean;
  ipWhitelistEnabled: boolean;
  allowedIps: string[];
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  auditRetentionDays: number;
}

interface GeofenceHome {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  latitude: string | null;
  longitude: string | null;
  geofenceRadiusMeters: number;
  status: string;
}

interface AccessLog {
  id: number;
  clerkUserId: string;
  userName: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: string | null;
  ipAddress: string | null;
  latitude: string | null;
  longitude: string | null;
  geofenceStatus: string;
  createdAt: string;
}

interface ActiveSessionRow {
  id: number;
  clerkUserId: string;
  userName: string | null;
  deviceInfo: string | null;
  ipAddress: string | null;
  latitude: string | null;
  longitude: string | null;
  lastActivity: string;
  isRevoked: boolean;
}

interface AccessStats {
  accessesToday: number;
  accessesThisWeek: number;
  blockedToday: number;
  topUsers: { userId: string; userName: string | null; count: number }[];
}

function MetricCard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MedPassPinSection() {
  const { toast } = useToast();
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [showSetup, setShowSetup] = useState(false);

  const fetchPinData = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const status = await getPinStatus();
      setPinStatus(status);
      try {
        const logs = await getPinAttempts();
        setAttempts(logs);
      } catch { setAttempts([]); }
    } catch { /* not authenticated or error */ }
    setLoadingStatus(false);
  }, []);

  useEffect(() => { fetchPinData(); }, [fetchPinData]);

  if (loadingStatus) return <Skeleton className="h-64" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Med-Pass PIN
          </CardTitle>
          <CardDescription>
            Your personal PIN verifies your identity before each medication administration, preventing unauthorized use of your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-50">
            {pinStatus?.hasPinSet ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">PIN is set</p>
                  <p className="text-sm text-muted-foreground">
                    Last updated: {pinStatus.lastUpdated ? new Date(pinStatus.lastUpdated).toLocaleDateString() : "Unknown"}
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800">No PIN set</p>
                  <p className="text-sm text-muted-foreground">
                    You must set up a med-pass PIN before you can administer medications.
                  </p>
                </div>
              </>
            )}
          </div>

          <Button onClick={() => setShowSetup(true)} className="w-full">
            <KeyRound className="h-4 w-4 mr-2" />
            {pinStatus?.hasPinSet ? "Change PIN" : "Set Up PIN"}
          </Button>

          <div className="text-sm text-muted-foreground space-y-1 pt-2 border-t">
            <p className="font-medium">How it works:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Before giving any medication, you'll be asked for your PIN</li>
              <li>PIN must be 4-6 digits</li>
              <li>After 5 failed attempts, your account is locked for 15 minutes</li>
              <li>All verification attempts are logged for security auditing</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> PIN Verification Log
          </CardTitle>
          <CardDescription>Recent PIN verification attempts (admin/manager only)</CardDescription>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No verification attempts recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Context</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.slice(0, 20).map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.staffName || `Staff #${a.staffId}`}</TableCell>
                    <TableCell>
                      {a.success ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          <CheckCircle className="h-3 w-3 mr-1" /> Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" /> Failed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{a.context}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PinSetupDialog
        open={showSetup}
        onOpenChange={setShowSetup}
        onComplete={() => {
          fetchPinData();
          toast({ title: pinStatus?.hasPinSet ? "PIN Updated" : "PIN Created", description: "Your med-pass PIN has been saved successfully." });
        }}
        isUpdate={pinStatus?.hasPinSet}
      />
    </div>
  );
}

export default function SecurityPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [geofences, setGeofences] = useState<GeofenceHome[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [sessions, setSessions] = useState<ActiveSessionRow[]>([]);
  const [stats, setStats] = useState<AccessStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newIp, setNewIp] = useState("");
  const [logFilter, setLogFilter] = useState({ action: "", resourceType: "" });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, geofencesRes, logsRes, sessionsRes, statsRes] = await Promise.all([
        fetch(`${BASE}/api/security/settings`),
        fetch(`${BASE}/api/security/geofences`),
        fetch(`${BASE}/api/security/access-logs?limit=50`),
        fetch(`${BASE}/api/security/sessions`),
        fetch(`${BASE}/api/security/access-logs/stats`),
      ]);

      if (settingsRes.ok) setSettings(await settingsRes.json());
      if (geofencesRes.ok) setGeofences(await geofencesRes.json());
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs);
        setLogTotal(data.total);
      }
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e) {
      console.error("Error fetching security data:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/security/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        toast({ title: "Settings saved", description: "Security settings updated successfully." });
      } else {
        toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    }
    setSaving(false);
  };

  const updateGeofence = async (id: number, updates: Partial<GeofenceHome>) => {
    try {
      const res = await fetch(`${BASE}/api/security/geofences/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        toast({ title: "Updated", description: "Geofence updated." });
        fetchAll();
      }
    } catch {
      toast({ title: "Error", description: "Failed to update geofence.", variant: "destructive" });
    }
  };

  const revokeSession = async (id: number) => {
    try {
      const res = await fetch(`${BASE}/api/security/sessions/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Revoked", description: "Session revoked successfully." });
        fetchAll();
      }
    } catch {
      toast({ title: "Error", description: "Failed to revoke session.", variant: "destructive" });
    }
  };

  const addIp = () => {
    if (!newIp || !settings) return;
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(newIp)) {
      toast({ title: "Invalid IP", description: "Please enter a valid IP address.", variant: "destructive" });
      return;
    }
    setSettings({ ...settings, allowedIps: [...(settings.allowedIps || []), newIp] });
    setNewIp("");
  };

  const removeIp = (ip: string) => {
    if (!settings) return;
    setSettings({ ...settings, allowedIps: settings.allowedIps.filter((i) => i !== ip) });
  };

  const actionBadgeColor = (action: string) => {
    if (action.includes("BLOCKED")) return "destructive";
    if (action.includes("REVOKED")) return "secondary";
    return "outline";
  };

  const geofenceStatusBadge = (status: string) => {
    switch (status) {
      case "verified": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Verified</Badge>;
      case "outside": return <Badge variant="destructive">Outside</Badge>;
      case "no_location": return <Badge variant="secondary">No Location</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-[#0a7ea4]" />
            Security & Compliance
          </h1>
          <p className="text-muted-foreground">HIPAA-compliant access controls, audit trail, and data protection</p>
        </div>
        <Button variant="outline" onClick={fetchAll}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="PHI Accesses Today" value={stats?.accessesToday || 0} icon={Eye} color="text-blue-600 bg-blue-50" />
        <MetricCard title="Accesses This Week" value={stats?.accessesThisWeek || 0} icon={Activity} color="text-green-600 bg-green-50" />
        <MetricCard title="Blocked Today" value={stats?.blockedToday || 0} icon={AlertTriangle} color="text-red-600 bg-red-50" />
        <MetricCard title="Active Sessions" value={sessions.length} icon={Monitor} color="text-purple-600 bg-purple-50" />
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="med-pin">Med-Pass PIN</TabsTrigger>
          <TabsTrigger value="geofences">Geofences</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Session Security</CardTitle>
                <CardDescription>Control session timeout and lockout behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Session Timeout (minutes)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={settings?.sessionTimeoutMinutes || 15}
                    onChange={(e) => setSettings(s => s ? { ...s, sessionTimeoutMinutes: parseInt(e.target.value) || 15 } : s)}
                  />
                  <p className="text-xs text-muted-foreground">Auto-logout after inactivity. Recommended: 5-15 minutes for HIPAA.</p>
                </div>
                <div className="space-y-2">
                  <Label>Max Failed Login Attempts</Label>
                  <Input
                    type="number"
                    min={3}
                    max={20}
                    value={settings?.maxFailedAttempts || 5}
                    onChange={(e) => setSettings(s => s ? { ...s, maxFailedAttempts: parseInt(e.target.value) || 5 } : s)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lockout Duration (minutes)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={1440}
                    value={settings?.lockoutDurationMinutes || 30}
                    onChange={(e) => setSettings(s => s ? { ...s, lockoutDurationMinutes: parseInt(e.target.value) || 30 } : s)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Audit Log Retention (days)</Label>
                  <Input
                    type="number"
                    min={90}
                    max={2555}
                    value={settings?.auditRetentionDays || 365}
                    onChange={(e) => setSettings(s => s ? { ...s, auditRetentionDays: parseInt(e.target.value) || 365 } : s)}
                  />
                  <p className="text-xs text-muted-foreground">HIPAA requires minimum 6 years (2190 days). Default: 365.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Location Access Control</CardTitle>
                <CardDescription>Restrict access to approved facility locations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Geofencing</Label>
                    <p className="text-xs text-muted-foreground">Only allow PHI access within facility boundaries</p>
                  </div>
                  <Switch
                    checked={settings?.geofenceEnabled || false}
                    onCheckedChange={(v) => setSettings(s => s ? { ...s, geofenceEnabled: v } : s)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Geofence Radius (meters)</Label>
                  <Input
                    type="number"
                    min={50}
                    max={5000}
                    value={settings?.geofenceRadiusMeters || 150}
                    onChange={(e) => setSettings(s => s ? { ...s, geofenceRadiusMeters: parseInt(e.target.value) || 150 } : s)}
                  />
                  <p className="text-xs text-muted-foreground">Default radius around each home. Individual homes can override.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Fingerprint className="h-4 w-4" /> Device Security</CardTitle>
                <CardDescription>Biometric and device requirements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Require Device Passcode</Label>
                    <p className="text-xs text-muted-foreground">Block access from devices without screen lock</p>
                  </div>
                  <Switch
                    checked={settings?.requireDevicePasscode || false}
                    onCheckedChange={(v) => setSettings(s => s ? { ...s, requireDevicePasscode: v } : s)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Require Biometric for All Actions</Label>
                    <p className="text-xs text-muted-foreground">Fingerprint/Face ID for every sensitive action</p>
                  </div>
                  <Switch
                    checked={settings?.biometricRequired || false}
                    onCheckedChange={(v) => setSettings(s => s ? { ...s, biometricRequired: v } : s)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Biometric for Controlled Substances</Label>
                    <p className="text-xs text-muted-foreground">Require biometric when administering controlled substances</p>
                  </div>
                  <Switch
                    checked={settings?.biometricForControlledSubstances !== false}
                    onCheckedChange={(v) => setSettings(s => s ? { ...s, biometricForControlledSubstances: v } : s)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Globe className="h-4 w-4" /> IP Whitelist</CardTitle>
                <CardDescription>Restrict web access to specific network IPs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable IP Whitelist</Label>
                    <p className="text-xs text-muted-foreground">Only allow access from listed IP addresses</p>
                  </div>
                  <Switch
                    checked={settings?.ipWhitelistEnabled || false}
                    onCheckedChange={(v) => setSettings(s => s ? { ...s, ipWhitelistEnabled: v } : s)}
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., 203.0.113.50"
                    value={newIp}
                    onChange={(e) => setNewIp(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addIp()}
                  />
                  <Button variant="outline" onClick={addIp}>Add</Button>
                </div>
                <div className="space-y-1">
                  {(settings?.allowedIps || []).map((ip) => (
                    <div key={ip} className="flex items-center justify-between bg-muted/50 rounded px-3 py-1.5 text-sm">
                      <span className="font-mono">{ip}</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeIp(ip)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {(!settings?.allowedIps || settings.allowedIps.length === 0) && (
                    <p className="text-xs text-muted-foreground">No IPs added yet. All IPs are currently allowed.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={saveSettings} disabled={saving} className="bg-[#0a7ea4] hover:bg-[#086f91]">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save All Settings"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="med-pin">
          <MedPassPinSection />
        </TabsContent>

        <TabsContent value="geofences">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Facility Geofences</CardTitle>
              <CardDescription>Each home defines a geofence perimeter. Staff must be within the radius to access PHI on mobile devices.</CardDescription>
            </CardHeader>
            <CardContent>
              {!settings?.geofenceEnabled && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">Geofencing is disabled</p>
                    <p className="text-sm text-amber-600">Enable geofencing in Settings to enforce location-based access.</p>
                  </div>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Home</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Latitude</TableHead>
                    <TableHead>Longitude</TableHead>
                    <TableHead>Radius (m)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {geofences.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{g.address}, {g.city}, {g.state}</TableCell>
                      <TableCell>
                        <Input
                          className="w-28 h-8 text-sm"
                          defaultValue={g.latitude || ""}
                          onBlur={(e) => {
                            if (e.target.value !== (g.latitude || "")) {
                              updateGeofence(g.id, { latitude: e.target.value } as any);
                            }
                          }}
                          placeholder="0.0000000"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-28 h-8 text-sm"
                          defaultValue={g.longitude || ""}
                          onBlur={(e) => {
                            if (e.target.value !== (g.longitude || "")) {
                              updateGeofence(g.id, { longitude: e.target.value } as any);
                            }
                          }}
                          placeholder="0.0000000"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-20 h-8 text-sm"
                          type="number"
                          defaultValue={g.geofenceRadiusMeters}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value);
                            if (val !== g.geofenceRadiusMeters) {
                              updateGeofence(g.id, { geofenceRadiusMeters: val });
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={g.latitude && g.longitude ? "outline" : "secondary"} className={g.latitude && g.longitude ? "bg-green-50 text-green-700 border-green-200" : ""}>
                          {g.latitude && g.longitude ? "Configured" : "No Coordinates"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {!g.latitude || !g.longitude ? (
                          <span className="text-xs text-muted-foreground">Set coordinates to enable</span>
                        ) : (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Active</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {geofences.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No homes configured.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Eye className="h-4 w-4" /> PHI Access Audit Log</CardTitle>
              <CardDescription>Every access to patient data is logged for HIPAA compliance. Total: {logTotal} records.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">{log.userName || log.clerkUserId.slice(0, 12)}</TableCell>
                      <TableCell>
                        <Badge variant={actionBadgeColor(log.action) as any}>{log.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.resourceType}
                        {log.resourceId && <span className="text-muted-foreground"> #{log.resourceId}</span>}
                      </TableCell>
                      <TableCell className="text-sm font-mono">{log.ipAddress || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {log.latitude && log.longitude ? `${parseFloat(log.latitude).toFixed(4)}, ${parseFloat(log.longitude).toFixed(4)}` : "—"}
                      </TableCell>
                      <TableCell>{geofenceStatusBadge(log.geofenceStatus)}</TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No access logs yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Monitor className="h-4 w-4" /> Active Sessions</CardTitle>
                  <CardDescription className="mt-1.5">View and revoke active user sessions. Revoking a session immediately logs the user out.</CardDescription>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1"
                  onClick={async () => {
                    if (!confirm("Sign out all sessions? This will log out every user currently signed in.")) return;
                    try {
                      for (const s of sessions) {
                        await fetch(`${BASE}/api/security/sessions/${s.id}`, { method: "DELETE" });
                      }
                      setSessions([]);
                      toast({ title: "All Sessions Revoked", description: "All users have been signed out." });
                    } catch {
                      toast({ title: "Error", description: "Failed to revoke sessions.", variant: "destructive" });
                    }
                  }}
                  disabled={sessions.length === 0}
                >
                  Sign Out Everyone
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.userName || s.clerkUserId.slice(0, 12)}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{s.deviceInfo || "Unknown"}</TableCell>
                      <TableCell className="text-sm font-mono">{s.ipAddress || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {s.latitude && s.longitude ? `${parseFloat(s.latitude).toFixed(4)}, ${parseFloat(s.longitude).toFixed(4)}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(s.lastActivity).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="destructive" size="sm" onClick={() => revokeSession(s.id)}>
                          <UserX className="h-3 w-3 mr-1" /> Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sessions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No active sessions.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
