import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InstallPrompt } from "@/components/InstallPrompt";
import { AuthProvider } from "@/lib/auth";
import MobileAppShell from "@/components/MobileAppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import BookRide from "@/pages/book-ride";
import DriverDashboard from "@/pages/driver-dashboard";
import DriverApply from "@/pages/driver-apply";
import DriverKyc from "@/pages/driver-kyc";
import DriverLogin from "@/pages/driver-login";
import AdminDrivers from "@/pages/admin-drivers";
import AdminDashboard from "@/pages/admin-dashboard";
import TripReceipt from "@/pages/trip-receipt";
import TrackRide from "@/pages/track-ride";
import SharedTracking from "@/pages/shared-tracking";
import DriverEarnings from "@/pages/driver-earnings";
import DriverPayouts from "@/pages/driver-payouts";
import ReportIncident from "@/pages/report-incident";
import RideHistory from "@/pages/ride-history";
import DriverTripHistory from "@/pages/driver-trip-history";
import ICAgreement from "@/pages/ic-agreement";
import TermsOfService from "@/pages/terms-of-service";
import PrivacyPolicy from "@/pages/privacy-policy";
import CaregiverDashboard from "@/pages/caregiver-dashboard";
import CaregiverBookRide from "@/pages/caregiver-book-ride";
import FacilityDashboard from "@/pages/facility-dashboard";
import FacilityBookRide from "@/pages/facility-book-ride";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/book-ride" component={BookRide} />
      <Route path="/track/:id" component={TrackRide} />
      <Route path="/share/:code" component={SharedTracking} />
      <Route path="/driver/login" component={DriverLogin} />
      <Route path="/driver/apply" component={DriverApply} />
      <Route path="/driver/kyc" component={DriverKyc} />
      <Route path="/driver/ic-agreement">
        <ProtectedRoute requiredRole="driver">
          <ICAgreement />
        </ProtectedRoute>
      </Route>
      <Route path="/driver">
        <ProtectedRoute requiredRole="driver">
          <DriverDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/driver/trip-history">
        <ProtectedRoute requiredRole="driver">
          <DriverTripHistory />
        </ProtectedRoute>
      </Route>
      <Route path="/driver/earnings">
        <ProtectedRoute requiredRole="driver">
          <DriverEarnings />
        </ProtectedRoute>
      </Route>
      <Route path="/driver-payouts">
        <ProtectedRoute requiredRole="driver">
          <DriverPayouts />
        </ProtectedRoute>
      </Route>
      <Route path="/admin">
        <ProtectedRoute requiredRole="admin" redirectTo="/">
          <AdminDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/drivers">
        <ProtectedRoute requiredRole="admin" redirectTo="/">
          <AdminDrivers />
        </ProtectedRoute>
      </Route>
      <Route path="/facility" component={FacilityDashboard} />
      <Route path="/facility/book-ride" component={FacilityBookRide} />
      <Route path="/caregiver" component={CaregiverDashboard} />
      <Route path="/caregiver/book-ride/:patientId" component={CaregiverBookRide} />
      <Route path="/my-rides" component={RideHistory} />
      <Route path="/receipt/:id" component={TripReceipt} />
      <Route path="/report/:id" component={ReportIncident} />
      <Route path="/report" component={ReportIncident} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <MobileAppShell>
            <Router />
          </MobileAppShell>
          <InstallPrompt />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
