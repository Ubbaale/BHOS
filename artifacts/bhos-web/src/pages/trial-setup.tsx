import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Rocket, BedDouble, Users, UserSquare, Pill, ClipboardList,
  FileText, UserPlus, LogOut, Shield, BarChart3, CheckCircle, Loader2
} from "lucide-react";
import logoImg from "@assets/bhos-logo.png";

const API = `${import.meta.env.BASE_URL}api`;

function fetchApi(url: string, opts?: RequestInit) {
  return fetch(`${API}${url}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
    credentials: "include",
  }).then(r => {
    if (!r.ok) return r.json().then(d => { throw new Error(d.error || `API error: ${r.status}`); });
    return r.json();
  });
}

const FEATURES = [
  { icon: BedDouble, label: "Census & Bed Board", desc: "Real-time bed tracking" },
  { icon: UserPlus, label: "Admissions CRM", desc: "Referral pipeline" },
  { icon: ClipboardList, label: "Treatment Plans", desc: "ISP goals & progress" },
  { icon: FileText, label: "Progress Notes", desc: "SOAP, DAP, BIRP" },
  { icon: LogOut, label: "Discharge Planning", desc: "Aftercare & follow-ups" },
  { icon: Pill, label: "eMAR & Medications", desc: "5 Rights verification" },
  { icon: Shield, label: "HIPAA Security", desc: "Audit trails & compliance" },
  { icon: BarChart3, label: "Predictive Analytics", desc: "Risk scoring" },
  { icon: Users, label: "Workforce Mgmt", desc: "Shifts & scheduling" },
];

export default function TrialSetupPage() {
  const [companyName, setCompanyName] = useState("");
  const [, navigate] = useLocation();
  const { user } = useUser();
  const [seeded, setSeeded] = useState(false);
  const qc = useQueryClient();

  const seedDemo = useMutation({
    mutationFn: () => fetchApi("/organizations/seed-demo", {
      method: "POST",
      body: JSON.stringify({
        companyName: companyName || `${user?.firstName || "My"}'s Behavioral Health`,
        planTier: "professional",
        email: user?.primaryEmailAddress?.emailAddress,
      }),
    }),
    onSuccess: () => {
      setSeeded(true);
      qc.invalidateQueries({ queryKey: ["my-org-check"] });
      setTimeout(() => navigate("/dashboard"), 2000);
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src={logoImg} alt="BHOS" className="h-12 w-12 object-contain" />
            <h1 className="text-3xl font-bold text-gray-900">Welcome to BHOS</h1>
          </div>
          <p className="text-lg text-gray-600">
            {user?.firstName ? `Hi ${user.firstName}! ` : ""}Let's get you started with a free 14-day trial.
          </p>
        </div>

        {seeded ? (
          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-green-800 mb-2">You're All Set!</h2>
              <p className="text-green-700 mb-4">
                Your trial is loaded with sample data across all modules. Redirecting to your dashboard...
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Badge className="bg-green-100 text-green-700">3 Homes</Badge>
                <Badge className="bg-green-100 text-green-700">10 Patients</Badge>
                <Badge className="bg-green-100 text-green-700">8 Staff</Badge>
                <Badge className="bg-green-100 text-green-700">15+ Medications</Badge>
                <Badge className="bg-green-100 text-green-700">6 Referrals</Badge>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-2 mb-6">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-primary" /> Start Your Free Trial
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  We'll set up your workspace with realistic sample data — homes, patients, staff, medications, treatment plans, and more — so you can explore every feature immediately.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Organization Name (optional)</label>
                    <Input
                      className="mt-1"
                      placeholder={`${user?.firstName || "My"}'s Behavioral Health`}
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full h-12 text-base"
                    onClick={() => seedDemo.mutate()}
                    disabled={seedDemo.isPending}
                  >
                    {seedDemo.isPending ? (
                      <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Setting up your trial...</>
                    ) : (
                      <><Rocket className="h-5 w-5 mr-2" /> Start 14-Day Free Trial</>
                    )}
                  </Button>
                  {seedDemo.isError && (
                    <p className="text-sm text-red-600 text-center">{(seedDemo.error as any)?.message}</p>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-400">
                  <span>No credit card required</span>
                  <span>·</span>
                  <span>Full access to all features</span>
                  <span>·</span>
                  <span>Cancel anytime</span>
                </div>
              </CardContent>
            </Card>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 text-center">Everything Included in Your Trial</h3>
              <div className="grid grid-cols-3 gap-3">
                {FEATURES.map(f => (
                  <Card key={f.label} className="border">
                    <CardContent className="p-3 flex items-start gap-2">
                      <f.icon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium leading-tight">{f.label}</p>
                        <p className="text-[10px] text-gray-400">{f.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
