import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone } from "lucide-react";
import logoImg from "@assets/Screenshot_2025-12-11_223813_1765510798530.jpg";
import JobPostingForm from "./JobPostingForm";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: "Services", href: "#services" },
    { name: "Find Jobs", href: "#jobs" },
    { name: "Report Issue", href: "#report" },
    { name: "Contact", href: "#contact" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between gap-4 h-16">
          <a href="#" className="flex items-center gap-2" data-testid="link-home">
            <img src={logoImg} alt="Carehub Logo" className="h-10 w-auto" />
            <span className="font-semibold text-lg">Carehub</span>
          </a>

          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                data-testid={`link-nav-${link.name.toLowerCase().replace(" ", "-")}`}
              >
                {link.name}
              </a>
            ))}
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

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <nav className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="px-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid={`link-mobile-${link.name.toLowerCase().replace(" ", "-")}`}
                >
                  {link.name}
                </a>
              ))}
              <div className="pt-4 flex flex-col gap-2">
                <a
                  href="tel:774-581-9700"
                  className="flex items-center gap-2 px-2 py-2 text-sm font-medium"
                  data-testid="link-mobile-phone"
                >
                  <Phone className="w-4 h-4" />
                  774-581-9700
                </a>
                <div className="px-2">
                  <JobPostingForm />
                </div>
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
