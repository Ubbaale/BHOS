import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoImg from "@assets/bhos-logo.png";
import bgMedical from "@assets/bg-medical.jpg";

const TEST_ACCOUNTS = [
  { email: "admin@test.bhos.app", role: "admin", name: "Admin TestUser", color: "bg-red-100 text-red-700" },
  { email: "manager@test.bhos.app", role: "manager", name: "Manager TestUser", color: "bg-blue-100 text-blue-700" },
  { email: "nurse@test.bhos.app", role: "nurse", name: "Nurse TestUser", color: "bg-green-100 text-green-700" },
  { email: "caregiver@test.bhos.app", role: "caregiver", name: "Caregiver TestUser", color: "bg-amber-100 text-amber-700" },
];

export default function DevLoginPage() {
  const [status, setStatus] = useState<string>("");
  const [customEmail, setCustomEmail] = useState("");

  const handleLogin = useCallback((email: string) => {
    localStorage.setItem("x-test-user-email", email);
    setStatus(`Logged in as ${email}`);
    window.location.href = import.meta.env.BASE_URL + "dashboard";
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("x-test-user-email");
    setStatus("Logged out");
    window.location.href = import.meta.env.BASE_URL;
  };

  const handleCustomLogin = () => {
    if (customEmail.trim()) {
      handleLogin(customEmail.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCustomLogin();
    }
  };

  const current = localStorage.getItem("x-test-user-email");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-teal-50/20 relative overflow-hidden p-4">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url('${bgMedical}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
      <Card className="max-w-md w-full relative z-10 shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            <img src={logoImg} alt="BHOS" className="h-12 w-12 object-contain" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            Dev Test Login
            <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">DEV ONLY</Badge>
          </CardTitle>
          {current && (
            <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
              Signed in as: <span className="font-medium">{current}</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick Login</p>
            {TEST_ACCOUNTS.map(account => (
              <Button key={account.email} variant="outline" className="w-full justify-between h-12"
                onClick={() => handleLogin(account.email)}>
                <span className="font-medium">{account.name}</span>
                <Badge className={`capitalize ${account.color}`}>{account.role}</Badge>
              </Button>
            ))}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">or enter email</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-email">Custom Email</Label>
            <div className="flex gap-2">
              <Input
                id="custom-email"
                type="email"
                placeholder="user@test.bhos.app"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button onClick={handleCustomLogin} disabled={!customEmail.trim()}>
                Login
              </Button>
            </div>
          </div>

          {current && (
            <Button variant="destructive" className="w-full" onClick={handleLogout}>
              Log Out
            </Button>
          )}
          {status && <p className="text-sm text-center text-muted-foreground">{status}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
