import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone, Car, Truck, ChevronLeft, Building2, Heart } from "lucide-react";
import logoImg from "@assets/Logocare-Picsart-BackgroundRemover_1767809315800.jpg";
import JobPostingForm from "./JobPostingForm";
import { usePlatform } from "@/hooks/use-platform";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function Header({ title, showBack }: { title?: string; showBack?: boolean }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { showMobileUI, isIOS } = usePlatform();
  const { isAuthenticated, user } = useAuth();

  const navLinks = [
    { name: "Services", href: "#services", isAnchor: true },
    { name: "Find Jobs", href: "#jobs", isAnchor: true },
    { name: "Book Ride", href: "/book-ride", isAnchor: false },
    { name: "Report Issue", href: "#report", isAnchor: true },
    { name: "Contact", href: "#contact", isAnchor: true },
  ];

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

          <nav className="hidden md:flex items-center gap-6">
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
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  data-testid={`link-nav-${link.name.toLowerCase().replace(" ", "-")}`}
                >
                  {link.name}
                </Link>
              )
            ))}
            <Link
              href="/driver"
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-nav-driver"
            >
              <Truck className="w-4 h-4" />
              Driver Portal
            </Link>
            {isAuthenticated && (
              <Link
                href="/caregiver"
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-nav-family"
              >
                <Heart className="w-4 h-4" />
                Family Portal
              </Link>
            )}
            {isAuthenticated && (
              <Link
                href="/facility"
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-nav-facility"
              >
                <Building2 className="w-4 h-4" />
                Facility Portal
              </Link>
            )}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <a
              href="tel:774-581-9700"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              data-testid="link-phone"
            >
              <Phone className="w-4 h-4" />
              774-581-9700
            </a>
            <JobPostingForm />
            <Button asChild data-testid="button-get-started">
              <a href="https://app.carehubapp.com/#/login">Get Started</a>
            </Button>
          </div>

          {showMobileUI && (
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
          )}
        </div>

        {mobileMenuOpen && showMobileUI && (
          <div className="md:hidden py-3 border-t animate-in slide-in-from-top-2 duration-200">
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
                    className="px-3 py-3 text-sm font-medium text-muted-foreground active:bg-accent rounded-lg transition-colors touch-feedback"
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid={`link-mobile-${link.name.toLowerCase().replace(" ", "-")}`}
                  >
                    {link.name}
                  </Link>
                )
              ))}
              <Link
                href="/driver"
                className="flex items-center gap-2 px-3 py-3 text-sm font-medium text-muted-foreground active:bg-accent rounded-lg transition-colors touch-feedback"
                onClick={() => setMobileMenuOpen(false)}
                data-testid="link-mobile-driver"
              >
                <Truck className="w-4 h-4" />
                Driver Portal
              </Link>
              {isAuthenticated && (
                <Link
                  href="/caregiver"
                  className="flex items-center gap-2 px-3 py-3 text-sm font-medium text-muted-foreground active:bg-accent rounded-lg transition-colors touch-feedback"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid="link-mobile-family"
                >
                  <Heart className="w-4 h-4" />
                  Family Portal
                </Link>
              )}
              {isAuthenticated && (
                <Link
                  href="/facility"
                  className="flex items-center gap-2 px-3 py-3 text-sm font-medium text-muted-foreground active:bg-accent rounded-lg transition-colors touch-feedback"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid="link-mobile-facility"
                >
                  <Building2 className="w-4 h-4" />
                  Facility Portal
                </Link>
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
                <Button asChild className="w-full" data-testid="button-mobile-get-started">
                  <a href="https://app.carehubapp.com/#/login">Get Started</a>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
