import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { format } from "date-fns";
import type { Ride, DriverProfile, PatientAccount, IncidentReport } from "@shared/schema";
import {
  Car, Users, AlertTriangle, DollarSign, Activity,
  Ban, CheckCircle, XCircle, Eye, Clock, Phone, Mail,
  MapPin, Calendar, ChevronLeft, Shield, FileText
} from "lucide-react";

interface AdminStats {
  totalRides: number;
  completedRides: number;
  activeRides: number;
  cancelledRides: number;
  totalDrivers: number;
  activeDrivers: number;
  pendingDrivers: number;
  suspendedDrivers: number;
  totalPatients: number;
  blockedPatients: number;
  totalRevenue: string;
  openIncidents: number;
  totalIncidents: number;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientAccount | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<string>("");
  const [actionReason, setActionReason] = useState("");
  const [rideStatusFilter, setRideStatusFilter] = useState<string>("all");

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: allRides = [], isLoading: ridesLoading } = useQuery<Ride[]>({
    queryKey: ["/api/admin/rides"],
  });

  const { data: allDrivers = [] } = useQuery<DriverProfile[]>({
    queryKey: ["/api/drivers/all"],
  });

  const { data: allPatients = [] } = useQuery<PatientAccount[]>({
    queryKey: ["/api/admin/patients"],
  });

  const { data: allIncidents = [] } = useQuery<IncidentReport[]>({
    queryKey: ["/api/admin/incidents"],
  });

  const updateDriverStatusMutation = useMutation({
    mutationFn: async ({ driverId, status, reason }: { driverId: number; status: string; reason?: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/drivers/${driverId}/status`, { status, reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setActionDialogOpen(false);
      setActionReason("");
      toast({ title: "Driver status updated" });
    },
  });

  const updatePatientStatusMutation = useMutation({
    mutationFn: async ({ phone, status, reason }: { phone: string; status: string; reason?: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/patients/${encodeURIComponent(phone)}/status`, { status, reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setActionDialogOpen(false);
      setActionReason("");
      toast({ title: "Patient status updated" });
    },
  });

  const cancelRideMutation = useMutation({
    mutationFn: async ({ rideId, reason }: { rideId: number; reason: string }) => {
      const response = await apiRequest("POST", `/api/admin/rides/${rideId}/cancel`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setActionDialogOpen(false);
      setActionReason("");
      toast({ title: "Ride cancelled" });
    },
  });

  const updateIncidentMutation = useMutation({
    mutationFn: async ({ incidentId, data }: { incidentId: number; data: Partial<IncidentReport> }) => {
      const response = await apiRequest("PATCH", `/api/admin/incidents/${incidentId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setSelectedIncident(null);
      toast({ title: "Incident updated" });
    },
  });

  const handleAction = () => {
    if (actionType === "suspend_driver" && selectedDriver) {
      updateDriverStatusMutation.mutate({ driverId: selectedDriver.id, status: "suspended", reason: actionReason });
    } else if (actionType === "unsuspend_driver" && selectedDriver) {
      updateDriverStatusMutation.mutate({ driverId: selectedDriver.id, status: "active" });
    } else if (actionType === "block_patient" && selectedPatient) {
      updatePatientStatusMutation.mutate({ phone: selectedPatient.patientPhone, status: "blocked", reason: actionReason });
    } else if (actionType === "unblock_patient" && selectedPatient) {
      updatePatientStatusMutation.mutate({ phone: selectedPatient.patientPhone, status: "good_standing" });
    } else if (actionType === "cancel_ride" && selectedRide) {
      cancelRideMutation.mutate({ rideId: selectedRide.id, reason: actionReason });
    }
  };

  const filteredRides = rideStatusFilter === "all" 
    ? allRides 
    : allRides.filter(r => r.status === rideStatusFilter);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      requested: "outline",
      accepted: "default",
      arrived: "default",
      in_progress: "default",
      completed: "secondary",
      cancelled: "destructive"
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getAccountStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      good_standing: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      restricted: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      suspended: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return <Badge className={colors[status] || ""}>{status.replace("_", " ")}</Badge>;
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage rides, drivers, patients, and incidents</p>
        </div>
        <Link href="/">
          <Button variant="outline" data-testid="button-back-home">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.activeRides || 0}</p>
                <p className="text-sm text-muted-foreground">Active Rides</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Car className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.activeDrivers || 0}</p>
                <p className="text-sm text-muted-foreground">Active Drivers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold">${stats?.totalRevenue || "0"}</p>
                <p className="text-sm text-muted-foreground">Platform Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.openIncidents || 0}</p>
                <p className="text-sm text-muted-foreground">Open Incidents</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rides" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rides" data-testid="tab-rides">
            Rides ({allRides.length})
          </TabsTrigger>
          <TabsTrigger value="drivers" data-testid="tab-drivers">
            Drivers ({allDrivers.length})
          </TabsTrigger>
          <TabsTrigger value="patients" data-testid="tab-patients">
            Patients ({allPatients.length})
          </TabsTrigger>
          <TabsTrigger value="incidents" data-testid="tab-incidents">
            Incidents ({allIncidents.length})
          </TabsTrigger>
        </TabsList>

        {/* Rides Tab */}
        <TabsContent value="rides">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle>All Rides</CardTitle>
                  <CardDescription>View and manage all ride requests</CardDescription>
                </div>
                <Select value={rideStatusFilter} onValueChange={setRideStatusFilter}>
                  <SelectTrigger className="w-40" data-testid="select-ride-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="requested">Requested</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="arrived">Arrived</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Pickup</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fare</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRides.slice(0, 50).map((ride) => (
                    <TableRow key={ride.id} data-testid={`row-ride-${ride.id}`}>
                      <TableCell className="font-mono">#{ride.id}</TableCell>
                      <TableCell>
                        <div className="font-medium">{ride.patientName}</div>
                        <div className="text-sm text-muted-foreground">{ride.patientPhone}</div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{ride.pickupAddress}</TableCell>
                      <TableCell>{getStatusBadge(ride.status)}</TableCell>
                      <TableCell>${ride.finalFare || ride.estimatedFare || "0"}</TableCell>
                      <TableCell>{ride.createdAt ? format(new Date(ride.createdAt), "MMM d, HH:mm") : "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/track/${ride.id}`}>
                            <Button size="sm" variant="outline" data-testid={`button-view-ride-${ride.id}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          {!["completed", "cancelled"].includes(ride.status) && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedRide(ride);
                                setActionType("cancel_ride");
                                setActionDialogOpen(true);
                              }}
                              data-testid={`button-cancel-ride-${ride.id}`}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Drivers Tab */}
        <TabsContent value="drivers">
          <Card>
            <CardHeader>
              <CardTitle>All Drivers</CardTitle>
              <CardDescription>Manage driver accounts and status</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>App Status</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allDrivers.map((driver) => (
                    <TableRow key={driver.id} data-testid={`row-driver-${driver.id}`}>
                      <TableCell>
                        <div className="font-medium">{driver.fullName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="w-3 h-3" />{driver.phone}
                          </span>
                          {driver.email && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="w-3 h-3" />{driver.email}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{driver.vehicleType}</div>
                        <div className="text-sm text-muted-foreground">{driver.vehiclePlate}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={driver.applicationStatus === "approved" ? "default" : "outline"}>
                          {driver.applicationStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getAccountStatusBadge(driver.accountStatus || "active")}
                      </TableCell>
                      <TableCell>
                        {driver.averageRating ? `${parseFloat(driver.averageRating).toFixed(1)} / 5` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {driver.accountStatus !== "suspended" ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedDriver(driver);
                                setActionType("suspend_driver");
                                setActionDialogOpen(true);
                              }}
                              data-testid={`button-suspend-driver-${driver.id}`}
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedDriver(driver);
                                setActionType("unsuspend_driver");
                                setActionDialogOpen(true);
                              }}
                              data-testid={`button-unsuspend-driver-${driver.id}`}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Patients Tab */}
        <TabsContent value="patients">
          <Card>
            <CardHeader>
              <CardTitle>Patient Accounts</CardTitle>
              <CardDescription>Manage patient accounts and restrictions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Rides</TableHead>
                    <TableHead>Cancellations</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allPatients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No patient accounts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    allPatients.map((patient) => (
                      <TableRow key={patient.id} data-testid={`row-patient-${patient.id}`}>
                        <TableCell className="font-mono">{patient.patientPhone}</TableCell>
                        <TableCell>{patient.patientName || "-"}</TableCell>
                        <TableCell>
                          {getAccountStatusBadge(patient.accountStatus || "good_standing")}
                        </TableCell>
                        <TableCell>${patient.outstandingBalance || "0"}</TableCell>
                        <TableCell>{patient.totalRidesCompleted || 0}</TableCell>
                        <TableCell>{patient.totalRidesCancelled || 0}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {patient.accountStatus !== "blocked" ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedPatient(patient);
                                  setActionType("block_patient");
                                  setActionDialogOpen(true);
                                }}
                                data-testid={`button-block-patient-${patient.id}`}
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedPatient(patient);
                                  setActionType("unblock_patient");
                                  setActionDialogOpen(true);
                                }}
                                data-testid={`button-unblock-patient-${patient.id}`}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Incidents Tab */}
        <TabsContent value="incidents">
          <Card>
            <CardHeader>
              <CardTitle>Incident Reports</CardTitle>
              <CardDescription>Review and resolve reported incidents</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Ride</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allIncidents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No incidents reported
                      </TableCell>
                    </TableRow>
                  ) : (
                    allIncidents.map((incident) => (
                      <TableRow key={incident.id} data-testid={`row-incident-${incident.id}`}>
                        <TableCell className="font-mono">#{incident.id}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{incident.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={incident.severity === "critical" || incident.severity === "high" ? "destructive" : "outline"}
                          >
                            {incident.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{incident.reporterName}</div>
                          <div className="text-sm text-muted-foreground">{incident.reporterType}</div>
                        </TableCell>
                        <TableCell>
                          {incident.rideId ? (
                            <Link href={`/track/${incident.rideId}`} className="text-blue-500 hover:underline font-medium">
                              #{incident.rideId}
                            </Link>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={incident.status === "open" ? "destructive" : incident.status === "resolved" ? "default" : "secondary"}
                          >
                            {incident.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {incident.createdAt ? format(new Date(incident.createdAt), "MMM d, HH:mm") : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedIncident(incident)}
                            data-testid={`button-view-incident-${incident.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "suspend_driver" && "Suspend Driver"}
              {actionType === "unsuspend_driver" && "Unsuspend Driver"}
              {actionType === "block_patient" && "Block Patient"}
              {actionType === "unblock_patient" && "Unblock Patient"}
              {actionType === "cancel_ride" && "Cancel Ride"}
            </DialogTitle>
            <DialogDescription>
              {actionType.includes("suspend") && `Are you sure you want to ${actionType.replace("_", " ")} ${selectedDriver?.fullName}?`}
              {actionType.includes("patient") && `Are you sure you want to ${actionType.replace("_", " ")} ${selectedPatient?.patientPhone}?`}
              {actionType === "cancel_ride" && `Are you sure you want to cancel ride #${selectedRide?.id}?`}
            </DialogDescription>
          </DialogHeader>
          {(actionType === "suspend_driver" || actionType === "block_patient" || actionType === "cancel_ride") && (
            <div className="py-4">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for this action..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="mt-2"
                data-testid="input-action-reason"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={actionType.includes("unsuspend") || actionType.includes("unblock") ? "default" : "destructive"}
              onClick={handleAction}
              disabled={updateDriverStatusMutation.isPending || updatePatientStatusMutation.isPending || cancelRideMutation.isPending}
              data-testid="button-confirm-action"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Incident Detail Dialog */}
      <Dialog open={!!selectedIncident} onOpenChange={(open) => !open && setSelectedIncident(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Incident #{selectedIncident?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedIncident && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="font-medium">{selectedIncident.category}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Severity</Label>
                  <p className="font-medium">{selectedIncident.severity}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Reporter</Label>
                  <p className="font-medium">{selectedIncident.reporterName} ({selectedIncident.reporterType})</p>
                  <p className="text-sm text-muted-foreground">{selectedIncident.reporterPhone}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Select
                    value={selectedIncident.status}
                    onValueChange={(value) => setSelectedIncident({ ...selectedIncident, status: value })}
                  >
                    <SelectTrigger data-testid="select-incident-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="investigating">Investigating</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p className="mt-1 p-3 bg-muted rounded-md">{selectedIncident.description}</p>
              </div>
              {selectedIncident.location && (
                <div>
                  <Label className="text-muted-foreground">Location</Label>
                  <p className="font-medium">{selectedIncident.location}</p>
                </div>
              )}
              {selectedIncident.evidenceUrls && selectedIncident.evidenceUrls.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Evidence ({selectedIncident.evidenceUrls.length} files)</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedIncident.evidenceUrls.map((url, i) => (
                      <a 
                        key={i} 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline text-sm"
                      >
                        View File {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="adminNotes">Admin Notes</Label>
                <Textarea
                  id="adminNotes"
                  value={selectedIncident.adminNotes || ""}
                  onChange={(e) => setSelectedIncident({ ...selectedIncident, adminNotes: e.target.value })}
                  placeholder="Add notes about this incident..."
                  className="mt-1"
                  data-testid="input-admin-notes"
                />
              </div>
              <div>
                <Label htmlFor="resolution">Resolution</Label>
                <Textarea
                  id="resolution"
                  value={selectedIncident.resolution || ""}
                  onChange={(e) => setSelectedIncident({ ...selectedIncident, resolution: e.target.value })}
                  placeholder="Describe how this was resolved..."
                  className="mt-1"
                  data-testid="input-resolution"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedIncident(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedIncident && updateIncidentMutation.mutate({
                incidentId: selectedIncident.id,
                data: {
                  status: selectedIncident.status,
                  adminNotes: selectedIncident.adminNotes,
                  resolution: selectedIncident.resolution
                }
              })}
              disabled={updateIncidentMutation.isPending}
              data-testid="button-save-incident"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
