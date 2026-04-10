import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Car, Truck, Users, MapPin, Clock, Plus, UserCheck, Fuel, AlertTriangle, CheckCircle, ArrowRight, Accessibility } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;

function fetchApi(url: string, opts?: RequestInit) {
  return fetch(`${API}${url}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
    credentials: "include",
  }).then((r) => {
    if (!r.ok) throw new Error(`API error: ${r.status}`);
    return r.json();
  });
}

export default function TransportationPage() {
  const [tab, setTab] = useState("requests");
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [showNewVehicle, setShowNewVehicle] = useState(false);
  const [showNewDriver, setShowNewDriver] = useState(false);
  const [requestForm, setRequestForm] = useState({ patientId: "", transportType: "company", pickupTime: "", pickupLocation: "", dropoffLocation: "", driverId: "", vehicleId: "", priority: "normal", wheelchairRequired: false, specialNeeds: "", notes: "" });
  const [vehicleForm, setVehicleForm] = useState({ name: "", type: "sedan", make: "", model: "", licensePlate: "", capacity: "4", adaAccessible: false, homeId: "" });
  const [driverForm, setDriverForm] = useState({ staffId: "", licenseNumber: "", licenseState: "", licenseExpiry: "", licenseType: "standard", vehicleId: "", certifications: "" });
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: dashboard } = useQuery({ queryKey: ["transport-dashboard"], queryFn: () => fetchApi("/transportation/dashboard") });
  const { data: requests = [] } = useQuery({ queryKey: ["transport-requests"], queryFn: () => fetchApi("/transportation/requests") });
  const { data: todayRequests = [] } = useQuery({ queryKey: ["transport-today"], queryFn: () => fetchApi("/transportation/requests/today") });
  const { data: vehicles = [] } = useQuery({ queryKey: ["transport-vehicles"], queryFn: () => fetchApi("/transportation/vehicles") });
  const { data: drivers = [] } = useQuery({ queryKey: ["transport-drivers"], queryFn: () => fetchApi("/transportation/drivers") });
  const { data: patients = [] } = useQuery({ queryKey: ["patients"], queryFn: () => fetchApi("/patients") });
  const { data: staffList = [] } = useQuery({ queryKey: ["staff"], queryFn: () => fetchApi("/staff") });
  const { data: homes = [] } = useQuery({ queryKey: ["homes"], queryFn: () => fetchApi("/homes") });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["transport-dashboard"] });
    qc.invalidateQueries({ queryKey: ["transport-requests"] });
    qc.invalidateQueries({ queryKey: ["transport-today"] });
    qc.invalidateQueries({ queryKey: ["transport-vehicles"] });
    qc.invalidateQueries({ queryKey: ["transport-drivers"] });
  };

  const createRequest = useMutation({
    mutationFn: (data: any) => fetchApi("/transportation/requests", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { invalidateAll(); setShowNewRequest(false); toast({ title: "Transport request created" }); },
  });

  const createVehicle = useMutation({
    mutationFn: (data: any) => fetchApi("/transportation/vehicles", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { invalidateAll(); setShowNewVehicle(false); toast({ title: "Vehicle added" }); },
  });

  const createDriver = useMutation({
    mutationFn: (data: any) => fetchApi("/transportation/drivers", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { invalidateAll(); setShowNewDriver(false); toast({ title: "Driver registered" }); },
  });

  const updateRequest = useMutation({
    mutationFn: ({ id, ...data }: any) => fetchApi(`/transportation/requests/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { invalidateAll(); toast({ title: "Request updated" }); },
  });

  const dispatchRequest = useMutation({
    mutationFn: ({ id, ...data }: any) => fetchApi(`/transportation/requests/${id}/dispatch`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { invalidateAll(); toast({ title: "Driver dispatched" }); },
  });

  const getPatientName = (id: number) => { const p = patients.find((p: any) => p.id === id); return p ? `${p.firstName} ${p.lastName}` : `#${id}`; };

  const statusBadge = (status: string) => {
    const map: Record<string, { cls: string; icon: any }> = {
      requested: { cls: "bg-yellow-100 text-yellow-700", icon: Clock },
      assigned: { cls: "bg-blue-100 text-blue-700", icon: UserCheck },
      dispatched: { cls: "bg-purple-100 text-purple-700", icon: ArrowRight },
      in_transit: { cls: "bg-indigo-100 text-indigo-700", icon: Car },
      completed: { cls: "bg-green-100 text-green-700", icon: CheckCircle },
      cancelled: { cls: "bg-red-100 text-red-700", icon: AlertTriangle },
    };
    const s = map[status] || { cls: "bg-gray-100 text-gray-700", icon: Clock };
    const Icon = s.icon;
    return <Badge className={s.cls} variant="outline"><Icon className="h-3 w-3 mr-1" />{status.replace("_", " ")}</Badge>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Car className="h-7 w-7 text-primary" />
            Transportation & Fleet Management
          </h1>
          <p className="text-gray-500 mt-1">Schedule rides, manage vehicles, and dispatch drivers across all homes</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showNewRequest} onOpenChange={setShowNewRequest}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Request Ride</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Request Transportation</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Patient</label>
                    <Select value={requestForm.patientId} onValueChange={(v) => setRequestForm({ ...requestForm, patientId: v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Type</label>
                    <Select value={requestForm.transportType} onValueChange={(v) => setRequestForm({ ...requestForm, transportType: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company">Company Vehicle</SelectItem>
                        <SelectItem value="medicaid_nemt">Medicaid NEMT</SelectItem>
                        <SelectItem value="rideshare">Rideshare</SelectItem>
                        <SelectItem value="taxi">Taxi</SelectItem>
                        <SelectItem value="ambulance">Ambulance</SelectItem>
                        <SelectItem value="family">Family Transport</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Pickup Time</label>
                  <Input type="datetime-local" className="mt-1" value={requestForm.pickupTime} onChange={(e) => setRequestForm({ ...requestForm, pickupTime: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Pickup Location</label>
                  <Input className="mt-1" value={requestForm.pickupLocation} onChange={(e) => setRequestForm({ ...requestForm, pickupLocation: e.target.value })} placeholder="Group home address..." />
                </div>
                <div>
                  <label className="text-sm font-medium">Drop-off Location</label>
                  <Input className="mt-1" value={requestForm.dropoffLocation} onChange={(e) => setRequestForm({ ...requestForm, dropoffLocation: e.target.value })} placeholder="Doctor's office, clinic..." />
                </div>
                {requestForm.transportType === "company" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">Driver</label>
                      <Select value={requestForm.driverId} onValueChange={(v) => setRequestForm({ ...requestForm, driverId: v })}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>{drivers.filter((d: any) => d.status === "active").map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.staffName}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Vehicle</label>
                      <Select value={requestForm.vehicleId} onValueChange={(v) => setRequestForm({ ...requestForm, vehicleId: v })}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>{vehicles.filter((v: any) => v.status === "available").map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.name} ({v.licensePlate})</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Priority</label>
                    <Select value={requestForm.priority} onValueChange={(v) => setRequestForm({ ...requestForm, priority: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2 pb-1">
                    <input type="checkbox" id="wheelchair" checked={requestForm.wheelchairRequired} onChange={(e) => setRequestForm({ ...requestForm, wheelchairRequired: e.target.checked })} />
                    <label htmlFor="wheelchair" className="text-sm font-medium">Wheelchair Accessible</label>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Special Needs / Notes</label>
                  <Textarea className="mt-1" value={requestForm.notes} onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })} placeholder="Oxygen tank, behavioral escort, etc." rows={2} />
                </div>
                <Button
                  onClick={() => createRequest.mutate({
                    patientId: Number(requestForm.patientId), transportType: requestForm.transportType,
                    pickupTime: requestForm.pickupTime, pickupLocation: requestForm.pickupLocation,
                    dropoffLocation: requestForm.dropoffLocation,
                    driverId: requestForm.driverId ? Number(requestForm.driverId) : undefined,
                    vehicleId: requestForm.vehicleId ? Number(requestForm.vehicleId) : undefined,
                    priority: requestForm.priority, wheelchairRequired: requestForm.wheelchairRequired,
                    notes: requestForm.notes || undefined,
                  })}
                  disabled={!requestForm.patientId || !requestForm.pickupTime || !requestForm.pickupLocation || !requestForm.dropoffLocation}
                  className="w-full"
                >Request Transportation</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><Car className="h-5 w-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{dashboard?.availableVehicles || 0}</p><p className="text-xs text-gray-500">Available Vehicles</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center"><UserCheck className="h-5 w-5 text-green-600" /></div><div><p className="text-2xl font-bold">{dashboard?.activeDrivers || 0}</p><p className="text-xs text-gray-500">Active Drivers</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center"><MapPin className="h-5 w-5 text-purple-600" /></div><div><p className="text-2xl font-bold">{dashboard?.todayTrips || 0}</p><p className="text-xs text-gray-500">Today's Trips</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-yellow-600" /></div><div><p className="text-2xl font-bold">{dashboard?.pendingRequests || 0}</p><p className="text-xs text-gray-500">Pending</p></div></div></CardContent></Card>
      </div>

      <Card>
        <Tabs value={tab} onValueChange={setTab}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="requests">Ride Requests</TabsTrigger>
                <TabsTrigger value="today">Today's Schedule</TabsTrigger>
                <TabsTrigger value="vehicles">Fleet ({vehicles.length})</TabsTrigger>
                <TabsTrigger value="drivers">Drivers ({drivers.length})</TabsTrigger>
              </TabsList>
              <div className="flex gap-2">
                {tab === "vehicles" && (
                  <Dialog open={showNewVehicle} onOpenChange={setShowNewVehicle}>
                    <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" /> Add Vehicle</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add Vehicle</DialogTitle></DialogHeader>
                      <div className="space-y-3 mt-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-sm font-medium">Name</label><Input className="mt-1" value={vehicleForm.name} onChange={(e) => setVehicleForm({ ...vehicleForm, name: e.target.value })} placeholder="Van #1" /></div>
                          <div><label className="text-sm font-medium">Type</label>
                            <Select value={vehicleForm.type} onValueChange={(v) => setVehicleForm({ ...vehicleForm, type: v })}>
                              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sedan">Sedan</SelectItem>
                                <SelectItem value="suv">SUV</SelectItem>
                                <SelectItem value="van">Van</SelectItem>
                                <SelectItem value="minibus">Minibus</SelectItem>
                                <SelectItem value="wheelchair_van">Wheelchair Van</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-sm font-medium">Make</label><Input className="mt-1" value={vehicleForm.make} onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })} placeholder="Toyota" /></div>
                          <div><label className="text-sm font-medium">Model</label><Input className="mt-1" value={vehicleForm.model} onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })} placeholder="Sienna" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-sm font-medium">License Plate</label><Input className="mt-1" value={vehicleForm.licensePlate} onChange={(e) => setVehicleForm({ ...vehicleForm, licensePlate: e.target.value })} /></div>
                          <div><label className="text-sm font-medium">Capacity</label><Input type="number" className="mt-1" value={vehicleForm.capacity} onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: e.target.value })} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-sm font-medium">Assigned Home</label>
                            <Select value={vehicleForm.homeId} onValueChange={(v) => setVehicleForm({ ...vehicleForm, homeId: v })}>
                              <SelectTrigger className="mt-1"><SelectValue placeholder="Any home..." /></SelectTrigger>
                              <SelectContent>{homes.map((h: any) => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end gap-2 pb-1">
                            <input type="checkbox" id="ada" checked={vehicleForm.adaAccessible} onChange={(e) => setVehicleForm({ ...vehicleForm, adaAccessible: e.target.checked })} />
                            <label htmlFor="ada" className="text-sm font-medium">ADA Accessible</label>
                          </div>
                        </div>
                        <Button onClick={() => createVehicle.mutate({ name: vehicleForm.name, type: vehicleForm.type, make: vehicleForm.make || undefined, model: vehicleForm.model || undefined, licensePlate: vehicleForm.licensePlate, capacity: Number(vehicleForm.capacity), adaAccessible: vehicleForm.adaAccessible, homeId: vehicleForm.homeId ? Number(vehicleForm.homeId) : undefined })} disabled={!vehicleForm.name || !vehicleForm.licensePlate} className="w-full">Add Vehicle</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                {tab === "drivers" && (
                  <Dialog open={showNewDriver} onOpenChange={setShowNewDriver}>
                    <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" /> Register Driver</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Register Driver</DialogTitle></DialogHeader>
                      <div className="space-y-3 mt-4">
                        <div><label className="text-sm font-medium">Staff Member</label>
                          <Select value={driverForm.staffId} onValueChange={(v) => setDriverForm({ ...driverForm, staffId: v })}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                            <SelectContent>{staffList.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-sm font-medium">License #</label><Input className="mt-1" value={driverForm.licenseNumber} onChange={(e) => setDriverForm({ ...driverForm, licenseNumber: e.target.value })} /></div>
                          <div><label className="text-sm font-medium">License State</label><Input className="mt-1" value={driverForm.licenseState} onChange={(e) => setDriverForm({ ...driverForm, licenseState: e.target.value })} placeholder="MA" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-sm font-medium">Expiry</label><Input type="date" className="mt-1" value={driverForm.licenseExpiry} onChange={(e) => setDriverForm({ ...driverForm, licenseExpiry: e.target.value })} /></div>
                          <div><label className="text-sm font-medium">Assigned Vehicle</label>
                            <Select value={driverForm.vehicleId} onValueChange={(v) => setDriverForm({ ...driverForm, vehicleId: v })}>
                              <SelectTrigger className="mt-1"><SelectValue placeholder="Optional..." /></SelectTrigger>
                              <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.name} ({v.licensePlate})</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div><label className="text-sm font-medium">Certifications</label><Input className="mt-1" value={driverForm.certifications} onChange={(e) => setDriverForm({ ...driverForm, certifications: e.target.value })} placeholder="CPR, First Aid, Defensive Driving..." /></div>
                        <Button onClick={() => createDriver.mutate({ staffId: Number(driverForm.staffId), licenseNumber: driverForm.licenseNumber, licenseState: driverForm.licenseState || undefined, licenseExpiry: driverForm.licenseExpiry, vehicleId: driverForm.vehicleId ? Number(driverForm.vehicleId) : undefined, certifications: driverForm.certifications || undefined })} disabled={!driverForm.staffId || !driverForm.licenseNumber || !driverForm.licenseExpiry} className="w-full">Register Driver</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TabsContent value="requests" className="mt-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Patient</TableHead><TableHead>Type</TableHead><TableHead>Pickup</TableHead><TableHead>From / To</TableHead><TableHead>Driver</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {requests.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No transport requests yet</TableCell></TableRow>
                  ) : requests.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{getPatientName(r.patientId)}</TableCell>
                      <TableCell><Badge variant="outline">{r.transportType === "company" ? "Company" : r.transportType === "medicaid_nemt" ? "Medicaid" : r.transportType}</Badge>{r.wheelchairRequired && <Accessibility className="h-3 w-3 text-blue-500 inline ml-1" />}</TableCell>
                      <TableCell><div className="text-sm">{new Date(r.pickupTime).toLocaleDateString()}</div><div className="text-xs text-gray-500">{new Date(r.pickupTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div></TableCell>
                      <TableCell><div className="text-sm"><MapPin className="h-3 w-3 inline text-green-500 mr-1" />{r.pickupLocation}</div><div className="text-sm"><MapPin className="h-3 w-3 inline text-red-500 mr-1" />{r.dropoffLocation}</div></TableCell>
                      <TableCell>{r.driverId ? <span className="text-sm">{drivers.find((d: any) => d.id === r.driverId)?.staffName || "Assigned"}</span> : <span className="text-gray-400">Unassigned</span>}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {r.status === "requested" && <Button size="sm" variant="outline" onClick={() => { const firstDriver = drivers.find((d: any) => d.status === "active"); if (firstDriver) dispatchRequest.mutate({ id: r.id, driverId: firstDriver.id }); }}>Dispatch</Button>}
                          {(r.status === "dispatched" || r.status === "in_transit") && <Button size="sm" variant="outline" onClick={() => updateRequest.mutate({ id: r.id, status: "completed" })}>Complete</Button>}
                          {r.status !== "completed" && r.status !== "cancelled" && <Button size="sm" variant="ghost" onClick={() => updateRequest.mutate({ id: r.id, status: "cancelled" })}>Cancel</Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="today" className="mt-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Time</TableHead><TableHead>Patient</TableHead><TableHead>From / To</TableHead><TableHead>Driver</TableHead><TableHead>Vehicle</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {todayRequests.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No trips scheduled for today</TableCell></TableRow>
                  ) : todayRequests.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{new Date(r.pickupTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</TableCell>
                      <TableCell>{getPatientName(r.patientId)}</TableCell>
                      <TableCell><span className="text-sm">{r.pickupLocation} → {r.dropoffLocation}</span></TableCell>
                      <TableCell>{r.driverId ? drivers.find((d: any) => d.id === r.driverId)?.staffName || "Assigned" : "—"}</TableCell>
                      <TableCell>{r.vehicleId ? vehicles.find((v: any) => v.id === r.vehicleId)?.name || `#${r.vehicleId}` : "—"}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="vehicles" className="mt-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Vehicle</TableHead><TableHead>Type</TableHead><TableHead>License Plate</TableHead><TableHead>Capacity</TableHead><TableHead>ADA</TableHead><TableHead>Home</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {vehicles.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No vehicles registered. Add your fleet above.</TableCell></TableRow>
                  ) : vehicles.map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.name}{v.make && ` (${v.make} ${v.model || ""})`}</TableCell>
                      <TableCell><Badge variant="outline">{v.type}</Badge></TableCell>
                      <TableCell className="font-mono">{v.licensePlate}</TableCell>
                      <TableCell>{v.capacity} seats</TableCell>
                      <TableCell>{v.adaAccessible ? <Badge className="bg-blue-100 text-blue-700"><Accessibility className="h-3 w-3 mr-1" />Yes</Badge> : "No"}</TableCell>
                      <TableCell>{v.homeId ? homes.find((h: any) => h.id === v.homeId)?.name || `#${v.homeId}` : "All"}</TableCell>
                      <TableCell><Badge className={v.status === "available" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"} variant="outline">{v.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="drivers" className="mt-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Driver</TableHead><TableHead>Role</TableHead><TableHead>License</TableHead><TableHead>Expires</TableHead><TableHead>Vehicle</TableHead><TableHead>Certifications</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {drivers.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No drivers registered. Add drivers above.</TableCell></TableRow>
                  ) : drivers.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.staffName}</TableCell>
                      <TableCell><Badge variant="outline">{d.staffRole}</Badge></TableCell>
                      <TableCell className="font-mono">{d.licenseNumber}{d.licenseState ? ` (${d.licenseState})` : ""}</TableCell>
                      <TableCell>{new Date(d.licenseExpiry).toLocaleDateString()}{new Date(d.licenseExpiry) < new Date() && <Badge variant="destructive" className="ml-1 text-xs">Expired</Badge>}</TableCell>
                      <TableCell>{d.vehicle ? `${d.vehicle.name} (${d.vehicle.licensePlate})` : "—"}</TableCell>
                      <TableCell className="text-sm">{d.certifications || "—"}</TableCell>
                      <TableCell><Badge className={d.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"} variant="outline">{d.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
