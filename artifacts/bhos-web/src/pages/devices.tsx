import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Smartphone,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  ShieldOff,
  Trash2,
  Ban,
  Monitor,
  Tablet,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL;
function fetchApi(path: string, opts?: RequestInit) {
  return fetch(`${BASE}api${path}`, { credentials: "include", ...opts }).then(r => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });
}

function statusBadge(status: string) {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
    case "pending":
      return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case "revoked":
      return <Badge className="bg-red-100 text-red-800"><ShieldOff className="h-3 w-3 mr-1" />Revoked</Badge>;
    case "blocked":
      return <Badge className="bg-gray-100 text-gray-800"><Ban className="h-3 w-3 mr-1" />Blocked</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function platformIcon(platform: string) {
  if (platform?.toLowerCase().includes("ios") || platform?.toLowerCase().includes("iphone")) {
    return <Smartphone className="h-5 w-5 text-blue-500" />;
  }
  if (platform?.toLowerCase().includes("android")) {
    return <Smartphone className="h-5 w-5 text-green-500" />;
  }
  if (platform?.toLowerCase().includes("tablet") || platform?.toLowerCase().includes("ipad")) {
    return <Tablet className="h-5 w-5 text-purple-500" />;
  }
  return <Monitor className="h-5 w-5 text-gray-500" />;
}

export default function DevicesPage() {
  const [filter, setFilter] = useState<string>("all");
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [actionNotes, setActionNotes] = useState("");
  const qc = useQueryClient();

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["devices"],
    queryFn: () => fetchApi("/devices"),
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => fetchApi(`/devices/${id}/approve`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: actionNotes }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["devices"] }); setSelectedDevice(null); setActionNotes(""); },
  });

  const revokeMut = useMutation({
    mutationFn: (id: number) => fetchApi(`/devices/${id}/revoke`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: actionNotes }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["devices"] }); setSelectedDevice(null); setActionNotes(""); },
  });

  const blockMut = useMutation({
    mutationFn: (id: number) => fetchApi(`/devices/${id}/block`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: actionNotes }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["devices"] }); setSelectedDevice(null); setActionNotes(""); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => fetchApi(`/devices/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["devices"] }); setSelectedDevice(null); },
  });

  const filtered = filter === "all" ? devices : devices.filter((d: any) => d.status === filter);

  const counts = {
    all: devices.length,
    pending: devices.filter((d: any) => d.status === "pending").length,
    approved: devices.filter((d: any) => d.status === "approved").length,
    revoked: devices.filter((d: any) => d.status === "revoked").length,
    blocked: devices.filter((d: any) => d.status === "blocked").length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Device Management
        </h1>
        <p className="text-muted-foreground">Manage enrolled staff devices. Approve or revoke device access to ensure security.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["all", "pending", "approved", "revoked", "blocked"] as const).map(f => (
          <Card
            key={f}
            className={`cursor-pointer transition-all hover:shadow-md ${filter === f ? "ring-2 ring-primary" : ""}`}
            onClick={() => setFilter(f)}
          >
            <CardContent className="py-3 px-4 text-center">
              <p className="text-2xl font-bold">{counts[f]}</p>
              <p className="text-xs text-muted-foreground capitalize">{f}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Smartphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Devices Found</h3>
            <p className="text-muted-foreground">
              {filter === "all"
                ? "No devices have been enrolled yet. Staff will appear here when they log in from the mobile app."
                : `No ${filter} devices.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((device: any) => (
            <Card key={device.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {platformIcon(device.platform)}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{device.deviceName}</h3>
                        {statusBadge(device.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {device.staffFirstName} {device.staffLastName} ({device.staffRole}) — {device.staffEmail}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span>{device.platform} {device.osVersion || ""}</span>
                        {device.appVersion && <span>App v{device.appVersion}</span>}
                        <span>Enrolled: {new Date(device.enrolledAt).toLocaleDateString()}</span>
                        {device.lastActiveAt && (
                          <span>Last active: {new Date(device.lastActiveAt).toLocaleString()}</span>
                        )}
                      </div>
                      {device.notes && <p className="text-xs text-muted-foreground mt-1 italic">Note: {device.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {device.status === "pending" && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => { setSelectedDevice({ ...device, action: "approve" }); setActionNotes(""); }}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Approve
                      </Button>
                    )}
                    {(device.status === "approved" || device.status === "pending") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200"
                        onClick={() => { setSelectedDevice({ ...device, action: "revoke" }); setActionNotes(""); }}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Revoke
                      </Button>
                    )}
                    {device.status !== "blocked" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-600"
                        onClick={() => { setSelectedDevice({ ...device, action: "block" }); setActionNotes(""); }}
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500"
                      onClick={() => { if (confirm("Delete this device enrollment?")) deleteMut.mutate(device.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedDevice} onOpenChange={() => setSelectedDevice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDevice?.action === "approve" && "Approve Device"}
              {selectedDevice?.action === "revoke" && "Revoke Device Access"}
              {selectedDevice?.action === "block" && "Block Device"}
            </DialogTitle>
          </DialogHeader>
          {selectedDevice && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p><strong>Staff:</strong> {selectedDevice.staffFirstName} {selectedDevice.staffLastName}</p>
                <p><strong>Device:</strong> {selectedDevice.deviceName}</p>
                <p><strong>Platform:</strong> {selectedDevice.platform} {selectedDevice.osVersion || ""}</p>
              </div>
              <Input
                placeholder="Optional notes (reason for action)"
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSelectedDevice(null)}>Cancel</Button>
                {selectedDevice.action === "approve" && (
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => approveMut.mutate(selectedDevice.id)}
                    disabled={approveMut.isPending}
                  >
                    {approveMut.isPending ? "Approving..." : "Approve Device"}
                  </Button>
                )}
                {selectedDevice.action === "revoke" && (
                  <Button
                    variant="destructive"
                    onClick={() => revokeMut.mutate(selectedDevice.id)}
                    disabled={revokeMut.isPending}
                  >
                    {revokeMut.isPending ? "Revoking..." : "Revoke Access"}
                  </Button>
                )}
                {selectedDevice.action === "block" && (
                  <Button
                    variant="destructive"
                    onClick={() => blockMut.mutate(selectedDevice.id)}
                    disabled={blockMut.isPending}
                  >
                    {blockMut.isPending ? "Blocking..." : "Block Device"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
