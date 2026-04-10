import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Camera, Plus, RefreshCw, Wifi, WifiOff, Wrench, Eye,
  Video, Circle, ChevronDown, ExternalLink, Trash2, Edit, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;

interface CameraData {
  id: number;
  homeId: number;
  homeName: string;
  name: string;
  location: string;
  cameraType: string;
  brand: string | null;
  model: string | null;
  streamUrl: string | null;
  dashboardUrl: string | null;
  resolution: string | null;
  hasNightVision: boolean;
  hasAudio: boolean;
  hasMotionDetection: boolean;
  recordingMode: string;
  retentionDays: number;
  status: string;
  lastOnlineAt: string | null;
  installedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CameraEvent {
  id: number;
  cameraId: number;
  eventType: string;
  description: string | null;
  clipUrl: string | null;
  thumbnailUrl: string | null;
  incidentId: number | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  occurredAt: string;
  createdAt: string;
}

interface CameraStats {
  total: number;
  online: number;
  offline: number;
  maintenance: number;
  byHome: { homeId: number; homeName: string; count: number; onlineCount: number }[];
}

interface Home {
  id: number;
  name: string;
}

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  online: { color: "bg-green-100 text-green-700 border-green-200", icon: Wifi, label: "Online" },
  offline: { color: "bg-red-100 text-red-700 border-red-200", icon: WifiOff, label: "Offline" },
  maintenance: { color: "bg-amber-100 text-amber-700 border-amber-200", icon: Wrench, label: "Maintenance" },
};

const eventTypeLabels: Record<string, { label: string; color: string }> = {
  motion: { label: "Motion Detected", color: "bg-blue-100 text-blue-700" },
  offline: { label: "Went Offline", color: "bg-red-100 text-red-700" },
  online: { label: "Came Online", color: "bg-green-100 text-green-700" },
  tampering: { label: "Tampering Alert", color: "bg-red-100 text-red-700" },
  recording_gap: { label: "Recording Gap", color: "bg-amber-100 text-amber-700" },
  maintenance: { label: "Maintenance", color: "bg-gray-100 text-gray-700" },
  review: { label: "Footage Reviewed", color: "bg-purple-100 text-purple-700" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.offline;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`${cfg.color} gap-1`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

function AddCameraDialog({ homes, onSuccess }: { homes: Home[]; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({
    homeId: "", name: "", location: "", cameraType: "indoor", brand: "", model: "",
    streamUrl: "", dashboardUrl: "", resolution: "1080p", hasNightVision: false,
    hasAudio: false, hasMotionDetection: false, recordingMode: "continuous",
    retentionDays: 30, notes: "",
  });

  const mutation = useMutation({
    mutationFn: () => fetch(`${API}/cameras`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, homeId: Number(form.homeId), retentionDays: Number(form.retentionDays) }),
    }).then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      toast({ title: "Camera added successfully" });
      setOpen(false);
      setForm({
        homeId: "", name: "", location: "", cameraType: "indoor", brand: "", model: "",
        streamUrl: "", dashboardUrl: "", resolution: "1080p", hasNightVision: false,
        hasAudio: false, hasMotionDetection: false, recordingMode: "continuous",
        retentionDays: 30, notes: "",
      });
      onSuccess();
    },
    onError: (err: any) => toast({ title: "Failed to add camera", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Add Camera</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Camera</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Home *</Label>
              <Select value={form.homeId} onValueChange={(v) => setForm({ ...form, homeId: v })}>
                <SelectTrigger><SelectValue placeholder="Select home" /></SelectTrigger>
                <SelectContent>
                  {homes.map(h => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Camera Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Front Door Camera" />
            </div>
            <div>
              <Label>Location *</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Main Entrance" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.cameraType} onValueChange={(v) => setForm({ ...form, cameraType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="indoor">Indoor</SelectItem>
                  <SelectItem value="outdoor">Outdoor</SelectItem>
                  <SelectItem value="doorbell">Doorbell</SelectItem>
                  <SelectItem value="ptz">PTZ (Pan/Tilt/Zoom)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Resolution</Label>
              <Select value={form.resolution} onValueChange={(v) => setForm({ ...form, resolution: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="720p">720p HD</SelectItem>
                  <SelectItem value="1080p">1080p Full HD</SelectItem>
                  <SelectItem value="2K">2K</SelectItem>
                  <SelectItem value="4K">4K Ultra HD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Brand</Label>
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Ring, Nest, Arlo..." />
            </div>
            <div>
              <Label>Model</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Model name" />
            </div>
            <div className="col-span-2">
              <Label>Stream URL</Label>
              <Input value={form.streamUrl} onChange={(e) => setForm({ ...form, streamUrl: e.target.value })} placeholder="https://camera-system.example.com/stream/1" />
            </div>
            <div className="col-span-2">
              <Label>Dashboard URL</Label>
              <Input value={form.dashboardUrl} onChange={(e) => setForm({ ...form, dashboardUrl: e.target.value })} placeholder="https://camera-system.example.com/dashboard" />
            </div>
            <div>
              <Label>Recording Mode</Label>
              <Select value={form.recordingMode} onValueChange={(v) => setForm({ ...form, recordingMode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="continuous">Continuous</SelectItem>
                  <SelectItem value="motion">Motion Only</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Retention (Days)</Label>
              <Input type="number" value={form.retentionDays} onChange={(e) => setForm({ ...form, retentionDays: Number(e.target.value) })} min={1} max={365} />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.hasNightVision} onCheckedChange={(v) => setForm({ ...form, hasNightVision: v })} />
              Night Vision
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.hasAudio} onCheckedChange={(v) => setForm({ ...form, hasAudio: v })} />
              Audio
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.hasMotionDetection} onCheckedChange={(v) => setForm({ ...form, hasMotionDetection: v })} />
              Motion Detection
            </label>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || !form.homeId || !form.name || !form.location}>
              {mutation.isPending ? "Adding..." : "Add Camera"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CameraCard({ camera, onRefresh }: { camera: CameraData; onRefresh: () => void }) {
  const [showEvents, setShowEvents] = useState(false);
  const [editing, setEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events } = useQuery<CameraEvent[]>({
    queryKey: ["camera-events", camera.id],
    queryFn: () => fetch(`${API}/cameras/${camera.id}/events`).then(r => r.json()),
    enabled: showEvents,
  });

  const deleteMutation = useMutation({
    mutationFn: () => fetch(`${API}/cameras/${camera.id}`, { method: "DELETE" }).then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      toast({ title: "Camera deleted" });
      onRefresh();
    },
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) =>
      fetch(`${API}/cameras/${camera.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      }).then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      toast({ title: "Camera status updated" });
      onRefresh();
    },
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${camera.status === "online" ? "bg-green-100" : camera.status === "offline" ? "bg-red-100" : "bg-amber-100"}`}>
              <Camera className={`h-5 w-5 ${camera.status === "online" ? "text-green-600" : camera.status === "offline" ? "text-red-600" : "text-amber-600"}`} />
            </div>
            <div>
              <CardTitle className="text-base">{camera.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{camera.homeName} — {camera.location}</p>
            </div>
          </div>
          <StatusBadge status={camera.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">Type</div>
          <div className="capitalize">{camera.cameraType}</div>
          {camera.brand && (
            <>
              <div className="text-muted-foreground">Brand / Model</div>
              <div>{camera.brand}{camera.model ? ` ${camera.model}` : ""}</div>
            </>
          )}
          {camera.resolution && (
            <>
              <div className="text-muted-foreground">Resolution</div>
              <div>{camera.resolution}</div>
            </>
          )}
          <div className="text-muted-foreground">Recording</div>
          <div className="capitalize">{camera.recordingMode}</div>
          <div className="text-muted-foreground">Retention</div>
          <div>{camera.retentionDays} days</div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {camera.hasNightVision && <Badge variant="secondary" className="text-xs">Night Vision</Badge>}
          {camera.hasAudio && <Badge variant="secondary" className="text-xs">Audio</Badge>}
          {camera.hasMotionDetection && <Badge variant="secondary" className="text-xs">Motion</Badge>}
        </div>

        {camera.lastOnlineAt && (
          <p className="text-xs text-muted-foreground">
            Last online: {new Date(camera.lastOnlineAt).toLocaleString()}
          </p>
        )}

        <div className="flex gap-2 pt-2 border-t">
          {camera.streamUrl && (
            <Button size="sm" variant="outline" asChild>
              <a href={camera.streamUrl} target="_blank" rel="noopener noreferrer">
                <Eye className="h-3 w-3 mr-1" />Live View
              </a>
            </Button>
          )}
          {camera.dashboardUrl && (
            <Button size="sm" variant="outline" asChild>
              <a href={camera.dashboardUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />Dashboard
              </a>
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowEvents(!showEvents)}>
            <Video className="h-3 w-3 mr-1" />Events
          </Button>
          <div className="flex-1" />
          <Select onValueChange={(v) => statusMutation.mutate(v)}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Change Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="online">Set Online</SelectItem>
              <SelectItem value="offline">Set Offline</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => {
            if (confirm("Delete this camera?")) deleteMutation.mutate();
          }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {showEvents && (
          <div className="mt-3 border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
            <h4 className="text-sm font-medium">Recent Events</h4>
            {!events || events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events recorded</p>
            ) : (
              events.map(ev => {
                const cfg = eventTypeLabels[ev.eventType] || { label: ev.eventType, color: "bg-gray-100 text-gray-700" };
                return (
                  <div key={ev.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                      {ev.description && <span className="text-muted-foreground">{ev.description}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(ev.occurredAt).toLocaleString()}</span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CamerasPage() {
  const [filterHome, setFilterHome] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const queryClient = useQueryClient();

  const { data: cameras = [], isLoading } = useQuery<CameraData[]>({
    queryKey: ["cameras", filterHome, filterStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterHome !== "all") params.set("homeId", filterHome);
      if (filterStatus !== "all") params.set("status", filterStatus);
      return fetch(`${API}/cameras?${params}`).then(r => r.json());
    },
  });

  const { data: stats } = useQuery<CameraStats>({
    queryKey: ["camera-stats"],
    queryFn: () => fetch(`${API}/cameras/stats`).then(r => r.json()),
  });

  const { data: homes = [] } = useQuery<Home[]>({
    queryKey: ["homes-list"],
    queryFn: () => fetch(`${API}/homes`).then(r => r.json()),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["cameras"] });
    queryClient.invalidateQueries({ queryKey: ["camera-stats"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            📹 Camera Management
          </h1>
          <p className="text-muted-foreground mt-1">Monitor and manage security cameras across all homes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-2" />Refresh
          </Button>
          <AddCameraDialog homes={homes} onSuccess={refresh} />
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Cameras</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Camera className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Online</p>
                  <p className="text-2xl font-bold text-green-600">{stats.online}</p>
                </div>
                <Wifi className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Offline</p>
                  <p className="text-2xl font-bold text-red-600">{stats.offline}</p>
                </div>
                <WifiOff className="h-8 w-8 text-red-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Maintenance</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.maintenance}</p>
                </div>
                <Wrench className="h-8 w-8 text-amber-200" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {stats && stats.byHome.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cameras by Home</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {stats.byHome.map(h => (
                <div key={h.homeId} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{h.homeName}</p>
                    <p className="text-xs text-muted-foreground">{h.count} camera{h.count !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Circle className={`h-2 w-2 fill-current ${h.onlineCount === h.count ? "text-green-500" : h.onlineCount === 0 ? "text-red-500" : "text-amber-500"}`} />
                    <span className="text-sm">{h.onlineCount}/{h.count} online</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Select value={filterHome} onValueChange={setFilterHome}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by home" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Homes</SelectItem>
            {homes.map(h => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : cameras.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Camera className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-medium">No cameras registered</h3>
            <p className="text-sm text-muted-foreground mt-1">Add cameras to start monitoring your homes</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cameras.map(cam => (
            <CameraCard key={cam.id} camera={cam} onRefresh={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
