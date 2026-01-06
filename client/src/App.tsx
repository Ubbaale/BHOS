import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InstallPrompt } from "@/components/InstallPrompt";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import BookRide from "@/pages/book-ride";
import DriverDashboard from "@/pages/driver-dashboard";
import DriverApply from "@/pages/driver-apply";
import DriverKyc from "@/pages/driver-kyc";
import AdminDrivers from "@/pages/admin-drivers";
import AdminDashboard from "@/pages/admin-dashboard";
import TripReceipt from "@/pages/trip-receipt";
import TrackRide from "@/pages/track-ride";
import SharedTracking from "@/pages/shared-tracking";
import DriverEarnings from "@/pages/driver-earnings";
import ReportIncident from "@/pages/report-incident";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/book-ride" component={BookRide} />
      <Route path="/track/:id" component={TrackRide} />
      <Route path="/share/:code" component={SharedTracking} />
      <Route path="/driver" component={DriverDashboard} />
      <Route path="/driver/apply" component={DriverApply} />
      <Route path="/driver/kyc" component={DriverKyc} />
      <Route path="/driver/earnings" component={DriverEarnings} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/drivers" component={AdminDrivers} />
      <Route path="/receipt/:id" component={TripReceipt} />
      <Route path="/report/:id" component={ReportIncident} />
      <Route path="/report" component={ReportIncident} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <InstallPrompt />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
