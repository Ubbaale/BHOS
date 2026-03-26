import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Eye,
  EyeOff,
  User,
  Mail,
  Lock,
  AlertCircle,
  Building2,
  UserPlus,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import logoImg from "@assets/Logocare-Picsart-BackgroundRemover_1767809315800.jpg";

const signupSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().min(1, "Email is required").email("Please enter a valid email"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a number"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
  accountType: z.enum(["individual", "company"]).default("individual"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

function VerificationStep({
  email,
  accountType,
}: {
  email: string;
  accountType: string;
}) {
  const { refetch } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  async function handleVerify() {
    if (code.length !== 5) {
      setError("Please enter the 5-digit code");
      return;
    }
    setIsVerifying(true);
    setError(null);
    try {
      const res = await apiRequest("POST", "/api/auth/verify-email", { email, code });
      const data = await res.json();
      setVerified(true);

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      await refetch();

      toast({ title: "Email verified!", description: "Welcome to CareHub." });

      setTimeout(() => {
        if (accountType === "company") {
          setLocation("/it-services/onboard");
        } else {
          setLocation("/it-services");
        }
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Invalid or expired code. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    setIsResending(true);
    setError(null);
    try {
      await apiRequest("POST", "/api/auth/resend-verification", { email });
      toast({ title: "Code sent!", description: "A new verification code has been sent to your email." });
    } catch (err: any) {
      setError(err.message || "Failed to resend code.");
    } finally {
      setIsResending(false);
    }
  }

  if (verified) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-8 pb-8">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <h2 className="text-2xl font-bold mb-2" data-testid="text-verified">Email Verified!</h2>
              <p className="text-muted-foreground">Redirecting you to CareHub...</p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl" data-testid="text-verify-title">Verify Your Email</CardTitle>
            <CardDescription>
              We sent a 5-digit verification code to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" data-testid="alert-verify-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Verification Code</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="Enter 5-digit code"
                className="text-center text-2xl tracking-[0.5em] font-mono"
                maxLength={5}
                data-testid="input-verify-code"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleVerify();
                }}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleVerify}
              disabled={isVerifying || code.length !== 5}
              data-testid="button-verify-submit"
            >
              {isVerifying ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
              ) : (
                <><ShieldCheck className="mr-2 h-4 w-4" />Verify Email</>
              )}
            </Button>

            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Didn't receive the code? Check your spam folder or
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={isResending}
                data-testid="button-resend-code"
              >
                {isResending ? (
                  <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Sending...</>
                ) : (
                  <><RefreshCw className="mr-2 h-3 w-3" />Resend Code</>
                )}
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground pt-2">
              <Link href="/login" className="text-primary hover:underline font-medium" data-testid="link-back-login">
                Back to Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

export default function SignupPage() {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [verificationAccountType, setVerificationAccountType] = useState("individual");

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      accountType: "individual",
    },
  });

  const accountType = form.watch("accountType");

  async function onSubmit(data: z.infer<typeof signupSchema>) {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await apiRequest("POST", "/api/auth/register", {
        fullName: data.fullName,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
        role: "user",
      });

      const result = await res.json();

      if (result.requiresVerification) {
        setVerificationEmail(data.email);
        setVerificationAccountType(data.accountType);
        toast({
          title: "Check your email!",
          description: "We sent a verification code to " + data.email,
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (verificationEmail) {
    return (
      <VerificationStep
        email={verificationEmail}
        accountType={verificationAccountType}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <img src={logoImg} alt="CareHub" className="h-16 w-16 rounded-full object-cover" />
            </div>
            <CardTitle className="text-2xl" data-testid="text-signup-title">Create Your Account</CardTitle>
            <CardDescription>Join CareHub to access IT services and more</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4" data-testid="alert-signup-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="accountType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>I am signing up as</FormLabel>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant={field.value === "individual" ? "default" : "outline"}
                        className="w-full"
                        onClick={() => field.onChange("individual")}
                        data-testid="button-type-individual"
                      >
                        <User className="mr-2 h-4 w-4" />
                        Individual
                      </Button>
                      <Button
                        type="button"
                        variant={field.value === "company" ? "default" : "outline"}
                        className="w-full"
                        onClick={() => field.onChange("company")}
                        data-testid="button-type-company"
                      >
                        <Building2 className="mr-2 h-4 w-4" />
                        Company
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="fullName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input {...field} placeholder="Your full name" className="pl-10" data-testid="input-signup-name" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input {...field} type="email" placeholder="you@example.com" className="pl-10" data-testid="input-signup-email" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a password"
                          className="pl-10 pr-10"
                          data-testid="input-signup-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type={showConfirm ? "text" : "password"}
                          placeholder="Confirm your password"
                          className="pl-10 pr-10"
                          data-testid="input-signup-confirm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                        >
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="text-xs text-muted-foreground">
                  Password must be at least 8 characters with uppercase, lowercase, and a number.
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-signup-submit">
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating Account...</>
                  ) : (
                    <><UserPlus className="mr-2 h-4 w-4" />{accountType === "company" ? "Create Account & Onboard Company" : "Create Account"}</>
                  )}
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link href="/login" className="text-primary hover:underline font-medium" data-testid="link-signin">
                    Sign In
                  </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}