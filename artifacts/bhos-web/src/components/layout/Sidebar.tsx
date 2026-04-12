import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { 
  LayoutDashboard, 
  Home as HomeIcon, 
  Users, 
  UserSquare, 
  Pill, 
  AlertTriangle, 
  CalendarClock, 
  ClipboardList,
  ShieldAlert,
  Fingerprint,
  ClipboardCheck,
  Shield,
  ShieldCheck,
  FileBarChart,
  DollarSign,
  Network,
  Briefcase,
  Heart,
  Brain,
  MessageSquare,
  Calendar,
  ClipboardList as ClipboardAssign,
  Car,
  Building2,
  CreditCard,
  Video,
  CalendarDays,
  Smartphone,
  LogOut,
  LockKeyhole,
  BedDouble,
  UserPlus,
  FileText,
  Target,
  Siren,
  GraduationCap,
  Landmark,
  ArrowRightLeft,
  Camera,
  LifeBuoy,
  ShieldEllipsis,
  Database,
  FolderOpen,
  Activity,
  Award,
  Layout,
  Send,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/GlobalSearch";
import logoImg from "@assets/bhos-logo.png";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, emoji: "📊" },
  { name: "Homes", href: "/homes", icon: HomeIcon, emoji: "🏠" },
  { name: "Staff", href: "/staff", icon: Users, emoji: "👥" },
  { name: "Patients", href: "/patients", icon: UserSquare, emoji: "🧑‍⚕️" },
  { name: "Census & Beds", href: "/census", icon: BedDouble, emoji: "🛏️" },
  { name: "Admissions", href: "/admissions", icon: UserPlus, emoji: "📥" },
  { name: "Treatment Plans", href: "/treatment-plans", icon: Target, emoji: "🎯" },
  { name: "Progress Notes", href: "/progress-notes", icon: FileText, emoji: "📝" },
  { name: "Discharge", href: "/discharge", icon: LogOut, emoji: "🚪" },
  { name: "Medications", href: "/medications", icon: Pill, emoji: "💊" },
  { name: "eMAR", href: "/emar", icon: ClipboardCheck, emoji: "📋" },
  { name: "Controlled Substances", href: "/controlled-substances", icon: Shield, emoji: "🔐" },
  { name: "Medication Safety", href: "/medication-safety", icon: ShieldCheck, emoji: "🛡️" },
  { name: "Med Reconciliation", href: "/medication-reconciliation", icon: ArrowRightLeft, emoji: "🔄" },
  { name: "Crisis Management", href: "/crisis", icon: Siren, emoji: "🚨" },
  { name: "Incidents", href: "/incidents", icon: AlertTriangle, emoji: "⚠️" },
  { name: "Shifts", href: "/shifts", icon: CalendarClock, emoji: "⏰" },
  { name: "Time Punches", href: "/time-punches", icon: Fingerprint, emoji: "👆" },
  { name: "Fraud Alerts", href: "/fraud-alerts", icon: ShieldAlert, emoji: "🚩" },
  { name: "Daily Logs", href: "/daily-logs", icon: ClipboardList, emoji: "📓" },
  { name: "Reports", href: "/reports", icon: FileBarChart, emoji: "📈" },
  { name: "Billing", href: "/billing", icon: DollarSign, emoji: "💰" },
  { name: "Integrations", href: "/integrations", icon: Network, emoji: "🔗" },
  { name: "Security", href: "/security", icon: Shield, emoji: "🔒" },
  { name: "Workforce", href: "/workforce", icon: Briefcase, emoji: "💼" },
  { name: "Family Portal", href: "/family-portal", icon: Heart, emoji: "❤️" },
  { name: "Predictive Analytics", href: "/predictive", icon: Brain, emoji: "🧠" },
  { name: "Staff Chat", href: "/staff-chat", icon: MessageSquare, emoji: "💬" },
  { name: "Appointments", href: "/appointments", icon: Calendar, emoji: "📅" },
  { name: "Meetings", href: "/meetings", icon: Video, emoji: "🎥" },
  { name: "Calendar Sync", href: "/calendar-sync", icon: CalendarDays, emoji: "🗓️" },
  { name: "Daily Assignments", href: "/daily-assignments", icon: ClipboardAssign, emoji: "✅" },
  { name: "Transportation", href: "/transportation", icon: Car, emoji: "🚗" },
  { name: "Training & Certs", href: "/training", icon: GraduationCap, emoji: "🎓" },
  { name: "State Compliance", href: "/compliance", icon: Landmark, emoji: "🏛️" },
  { name: "Camera System", href: "/cameras", icon: Camera, emoji: "📹" },
  { name: "Device Management", href: "/devices", icon: Smartphone, emoji: "📱" },
  { name: "Data Backups", href: "/backups", icon: Database, emoji: "💾" },
  { name: "Support", href: "/support", icon: LifeBuoy, emoji: "🎫" },
  { name: "Organization", href: "/organization", icon: Building2, emoji: "🏢" },
  { name: "Subscription", href: "/subscription", icon: CreditCard, emoji: "💳" },
  { name: "Platform Admin", href: "/platform-admin", icon: ShieldEllipsis, emoji: "🛡️" },
  { name: "Documents", href: "/documents", icon: FolderOpen, emoji: "📂" },
  { name: "ISP Plans", href: "/isp", icon: ClipboardList, emoji: "📋" },
  { name: "Behavior Tracking", href: "/behavior-tracking", icon: Activity, emoji: "📊" },
  { name: "Staff Credentials", href: "/staff-credentials", icon: Award, emoji: "🏅" },
  { name: "Custom Forms", href: "/custom-forms", icon: Layout, emoji: "📝" },
  { name: "State Reporting", href: "/state-reporting", icon: Send, emoji: "📤" },
  { name: "Care Coordination", href: "/care-coordination", icon: Stethoscope, emoji: "🩺" },
  { name: "Authorizations", href: "/authorizations", icon: ShieldCheck, emoji: "✅" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const initials = user
    ? `${(user.firstName?.[0] || "").toUpperCase()}${(user.lastName?.[0] || user.primaryEmailAddress?.emailAddress?.[0] || "").toUpperCase()}`
    : "??";

  const displayName = user
    ? user.fullName || user.primaryEmailAddress?.emailAddress || "User"
    : "Loading...";

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border bg-sidebar-primary text-sidebar-primary-foreground">
        <img src={logoImg} alt="BHOS" className="h-8 w-8 object-contain" />
        <span className="text-xl font-bold tracking-tight">BHOS</span>
      </div>
      <div className="px-3 pt-3">
        <GlobalSearch />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center rounded-md px-2 py-2 text-sm font-medium",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <span className="mr-2 text-base flex-shrink-0 w-5 text-center" aria-hidden="true">{item.emoji}</span>
                <item.icon
                  className={cn(
                    "mr-2 h-4 w-4 flex-shrink-0",
                    isActive ? "text-sidebar-accent-foreground" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm flex-shrink-0">
                {isLoaded ? initials : ".."}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => (window as any).__bhosLockScreen?.()}
              className="p-1.5 rounded-md text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition-colors"
              title="Lock screen"
            >
              <LockKeyhole className="h-4 w-4" />
            </button>
            <button
              onClick={() => signOut({ redirectUrl: "/" })}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
