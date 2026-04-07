import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Menu, X, Phone, Car, Truck, ChevronLeft, Building2, Heart,
  Monitor, Package, LogOut, User, LayoutDashboard, History,
  ClipboardList, Shield, Briefcase, Wrench, UserPlus,
} from "lucide-react";
import logoImg from "@assets/Logocare-Picsart-BackgroundRemover_1767809315800.jpg";
import JobPostingForm from "./JobPostingForm";
import { usePlatform } from "@/hooks/use-platform";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

function getDashboardPath(role?: string) {
  switch (role) {
    case "admin": return "/admin";
    case "driver": return "/driver";
    case "patient": return "/book-ride";
    case "caregiver": return "/caregiver";
    case "facility_staff": return "/facility";
    case "it_tech": return "/it-tech";
    default: return "/";
  }
}

function getRoleDashboardLabel(role?: string) {
  switch (role) {
    case "admin": return "Admin Dashboard";
    case "driver": return "Driver Dashboard";
    case "patient": return "Book a Ride";
    case "caregiver": return "Caregiver Portal";
    case "facility_staff": return "Facility Portal";
    case "it_tech": return "Tech Dashboard";
    default: return "Dashboard";
  }
}

export default function Header({ title, showBack }: { title?: string; showBack?: boolean }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { showMobileUI, isIOS } = usePlatform();
  const { isAuthenticated, user, logout } = useAuth();
  const scrollYRef = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mobileMenuOpen) {
      scrollYRef.current = window.scrollY;
      document.body.classList.add("body-scroll-lock");
      document.body.style.top = `-${scrollYRef.current}px`;
    } else {
      document.body.classList.remove("body-scroll-lock");
      document.body.style.top = "";
      window.scrollTo(0, scrollYRef.current);
    }
    return () => {
      document.body.classList.remove("body-scroll-lock");
      document.body.style.top = "";
    };
  }, [mobileMenuOpen]);

  const handleMenuTouchMove = useCallback((e: React.TouchEvent) => {
    const el = menuRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const isAtTop = scrollTop <= 0;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight;
    const touchDelta = e.touches[0]?.clientY;
    if (!touchDelta) return;
    if ((isAtTop && scrollTop === 0) || (isAtBottom && scrollTop > 0)) {
      // let the scroll container handle it naturally
    }
  }, []);

  const isHomePage = location === "/";

  const navLinks = isHomePage
    ? [
        { name: "Services", href: "#services", isAnchor: true },
        { name: "Find Jobs", href: "#jobs", isAnchor: true },
        { name: "Book Ride", href: "/book-ride", isAnchor: false },
        { name: "IT Services", href: "/it-services", isAnchor: false },
        { name: "Contact", href: "#contact", isAnchor: true },
      ]
    : [
        { name: "Home", href: "/", isAnchor: false },
        { name: "Book Ride", href: "/book-ride", isAnchor: false },
        { name: "IT Services", href: "/it-services", isAnchor: false },
        { name: "Courier", href: "/courier/onboard", isAnchor: false },
      ];

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  if (showMobileUI && title) {
    return (
      <header
        className={cn(
          "sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b",
          isIOS && "safe-top"
        )}
        data-testid="header-mobile-inner"
      >
        <div className="flex items-center justify-between h-12 px-4">
          {showBack ? (
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-1 text-primary touch-feedback"
              data-testid="button-back"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Back</span>
            </button>
          ) : (
            <div className="w-16" />
          )}
          <h1 className="text-base font-semibold truncate max-w-[60%] text-center">{title}</h1>
          <div className="w-16" />
        </div>
      </header>
    );
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b",
        showMobileUI && isIOS && "safe-top"
      )}
      data-testid="header"
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className={cn(
          "flex items-center justify-between gap-4",
          showMobileUI ? "h-12" : "h-16"
        )}>
          <Link href="/" className="flex items-center gap-2 touch-feedback" data-testid="link-home">
            <img
              src={logoImg}
              alt="Carehub Logo"
              className={cn(showMobileUI ? "h-8 w-auto" : "h-10 w-auto")}
            />
            <span className={cn(
              "font-semibold",
              showMobileUI ? "text-base" : "text-lg"
            )}>Carehub</span>
          </Link>

          <nav className="hidden md:flex items-center gap-5">
            {navLinks.map((link) => (
              link.isAnchor ? (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  data-testid={`link-nav-${link.name.toLowerCase().replace(" ", "-")}`}
                >
                  {link.name}
                </a>
              ) : (
                <Link
                  key={link.name}
                  href={link.href}
                  className={cn(
                    "text-sm font-medium transition-colors",
                    location === link.href
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  data-testid={`link-nav-${link.name.toLowerCase().replace(" ", "-")}`}
                >
                  {link.name}
                </Link>
              )
            ))}
            <Link
              href="/driver/apply"
              className={cn(
                "flex items-center gap-1 text-sm font-medium transition-colors",
                location.startsWith("/driver")
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid="link-nav-driver"
            >
              <Truck className="w-4 h-4" />
              Drive
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <a
              href="tel:774-581-9700"
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              data-testid="link-phone"
            >
              <Phone className="w-4 h-4" />
              774-581-9700
            </a>
            <JobPostingForm />

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2" data-testid="button-user-menu">
                    <User className="w-4 h-4" />
                    <span className="max-w-[120px] truncate">
                      {user?.username?.split("@")[0] || "Account"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">{user?.username?.split("@")[0]}</p>
                      <p className="text-xs text-muted-foreground">{user?.username}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem asChild data-testid="menu-dashboard">
                    <Link href={getDashboardPath(user?.role)} className="flex items-center gap-2 cursor-pointer">
                      <LayoutDashboard className="w-4 h-4" />
                      {getRoleDashboardLabel(user?.role)}
                    </Link>
                  </DropdownMenuItem>

                  {(user?.role === "patient" || user?.role === "caregiver") && (
                    <DropdownMenuItem asChild data-testid="menu-ride-history">
                      <Link href="/my-rides" className="flex items-center gap-2 cursor-pointer">
                        <History className="w-4 h-4" />
                        Ride History
                      </Link>
                    </DropdownMenuItem>
                  )}

                  {user?.role === "driver" && (
                    <>
                      <DropdownMenuItem asChild data-testid="menu-trip-history">
                        <Link href="/driver/trip-history" className="flex items-center gap-2 cursor-pointer">
                          <History className="w-4 h-4" />
                          Trip History
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild data-testid="menu-earnings">
                        <Link href="/driver/earnings" className="flex items-center gap-2 cursor-pointer">
                          <ClipboardList className="w-4 h-4" />
                          Earnings
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}

                  {user?.role === "admin" && (
                    <DropdownMenuItem asChild data-testid="menu-admin-drivers">
                      <Link href="/admin/drivers" className="flex items-center gap-2 cursor-pointer">
                        <Shield className="w-4 h-4" />
                        Manage Drivers
                      </Link>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem asChild data-testid="menu-book-ride">
                    <Link href="/book-ride" className="flex items-center gap-2 cursor-pointer">
                      <Car className="w-4 h-4" />
                      Book a Ride
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild data-testid="menu-it-services">
                    <Link href="/it-services" className="flex items-center gap-2 cursor-pointer">
                      <Monitor className="w-4 h-4" />
                      IT Services
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild data-testid="menu-courier">
                    <Link href="/courier/onboard" className="flex items-center gap-2 cursor-pointer">
                      <Package className="w-4 h-4" />
                      Medical Courier
                    </Link>
                  </DropdownMenuItem>

                  {isAuthenticated && (
                    <>
                      <DropdownMenuItem asChild data-testid="menu-caregiver">
                        <Link href="/caregiver" className="flex items-center gap-2 cursor-pointer">
                          <Heart className="w-4 h-4" />
                          Family Portal
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild data-testid="menu-facility">
                        <Link href="/facility" className="flex items-center gap-2 cursor-pointer">
                          <Building2 className="w-4 h-4" />
                          Facility Portal
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                    data-testid="menu-sign-out"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" asChild data-testid="button-sign-up">
                  <Link href="/signup">Sign Up</Link>
                </Button>
                <Button asChild data-testid="button-sign-in">
                  <Link href="/login">Sign In</Link>
                </Button>
              </div>
            )}
          </div>

          <div className="flex md:hidden items-center gap-2">
            <JobPostingForm />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div
            ref={menuRef}
            onTouchMove={handleMenuTouchMove}
            className="md:hidden py-3 border-t animate-in slide-in-from-top-2 duration-200 max-h-[calc(100vh-4rem)] ios-scroll-container safe-bottom"
          >
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                link.isAnchor ? (
                  <a
                    key={link.name}
                    href={link.href}
                    className="px-3 py-3 text-sm font-medium text-muted-foreground active:bg-accent rounded-lg transition-colors touch-feedback"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid={`link-mobile-${link.name.toLowerCase().replace(" ", "-")}`}
                  >
                    {link.name}
                  </a>
                ) : (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={cn(
                      "px-3 py-3 text-sm font-medium rounded-lg transition-colors touch-feedback",
                      location === link.href ? "text-foreground bg-accent/50" : "text-muted-foreground active:bg-accent"
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid={`link-mobile-${link.name.toLowerCase().replace(" ", "-")}`}
                  >
                    {link.name}
                  </Link>
                )
              ))}

              <div className="my-1 border-t" />

              <Link
                href="/driver/apply"
                className="flex items-center gap-2 px-3 py-3 text-sm font-medium text-muted-foreground active:bg-accent rounded-lg touch-feedback"
                onClick={() => setMobileMenuOpen(false)}
                data-testid="link-mobile-driver"
              >
                <Truck className="w-4 h-4" />
                Become a Driver
              </Link>
              <Link
                href="/it-services"
                className="flex items-center gap-2 px-3 py-3 text-sm font-medium text-muted-foreground active:bg-accent rounded-lg touch-feedback"
                onClick={() => setMobileMenuOpen(false)}
                data-testid="link-mobile-it-services"
              >
                <Monitor className="w-4 h-4" />
                IT Services
              </Link>
              <Link
                href="/courier/onboard"
                className="flex items-center gap-2 px-3 py-3 text-sm font-medium text-muted-foreground active:bg-accent rounded-lg touch-feedback"
                onClick={() => setMobileMenuOpen(false)}
                data-testid="link-mobile-courier"
              >
                <Package className="w-4 h-4" />
                Medical Courier
              </Link>

              {isAuthenticated && (
                <>
                  <div className="my-1 border-t" />
                  <Link
                    href={getDashboardPath(user?.role)}
                    className="flex items-center gap-2 px-3 py-3 text-sm font-medium text-foreground active:bg-accent rounded-lg touch-feedback"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="link-mobile-dashboard"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    {getRoleDashboardLabel(user?.role)}
                  </Link>
                  <Link
                    href="/caregiver"
                    className="flex items-center gap-2 px-3 py-3 text-sm font-medium text-muted-foreground active:bg-accent rounded-lg touch-feedback"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="link-mobile-family"
                  >
                    <Heart className="w-4 h-4" />
                    Family Portal
                  </Link>
                  <Link
                    href="/facility"
                    className="flex items-center gap-2 px-3 py-3 text-sm font-medium text-muted-foreground active:bg-accent rounded-lg touch-feedback"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid="link-mobile-facility"
                  >
                    <Building2 className="w-4 h-4" />
                    Facility Portal
                  </Link>
                </>
              )}

              <div className="pt-3 mt-1 border-t flex flex-col gap-2">
                <a
                  href="tel:774-581-9700"
                  className="flex items-center gap-2 px-3 py-3 text-sm font-medium touch-feedback"
                  data-testid="link-mobile-phone"
                >
                  <Phone className="w-4 h-4" />
                  774-581-9700
                </a>
                {isAuthenticated ? (
                  <div className="flex flex-col gap-2">
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Signed in as <span className="font-medium text-foreground">{user?.username}</span>
                    </div>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                      data-testid="button-mobile-sign-out"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button asChild className="flex-1" variant="outline" data-testid="button-mobile-sign-up">
                      <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>Sign Up</Link>
                    </Button>
                    <Button asChild className="flex-1" data-testid="button-mobile-sign-in">
                      <Link href="/login" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                    </Button>
                  </div>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
