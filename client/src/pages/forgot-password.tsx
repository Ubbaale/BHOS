import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, KeyRound, Lock, ArrowLeft, CheckCircle2, Eye, EyeOff } from "lucide-react";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const codeSchema = z.object({
  code: z.string().length(5, "Code must be 5 digits").regex(/^\d{5}$/, "Code must be 5 digits"),
});

const passwordSchema = z.object({
  newPassword: z.string()
    .min(6, "Password must be at least 6 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Must contain a special character"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type Step = "email" | "code" | "password" | "success";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const codeForm = useForm<z.infer<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const requestCodeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof emailSchema>) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { email: data.email });
      return res.json();
    },
    onSuccess: (_, variables) => {
      setEmail(variables.email);
      setStep("code");
      toast({ title: "Code sent", description: "Check your email for the 5-digit reset code." });
    },
    onError: () => {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof codeSchema>) => {
      const res = await apiRequest("POST", "/api/auth/verify-reset-code", { email, code: data.code });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      setCode(variables.code);
      setStep("password");
    },
    onError: (error: Error) => {
      toast({ title: "Invalid code", description: error.message || "The code is invalid or expired.", variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof passwordSchema>) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", {
        email,
        code,
        newPassword: data.newPassword,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      setStep("success");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to reset password.", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              {step === "success" ? "Password Reset!" : "Reset Password"}
            </CardTitle>
            <CardDescription>
              {step === "email" && "Enter your email to receive a reset code"}
              {step === "code" && `Enter the 5-digit code sent to ${email}`}
              {step === "password" && "Create your new password"}
              {step === "success" && "Your password has been updated successfully"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "email" && (
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit((data) => requestCodeMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={emailForm.control}
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
                            data-testid="input-reset-email"
                            autoComplete="email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={requestCodeMutation.isPending}
                    data-testid="button-send-code"
                  >
                    {requestCodeMutation.isPending ? "Sending..." : "Send Reset Code"}
                  </Button>
                  <div className="text-center mt-4">
                    <Link href="/" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                      <ArrowLeft className="w-3 h-3" />
                      Back to Login
                    </Link>
                  </div>
                </form>
              </Form>
            )}

            {step === "code" && (
              <Form {...codeForm}>
                <form onSubmit={codeForm.handleSubmit((data) => verifyCodeMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={codeForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <KeyRound className="w-4 h-4" />
                          5-Digit Code
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            inputMode="numeric"
                            maxLength={5}
                            placeholder="Enter 5-digit code"
                            data-testid="input-reset-code"
                            className="text-center text-2xl tracking-[0.5em] font-mono"
                            autoComplete="one-time-code"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={verifyCodeMutation.isPending}
                    data-testid="button-verify-code"
                  >
                    {verifyCodeMutation.isPending ? "Verifying..." : "Verify Code"}
                  </Button>
                  <div className="flex justify-between mt-4">
                    <button
                      type="button"
                      onClick={() => setStep("email")}
                      className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                      data-testid="button-back-to-email"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      Change email
                    </button>
                    <button
                      type="button"
                      onClick={() => requestCodeMutation.mutate({ email })}
                      className="text-sm text-primary hover:underline"
                      disabled={requestCodeMutation.isPending}
                      data-testid="button-resend-code"
                    >
                      Resend code
                    </button>
                  </div>
                </form>
              </Form>
            )}

            {step === "password" && (
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit((data) => resetPasswordMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Lock className="w-4 h-4" />
                          New Password
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter new password"
                              data-testid="input-new-password"
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              data-testid="button-toggle-new-password"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Min. 6 chars with uppercase, lowercase, number, and special character
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Lock className="w-4 h-4" />
                          Confirm Password
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirm new password"
                              data-testid="input-confirm-new-password"
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              data-testid="button-toggle-confirm-new-password"
                            >
                              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                    disabled={resetPasswordMutation.isPending}
                    data-testid="button-reset-password"
                  >
                    {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                  </Button>
                </form>
              </Form>
            )}

            {step === "success" && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-muted-foreground">
                  Your password has been reset successfully. You can now log in with your new password.
                </p>
                <Link href="/">
                  <Button className="w-full" data-testid="button-back-to-login">
                    Back to Login
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
