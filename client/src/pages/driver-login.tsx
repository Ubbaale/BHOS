import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Car, AlertCircle } from "lucide-react";
import BackToHome from "@/components/BackToHome";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function DriverLogin() {
  const [, setLocation] = useLocation();
  const { login, isAuthenticated, driver } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  if (isAuthenticated && driver) {
    setLocation("/driver");
    return null;
  }

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    setError(null);

    const result = await login(data.username, data.password);

    if (result.success) {
      setLocation("/driver");
    } else {
      if (result.redirectTo) {
        setLocation(result.redirectTo);
      } else {
        setError(result.message || "Login failed");
      }
    }

    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <BackToHome />
        
        <Card className="mt-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Car className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Driver Portal Login</CardTitle>
            <CardDescription>
              Sign in to access your driver dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter your username"
                          data-testid="input-username"
                          autoComplete="username"
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
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Enter your password"
                          data-testid="input-password"
                          autoComplete="current-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                  data-testid="button-login"
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
              </form>
            </Form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>Not a driver yet?</p>
              <Button
                variant="ghost"
                onClick={() => setLocation("/driver/apply")}
                data-testid="link-apply"
              >
                Apply to become a driver
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
