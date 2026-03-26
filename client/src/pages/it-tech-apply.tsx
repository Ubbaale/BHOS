import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Wrench,
  CheckCircle2,
  Eye,
  EyeOff,
  Wifi,
  Monitor,
  Shield,
  HardDrive,
  Server,
  Printer,
} from "lucide-react";

const applySchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(1, "Phone number is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  skills: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  experienceYears: z.enum(["0-1", "1-3", "3-5", "5-10", "10+"]).default("0-1"),
  bio: z.string().optional(),
  hourlyRate: z.string().optional(),
});

const skillOptions = [
  { label: "Network / Wi-Fi Setup", value: "network", icon: Wifi },
  { label: "Hardware Repair", value: "hardware", icon: HardDrive },
  { label: "Software Installation", value: "software", icon: Monitor },
  { label: "Printer / Scanner", value: "printer", icon: Printer },
  { label: "EHR Systems", value: "ehr_system", icon: Server },
  { label: "Cybersecurity / HIPAA", value: "security", icon: Shield },
  { label: "Server Administration", value: "server_admin", icon: Server },
  { label: "Desktop Support", value: "desktop_support", icon: Monitor },
  { label: "VoIP / Phone Systems", value: "voip", icon: Monitor },
  { label: "Cabling / Infrastructure", value: "cabling", icon: Wrench },
  { label: "Cloud Services", value: "cloud", icon: Server },
  { label: "Data Backup / Recovery", value: "backup", icon: HardDrive },
];

const certOptions = [
  "CompTIA A+",
  "CompTIA Network+",
  "CompTIA Security+",
  "Microsoft Certified",
  "Cisco CCNA",
  "HIPAA Compliance",
  "AWS Certified",
  "Google IT Support",
  "ITIL Foundation",
  "Apple Certified",
];

export default function ITTechApplyPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);

  const form = useForm<z.infer<typeof applySchema>>({
    resolver: zodResolver(applySchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      city: "",
      state: "",
      zipCode: "",
      skills: [],
      certifications: [],
      experienceYears: "0-1",
      bio: "",
      hourlyRate: "",
    },
  });

  const toggleSkill = (skill: string) => {
    const updated = selectedSkills.includes(skill)
      ? selectedSkills.filter(s => s !== skill)
      : [...selectedSkills, skill];
    setSelectedSkills(updated);
    form.setValue("skills", updated);
  };

  const toggleCert = (cert: string) => {
    const updated = selectedCerts.includes(cert)
      ? selectedCerts.filter(c => c !== cert)
      : [...selectedCerts, cert];
    setSelectedCerts(updated);
    form.setValue("certifications", updated);
  };

  const onSubmit = async (data: z.infer<typeof applySchema>) => {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/it/tech/apply", data);
      setSubmitted(true);
      toast({ title: "Application submitted!", description: "We'll review your application and get back to you." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to submit application", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-8 pb-8">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <h2 className="text-2xl font-bold mb-2" data-testid="text-apply-success">Application Submitted!</h2>
              <p className="text-muted-foreground mb-6">
                Thank you for applying to be a CareHub IT Technician. We'll review your application and notify you once approved.
              </p>
              <div className="space-y-3">
                <Button className="w-full" onClick={() => setLocation("/login")} data-testid="button-login-after-apply">
                  Sign In to Your Account
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setLocation("/")} data-testid="button-home-after-apply">
                  Back to Home
                </Button>
              </div>
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
      <main className="flex-1 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Wrench className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl" data-testid="text-tech-apply-title">Become a CareHub IT Tech</CardTitle>
              <CardDescription>
                Join our network of IT professionals serving healthcare facilities. Get dispatched to jobs, set your own rates, and help keep healthcare technology running.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold">Personal Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="fullName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name *</FormLabel>
                          <FormControl><Input {...field} placeholder="John Smith" data-testid="input-tech-name" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl><Input {...field} type="email" placeholder="john@example.com" data-testid="input-tech-email" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone *</FormLabel>
                          <FormControl><Input {...field} placeholder="(555) 123-4567" data-testid="input-tech-phone" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input {...field} type={showPassword ? "text" : "password"} placeholder="Min 8 characters" data-testid="input-tech-password" className="pr-10" />
                              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" data-testid="button-toggle-tech-password">
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold">Location</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField control={form.control} name="city" render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl><Input {...field} placeholder="City" data-testid="input-tech-city" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="state" render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl><Input {...field} placeholder="State" data-testid="input-tech-state" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="zipCode" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zip Code</FormLabel>
                          <FormControl><Input {...field} placeholder="12345" data-testid="input-tech-zip" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold">Skills & Expertise</h3>
                    <p className="text-sm text-muted-foreground">Select all that apply</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {skillOptions.map(skill => {
                        const Icon = skill.icon;
                        const isSelected = selectedSkills.includes(skill.value);
                        return (
                          <button
                            key={skill.value}
                            type="button"
                            onClick={() => toggleSkill(skill.value)}
                            className={`flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/50"
                            }`}
                            data-testid={`skill-${skill.value}`}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span>{skill.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold">Certifications</h3>
                    <p className="text-sm text-muted-foreground">Select any certifications you hold</p>
                    <div className="flex flex-wrap gap-2">
                      {certOptions.map(cert => {
                        const isSelected = selectedCerts.includes(cert);
                        return (
                          <Badge
                            key={cert}
                            variant={isSelected ? "default" : "outline"}
                            className={`cursor-pointer text-sm py-1.5 px-3 ${isSelected ? "" : "hover:bg-primary/10"}`}
                            onClick={() => toggleCert(cert)}
                            data-testid={`cert-${cert.replace(/\s+/g, "-").toLowerCase()}`}
                          >
                            {isSelected && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {cert}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold">Experience & Rate</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="experienceYears" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Years of Experience</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger data-testid="select-tech-experience"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="0-1">0-1 years</SelectItem>
                              <SelectItem value="1-3">1-3 years</SelectItem>
                              <SelectItem value="3-5">3-5 years</SelectItem>
                              <SelectItem value="5-10">5-10 years</SelectItem>
                              <SelectItem value="10+">10+ years</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="hourlyRate" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Desired Hourly Rate ($)</FormLabel>
                          <FormControl><Input {...field} placeholder="e.g. 45" data-testid="input-tech-rate" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="bio" render={({ field }) => (
                      <FormItem>
                        <FormLabel>About You</FormLabel>
                        <FormControl><Textarea {...field} placeholder="Tell us about your experience working with healthcare IT systems..." rows={3} data-testid="input-tech-bio" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <Button type="submit" className="w-full" size="lg" disabled={isSubmitting} data-testid="button-submit-tech-apply">
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : "Submit Application"}
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