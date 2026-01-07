import { Phone, Mail, MapPin } from "lucide-react";
import { SiFacebook, SiLinkedin, SiInstagram, SiApple, SiGoogleplay } from "react-icons/si";

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
                href="tel:774-581-9700"
                className="flex items-center gap-2 text-sm opacity-90 hover:opacity-100"
                data-testid="link-footer-phone"
              >
                <Phone className="w-4 h-4" />
                774-581-9700
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

        </div>

        <div className="border-t border-background/20 pt-8 pb-8">
          <div className="text-center">
            <h4 className="font-semibold mb-4">Carehub App Now Available</h4>
            <p className="text-sm opacity-70 mb-6">
              Download the Carehub app on iOS and Android
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="https://apps.apple.com/us/app/care-hub-app/id6444679914"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-background/10 hover:bg-background/20 transition-colors px-4 py-2 rounded-md"
                data-testid="link-app-store"
              >
                <SiApple className="w-6 h-6" />
                <div className="text-left">
                  <div className="text-xs opacity-70">Download on the</div>
                  <div className="text-sm font-semibold">App Store</div>
                </div>
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.fieldhcp.app&pcampaignid=web_share"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-background/10 hover:bg-background/20 transition-colors px-4 py-2 rounded-md"
                data-testid="link-google-play"
              >
                <SiGoogleplay className="w-5 h-5" />
                <div className="text-left">
                  <div className="text-xs opacity-70">Get it on</div>
                  <div className="text-sm font-semibold">Google Play</div>
                </div>
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-background/20 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm opacity-70">
            {new Date().getFullYear()} Carehub. All rights reserved.
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
