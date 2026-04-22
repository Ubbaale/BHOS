import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { Toaster } from "@/components/ui/toaster";
import bgMedical from "@assets/bg-medical.jpg";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/Layout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import HomesPage from "@/pages/homes";
import HomeDetail from "@/pages/homes/[id]";
import StaffPage from "@/pages/staff";
import StaffDetail from "@/pages/staff/[id]";
import PatientsPage from "@/pages/patients";
import PatientDetail from "@/pages/patients/[id]";
import MedicationsPage from "@/pages/medications";
import IncidentsPage from "@/pages/incidents";
import ShiftsPage from "@/pages/shifts";
import DailyLogsPage from "@/pages/daily-logs";
import TimePunchesPage from "@/pages/time-punches";
import FraudAlertsPage from "@/pages/fraud-alerts";
import EmarPage from "@/pages/emar";
import ControlledSubstancesPage from "@/pages/controlled-substances";
import MedicationSafetyPage from "@/pages/medication-safety";
import MedicationReconciliationPage from "@/pages/medication-reconciliation";
import ReportsPage from "@/pages/reports";
import BillingPage from "@/pages/billing";
import IntegrationsPage from "@/pages/integrations";
import SecurityPage from "@/pages/security";
import WorkforcePage from "@/pages/workforce";
import FamilyPortalPage from "@/pages/family-portal";
import PredictivePage from "@/pages/predictive";
import StaffChatPage from "@/pages/staff-chat";
import AppointmentsPage from "@/pages/appointments";
import DailyAssignmentsPage from "@/pages/daily-assignments";
import TransportationPage from "@/pages/transportation";
import OrganizationPage from "@/pages/organization";
import CensusPage from "@/pages/census";
import AdmissionsPage from "@/pages/admissions";
import TreatmentPlansPage from "@/pages/treatment-plans";
import ProgressNotesPage from "@/pages/progress-notes";
import DischargePage from "@/pages/discharge";
import SubscriptionPage from "@/pages/subscription";
import MeetingsPage from "@/pages/meetings";
import CalendarSyncPage from "@/pages/calendar-sync";
import DevicesPage from "@/pages/devices";
import CrisisPage from "@/pages/crisis";
import TrainingPage from "@/pages/training";
import TrialSetupPage from "@/pages/trial-setup";
import CompliancePage from "@/pages/compliance";
import CamerasPage from "@/pages/cameras";
import SupportPage from "@/pages/support";
import PlatformAdminPage from "@/pages/platform-admin";
import BackupsPage from "@/pages/backups";
import InspectorPortalPage from "@/pages/inspector-portal";
import DevLoginPage from "@/pages/dev-login";
import LandingPage from "@/pages/landing";
import DocumentsPage from "@/pages/documents";
import ISPPage from "@/pages/isp";
import BehaviorTrackingPage from "@/pages/behavior-tracking";
import StaffCredentialsPage from "@/pages/staff-credentials";
import CustomFormsPage from "@/pages/custom-forms";
import StateReportingPage from "@/pages/state-reporting";
import CareCoordinationPage from "@/pages/care-coordination";
import AuthorizationsPage from "@/pages/authorizations";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-teal-50/20 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url('${bgMedical}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div className="relative z-10">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} fallbackRedirectUrl={`${basePath}/`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-teal-50/20 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url('${bgMedical}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div className="relative z-10">
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} fallbackRedirectUrl={`${basePath}/`} />
      </div>
    </div>
  );
}

function fetchMyOrg(): Promise<{ hasOrg: boolean; alreadyOnboarded?: boolean }> {
  const base = import.meta.env.BASE_URL;
  return fetch(`${base}api/organizations/my-org`, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error("my-org");
    return r.json();
  });
}

/** After login: dashboard if trial/org already set up, otherwise trial setup (first visit). */
function SignedInRedirect() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-org-check"],
    queryFn: fetchMyOrg,
    staleTime: 60_000,
  });

  if (isLoading && data === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-teal-50/20">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  const skipTrial =
    !isError && (data?.hasOrg === true || data?.alreadyOnboarded === true);
  return <Redirect to={skipTrial ? "/dashboard" : "/trial-setup"} />;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <SignedInRedirect />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function ProtectedTrialSetup() {
  return (
    <>
      <Show when="signed-in">
        <TrialSetupPage />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function AppRoutes() {
  return (
    <Layout>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/homes" component={HomesPage} />
        <Route path="/homes/:id" component={HomeDetail} />
        <Route path="/staff" component={StaffPage} />
        <Route path="/staff/:id" component={StaffDetail} />
        <Route path="/patients" component={PatientsPage} />
        <Route path="/patients/:id" component={PatientDetail} />
        <Route path="/medications" component={MedicationsPage} />
        <Route path="/incidents" component={IncidentsPage} />
        <Route path="/shifts" component={ShiftsPage} />
        <Route path="/daily-logs" component={DailyLogsPage} />
        <Route path="/time-punches" component={TimePunchesPage} />
        <Route path="/fraud-alerts" component={FraudAlertsPage} />
        <Route path="/emar" component={EmarPage} />
        <Route path="/controlled-substances" component={ControlledSubstancesPage} />
        <Route path="/medication-safety" component={MedicationSafetyPage} />
        <Route path="/medication-reconciliation" component={MedicationReconciliationPage} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/billing" component={BillingPage} />
        <Route path="/integrations" component={IntegrationsPage} />
        <Route path="/security" component={SecurityPage} />
        <Route path="/workforce" component={WorkforcePage} />
        <Route path="/family-portal" component={FamilyPortalPage} />
        <Route path="/predictive" component={PredictivePage} />
        <Route path="/staff-chat" component={StaffChatPage} />
        <Route path="/appointments" component={AppointmentsPage} />
        <Route path="/daily-assignments" component={DailyAssignmentsPage} />
        <Route path="/transportation" component={TransportationPage} />
        <Route path="/organization" component={OrganizationPage} />
        <Route path="/subscription" component={SubscriptionPage} />
        <Route path="/meetings" component={MeetingsPage} />
        <Route path="/calendar-sync" component={CalendarSyncPage} />
        <Route path="/devices" component={DevicesPage} />
        <Route path="/crisis" component={CrisisPage} />
        <Route path="/training" component={TrainingPage} />
        <Route path="/compliance" component={CompliancePage} />
        <Route path="/cameras" component={CamerasPage} />
        <Route path="/support" component={SupportPage} />
        <Route path="/platform-admin" component={PlatformAdminPage} />
        <Route path="/backups" component={BackupsPage} />
        <Route path="/census" component={CensusPage} />
        <Route path="/admissions" component={AdmissionsPage} />
        <Route path="/treatment-plans" component={TreatmentPlansPage} />
        <Route path="/progress-notes" component={ProgressNotesPage} />
        <Route path="/discharge" component={DischargePage} />
        <Route path="/documents" component={DocumentsPage} />
        <Route path="/isp" component={ISPPage} />
        <Route path="/behavior-tracking" component={BehaviorTrackingPage} />
        <Route path="/staff-credentials" component={StaffCredentialsPage} />
        <Route path="/custom-forms" component={CustomFormsPage} />
        <Route path="/state-reporting" component={StateReportingPage} />
        <Route path="/care-coordination" component={CareCoordinationPage} />
        <Route path="/authorizations" component={AuthorizationsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function DevTestOrProtectedRoutes() {
  const hasDevAuth = typeof window !== "undefined" && !!localStorage.getItem("x-test-user-email");
  if (hasDevAuth) return <AppRoutes />;
  return <ProtectedRoutes />;
}

function ProtectedRoutes() {
  return (
    <>
      <Show when="signed-in">
        <AppRoutes />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/dev-login" component={DevLoginPage} />
            <Route path="/inspector" component={InspectorPortalPage} />
            <Route path="/trial-setup" component={ProtectedTrialSetup} />
            <Route path="/:rest*" component={DevTestOrProtectedRoutes} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
