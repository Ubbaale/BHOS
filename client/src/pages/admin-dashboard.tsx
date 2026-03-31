import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Ride, DriverProfile, PatientAccount, IncidentReport, ItTechComplaint } from "@shared/schema";
import { ADMIN_PERMISSIONS, PERMISSION_PRESETS } from "@shared/schema";
import {
  Car, Users, AlertTriangle, DollarSign, Activity,
  Ban, CheckCircle, XCircle, Eye, Clock, Phone, Mail,
  MapPin, Calendar, ChevronLeft, Shield, FileText, RotateCcw,
  UserPlus, TrendingUp, CreditCard, Unlock, BarChart3,
  LayoutDashboard, Navigation, Headphones, Settings, Monitor,
  Menu, X, LogOut, Home, ChevronRight, Package, Thermometer
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

interface EarningsData {
  totalRevenue: string;
  totalFares: string;
  totalDriverPayouts: string;
  totalTips: string;
  totalTolls: string;
  totalCancellationFees: string;
  totalRefunds: string;
  completedRides: number;
  cancelledRides: number;
  totalRides: number;
  averageFare: string;
  ridesByMonth: Record<string, { rides: number; revenue: number; fares: number; driverPayouts: number }>;
  paymentStatusBreakdown: { pending: number; paid: number; failed: number; refunded: number };
}

interface AdminUser {
  id: string;
  username: string;
  role: string;
  emailVerified: boolean;
  tosAcceptedAt: string | null;
  tosVersion: string | null;
  privacyPolicyAcceptedAt: string | null;
  permissions: string[] | null;
}

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { key: "rides", label: "Rides", icon: Navigation, permission: "rides" },
  { key: "drivers", label: "Drivers", icon: Car, permission: "drivers" },
  { key: "patients", label: "Patients", icon: Users, permission: "patients" },
  { key: "earnings", label: "Earnings", icon: TrendingUp, permission: "earnings" },
  { key: "accounts", label: "Accounts", icon: Shield, permission: "accounts" },
  { key: "driver-complaints", label: "Driver Reports", icon: AlertTriangle, permission: "drivers" },
  { key: "incidents", label: "Incidents", icon: AlertTriangle, permission: "incidents" },
  { key: "it-complaints", label: "IT Services", icon: Monitor, permission: "it_services" },
  { key: "courier", label: "Courier", icon: Package, permission: "dispatch" },
] as const;

export default function AdminDashboard() {
  const { toast } = useToast();
  const { user: authUser, logout } = useAuth();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientAccount | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<string>("");
  const [actionReason, setActionReason] = useState("");
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [rideStatusFilter, setRideStatusFilter] = useState<string>("all");
  const [driverDetailOpen, setDriverDetailOpen] = useState(false);
  const [detailDriver, setDetailDriver] = useState<DriverProfile | null>(null);
  const [rideDetailOpen, setRideDetailOpen] = useState(false);
  const [detailRide, setDetailRide] = useState<Ride | null>(null);
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [newAccountEmail, setNewAccountEmail] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountPassword, setNewAccountPassword] = useState("");
  const [newAccountRole, setNewAccountRole] = useState("user");
  const [newAccountPreset, setNewAccountPreset] = useState("full_admin");
  const [newAccountPermissions, setNewAccountPermissions] = useState<string[]>([...ADMIN_PERMISSIONS]);
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [editPermissionsUser, setEditPermissionsUser] = useState<AdminUser | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  const userPermissions = authUser?.permissions || [];
  const hasPermission = (perm: string) => {
    if (!userPermissions.length) return true;
    return userPermissions.includes(perm);
  };
  const visibleNavItems = NAV_ITEMS.filter(item => hasPermission(item.permission));

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

  const { data: driverComplaints = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/driver-complaints"],
  });

  const { data: allItTechs = [] } = useQuery<any[]>({
    queryKey: ["/api/it/admin/techs"],
  });

  const { data: earnings } = useQuery<EarningsData>({
    queryKey: ["/api/admin/earnings"],
  });

  const { data: allUsers = [] } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const createAccountMutation = useMutation({
    mutationFn: async (data: { email: string; fullName: string; password: string; role: string; permissions?: string[] }) => {
      const response = await apiRequest("POST", "/api/admin/create-account", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setCreateAccountOpen(false);
      setNewAccountEmail("");
      setNewAccountName("");
      setNewAccountPassword("");
      setNewAccountRole("user");
      setNewAccountPreset("full_admin");
      setNewAccountPermissions([...ADMIN_PERMISSIONS]);
      toast({ title: "Account created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error creating account", description: error.message, variant: "destructive" });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: string[] }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${userId}/permissions`, { permissions });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditPermissionsUser(null);
      toast({ title: "Permissions updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${userId}/verify-email`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Email verified" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [complaintReviewStatus, setComplaintReviewStatus] = useState("");
  const [complaintAdminNotes, setComplaintAdminNotes] = useState("");
  const [enforcementDialogOpen, setEnforcementDialogOpen] = useState(false);
  const [selectedTechForAction, setSelectedTechForAction] = useState<any>(null);
  const [enforcementAction, setEnforcementAction] = useState("");
  const [enforcementReason, setEnforcementReason] = useState("");
  const [suspendDays, setSuspendDays] = useState("");

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
    onError: (error: any) => {
      toast({ title: "Error approving driver", description: error.message, variant: "destructive" });
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
    onError: (error: any) => {
      toast({ title: "Error rejecting driver", description: error.message, variant: "destructive" });
    },
  });

  const reviewDriverComplaintMutation = useMutation({
    mutationFn: async ({ complaintId, status, adminNotes, adminAction }: { complaintId: string; status: string; adminNotes?: string; adminAction?: string }) => {
      const response = await apiRequest("POST", `/api/admin/driver-complaints/${complaintId}/review`, { status, adminNotes, adminAction });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/driver-complaints"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/all"] });
      toast({ title: "Complaint reviewed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const enforceDriverMutation = useMutation({
    mutationFn: async ({ driverId, action, reason, suspendDays, notes }: { driverId: number; action: string; reason: string; suspendDays?: number; notes?: string }) => {
      const response = await apiRequest("POST", `/api/admin/drivers/${driverId}/enforce`, { action, reason, suspendDays, notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/driver-complaints"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setActionDialogOpen(false);
      setActionReason("");
      toast({ title: "Driver enforcement action applied" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
    } else if (actionType === "enforce_suspend_driver" && selectedDriver) {
      enforceDriverMutation.mutate({ driverId: selectedDriver.id, action: "suspend", reason: actionReason });
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

  const permissionLabels: Record<string, string> = {
    dashboard: "Dashboard Overview",
    rides: "Ride Management",
    drivers: "Driver Management",
    patients: "Patient Management",
    earnings: "Earnings & Finance",
    accounts: "Account Management",
    incidents: "Incident Reports",
    it_services: "IT Services",
    dispatch: "Dispatch View",
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out flex flex-col ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">CareHub Admin</h2>
              <p className="text-xs text-muted-foreground truncate max-w-[140px]">{authUser?.username}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(false)} data-testid="button-close-sidebar">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.key;
            let count: number | undefined;
            if (item.key === "rides") count = allRides.length;
            if (item.key === "drivers") count = allDrivers.length;
            if (item.key === "patients") count = allPatients.length;
            if (item.key === "accounts") count = allUsers.length;
            if (item.key === "incidents") count = allIncidents.length;
            if (item.key === "it-complaints") count = allComplaints.length;
            return (
              <button
                key={item.key}
                onClick={() => { setActiveSection(item.key); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
                data-testid={`nav-${item.key}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {count !== undefined && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-2 border-t space-y-1">
          <Link href="/">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors" data-testid="nav-home">
              <Home className="w-4 h-4" />
              <span>Back to Home</span>
            </button>
          </Link>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            data-testid="nav-logout"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b bg-card flex items-center px-4 gap-3 flex-shrink-0">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)} data-testid="button-open-sidebar">
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold" data-testid="text-section-title">
            {NAV_ITEMS.find(i => i.key === activeSection)?.label || "Dashboard"}
          </h1>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {activeSection === "dashboard" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {hasPermission("rides") && (
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveSection("rides")}>
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
                )}
                {hasPermission("drivers") && (
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveSection("drivers")}>
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
                )}
                {hasPermission("earnings") && (
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveSection("earnings")}>
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
                )}
                {hasPermission("incidents") && (
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveSection("incidents")}>
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
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Total Rides</p>
                    <p className="text-3xl font-bold">{stats?.totalRides || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stats?.completedRides || 0} completed, {stats?.cancelledRides || 0} cancelled</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Total Drivers</p>
                    <p className="text-3xl font-bold">{stats?.totalDrivers || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stats?.pendingDrivers || 0} pending review</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Total Patients</p>
                    <p className="text-3xl font-bold">{stats?.totalPatients || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stats?.blockedPatients || 0} blocked</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeSection === "rides" && hasPermission("rides") && (
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setDetailRide(ride); setRideDetailOpen(true); }}
                            data-testid={`button-detail-ride-${ride.id}`}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Link href={`/track/${ride.id}`}>
                            <Button size="sm" variant="outline" data-testid={`button-view-ride-${ride.id}`}>
                              <MapPin className="w-4 h-4" />
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
          )}

          {activeSection === "drivers" && hasPermission("drivers") && (
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDetailDriver(driver);
                              setDriverDetailOpen(true);
                            }}
                            data-testid={`button-view-driver-${driver.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Details
                          </Button>
                          {driver.applicationStatus === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={(e) => {
                                  e.stopPropagation();
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
                                onClick={(e) => {
                                  e.stopPropagation();
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
          )}

          {activeSection === "patients" && hasPermission("patients") && (
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
          )}

          {activeSection === "driver-complaints" && hasPermission("drivers") && (
          <Card>
            <CardHeader>
              <CardTitle>Driver Complaint Reports</CardTitle>
              <CardDescription>
                Review complaints filed against drivers. After {3} complaints, a driver is automatically put on hold and cannot accept rides until an admin reviews.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {driverComplaints.length === 0 ? (
                <p className="text-muted-foreground text-center py-8" data-testid="text-no-driver-complaints">No driver complaints filed yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reporter</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Driver Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {driverComplaints.map((complaint: any) => (
                      <TableRow key={complaint.id} data-testid={`row-driver-complaint-${complaint.id}`}>
                        <TableCell className="font-medium">{complaint.driverName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" data-testid={`badge-category-${complaint.id}`}>
                            {complaint.category?.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{complaint.description}</TableCell>
                        <TableCell>{complaint.reporterName}</TableCell>
                        <TableCell>
                          <Badge
                            variant={complaint.status === "verified" ? "destructive" : complaint.status === "dismissed" ? "secondary" : "default"}
                            data-testid={`badge-status-${complaint.id}`}
                          >
                            {complaint.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              complaint.driverAccountStatus === "on_hold" || complaint.driverAccountStatus === "suspended"
                                ? "destructive"
                                : complaint.driverAccountStatus === "deactivated"
                                ? "destructive"
                                : complaint.driverAccountStatus === "warning"
                                ? "default"
                                : "secondary"
                            }
                            data-testid={`badge-driver-status-${complaint.id}`}
                          >
                            {complaint.driverAccountStatus?.replace(/_/g, " ") || "active"}
                          </Badge>
                        </TableCell>
                        <TableCell>{complaint.createdAt ? new Date(complaint.createdAt).toLocaleDateString() : "N/A"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {complaint.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => reviewDriverComplaintMutation.mutate({ complaintId: complaint.id, status: "verified" })}
                                  data-testid={`button-verify-complaint-${complaint.id}`}
                                >
                                  Verify
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => reviewDriverComplaintMutation.mutate({ complaintId: complaint.id, status: "dismissed" })}
                                  data-testid={`button-dismiss-complaint-${complaint.id}`}
                                >
                                  Dismiss
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => reviewDriverComplaintMutation.mutate({ complaintId: complaint.id, status: "investigating" })}
                                  data-testid={`button-investigate-complaint-${complaint.id}`}
                                >
                                  Investigate
                                </Button>
                              </>
                            )}
                            {(complaint.driverAccountStatus === "on_hold" || complaint.driverAccountStatus === "active" || complaint.driverAccountStatus === "warning") && (
                              <>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedDriver(allDrivers.find(d => d.id === complaint.driverProfileId) || null);
                                    setActionType("enforce_suspend_driver");
                                    setActionDialogOpen(true);
                                  }}
                                  data-testid={`button-suspend-driver-${complaint.id}`}
                                >
                                  Suspend
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => enforceDriverMutation.mutate({ driverId: complaint.driverProfileId, action: "ban", reason: `Banned due to complaint: ${complaint.category}` })}
                                  data-testid={`button-ban-driver-${complaint.id}`}
                                >
                                  Ban
                                </Button>
                              </>
                            )}
                            {(complaint.driverAccountStatus === "on_hold" || complaint.driverAccountStatus === "suspended") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => enforceDriverMutation.mutate({ driverId: complaint.driverProfileId, action: "remove_hold", reason: "Admin cleared after review" })}
                                data-testid={`button-reinstate-driver-${complaint.id}`}
                              >
                                Reinstate
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          )}

          {activeSection === "incidents" && hasPermission("incidents") && (
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
          )}

          {activeSection === "it-complaints" && hasPermission("it_services") && (
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
          )}

          {activeSection === "courier" && hasPermission("dispatch") && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Medical Courier Deliveries</CardTitle>
                <CardDescription>View and manage all medical courier deliveries across the platform</CardDescription>
              </CardHeader>
              <CardContent>
                <CourierAdminSection />
              </CardContent>
            </Card>
          </div>
          )}

          {activeSection === "earnings" && hasPermission("earnings") && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Total Fares Collected</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-total-fares">${earnings?.totalFares || "0"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Platform Revenue</p>
                  <p className="text-2xl font-bold text-emerald-600" data-testid="text-platform-revenue">${earnings?.totalRevenue || "0"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Driver Payouts</p>
                  <p className="text-2xl font-bold text-blue-600" data-testid="text-driver-payouts">${earnings?.totalDriverPayouts || "0"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Average Fare</p>
                  <p className="text-2xl font-bold" data-testid="text-avg-fare">${earnings?.averageFare || "0"}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Tips Collected</p>
                  <p className="text-xl font-bold text-purple-600" data-testid="text-total-tips">${earnings?.totalTips || "0"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Tolls</p>
                  <p className="text-xl font-bold" data-testid="text-total-tolls">${earnings?.totalTolls || "0"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Cancellation Fees</p>
                  <p className="text-xl font-bold text-orange-600" data-testid="text-cancel-fees">${earnings?.totalCancellationFees || "0"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Refunds Issued</p>
                  <p className="text-xl font-bold text-red-600" data-testid="text-total-refunds">${earnings?.totalRefunds || "0"}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Payment Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-muted/50 rounded-md p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-600" data-testid="text-payments-pending">{earnings?.paymentStatusBreakdown?.pending || 0}</p>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                  <div className="bg-muted/50 rounded-md p-3 text-center">
                    <p className="text-2xl font-bold text-green-600" data-testid="text-payments-paid">{earnings?.paymentStatusBreakdown?.paid || 0}</p>
                    <p className="text-sm text-muted-foreground">Paid</p>
                  </div>
                  <div className="bg-muted/50 rounded-md p-3 text-center">
                    <p className="text-2xl font-bold text-red-600" data-testid="text-payments-failed">{earnings?.paymentStatusBreakdown?.failed || 0}</p>
                    <p className="text-sm text-muted-foreground">Failed</p>
                  </div>
                  <div className="bg-muted/50 rounded-md p-3 text-center">
                    <p className="text-2xl font-bold text-orange-600" data-testid="text-payments-refunded">{earnings?.paymentStatusBreakdown?.refunded || 0}</p>
                    <p className="text-sm text-muted-foreground">Refunded</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ride Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-2xl font-bold" data-testid="text-total-rides">{earnings?.totalRides || 0}</p>
                    <p className="text-sm text-muted-foreground">Total Rides</p>
                  </div>
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-2xl font-bold text-green-600" data-testid="text-completed-rides">{earnings?.completedRides || 0}</p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-2xl font-bold text-red-600" data-testid="text-cancelled-rides">{earnings?.cancelledRides || 0}</p>
                    <p className="text-sm text-muted-foreground">Cancelled</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {earnings?.ridesByMonth && Object.keys(earnings.ridesByMonth).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead>Rides</TableHead>
                        <TableHead>Total Fares</TableHead>
                        <TableHead>Platform Revenue</TableHead>
                        <TableHead>Driver Payouts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(earnings.ridesByMonth).sort(([a], [b]) => b.localeCompare(a)).map(([month, data]) => (
                        <TableRow key={month} data-testid={`row-month-${month}`}>
                          <TableCell className="font-medium">{month}</TableCell>
                          <TableCell>{data.rides}</TableCell>
                          <TableCell>${data.fares.toFixed(2)}</TableCell>
                          <TableCell className="text-green-600">${data.revenue.toFixed(2)}</TableCell>
                          <TableCell className="text-blue-600">${data.driverPayouts.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
          )}

          {activeSection === "accounts" && hasPermission("accounts") && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle>All Accounts</CardTitle>
                  <CardDescription>Manage user accounts, roles, and create new accounts</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                    <SelectTrigger className="w-36" data-testid="select-role-filter">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="patient">Patient</SelectItem>
                      <SelectItem value="driver">Driver</SelectItem>
                      <SelectItem value="employer">Employer</SelectItem>
                      <SelectItem value="it_company">IT Company</SelectItem>
                      <SelectItem value="it_tech">IT Tech</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => setCreateAccountOpen(true)} data-testid="button-create-account">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create Account
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Email Verified</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allUsers
                    .filter(u => userRoleFilter === "all" || u.role === userRoleFilter)
                    .map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell>
                        <div className="font-medium">{user.username}</div>
                        <div className="text-xs text-muted-foreground font-mono">{user.id.slice(0, 8)}...</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === "admin" ? "default" : "outline"}>{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.role === "admin" ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {(!user.permissions || user.permissions.length === 0) ? (
                              <Badge variant="outline" className="text-xs">Full Access</Badge>
                            ) : (
                              user.permissions.slice(0, 3).map(p => (
                                <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                              ))
                            )}
                            {user.permissions && user.permissions.length > 3 && (
                              <Badge variant="secondary" className="text-xs">+{user.permissions.length - 3}</Badge>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1"
                              onClick={() => { setEditPermissionsUser(user); setEditPermissions(user.permissions || []); }}
                              data-testid={`button-edit-perms-${user.id}`}
                            >
                              <Settings className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.emailVerified ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Verified</Badge>
                        ) : (
                          <Badge variant="destructive">Unverified</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!user.emailVerified && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => verifyEmailMutation.mutate(user.id)}
                              disabled={verifyEmailMutation.isPending}
                              data-testid={`button-verify-email-${user.id}`}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Verify
                            </Button>
                          )}
                          <Select
                            value={user.role}
                            onValueChange={(role) => updateRoleMutation.mutate({ userId: user.id, role })}
                          >
                            <SelectTrigger className="w-28 h-8 text-xs" data-testid={`select-role-${user.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="patient">Patient</SelectItem>
                              <SelectItem value="driver">Driver</SelectItem>
                              <SelectItem value="employer">Employer</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="it_company">IT Company</SelectItem>
                              <SelectItem value="it_tech">IT Tech</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          )}
        </div>
      </main>

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
              {actionType === "enforce_suspend_driver" && "Suspend Driver (Enforcement)"}
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
          {(actionType === "reject_driver" || actionType === "suspend_driver" || actionType === "enforce_suspend_driver" || actionType === "block_patient" || actionType === "cancel_ride" || actionType === "refund_ride") && (
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

      <Dialog open={driverDetailOpen} onOpenChange={(open) => { setDriverDetailOpen(open); if (!open) setDetailDriver(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="w-5 h-5" />
              Driver Details — {detailDriver?.fullName}
            </DialogTitle>
            <DialogDescription>
              Full onboarding and profile information
            </DialogDescription>
          </DialogHeader>
          {detailDriver && (
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Personal Info</h4>
                <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 rounded-md p-3">
                  <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{detailDriver.fullName}</span></div>
                  <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{detailDriver.phone}</span></div>
                  <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{detailDriver.email || "N/A"}</span></div>
                  <div><span className="text-muted-foreground">User ID:</span> <span className="font-medium">{detailDriver.userId || "N/A"}</span></div>
                  <div><span className="text-muted-foreground">Application Status:</span> <Badge variant={detailDriver.applicationStatus === "approved" ? "default" : detailDriver.applicationStatus === "rejected" ? "destructive" : "outline"}>{detailDriver.applicationStatus}</Badge></div>
                  <div><span className="text-muted-foreground">Account Status:</span> {getAccountStatusBadge(detailDriver.accountStatus || "active")}</div>
                  {detailDriver.rejectionReason && <div className="col-span-2"><span className="text-muted-foreground">Rejection Reason:</span> <span className="font-medium text-red-600">{detailDriver.rejectionReason}</span></div>}
                  {detailDriver.suspensionReason && <div className="col-span-2"><span className="text-muted-foreground">Suspension Reason:</span> <span className="font-medium text-red-600">{detailDriver.suspensionReason}</span></div>}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Car className="w-4 h-4" /> Vehicle Info</h4>
                <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 rounded-md p-3">
                  <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{detailDriver.vehicleType}</span></div>
                  <div><span className="text-muted-foreground">Plate:</span> <span className="font-medium">{detailDriver.vehiclePlate}</span></div>
                  <div><span className="text-muted-foreground">Year:</span> <span className="font-medium">{detailDriver.vehicleYear || "N/A"}</span></div>
                  <div><span className="text-muted-foreground">Make:</span> <span className="font-medium">{detailDriver.vehicleMake || "N/A"}</span></div>
                  <div><span className="text-muted-foreground">Model:</span> <span className="font-medium">{detailDriver.vehicleModel || "N/A"}</span></div>
                  <div><span className="text-muted-foreground">Color:</span> <span className="font-medium">{detailDriver.vehicleColor || "N/A"}</span></div>
                  <div><span className="text-muted-foreground">Wheelchair Accessible:</span> <span className="font-medium">{detailDriver.wheelchairAccessible ? "Yes" : "No"}</span></div>
                  <div><span className="text-muted-foreground">Stretcher Capable:</span> <span className="font-medium">{detailDriver.stretcherCapable ? "Yes" : "No"}</span></div>
                  <div><span className="text-muted-foreground">Inspection Date:</span> <span className="font-medium">{detailDriver.vehicleInspectionDate || "N/A"}</span></div>
                  <div><span className="text-muted-foreground">Inspection Expiry:</span> <span className="font-medium">{detailDriver.vehicleInspectionExpiry || "N/A"}</span></div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Shield className="w-4 h-4" /> License & Insurance</h4>
                <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 rounded-md p-3">
                  <div><span className="text-muted-foreground">License Number:</span> <span className="font-medium">{detailDriver.driversLicenseNumber || "N/A"}</span></div>
                  <div><span className="text-muted-foreground">License State:</span> <span className="font-medium">{detailDriver.driversLicenseState || "N/A"}</span></div>
                  <div><span className="text-muted-foreground">License Expiry:</span> <span className="font-medium">{detailDriver.driversLicenseExpiry || "N/A"}</span></div>
                  <div><span className="text-muted-foreground">Insurance Provider:</span> <span className="font-medium">{detailDriver.insuranceProvider || "N/A"}</span></div>
                  <div><span className="text-muted-foreground">Policy Number:</span> <span className="font-medium">{detailDriver.insurancePolicyNumber || "N/A"}</span></div>
                  <div><span className="text-muted-foreground">Insurance Expiry:</span> <span className="font-medium">{detailDriver.insuranceExpiry || "N/A"}</span></div>
                  <div><span className="text-muted-foreground">Background Check:</span> <span className="font-medium">{detailDriver.backgroundCheckStatus || "not_started"}</span></div>
                  <div><span className="text-muted-foreground">Background Check Date:</span> <span className="font-medium">{detailDriver.backgroundCheckDate || "N/A"}</span></div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><FileText className="w-4 h-4" /> KYC & Documents</h4>
                <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 rounded-md p-3">
                  <div><span className="text-muted-foreground">KYC Status:</span> <Badge variant={detailDriver.kycStatus === "approved" ? "default" : detailDriver.kycStatus === "rejected" ? "destructive" : "outline"}>{detailDriver.kycStatus}</Badge></div>
                  <div><span className="text-muted-foreground">KYC Verified At:</span> <span className="font-medium">{detailDriver.kycVerifiedAt ? format(new Date(detailDriver.kycVerifiedAt), "MMM d, yyyy") : "N/A"}</span></div>
                  {detailDriver.kycNotes && <div className="col-span-2"><span className="text-muted-foreground">KYC Notes:</span> <span className="font-medium">{detailDriver.kycNotes}</span></div>}
                  <div><span className="text-muted-foreground">License Doc:</span> <span className="font-medium">{detailDriver.driversLicenseDoc ? "Uploaded" : "Not uploaded"}</span></div>
                  <div><span className="text-muted-foreground">Registration Doc:</span> <span className="font-medium">{detailDriver.vehicleRegistrationDoc ? "Uploaded" : "Not uploaded"}</span></div>
                  <div><span className="text-muted-foreground">Insurance Doc:</span> <span className="font-medium">{detailDriver.insuranceDoc ? "Uploaded" : "Not uploaded"}</span></div>
                  <div><span className="text-muted-foreground">Profile Photo:</span> <span className="font-medium">{detailDriver.profilePhotoDoc ? "Uploaded" : "Not uploaded"}</span></div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Contractor & Financials</h4>
                <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 rounded-md p-3">
                  <div><span className="text-muted-foreground">Contractor Onboarded:</span> <span className="font-medium">{detailDriver.isContractorOnboarded ? "Yes" : "No"}</span></div>
                  <div><span className="text-muted-foreground">IC Agreement Signed:</span> <span className="font-medium">{detailDriver.contractorAgreementSignedAt ? format(new Date(detailDriver.contractorAgreementSignedAt), "MMM d, yyyy") : "Not signed"}</span></div>
                  <div><span className="text-muted-foreground">SSN Last 4:</span> <span className="font-medium">{detailDriver.ssnLast4 ? `***${detailDriver.ssnLast4}` : "N/A"}</span></div>
                  <div><span className="text-muted-foreground">Tax Classification:</span> <span className="font-medium">{detailDriver.taxClassification || "N/A"}</span></div>
                  {detailDriver.businessName && <div><span className="text-muted-foreground">Business Name:</span> <span className="font-medium">{detailDriver.businessName}</span></div>}
                  <div><span className="text-muted-foreground">Tax Address:</span> <span className="font-medium">{[detailDriver.taxAddress, detailDriver.taxCity, detailDriver.taxState, detailDriver.taxZip].filter(Boolean).join(", ") || "N/A"}</span></div>
                  <div><span className="text-muted-foreground">W-9 Received:</span> <span className="font-medium">{detailDriver.w9ReceivedAt ? format(new Date(detailDriver.w9ReceivedAt), "MMM d, yyyy") : "Not received"}</span></div>
                  <div><span className="text-muted-foreground">Stripe Connect:</span> <span className="font-medium">{detailDriver.stripeConnectOnboarded ? "Connected" : "Not connected"}</span></div>
                  <div><span className="text-muted-foreground">Payout Preference:</span> <span className="font-medium">{detailDriver.payoutPreference || "manual"}</span></div>
                  <div><span className="text-muted-foreground">Total Earnings:</span> <span className="font-medium">${detailDriver.totalEarnings || "0"}</span></div>
                  <div><span className="text-muted-foreground">Available Balance:</span> <span className="font-medium">${detailDriver.availableBalance || "0"}</span></div>
                  <div><span className="text-muted-foreground">Pending Balance:</span> <span className="font-medium">${detailDriver.pendingBalance || "0"}</span></div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Activity className="w-4 h-4" /> Performance</h4>
                <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 rounded-md p-3">
                  <div><span className="text-muted-foreground">Rides Completed:</span> <span className="font-medium">{detailDriver.totalRidesCompleted || 0}</span></div>
                  <div><span className="text-muted-foreground">Rides Cancelled:</span> <span className="font-medium">{detailDriver.totalRidesCancelled || 0}</span></div>
                  <div><span className="text-muted-foreground">Average Rating:</span> <span className="font-medium">{detailDriver.averageRating ? `${parseFloat(detailDriver.averageRating).toFixed(1)} / 5` : "N/A"}</span></div>
                  <div><span className="text-muted-foreground">Total Ratings:</span> <span className="font-medium">{detailDriver.totalRatings || 0}</span></div>
                  <div><span className="text-muted-foreground">Available:</span> <span className="font-medium">{detailDriver.isAvailable ? "Yes" : "No"}</span></div>
                  <div><span className="text-muted-foreground">Navigation Pref:</span> <span className="font-medium">{detailDriver.navigationPreference || "default"}</span></div>
                  <div><span className="text-muted-foreground">Joined:</span> <span className="font-medium">{detailDriver.createdAt ? format(new Date(detailDriver.createdAt), "MMM d, yyyy") : "N/A"}</span></div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDriverDetailOpen(false)} data-testid="button-close-driver-detail">
              Close
            </Button>
            {detailDriver?.applicationStatus === "pending" && (
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  setDriverDetailOpen(false);
                  setSelectedDriver(detailDriver);
                  setActionType("approve_driver");
                  setActionDialogOpen(true);
                }}
                data-testid="button-approve-from-detail"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Approve Driver
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rideDetailOpen} onOpenChange={(open) => { setRideDetailOpen(open); if (!open) setDetailRide(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="w-5 h-5" />
              Ride #{detailRide?.id} — Details
            </DialogTitle>
            <DialogDescription>Full ride information and fare breakdown</DialogDescription>
          </DialogHeader>
          {detailRide && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-2">Patient & Booking</h4>
                <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 rounded-md p-3">
                  <div><span className="text-muted-foreground">Patient:</span> <span className="font-medium">{detailRide.patientName}</span></div>
                  <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{detailRide.patientPhone}</span></div>
                  <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{detailRide.patientEmail || "N/A"}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> {getStatusBadge(detailRide.status)}</div>
                  <div><span className="text-muted-foreground">Payment Type:</span> <span className="font-medium">{detailRide.paymentType}</span></div>
                  <div><span className="text-muted-foreground">Payment Status:</span> <Badge variant={detailRide.paymentStatus === "completed" || detailRide.paymentStatus === "paid" ? "default" : "outline"}>{detailRide.paymentStatus || "pending"}</Badge></div>
                  <div><span className="text-muted-foreground">Vehicle Type:</span> <span className="font-medium">{detailRide.requiredVehicleType || "Any"}</span></div>
                  <div><span className="text-muted-foreground">Round Trip:</span> <span className="font-medium">{detailRide.isRoundTrip ? "Yes" : "No"}</span></div>
                  {detailRide.bookedByOther && (
                    <>
                      <div><span className="text-muted-foreground">Booked By:</span> <span className="font-medium">{detailRide.bookerName} ({detailRide.bookerRelation})</span></div>
                      <div><span className="text-muted-foreground">Booker Phone:</span> <span className="font-medium">{detailRide.bookerPhone}</span></div>
                    </>
                  )}
                  <div><span className="text-muted-foreground">Appointment:</span> <span className="font-medium">{detailRide.appointmentTime ? format(new Date(detailRide.appointmentTime), "MMM d, yyyy HH:mm") : "N/A"}</span></div>
                  <div><span className="text-muted-foreground">Created:</span> <span className="font-medium">{detailRide.createdAt ? format(new Date(detailRide.createdAt), "MMM d, yyyy HH:mm") : "N/A"}</span></div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Route</h4>
                <div className="grid grid-cols-1 gap-3 text-sm bg-muted/50 rounded-md p-3">
                  <div><span className="text-muted-foreground">Pickup:</span> <span className="font-medium">{detailRide.pickupAddress}</span></div>
                  <div><span className="text-muted-foreground">Dropoff:</span> <span className="font-medium">{detailRide.dropoffAddress}</span></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-muted-foreground">Distance:</span> <span className="font-medium">{detailRide.distanceMiles || detailRide.actualDistanceMiles || "N/A"} mi</span></div>
                    <div><span className="text-muted-foreground">Traffic:</span> <span className="font-medium">{detailRide.trafficCondition || "N/A"}</span></div>
                  </div>
                  {detailRide.notes && <div><span className="text-muted-foreground">Notes:</span> <span className="font-medium">{detailRide.notes}</span></div>}
                  {detailRide.medicalNotes && <div><span className="text-muted-foreground">Medical Notes:</span> <span className="font-medium">{detailRide.medicalNotes}</span></div>}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Fare Breakdown</h4>
                <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 rounded-md p-3">
                  <div><span className="text-muted-foreground">Estimated Fare:</span> <span className="font-medium">${detailRide.estimatedFare || "0"}</span></div>
                  <div><span className="text-muted-foreground">Final Fare:</span> <span className="font-medium text-green-600">${detailRide.finalFare || "0"}</span></div>
                  <div><span className="text-muted-foreground">Base Fare:</span> <span className="font-medium">${detailRide.baseFare || "0"}</span></div>
                  <div><span className="text-muted-foreground">Surge Multiplier:</span> <span className="font-medium">{detailRide.surgeMultiplier || "1.0"}x</span></div>
                  <div><span className="text-muted-foreground">Platform Fee ({detailRide.platformFeePercent || "15"}%):</span> <span className="font-medium">${detailRide.platformFee || "0"}</span></div>
                  <div><span className="text-muted-foreground">Driver Earnings:</span> <span className="font-medium text-blue-600">${detailRide.driverEarnings || "0"}</span></div>
                  <div><span className="text-muted-foreground">Tip:</span> <span className="font-medium">${detailRide.tipAmount || "0"}</span></div>
                  <div><span className="text-muted-foreground">Tolls:</span> <span className="font-medium">${detailRide.actualTolls || detailRide.estimatedTolls || "0"}</span></div>
                  <div><span className="text-muted-foreground">Paid Amount:</span> <span className="font-medium">${detailRide.paidAmount || "0"}</span></div>
                  {detailRide.cancellationFee && <div><span className="text-muted-foreground">Cancellation Fee:</span> <span className="font-medium text-red-600">${detailRide.cancellationFee}</span></div>}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Trip Timeline</h4>
                <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 rounded-md p-3">
                  <div><span className="text-muted-foreground">Driver ID:</span> <span className="font-medium">{detailRide.driverId || "Not assigned"}</span></div>
                  <div><span className="text-muted-foreground">ETA:</span> <span className="font-medium">{detailRide.estimatedArrivalTime ? format(new Date(detailRide.estimatedArrivalTime), "HH:mm") : "N/A"}</span></div>
                  <div><span className="text-muted-foreground">Actual Pickup:</span> <span className="font-medium">{detailRide.actualPickupTime ? format(new Date(detailRide.actualPickupTime), "HH:mm") : "N/A"}</span></div>
                  <div><span className="text-muted-foreground">Actual Dropoff:</span> <span className="font-medium">{detailRide.actualDropoffTime ? format(new Date(detailRide.actualDropoffTime), "HH:mm") : "N/A"}</span></div>
                  {detailRide.waitTimeMinutes && <div><span className="text-muted-foreground">Wait Time:</span> <span className="font-medium">{detailRide.waitTimeMinutes} min</span></div>}
                  {detailRide.delayMinutes && detailRide.delayMinutes > 0 && (
                    <div><span className="text-muted-foreground">Delay:</span> <span className="font-medium text-orange-600">{detailRide.delayMinutes} min ({detailRide.delayReason || "unknown"})</span></div>
                  )}
                  {detailRide.cancelledAt && (
                    <>
                      <div><span className="text-muted-foreground">Cancelled At:</span> <span className="font-medium text-red-600">{format(new Date(detailRide.cancelledAt), "MMM d, HH:mm")}</span></div>
                      <div><span className="text-muted-foreground">Cancelled By:</span> <span className="font-medium">{detailRide.cancelledBy}</span></div>
                      {detailRide.cancellationReason && <div className="col-span-2"><span className="text-muted-foreground">Reason:</span> <span className="font-medium">{detailRide.cancellationReason}</span></div>}
                    </>
                  )}
                </div>
              </div>

              {detailRide.insuranceProvider && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Insurance</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 rounded-md p-3">
                    <div><span className="text-muted-foreground">Provider:</span> <span className="font-medium">{detailRide.insuranceProvider}</span></div>
                    <div><span className="text-muted-foreground">Member ID:</span> <span className="font-medium">{detailRide.memberId || "N/A"}</span></div>
                    <div><span className="text-muted-foreground">Group #:</span> <span className="font-medium">{detailRide.groupNumber || "N/A"}</span></div>
                    <div><span className="text-muted-foreground">Prior Auth #:</span> <span className="font-medium">{detailRide.priorAuthNumber || "N/A"}</span></div>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRideDetailOpen(false)} data-testid="button-close-ride-detail">Close</Button>
            {detailRide && !["completed", "cancelled"].includes(detailRide.status) && (
              <Button
                variant="destructive"
                onClick={() => {
                  setRideDetailOpen(false);
                  setSelectedRide(detailRide);
                  setActionType("cancel_ride");
                  setActionDialogOpen(true);
                }}
                data-testid="button-cancel-from-detail"
              >
                Cancel Ride
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createAccountOpen} onOpenChange={setCreateAccountOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Create New Account
            </DialogTitle>
            <DialogDescription>Create an account and set what they can access</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="newEmail">Email</Label>
              <Input id="newEmail" type="email" value={newAccountEmail} onChange={(e) => setNewAccountEmail(e.target.value)} placeholder="user@example.com" data-testid="input-new-email" />
            </div>
            <div>
              <Label htmlFor="newName">Full Name</Label>
              <Input id="newName" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} placeholder="John Smith" data-testid="input-new-name" />
            </div>
            <div>
              <Label htmlFor="newPassword">Password</Label>
              <Input id="newPassword" type="password" value={newAccountPassword} onChange={(e) => setNewAccountPassword(e.target.value)} placeholder="Min 8 chars, uppercase, number" data-testid="input-new-password" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={newAccountRole} onValueChange={(val) => {
                setNewAccountRole(val);
                if (val === "admin") {
                  setNewAccountPreset("full_admin");
                  setNewAccountPermissions([...ADMIN_PERMISSIONS]);
                }
              }}>
                <SelectTrigger data-testid="select-new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="patient">Patient</SelectItem>
                  <SelectItem value="driver">Driver</SelectItem>
                  <SelectItem value="employer">Employer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="it_company">IT Company</SelectItem>
                  <SelectItem value="it_tech">IT Tech</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newAccountRole === "admin" && (
              <div className="space-y-3 border rounded-lg p-3">
                <Label>Access Level</Label>
                <Select value={newAccountPreset} onValueChange={(val) => {
                  setNewAccountPreset(val);
                  const preset = PERMISSION_PRESETS[val];
                  if (preset && val !== "custom") {
                    setNewAccountPermissions([...preset.permissions]);
                  }
                }}>
                  <SelectTrigger data-testid="select-preset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PERMISSION_PRESETS).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>{preset.label} — {preset.description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Permissions</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {ADMIN_PERMISSIONS.map((perm) => (
                      <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={newAccountPermissions.includes(perm)}
                          onCheckedChange={(checked) => {
                            setNewAccountPreset("custom");
                            setNewAccountPermissions(prev =>
                              checked ? [...prev, perm] : prev.filter(p => p !== perm)
                            );
                          }}
                          data-testid={`check-perm-${perm}`}
                        />
                        {permissionLabels[perm] || perm}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateAccountOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createAccountMutation.mutate({
                email: newAccountEmail,
                fullName: newAccountName,
                password: newAccountPassword,
                role: newAccountRole,
                permissions: newAccountRole === "admin" ? newAccountPermissions : undefined
              })}
              disabled={!newAccountEmail || !newAccountName || !newAccountPassword || createAccountMutation.isPending}
              data-testid="button-submit-create-account"
            >
              {createAccountMutation.isPending ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editPermissionsUser} onOpenChange={(open) => !open && setEditPermissionsUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Permissions</DialogTitle>
            <DialogDescription>
              {editPermissionsUser?.username} — choose what this admin can access
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Quick Presets</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PERMISSION_PRESETS).filter(([k]) => k !== "custom").map(([key, preset]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    onClick={() => setEditPermissions([...preset.permissions])}
                    data-testid={`preset-${key}`}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ADMIN_PERMISSIONS.map((perm) => (
                <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={editPermissions.includes(perm)}
                    onCheckedChange={(checked) => {
                      setEditPermissions(prev =>
                        checked ? [...prev, perm] : prev.filter(p => p !== perm)
                      );
                    }}
                    data-testid={`edit-perm-${perm}`}
                  />
                  {permissionLabels[perm] || perm}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPermissionsUser(null)}>Cancel</Button>
            <Button
              onClick={() => editPermissionsUser && updatePermissionsMutation.mutate({ userId: editPermissionsUser.id, permissions: editPermissions })}
              disabled={updatePermissionsMutation.isPending}
              data-testid="button-save-permissions"
            >
              {updatePermissionsMutation.isPending ? "Saving..." : "Save Permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CourierAdminSection() {
  const { data: deliveries = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/courier/deliveries"],
  });

  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/courier/companies"],
  });

  const statusColors: Record<string, string> = {
    requested: "bg-yellow-100 text-yellow-800",
    accepted: "bg-blue-100 text-blue-800",
    en_route_pickup: "bg-indigo-100 text-indigo-800",
    picked_up: "bg-purple-100 text-purple-800",
    in_transit: "bg-orange-100 text-orange-800",
    arrived: "bg-teal-100 text-teal-800",
    delivered: "bg-green-100 text-green-800",
    confirmed: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-red-100 text-red-800",
  };

  if (isLoading) return <p className="text-muted-foreground">Loading courier data...</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold" data-testid="text-admin-courier-companies">{companies.length}</p>
            <p className="text-xs text-muted-foreground">Companies</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold" data-testid="text-admin-courier-total">{deliveries.length}</p>
            <p className="text-xs text-muted-foreground">Total Deliveries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{deliveries.filter((d: any) => !["delivered","confirmed","cancelled"].includes(d.status)).length}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">{deliveries.filter((d: any) => ["delivered","confirmed"].includes(d.status)).length}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Package</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Pickup</TableHead>
            <TableHead>Dropoff</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Fare</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deliveries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No courier deliveries yet</TableCell>
            </TableRow>
          ) : (
            deliveries.map((d: any) => (
              <TableRow key={d.id} data-testid={`row-admin-delivery-${d.id}`}>
                <TableCell className="font-mono text-xs">#{d.id}</TableCell>
                <TableCell className="text-sm">{d.companyName || "—"}</TableCell>
                <TableCell>
                  <div className="text-sm">{d.packageType?.replace(/_/g, " ")}</div>
                  {d.temperatureControl !== "ambient" && (
                    <Badge variant="outline" className="text-xs mt-1">
                      <Thermometer className="h-3 w-3 mr-1" />{d.temperatureControl}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={d.priority === "stat" ? "destructive" : d.priority === "urgent" ? "default" : "secondary"}>
                    {d.priority?.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs max-w-[120px] truncate">{d.pickupAddress}</TableCell>
                <TableCell className="text-xs max-w-[120px] truncate">{d.dropoffAddress}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[d.status] || "bg-gray-100"}`}>
                    {d.status?.replace(/_/g, " ")}
                  </span>
                </TableCell>
                <TableCell>${d.finalFare || d.estimatedFare || "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
