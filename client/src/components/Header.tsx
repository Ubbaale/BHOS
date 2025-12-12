import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone } from "lucide-react";

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
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">CH</span>
            </div>
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
              href="tel:1-800-CARE-NOW"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              data-testid="link-phone"
            >
              <Phone className="w-4 h-4" />
              1-800-CARE-NOW
            </a>
            <Button data-testid="button-get-started">Get Started</Button>
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
                  href="tel:1-800-CARE-NOW"
                  className="flex items-center gap-2 px-2 py-2 text-sm font-medium"
                  data-testid="link-mobile-phone"
                >
                  <Phone className="w-4 h-4" />
                  1-800-CARE-NOW
                </a>
                <Button className="w-full" data-testid="button-mobile-get-started">
                  Get Started
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
