import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Building2,
  CheckCircle2,
  ArrowRight,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import type { ItCompany } from "@shared/schema";

const companySchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  contactEmail: z.string().email("Valid email required"),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  industry: z.enum(["healthcare", "dental", "pharmacy", "clinic", "hospital", "nursing_home", "other"]).default("healthcare"),
  companySize: z.enum(["1-10", "11-50", "51-100", "100+"]).default("1-10"),
});

const industryLabels: Record<string, string> = {
  healthcare: "Healthcare",
  dental: "Dental",
  pharmacy: "Pharmacy",
  clinic: "Clinic",
  hospital: "Hospital",
  nursing_home: "Nursing Home",
  other: "Other",
};

export default function ITCompanyOnboard() {
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: existingCompany, isLoading: loadingCompany } = useQuery<ItCompany | null>({
    queryKey: ["/api/it/companies/mine"],
    enabled: isAuthenticated,
  });

  const form = useForm<z.infer<typeof companySchema>>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      companyName: "",
      contactEmail: user?.email || "",
      contactPhone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      industry: "healthcare",
      companySize: "1-10",
    },
  });

  const registerCompany = useMutation({
    mutationFn: (data: z.infer<typeof companySchema>) =>
      apiRequest("POST", "/api/it/companies", data),
    onSuccess: () => {
      toast({ title: "Company registered!", description: "Your company has been onboarded successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/it/companies/mine"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to register company", variant: "destructive" });
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <div className="max-w-2xl mx-auto px-4 py-16 text-center">
            <Building2 className="h-16 w-16 mx-auto mb-6 text-primary" />
            <h1 className="text-3xl font-bold mb-4" data-testid="text-onboard-hero">Company Onboarding</h1>
            <p className="text-lg text-muted-foreground mb-8">
              Create an account or sign in to register your healthcare company and start submitting IT service requests.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={() => setLocation("/signup")} data-testid="button-onboard-signup">
                Create an Account
              </Button>
              <Button size="lg" variant="outline" onClick={() => setLocation("/login")} data-testid="button-onboard-signin">
                Sign In
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (loadingCompany) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </main>
        <Footer />
      </div>
    );
  }

  if (existingCompany) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 py-12 px-4">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardContent className="pt-8 text-center">
                <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
                <h2 className="text-2xl font-bold mb-2" data-testid="text-company-registered">Company Registered</h2>
                <p className="text-muted-foreground mb-2">
                  Your company <span className="font-semibold text-foreground">{existingCompany.companyName}</span> is already onboarded.
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
                  {existingCompany.contactEmail && (
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{existingCompany.contactEmail}</span>
                  )}
                  {existingCompany.contactPhone && (
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{existingCompany.contactPhone}</span>
                  )}
                </div>
                <Button onClick={() => setLocation("/it-services")} data-testid="button-go-to-tickets">
                  Go to IT Services
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h1 className="text-3xl font-bold mb-2" data-testid="text-onboard-title">Sign Up / Get Started</h1>
            <p className="text-muted-foreground">
              Register your healthcare company to start submitting IT service requests.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>Tell us about your organization</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => registerCompany.mutate(data))} className="space-y-4">
                  <FormField control={form.control} name="companyName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name *</FormLabel>
                      <FormControl><Input {...field} placeholder="e.g. Sunrise Medical Center" data-testid="input-company-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="contactEmail" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email *</FormLabel>
                      <FormControl><Input {...field} type="email" placeholder="admin@yourcompany.com" data-testid="input-company-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="contactPhone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Phone</FormLabel>
                      <FormControl><Input {...field} placeholder="(555) 123-4567" data-testid="input-company-phone" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="industry" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger data-testid="select-company-industry"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {Object.entries(industryLabels).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="companySize" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Size</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger data-testid="select-company-size"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="1-10">1-10 employees</SelectItem>
                            <SelectItem value="11-50">11-50 employees</SelectItem>
                            <SelectItem value="51-100">51-100 employees</SelectItem>
                            <SelectItem value="100+">100+ employees</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="border rounded-lg p-4 space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Company Address
                    </h4>
                    <FormField control={form.control} name="address" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl><Input {...field} placeholder="123 Healthcare Blvd" data-testid="input-company-address" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField control={form.control} name="city" render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl><Input {...field} placeholder="City" data-testid="input-company-city" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="state" render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl><Input {...field} placeholder="State" data-testid="input-company-state" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="zipCode" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zip Code</FormLabel>
                          <FormControl><Input {...field} placeholder="12345" data-testid="input-company-zip" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={registerCompany.isPending} data-testid="button-register-company">
                    {registerCompany.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registering...</> : (
                      <>
                        <Building2 className="mr-2 h-4 w-4" />
                        Register Company
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}