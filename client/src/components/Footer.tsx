import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, Mail, MapPin } from "lucide-react";
import { SiFacebook, SiLinkedin, SiInstagram } from "react-icons/si";

const footerLinks = {
  company: [
    { name: "About Us", href: "#" },
    { name: "Careers", href: "#" },
    { name: "Press", href: "#" },
    { name: "Blog", href: "#" },
  ],
  workers: [
    { name: "Find Jobs", href: "#jobs" },
    { name: "Submit Resume", href: "https://app.carehubapp.com/#/signUpSelection/signUp" },
    { name: "Benefits", href: "#" },
    { name: "Training", href: "#" },
  ],
  facilities: [
    { name: "Request Staff", href: "#" },
    { name: "Pricing", href: "#" },
    { name: "Enterprise", href: "#" },
    { name: "Case Studies", href: "#" },
  ],
  support: [
    { name: "Contact Us", href: "#contact" },
    { name: "Report Issue", href: "#report" },
    { name: "FAQ", href: "#" },
    { name: "Terms of Service", href: "#" },
  ],
};

export default function Footer() {
  return (
    <footer id="contact" className="bg-foreground text-background py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="font-semibold text-lg">Carehub</span>
            </div>
            <p className="text-sm opacity-70 mb-6">
              Your trusted partner for healthcare staffing solutions. Available 24/7.
            </p>
            <div className="space-y-3">
              <a
                href="tel:1-800-CARE-NOW"
                className="flex items-center gap-2 text-sm opacity-90 hover:opacity-100"
                data-testid="link-footer-phone"
              >
                <Phone className="w-4 h-4" />
                1-800-CARE-NOW
              </a>
              <a
                href="mailto:support@carehub.com"
                className="flex items-center gap-2 text-sm opacity-90 hover:opacity-100"
                data-testid="link-footer-email"
              >
                <Mail className="w-4 h-4" />
                support@carehub.com
              </a>
              <p className="flex items-center gap-2 text-sm opacity-70">
                <MapPin className="w-4 h-4" />
                Massachusetts
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm opacity-70 hover:opacity-100 transition-opacity"
                    data-testid={`link-footer-${link.name.toLowerCase().replace(" ", "-")}`}
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">For Workers</h4>
            <ul className="space-y-2">
              {footerLinks.workers.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm opacity-70 hover:opacity-100 transition-opacity"
                    data-testid={`link-footer-${link.name.toLowerCase().replace(" ", "-")}`}
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">For Facilities</h4>
            <ul className="space-y-2">
              {footerLinks.facilities.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm opacity-70 hover:opacity-100 transition-opacity"
                    data-testid={`link-footer-${link.name.toLowerCase().replace(" ", "-")}`}
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Newsletter</h4>
            <p className="text-sm opacity-70 mb-4">
              Stay updated on new opportunities
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Enter email"
                className="bg-background/10 border-background/20 text-background placeholder:text-background/50"
                data-testid="input-newsletter"
              />
              <Button variant="secondary" data-testid="button-subscribe">
                Subscribe
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-background/20 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm opacity-70">
            2024 Carehub. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="opacity-70 hover:opacity-100 transition-opacity"
              data-testid="link-facebook"
            >
              <SiFacebook className="w-5 h-5" />
            </a>
            <a
              href="#"
              className="opacity-70 hover:opacity-100 transition-opacity"
              data-testid="link-linkedin"
            >
              <SiLinkedin className="w-5 h-5" />
            </a>
            <a
              href="#"
              className="opacity-70 hover:opacity-100 transition-opacity"
              data-testid="link-instagram"
            >
              <SiInstagram className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
