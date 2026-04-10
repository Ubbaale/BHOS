import { Link } from "wouter";
import { Activity, Pill, FileBarChart, DollarSign, Network, ShieldCheck, Heart, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImg from "@assets/bhos-logo.png";
import heroDoctor from "@assets/hero-doctor.jpg";
import heroClinical from "@assets/hero-clinical.jpg";
import heroPatient from "@assets/hero-patient.jpg";
import bgMedical from "@assets/bg-medical.jpg";
import bgCta from "@assets/bg-cta.jpg";

const features = [
  { icon: Pill, title: "Medication Safety", desc: "5 Rights verification, PRN timers, expiration tracking, controlled substance counts" },
  { icon: Activity, title: "eMAR & Clinical", desc: "Electronic medication administration, vital signs, side effect and refusal workflows" },
  { icon: ShieldCheck, title: "Compliance & Audit", desc: "Immutable audit trail, incident reporting, fraud detection with GPS geofencing" },
  { icon: FileBarChart, title: "Reports Center", desc: "14 report types across medication, clinical, operations, and compliance categories" },
  { icon: DollarSign, title: "Billing & Claims", desc: "Full revenue cycle management with EDI 837P, Medicaid, and payer integrations" },
  { icon: Network, title: "Integrations", desc: "Clearinghouse, FHIR R4, Stripe payments, and state Medicaid portal connections" },
];

const heroImages = [heroDoctor, heroClinical, heroPatient];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="flex items-center justify-between px-8 py-4 border-b bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="BHOS" className="h-9 w-9 object-contain" />
          <span className="text-xl font-bold tracking-tight text-slate-900">BHOS</span>
        </div>
        <div className="flex gap-3">
          <Link href="/sign-in">
            <Button variant="outline">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button className="bg-[#0a7ea4] hover:bg-[#086f91]">Get Started</Button>
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `url('${bgMedical}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="max-w-6xl mx-auto px-8 py-20 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-teal-50 text-teal-700 text-sm font-medium px-3 py-1.5 rounded-full mb-6">
                <Heart className="h-4 w-4" />
                Built for Behavioral Health
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-5 leading-tight">
                Behavioral Home<br />Operating System
              </h1>
              <p className="text-lg text-slate-600 mb-8 max-w-lg">
                The complete platform for managing behavioral health group homes — medication safety, clinical compliance, billing, and integrations in one place.
              </p>
              <div className="flex gap-4">
                <Link href="/sign-up">
                  <Button size="lg" className="bg-[#0a7ea4] hover:bg-[#086f91] text-base px-8">
                    Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/sign-in">
                  <Button size="lg" variant="outline" className="text-base px-8">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>

            <div className="hidden lg:grid grid-cols-2 gap-3">
              <div className="space-y-3">
                <div className="rounded-2xl overflow-hidden shadow-lg">
                  <img src={heroImages[0]} alt="Healthcare professional" className="w-full h-44 object-cover" />
                </div>
                <div className="rounded-2xl overflow-hidden shadow-lg">
                  <img src={heroImages[1]} alt="Clinical care" className="w-full h-32 object-cover" />
                </div>
              </div>
              <div className="mt-8 space-y-3">
                <div className="rounded-2xl overflow-hidden shadow-lg">
                  <img src={heroImages[2]} alt="Patient care" className="w-full h-32 object-cover" />
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-[#0a7ea4] to-[#086f91] p-6 text-white shadow-lg">
                  <p className="text-3xl font-bold">14+</p>
                  <p className="text-sm opacity-90">Report Types</p>
                  <p className="text-3xl font-bold mt-3">86</p>
                  <p className="text-sm opacity-90">Database Tables</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border-y">
        <div className="max-w-6xl mx-auto px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-[#0a7ea4]">HIPAA</p>
              <p className="text-sm text-slate-500 mt-1">Compliant</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#0a7ea4]">5 Rights</p>
              <p className="text-sm text-slate-500 mt-1">Med Safety</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#0a7ea4]">50+</p>
              <p className="text-sm text-slate-500 mt-1">Features</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#0a7ea4]">24/7</p>
              <p className="text-sm text-slate-500 mt-1">Support</p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-8 py-20">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-3">Everything You Need</h2>
        <p className="text-slate-500 text-center mb-12 max-w-xl mx-auto">
          From medication management to billing, BHOS covers every aspect of running a behavioral health group home.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition-shadow hover:border-[#0a7ea4]/30">
              <f.icon className="h-8 w-8 text-[#0a7ea4] mb-3" />
              <h3 className="font-semibold text-slate-900 mb-1">{f.title}</h3>
              <p className="text-sm text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `url('${bgCta}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="bg-gradient-to-r from-[#0a7ea4]/95 to-[#086f91]/95 relative">
          <div className="max-w-4xl mx-auto px-8 py-16 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Group Home Operations?</h2>
            <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
              Join behavioral health providers who trust BHOS to manage their homes safely and efficiently. Start your free 14-day trial today.
            </p>
            <Link href="/sign-up">
              <Button size="lg" variant="secondary" className="text-base px-10">
                Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="text-center text-sm text-slate-400 py-8 border-t bg-white">
        &copy; {new Date().getFullYear()} BHOS — Behavioral Home Operating System. All rights reserved.
      </footer>
    </div>
  );
}
