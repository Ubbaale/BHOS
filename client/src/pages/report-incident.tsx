import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import BackToHome from "@/components/BackToHome";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import type { Ride } from "@shared/schema";
import { 
  ChevronLeft, Upload, X, AlertTriangle, FileText, Image, 
  CheckCircle, Car, MapPin, Calendar
} from "lucide-react";
import { format } from "date-fns";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];

const incidentSchema = z.object({
  reporterName: z.string().min(1, "Name is required"),
  reporterPhone: z.string().min(1, "Phone number is required"),
  reporterEmail: z.string().email().optional().or(z.literal("")),
  category: z.enum(["accident", "driver_behavior", "vehicle_issue", "safety_concern", "billing", "other"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().min(10, "Please provide at least 10 characters describing the incident"),
  location: z.string().optional(),
  incidentDate: z.string().optional(),
});

type IncidentFormData = z.infer<typeof incidentSchema>;

export default function ReportIncident() {
  const { id } = useParams<{ id: string }>();
  const rideId = id ? parseInt(id) : undefined;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const { data: ride } = useQuery<Ride>({
    queryKey: ["/api/rides", rideId],
    enabled: !!rideId,
  });

  const form = useForm<IncidentFormData>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      reporterName: "",
      reporterPhone: "",
      reporterEmail: "",
      category: "safety_concern",
      severity: "medium",
      description: "",
      location: "",
      incidentDate: new Date().toISOString().split("T")[0],
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: IncidentFormData) => {
      const formData = new FormData();
      if (rideId) formData.append("rideId", rideId.toString());
      formData.append("reporterType", "patient");
      formData.append("reporterName", data.reporterName);
      formData.append("reporterPhone", data.reporterPhone);
      if (data.reporterEmail) formData.append("reporterEmail", data.reporterEmail);
      formData.append("category", data.category);
      formData.append("severity", data.severity);
      formData.append("description", data.description);
      if (data.location) formData.append("location", data.location);
      if (data.incidentDate) formData.append("incidentDate", data.incidentDate);
      
      selectedFiles.forEach((file) => {
        formData.append("evidence", file);
      });

      const response = await fetch("/api/incidents", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to submit incident report");
      }

      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Report Submitted",
        description: "Your incident report has been submitted. Our team will review it shortly.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    setFileError(null);

    if (!files) return;

    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setFileError("Invalid file type. Only PNG, JPG, and PDF files are allowed.");
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setFileError("File is too large. Maximum size is 10MB per file.");
        return;
      }

      newFiles.push(file);
    }

    if (selectedFiles.length + newFiles.length > 5) {
      setFileError("Maximum 5 files allowed.");
      return;
    }

    setSelectedFiles([...selectedFiles, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const onSubmit = (data: IncidentFormData) => {
    submitMutation.mutate(data);
  };

  if (submitted) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Report Submitted</h2>
            <p className="text-muted-foreground mb-6">
              Thank you for reporting this incident. Our safety team will review your report and may contact you for additional information.
            </p>
            <div className="flex justify-center gap-4">
              {rideId && (
                <Link href={`/track/${rideId}`}>
                  <Button variant="outline" data-testid="button-back-to-ride">
                    Back to Ride
                  </Button>
                </Link>
              )}
              <Link href="/">
                <Button data-testid="button-go-home">
                  Go Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="mb-6">
        <BackToHome />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            Report an Incident
          </CardTitle>
          <CardDescription>
            Report any safety concerns, accidents, or issues related to your ride. Your report helps us maintain a safe platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ride && (
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <h3 className="font-medium mb-2">Ride Details</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-muted-foreground" />
                  <span>Ride #{ride.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{ride.createdAt ? format(new Date(ride.createdAt), "MMM d, yyyy") : "-"}</span>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="truncate">{ride.pickupAddress} → {ride.dropoffAddress}</span>
                </div>
              </div>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="reporterName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Full name" data-testid="input-reporter-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reporterPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Your phone number" data-testid="input-reporter-phone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="reporterEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="your@email.com" data-testid="input-reporter-email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Incident Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="accident">Accident</SelectItem>
                        <SelectItem value="driver_behavior">Driver Behavior</SelectItem>
                        <SelectItem value="vehicle_issue">Vehicle Issue</SelectItem>
                        <SelectItem value="safety_concern">Safety Concern</SelectItem>
                        <SelectItem value="billing">Billing Issue</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-wrap gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="low" id="low" data-testid="radio-severity-low" />
                          <Label htmlFor="low" className="cursor-pointer text-green-600">Low</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="medium" id="medium" data-testid="radio-severity-medium" />
                          <Label htmlFor="medium" className="cursor-pointer text-yellow-600">Medium</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="high" id="high" data-testid="radio-severity-high" />
                          <Label htmlFor="high" className="cursor-pointer text-orange-600">High</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="critical" id="critical" data-testid="radio-severity-critical" />
                          <Label htmlFor="critical" className="cursor-pointer text-red-600">Critical</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Please describe what happened in detail..."
                        rows={5}
                        data-testid="input-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Where did this occur?" data-testid="input-location" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="incidentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Incident</FormLabel>
                      <FormControl>
                        <Input type="date" data-testid="input-incident-date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* File Upload */}
              <div>
                <Label className="mb-2 block">Evidence (Optional - up to 5 files)</Label>
                {selectedFiles.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="border rounded-md p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {file.type === 'application/pdf' ? (
                            <FileText className="w-6 h-6 text-red-500 flex-shrink-0" />
                          ) : (
                            <Image className="w-6 h-6 text-blue-500 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(index)}
                          data-testid={`button-remove-file-${index}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                {selectedFiles.length < 5 && (
                  <label className="border-2 border-dashed rounded-md p-6 text-center block cursor-pointer hover-elevate transition-colors">
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload photos or documents
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, JPG, PDF up to 10MB each
                    </p>
                    <input
                      type="file"
                      className="hidden"
                      accept=".png,.jpg,.jpeg,.pdf"
                      multiple
                      onChange={handleFileChange}
                      data-testid="input-file"
                    />
                  </label>
                )}
                {fileError && (
                  <p className="text-sm text-destructive mt-2">{fileError}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={submitMutation.isPending}
                data-testid="button-submit-report"
              >
                {submitMutation.isPending ? "Submitting..." : "Submit Report"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
