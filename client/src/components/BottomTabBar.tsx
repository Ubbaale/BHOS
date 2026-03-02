import { useLocation, Link } from "wouter";
import { Home, Car, Briefcase, AlertTriangle, User, ClipboardList } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { usePlatform } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";

const tabs = [
  { icon: Home, label: "Home", path: "/", testId: "tab-home" },
  { icon: Car, label: "Book Ride", path: "/book-ride", testId: "tab-book-ride" },
  { icon: ClipboardList, label: "My Rides", path: "/my-rides", testId: "tab-my-rides" },
  { icon: Briefcase, label: "Jobs", path: "/", hash: "#jobs", testId: "tab-jobs" },
  { icon: User, label: "Account", path: "/driver/login", testId: "tab-account" },
];

export default function BottomTabBar() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { isIOS } = usePlatform();

  const getAccountPath = () => {
    if (!isAuthenticated) return "/driver/login";
    if (user?.role === "admin") return "/admin";
    return "/driver";
  };

  const isActive = (tab: typeof tabs[0]) => {
    if (tab.hash) return location === "/";
    if (tab.path === "/") return location === "/" && !tab.hash;
    return location.startsWith(tab.path);
  };

  const handleTabClick = (tab: typeof tabs[0]) => {
    const path = tab.label === "Account" ? getAccountPath() : tab.path;

    if (tab.hash) {
      if (location !== "/") {
        setLocation("/");
        setTimeout(() => {
          const el = document.querySelector(tab.hash!);
          el?.scrollIntoView({ behavior: "smooth" });
        }, 300);
      } else {
        const el = document.querySelector(tab.hash);
        el?.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }

    setLocation(path);
  };

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border",
        "md:hidden",
        isIOS ? "pb-[env(safe-area-inset-bottom)]" : "pb-0"
      )}
      data-testid="bottom-tab-bar"
    >
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const active = isActive(tab);
          const Icon = tab.icon;

          return (
            <button
              key={tab.label}
              onClick={() => handleTabClick(tab)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
                "active:scale-95 active:opacity-70",
                active ? "text-primary" : "text-muted-foreground"
              )}
              data-testid={tab.testId}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
