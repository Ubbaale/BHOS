import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToHome from "@/components/BackToHome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Plus,
  Car,
  Clock,
  CheckCircle2,
  Activity,
  Phone,
  Mail,
  MapPin,
  User,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import type { Ride, Facility, FacilityStaff } from "@shared/schema";

interface FacilityDashboardData {
  facility: Facility & { id: number };
  rides: Ride[];
  staff: FacilityStaff;
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "requested":
      return "secondary";
    case "accepted":
    case "driver_enroute":
      return "default";
    case "arrived":
    case "in_progress":
      return "default";
    case "completed":
      return "secondary";
    case "cancelled":
      return "destructive";
    default:
      return "secondary";
  }
}

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function FacilityDashboard() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: staffCheck, isLoading: staffCheckLoading } = useQuery<{
    isFacilityStaff: boolean;
    staff: FacilityStaff | null;
  }>({
    queryKey: ["/api/facility/staff-check"],
    enabled: isAuthenticated,
  });

  const {
    data: dashboard,
    isLoading: dashboardLoading,
    error,
  } = useQuery<FacilityDashboardData>({
    queryKey: ["/api/facility/dashboard"],
    enabled: isAuthenticated && staffCheck?.isFacilityStaff === true,
    refetchInterval: 15000,
  });

  if (authLoading || staffCheckLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </div>
            <Skeleton className="h-64" />
          </div>
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-semibold" data-testid="text-auth-required">Authentication Required</h2>
              <p className="text-muted-foreground">Please log in to access the facility portal.</p>
              <Button asChild data-testid="button-login-redirect">
                <Link href="/driver/login">Log In</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!staffCheck?.isFacilityStaff) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-semibold" data-testid="text-no-access">Access Denied</h2>
              <p className="text-muted-foreground">
                You are not registered as facility staff. Contact your administrator.
              </p>
              <BackToHome />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (dashboardLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
          <div className="flex items-center gap-2 mb-6">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-muted-foreground">Loading facility dashboard...</span>
          </div>
        </main>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold">Error Loading Dashboard</h2>
              <p className="text-muted-foreground">
                Failed to load facility data. Please try again.
              </p>
              <BackToHome />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const { facility, rides } = dashboard;

  const activeRides = rides.filter((r) =>
    ["requested", "accepted", "driver_enroute", "arrived", "in_progress"].includes(r.status)
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completedToday = rides.filter(
    (r) =>
      r.status === "completed" &&
      r.actualDropoffTime &&
      new Date(r.actualDropoffTime) >= today
  );
  const waitingForPickup = rides.filter((r) =>
    ["requested", "accepted", "driver_enroute"].includes(r.status)
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 md:py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-facility-name">
                {facility.name}
              </h1>
              <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {facility.address}
                </span>
                {facility.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    {facility.phone}
                  </span>
                )}
                {facility.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    {facility.email}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            onClick={() => navigate("/facility/book-ride")}
            data-testid="button-request-transport"
          >
            <Plus className="w-4 h-4 mr-2" />
            Request Transport
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Rides</CardTitle>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-stat-active">
                {activeRides.length}
              </div>
              <p className="text-xs text-muted-foreground">Currently in progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-stat-completed">
                {completedToday.length}
              </div>
              <p className="text-xs text-muted-foreground">Rides finished today</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Waiting for Pickup</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-stat-waiting">
                {waitingForPickup.length}
              </div>
              <p className="text-xs text-muted-foreground">Awaiting driver</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active" data-testid="tab-active-rides">
              Active ({activeRides.length})
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed-rides">
              Completed Today ({completedToday.length})
            </TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all-rides">
              All Rides ({rides.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <Card>
              <CardContent className="pt-6">
                {activeRides.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-active">
                    <Car className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>No active rides at the moment.</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => navigate("/facility/book-ride")}
                      data-testid="button-request-first"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Request Transport
                    </Button>
                  </div>
                ) : (
                  <RideTable rides={activeRides} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed">
            <Card>
              <CardContent className="pt-6">
                {completedToday.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-completed">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>No completed rides today.</p>
                  </div>
                ) : (
                  <RideTable rides={completedToday} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all">
            <Card>
              <CardContent className="pt-6">
                {rides.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-rides">
                    <Car className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>No rides found for this facility.</p>
                  </div>
                ) : (
                  <RideTable rides={rides} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}

function RideTable({ rides }: { rides: Ride[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Patient</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Pickup</TableHead>
            <TableHead>Dropoff</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Fare</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rides.map((ride) => (
            <TableRow key={ride.id} data-testid={`row-ride-${ride.id}`}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium" data-testid={`text-patient-name-${ride.id}`}>
                      {ride.patientName}
                    </p>
                    <p className="text-xs text-muted-foreground">{ride.patientPhone}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(ride.status)} data-testid={`badge-status-${ride.id}`}>
                  {formatStatus(ride.status)}
                </Badge>
                {ride.waitStartedAt && !ride.waitEndedAt && (
                  <Badge variant="outline" className="ml-1">
                    <Clock className="w-3 h-3 mr-1" />
                    Waiting
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <span className="text-sm truncate max-w-[150px] block" title={ride.pickupAddress}>
                  {ride.pickupAddress}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm truncate max-w-[150px] block" title={ride.dropoffAddress}>
                  {ride.dropoffAddress}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {ride.appointmentTime
                    ? format(new Date(ride.appointmentTime), "MMM d, h:mm a")
                    : "N/A"}
                </span>
              </TableCell>
              <TableCell>
                {ride.requiredVehicleType ? (
                  <Badge variant="outline" className="text-xs">
                    {ride.requiredVehicleType.replace(/_/g, " ")}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Any</span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-sm font-medium">
                  {ride.estimatedFare ? `$${parseFloat(ride.estimatedFare).toFixed(2)}` : "TBD"}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
