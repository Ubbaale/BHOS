import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
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
import { Loader2, Eye, EyeOff, Mail, Lock, AlertCircle, Smartphone, Monitor } from "lucide-react";
import { SiApple, SiGoogleplay } from "react-icons/si";
import logoImg from "@assets/Logocare-Picsart-BackgroundRemover_1767809315800.jpg";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showWebLogin, setShowWebLogin] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "admin") setLocation("/admin");
      else if (user.role === "driver") setLocation("/driver");
      else setLocation("/");
    }
  }, [isAuthenticated, user, setLocation]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await login(data.email, data.password);
      if (result.success) {
        toast({ title: "Welcome back!", description: "Login successful." });
        if (result.redirectTo) {
          setLocation(result.redirectTo);
        } else {
          setLocation("/");
        }
      } else {
        if (result.redirectTo) {
          setLocation(result.redirectTo);
        } else {
          setError(result.message || "Invalid email or password.");
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isMobile && !showWebLogin) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                <img src={logoImg} alt="CareHub" className="h-16 w-auto mx-auto rounded-lg" />
              </div>
              <CardTitle className="text-2xl font-bold" data-testid="text-login-title">Welcome to CareHub</CardTitle>
              <CardDescription>
                Choose how you'd like to sign in
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full h-14 text-base"
                asChild
                data-testid="button-open-app"
              >
                <a href="https://app.carehubapp.com/#/login">
                  <Smartphone className="mr-2 h-5 w-5" />
                  Open CareHub App
                </a>
              </Button>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-12" asChild data-testid="button-app-store">
                  <a href="https://apps.apple.com/app/id6444679914" target="_blank" rel="noopener noreferrer">
                    <SiApple className="mr-2 h-4 w-4" />
                    App Store
                  </a>
                </Button>
                <Button variant="outline" className="h-12" asChild data-testid="button-play-store">
                  <a href="https://play.google.com/store/apps/details?id=com.fieldhcp.app" target="_blank" rel="noopener noreferrer">
                    <SiGoogleplay className="mr-2 h-4 w-4" />
                    Google Play
                  </a>
                </Button>
              </div>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full h-12"
                onClick={() => setShowWebLogin(true)}
                data-testid="button-web-login"
              >
                <Monitor className="mr-2 h-4 w-4" />
                Sign in on Web
              </Button>

              <p className="text-xs text-center text-muted-foreground mt-2">
                Admins and drivers can sign in on the web to access dashboards
              </p>
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
            <div className="mx-auto mb-4">
              <img src={logoImg} alt="CareHub" className="h-16 w-auto mx-auto rounded-lg" />
            </div>
            <CardTitle className="text-2xl font-bold" data-testid="text-login-title">Sign In</CardTitle>
            <CardDescription>
              Sign in to your CareHub account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription data-testid="text-login-error">{error}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email Address
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="Enter your email"
                          data-testid="input-login-email"
                          autoComplete="email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        Password
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            data-testid="input-login-password"
                            className="pr-10"
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            data-testid="button-toggle-login-password"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                  data-testid="button-login-submit"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>

                <div className="text-center mt-3">
                  <Link href="/forgot-password">
                    <Button
                      variant="link"
                      type="button"
                      className="text-sm text-muted-foreground hover:text-primary p-0 h-auto"
                      data-testid="link-forgot-password"
                    >
                      Forgot Password?
                    </Button>
                  </Link>
                </div>
              </form>
            </Form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Button
                variant="link"
                className="p-0 h-auto text-primary"
                onClick={() => setLocation("/signup")}
                data-testid="link-signup"
              >
                Sign Up
              </Button>
            </div>

            <div className="mt-4 pt-4 border-t text-center text-sm text-muted-foreground">
              <p>Want to drive with CareHub?</p>
              <Button
                variant="ghost"
                onClick={() => setLocation("/driver/apply")}
                data-testid="link-apply"
              >
                Apply to become a driver
              </Button>
            </div>

            {isMobile && (
              <div className="mt-4 pt-4 border-t text-center">
                <Button
                  variant="outline"
                  className="w-full"
                  asChild
                  data-testid="button-switch-to-app"
                >
                  <a href="https://app.carehubapp.com/#/login">
                    <Smartphone className="mr-2 h-4 w-4" />
                    Open CareHub App Instead
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
