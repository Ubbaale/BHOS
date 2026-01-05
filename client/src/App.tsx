import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import BookRide from "@/pages/book-ride";
import DriverDashboard from "@/pages/driver-dashboard";
import DriverApply from "@/pages/driver-apply";
import DriverKyc from "@/pages/driver-kyc";
import AdminDrivers from "@/pages/admin-drivers";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/book-ride" component={BookRide} />
      <Route path="/driver" component={DriverDashboard} />
      <Route path="/driver/apply" component={DriverApply} />
      <Route path="/driver/kyc" component={DriverKyc} />
      <Route path="/admin/drivers" component={AdminDrivers} />
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
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
