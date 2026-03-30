import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import BackToHome from "@/components/BackToHome";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Ride, DriverProfile, PatientAccount, IncidentReport, ItTechComplaint } from "@shared/schema";
import {
  Car, Users, AlertTriangle, DollarSign, Activity,
  Ban, CheckCircle, XCircle, Eye, Clock, Phone, Mail,
  MapPin, Calendar, ChevronLeft, Shield, FileText, RotateCcw
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
  const [refundAmount, setRefundAmount] = useState<string>("");
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

  const { data: allComplaints = [] } = useQuery<any[]>({
    queryKey: ["/api/it/admin/complaints"],
  });

  const { data: allItTechs = [] } = useQuery<any[]>({
    queryKey: ["/api/it/admin/techs"],
  });

  const { data: disputedTickets = [], isLoading: disputesLoading } = useQuery<any[]>({
    queryKey: ["/api/it/admin/disputed-tickets"],
  });

  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [complaintReviewStatus, setComplaintReviewStatus] = useState("");
  const [complaintAdminNotes, setComplaintAdminNotes] = useState("");
  const [enforcementDialogOpen, setEnforcementDialogOpen] = useState(false);
  const [selectedTechForAction, setSelectedTechForAction] = useState<any>(null);
  const [enforcementAction, setEnforcementAction] = useState("");
  const [enforcementReason, setEnforcementReason] = useState("");
  const [suspendDays, setSuspendDays] = useState("");
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [mediationResolution, setMediationResolution] = useState("");
  const [mediationNotes, setMediationNotes] = useState("");

  const mediateMutation = useMutation({
    mutationFn: async ({ ticketId, resolution, notes }: { ticketId: string; resolution: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/it/admin/tickets/${ticketId}/mediate`, { resolution, notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/admin/disputed-tickets"] });
      toast({ title: "Dispute resolved" });
      setSelectedDispute(null);
      setMediationResolution("");
      setMediationNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const reviewComplaintMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status: string; adminNotes: string }) => {
      const response = await apiRequest("POST", `/api/it/admin/complaints/${id}/review`, { status, adminNotes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/admin/complaints"] });
      toast({ title: "Complaint reviewed" });
      setSelectedComplaint(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const enforceTechMutation = useMutation({
    mutationFn: async ({ techId, action, reason, suspendDays, notes }: { techId: string; action: string; reason: string; suspendDays?: string; notes?: string }) => {
      const response = await apiRequest("POST", `/api/it/admin/techs/${techId}/enforce`, { action, reason, suspendDays, notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/it/admin/techs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/it/admin/complaints"] });
      toast({ title: "Enforcement action applied" });
      setEnforcementDialogOpen(false);
      setSelectedTechForAction(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
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

  const approveDriverMutation = useMutation({
    mutationFn: async ({ driverId }: { driverId: number }) => {
      const response = await apiRequest("POST", `/api/drivers/${driverId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setActionDialogOpen(false);
      toast({ title: "Driver approved successfully" });
    },
  });

  const rejectDriverMutation = useMutation({
    mutationFn: async ({ driverId, reason }: { driverId: number; reason?: string }) => {
      const response = await apiRequest("POST", `/api/drivers/${driverId}/reject`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setActionDialogOpen(false);
      setActionReason("");
      toast({ title: "Driver rejected" });
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

  const refundRideMutation = useMutation({
    mutationFn: async ({ rideId, reason, refundAmount }: { rideId: number; reason: string; refundAmount?: string }) => {
      const body: { reason: string; refundAmount?: number } = { reason };
      if (refundAmount && parseFloat(refundAmount) > 0) {
        body.refundAmount = parseFloat(refundAmount);
      }
      const response = await apiRequest("POST", `/api/admin/rides/${rideId}/refund`, body);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setActionDialogOpen(false);
      setActionReason("");
      setRefundAmount("");
      toast({ 
        title: "Refund processed", 
        description: `$${data.refundAmount} refunded to customer's card`
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Refund failed", 
        description: error.message,
        variant: "destructive"
      });
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
    if (actionType === "approve_driver" && selectedDriver) {
      approveDriverMutation.mutate({ driverId: selectedDriver.id });
    } else if (actionType === "reject_driver" && selectedDriver) {
      rejectDriverMutation.mutate({ driverId: selectedDriver.id, reason: actionReason });
    } else if (actionType === "suspend_driver" && selectedDriver) {
      updateDriverStatusMutation.mutate({ driverId: selectedDriver.id, status: "suspended", reason: actionReason });
    } else if (actionType === "unsuspend_driver" && selectedDriver) {
      updateDriverStatusMutation.mutate({ driverId: selectedDriver.id, status: "active" });
    } else if (actionType === "block_patient" && selectedPatient) {
      updatePatientStatusMutation.mutate({ phone: selectedPatient.patientPhone, status: "blocked", reason: actionReason });
    } else if (actionType === "unblock_patient" && selectedPatient) {
      updatePatientStatusMutation.mutate({ phone: selectedPatient.patientPhone, status: "good_standing" });
    } else if (actionType === "cancel_ride" && selectedRide) {
      cancelRideMutation.mutate({ rideId: selectedRide.id, reason: actionReason });
    } else if (actionType === "refund_ride" && selectedRide) {
      refundRideMutation.mutate({ rideId: selectedRide.id, reason: actionReason, refundAmount: refundAmount || undefined });
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
      <div className="mb-4">
        <BackToHome />
      </div>
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
          <TabsTrigger value="it-complaints" data-testid="tab-it-complaints">
            IT Complaints ({allComplaints.length})
          </TabsTrigger>
          <TabsTrigger value="it-disputes" data-testid="tab-it-disputes">
            Disputes {disputedTickets.filter((t: any) => t.mediationStatus === "requested").length > 0 ? `(${disputedTickets.filter((t: any) => t.mediationStatus === "requested").length})` : ""}
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
                          {ride.status === "completed" && ride.stripePaymentIntentId && ride.paymentStatus !== "refunded" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRide(ride);
                                setActionType("refund_ride");
                                setRefundAmount("");
                                setActionDialogOpen(true);
                              }}
                              data-testid={`button-refund-ride-${ride.id}`}
                            >
                              <RotateCcw className="w-4 h-4" />
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
                          {driver.applicationStatus === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => {
                                  setSelectedDriver(driver);
                                  setActionType("approve_driver");
                                  setActionDialogOpen(true);
                                }}
                                data-testid={`button-approve-driver-${driver.id}`}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedDriver(driver);
                                  setActionType("reject_driver");
                                  setActionDialogOpen(true);
                                }}
                                data-testid={`button-reject-driver-${driver.id}`}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
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

        {/* IT Complaints Tab */}
        <TabsContent value="it-complaints">
          <Card>
            <CardHeader>
              <CardTitle>IT Tech Complaints</CardTitle>
              <CardDescription>Review and manage complaints filed against IT technicians</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Tech</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allComplaints.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No complaints filed yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    allComplaints.map((complaint: any) => (
                      <TableRow key={complaint.id} data-testid={`row-complaint-${complaint.id}`}>
                        <TableCell className="text-xs">
                          {complaint.createdAt ? format(new Date(complaint.createdAt), "MMM d, yyyy") : "N/A"}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{complaint.techName}</div>
                          <Badge variant="outline" className="text-xs mt-1">
                            {complaint.techAccountStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {complaint.category?.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {complaint.reason}
                        </TableCell>
                        <TableCell className="text-sm">{complaint.reporterName}</TableCell>
                        <TableCell>
                          <Badge variant={
                            complaint.status === "pending" ? "default" :
                            complaint.status === "verified" ? "destructive" :
                            complaint.status === "dismissed" ? "secondary" : "outline"
                          } className="text-xs">
                            {complaint.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedComplaint(complaint);
                                setComplaintReviewStatus("");
                                setComplaintAdminNotes("");
                              }}
                              data-testid={`button-review-complaint-${complaint.id}`}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            {complaint.techProfileId && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  const tech = allItTechs.find((t: any) => t.id === complaint.techProfileId);
                                  if (tech) {
                                    setSelectedTechForAction(tech);
                                    setEnforcementAction("");
                                    setEnforcementReason(complaint.reason || "");
                                    setEnforcementDialogOpen(true);
                                  }
                                }}
                                data-testid={`button-enforce-tech-${complaint.id}`}
                              >
                                <Ban className="h-3 w-3" />
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

        <TabsContent value="it-disputes">
          <Card>
            <CardHeader>
              <CardTitle>IT Ticket Disputes & Mediation</CardTitle>
              <CardDescription>Review and resolve disputes between companies and technicians</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Tech</TableHead>
                    <TableHead>Dispute Reason</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Mediation</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disputesLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Loading disputes...
                      </TableCell>
                    </TableRow>
                  ) : disputedTickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No disputed tickets
                      </TableCell>
                    </TableRow>
                  ) : (
                    disputedTickets.map((ticket: any) => (
                      <TableRow key={ticket.id} data-testid={`row-dispute-${ticket.id}`}>
                        <TableCell>
                          <div className="font-medium text-sm">{ticket.ticketNumber}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[150px]">{ticket.title}</div>
                        </TableCell>
                        <TableCell className="text-sm">{ticket.companyName || "N/A"}</TableCell>
                        <TableCell className="text-sm">{ticket.techName || "N/A"}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {ticket.disputeReason || "No reason given"}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          ${Number(ticket.totalPay || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            ticket.mediationStatus === "requested" ? "default" :
                            ticket.mediationStatus === "resolved" ? "secondary" : "outline"
                          } className="text-xs">
                            {ticket.mediationStatus === "requested" ? "Pending" :
                             ticket.mediationStatus === "resolved" ? "Resolved" : "Not Requested"}
                          </Badge>
                          {ticket.mediationResolution && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {ticket.mediationResolution.replace("_", " ")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {ticket.mediationStatus !== "resolved" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedDispute(ticket);
                                setMediationResolution("");
                                setMediationNotes("");
                              }}
                              data-testid={`button-mediate-${ticket.id}`}
                            >
                              <Shield className="h-3 w-3 mr-1" /> Mediate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedDispute(ticket)}
                              data-testid={`button-view-dispute-${ticket.id}`}
                            >
                              <Eye className="h-3 w-3 mr-1" /> View
                            </Button>
                          )}
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

      {/* Dispute Mediation Dialog */}
      <Dialog open={!!selectedDispute} onOpenChange={(open) => !open && setSelectedDispute(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" /> Dispute Mediation
            </DialogTitle>
            <DialogDescription>
              Ticket: {selectedDispute?.ticketNumber} — {selectedDispute?.title}
            </DialogDescription>
          </DialogHeader>
          {selectedDispute && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Company</Label>
                  <p className="font-medium">{selectedDispute.companyName}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Tech</Label>
                  <p className="font-medium">{selectedDispute.techName}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Total Pay</Label>
                  <p className="font-medium">${Number(selectedDispute.totalPay || 0).toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Hours Worked</Label>
                  <p className="font-medium">{selectedDispute.hoursWorked ? `${Number(selectedDispute.hoursWorked).toFixed(1)}h` : "N/A"}</p>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Dispute Reason</Label>
                <p className="text-sm p-2 bg-red-50 dark:bg-red-950 rounded border">{selectedDispute.disputeReason || "No reason provided"}</p>
              </div>
              {selectedDispute.companyApprovalNotes && (
                <div>
                  <Label className="text-xs text-muted-foreground">Company Notes</Label>
                  <p className="text-sm">{selectedDispute.companyApprovalNotes}</p>
                </div>
              )}

              {selectedDispute.mediationStatus === "resolved" ? (
                <div className="space-y-2">
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border">
                    <p className="text-sm font-medium">Resolution: {selectedDispute.mediationResolution?.replace("_", " ")}</p>
                    {selectedDispute.mediationNotes && <p className="text-sm text-muted-foreground mt-1">{selectedDispute.mediationNotes}</p>}
                    {selectedDispute.mediationResolvedAt && <p className="text-xs text-muted-foreground mt-1">Resolved: {format(new Date(selectedDispute.mediationResolvedAt), "MMM d, yyyy h:mm a")}</p>}
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <Label>Resolution</Label>
                    <Select value={mediationResolution} onValueChange={setMediationResolution}>
                      <SelectTrigger data-testid="select-mediation-resolution">
                        <SelectValue placeholder="Select resolution" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="favor_tech">Favor Tech — Full payment to tech</SelectItem>
                        <SelectItem value="favor_company">Favor Company — Full refund</SelectItem>
                        <SelectItem value="split">Split — 50/50 payout</SelectItem>
                        <SelectItem value="cancel">Cancel — Void the ticket</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Admin Notes</Label>
                    <Textarea
                      value={mediationNotes}
                      onChange={(e) => setMediationNotes(e.target.value)}
                      placeholder="Explain the reasoning for this resolution..."
                      data-testid="input-mediation-notes"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => mediateMutation.mutate({
                        ticketId: selectedDispute.id,
                        resolution: mediationResolution,
                        notes: mediationNotes,
                      })}
                      disabled={!mediationResolution || mediateMutation.isPending}
                      data-testid="button-submit-mediation"
                    >
                      {mediateMutation.isPending ? "Resolving..." : "Resolve Dispute"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Complaint Review Dialog */}
      <Dialog open={!!selectedComplaint} onOpenChange={(open) => !open && setSelectedComplaint(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Complaint</DialogTitle>
            <DialogDescription>
              Filed against: {selectedComplaint?.techName} | Category: {selectedComplaint?.category?.replace("_", " ")}
            </DialogDescription>
          </DialogHeader>
          {selectedComplaint && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Reason</Label>
                <p className="text-sm font-medium">{selectedComplaint.reason}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <p className="text-sm">{selectedComplaint.description}</p>
              </div>
              {selectedComplaint.evidence && (
                <div>
                  <Label className="text-xs text-muted-foreground">Evidence</Label>
                  <p className="text-sm">{selectedComplaint.evidence}</p>
                </div>
              )}
              {selectedComplaint.ticketTitle && (
                <div>
                  <Label className="text-xs text-muted-foreground">Related Ticket</Label>
                  <p className="text-sm">{selectedComplaint.ticketTitle}</p>
                </div>
              )}
              <div>
                <Label>Review Decision</Label>
                <Select value={complaintReviewStatus} onValueChange={setComplaintReviewStatus}>
                  <SelectTrigger data-testid="select-complaint-review-status">
                    <SelectValue placeholder="Select decision" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verified">Verified - Complaint is valid</SelectItem>
                    <SelectItem value="dismissed">Dismissed - Not valid</SelectItem>
                    <SelectItem value="investigating">Investigating - Need more info</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Admin Notes</Label>
                <Textarea
                  value={complaintAdminNotes}
                  onChange={(e) => setComplaintAdminNotes(e.target.value)}
                  placeholder="Add notes about this review..."
                  data-testid="input-complaint-admin-notes"
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={() => reviewComplaintMutation.mutate({
                    id: selectedComplaint.id,
                    status: complaintReviewStatus,
                    adminNotes: complaintAdminNotes,
                  })}
                  disabled={!complaintReviewStatus || reviewComplaintMutation.isPending}
                  data-testid="button-submit-complaint-review"
                >
                  Submit Review
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tech Enforcement Dialog */}
      <Dialog open={enforcementDialogOpen} onOpenChange={setEnforcementDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Take Action Against Tech</DialogTitle>
            <DialogDescription>
              Tech: {selectedTechForAction?.fullName} | Current Status: {selectedTechForAction?.accountStatus || "active"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Action</Label>
              <Select value={enforcementAction} onValueChange={setEnforcementAction}>
                <SelectTrigger data-testid="select-enforcement-action">
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warn">Warn - Issue a warning</SelectItem>
                  <SelectItem value="suspend">Suspend - Temporarily block</SelectItem>
                  <SelectItem value="ban">Ban - Permanently deactivate</SelectItem>
                  <SelectItem value="reinstate">Reinstate - Restore to active</SelectItem>
                  <SelectItem value="remove_hold">Remove Hold - Clear auto-hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {enforcementAction === "suspend" && (
              <div>
                <Label>Suspension Duration (days, leave empty for indefinite)</Label>
                <Input
                  type="number"
                  value={suspendDays}
                  onChange={(e) => setSuspendDays(e.target.value)}
                  placeholder="e.g., 7"
                  data-testid="input-suspend-days"
                />
              </div>
            )}
            <div>
              <Label>Reason</Label>
              <Textarea
                value={enforcementReason}
                onChange={(e) => setEnforcementReason(e.target.value)}
                placeholder="Reason for this action..."
                data-testid="input-enforcement-reason"
              />
            </div>
            <DialogFooter>
              <Button
                variant={enforcementAction === "ban" ? "destructive" : "default"}
                onClick={() => enforceTechMutation.mutate({
                  techId: selectedTechForAction?.id,
                  action: enforcementAction,
                  reason: enforcementReason,
                  suspendDays: enforcementAction === "suspend" ? suspendDays : undefined,
                })}
                disabled={!enforcementAction || !enforcementReason || enforceTechMutation.isPending}
                data-testid="button-submit-enforcement"
              >
                {enforceTechMutation.isPending ? "Applying..." : `Apply ${enforcementAction?.replace("_", " ")}`}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve_driver" && "Approve Driver"}
              {actionType === "reject_driver" && "Reject Driver"}
              {actionType === "suspend_driver" && "Suspend Driver"}
              {actionType === "unsuspend_driver" && "Unsuspend Driver"}
              {actionType === "block_patient" && "Block Patient"}
              {actionType === "unblock_patient" && "Unblock Patient"}
              {actionType === "cancel_ride" && "Cancel Ride"}
              {actionType === "refund_ride" && "Refund Customer"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve_driver" && `Approve ${selectedDriver?.fullName} as a driver? They will be able to accept rides.`}
              {actionType === "reject_driver" && `Reject ${selectedDriver?.fullName}'s driver application?`}
              {actionType.includes("suspend") && `Are you sure you want to ${actionType.replace("_", " ")} ${selectedDriver?.fullName}?`}
              {actionType.includes("patient") && `Are you sure you want to ${actionType.replace("_", " ")} ${selectedPatient?.patientPhone}?`}
              {actionType === "cancel_ride" && `Are you sure you want to cancel ride #${selectedRide?.id}?`}
              {actionType === "refund_ride" && "Process refund for customer complaint or service issue."}
            </DialogDescription>
          </DialogHeader>
          {actionType === "refund_ride" && selectedRide && (
            <div className="bg-muted/50 rounded-md p-3 space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Ride ID:</span>
                  <span className="ml-2 font-medium" data-testid="text-refund-ride-id">#{selectedRide.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount Paid:</span>
                  <span className="ml-2 font-medium" data-testid="text-refund-amount-paid">${selectedRide.paidAmount || selectedRide.finalFare || "0"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="ml-2 font-medium" data-testid="text-refund-customer">{selectedRide.patientName || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="ml-2 font-medium" data-testid="text-refund-customer-phone">{selectedRide.patientPhone || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Driver ID:</span>
                  <span className="ml-2 font-medium" data-testid="text-refund-driver-id">{selectedRide.driverId ? `#${selectedRide.driverId}` : "Not assigned"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Date:</span>
                  <span className="ml-2 font-medium" data-testid="text-refund-date">{selectedRide.createdAt ? format(new Date(selectedRide.createdAt), "MMM d, yyyy") : "N/A"}</span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Route:</span>
                <span className="ml-2 text-xs" data-testid="text-refund-route">{selectedRide.pickupAddress} → {selectedRide.dropoffAddress}</span>
              </div>
            </div>
          )}
          {(actionType === "reject_driver" || actionType === "suspend_driver" || actionType === "block_patient" || actionType === "cancel_ride" || actionType === "refund_ride") && (
            <div className="py-4 space-y-4">
              <div>
                <Label htmlFor="reason">Reason {actionType === "refund_ride" && "(required)"}</Label>
                <Textarea
                  id="reason"
                  placeholder={actionType === "refund_ride" ? "Enter reason for refund (e.g., customer complaint, service issue)..." : "Enter reason for this action..."}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="mt-2"
                  data-testid="input-action-reason"
                />
              </div>
              {actionType === "refund_ride" && (
                <div>
                  <Label htmlFor="refundAmount">Refund Amount (leave empty for full refund)</Label>
                  <Input
                    id="refundAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={`Max: $${selectedRide?.paidAmount || selectedRide?.finalFare || "0"}`}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="mt-2"
                    data-testid="input-refund-amount"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    The refund will be sent back to the customer's original payment method.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={actionType === "approve_driver" || actionType.includes("unsuspend") || actionType.includes("unblock") || actionType === "refund_ride" ? "default" : "destructive"}
              onClick={handleAction}
              disabled={
                approveDriverMutation.isPending ||
                rejectDriverMutation.isPending ||
                updateDriverStatusMutation.isPending || 
                updatePatientStatusMutation.isPending || 
                cancelRideMutation.isPending || 
                refundRideMutation.isPending ||
                (actionType === "refund_ride" && !actionReason.trim())
              }
              data-testid="button-confirm-action"
            >
              {actionType === "refund_ride" ? "Process Refund" : "Confirm"}
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
