import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CheckCircle2, Loader2, Plus, X, Briefcase } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Job } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

const US_STATES = [
  { value: "AL", label: "Alabama", lat: 32.806671, lng: -86.791130 },
  { value: "AK", label: "Alaska", lat: 61.370716, lng: -152.404419 },
  { value: "AZ", label: "Arizona", lat: 33.729759, lng: -111.431221 },
  { value: "AR", label: "Arkansas", lat: 34.969704, lng: -92.373123 },
  { value: "CA", label: "California", lat: 36.116203, lng: -119.681564 },
  { value: "CO", label: "Colorado", lat: 39.059811, lng: -105.311104 },
  { value: "CT", label: "Connecticut", lat: 41.597782, lng: -72.755371 },
  { value: "DE", label: "Delaware", lat: 39.318523, lng: -75.507141 },
  { value: "FL", label: "Florida", lat: 27.766279, lng: -81.686783 },
  { value: "GA", label: "Georgia", lat: 33.040619, lng: -83.643074 },
  { value: "HI", label: "Hawaii", lat: 21.094318, lng: -157.498337 },
  { value: "ID", label: "Idaho", lat: 44.240459, lng: -114.478828 },
  { value: "IL", label: "Illinois", lat: 40.349457, lng: -88.986137 },
  { value: "IN", label: "Indiana", lat: 39.849426, lng: -86.258278 },
  { value: "IA", label: "Iowa", lat: 42.011539, lng: -93.210526 },
  { value: "KS", label: "Kansas", lat: 38.526600, lng: -96.726486 },
  { value: "KY", label: "Kentucky", lat: 37.668140, lng: -84.670067 },
  { value: "LA", label: "Louisiana", lat: 31.169546, lng: -91.867805 },
  { value: "ME", label: "Maine", lat: 44.693947, lng: -69.381927 },
  { value: "MD", label: "Maryland", lat: 39.063946, lng: -76.802101 },
  { value: "MA", label: "Massachusetts", lat: 42.230171, lng: -71.530106 },
  { value: "MI", label: "Michigan", lat: 43.326618, lng: -84.536095 },
  { value: "MN", label: "Minnesota", lat: 45.694454, lng: -93.900192 },
  { value: "MS", label: "Mississippi", lat: 32.741646, lng: -89.678696 },
  { value: "MO", label: "Missouri", lat: 38.456085, lng: -92.288368 },
  { value: "MT", label: "Montana", lat: 46.921925, lng: -110.454353 },
  { value: "NE", label: "Nebraska", lat: 41.125370, lng: -98.268082 },
  { value: "NV", label: "Nevada", lat: 38.313515, lng: -117.055374 },
  { value: "NH", label: "New Hampshire", lat: 43.452492, lng: -71.563896 },
  { value: "NJ", label: "New Jersey", lat: 40.298904, lng: -74.521011 },
  { value: "NM", label: "New Mexico", lat: 34.840515, lng: -106.248482 },
  { value: "NY", label: "New York", lat: 42.165726, lng: -74.948051 },
  { value: "NC", label: "North Carolina", lat: 35.630066, lng: -79.806419 },
  { value: "ND", label: "North Dakota", lat: 47.528912, lng: -99.784012 },
  { value: "OH", label: "Ohio", lat: 40.388783, lng: -82.764915 },
  { value: "OK", label: "Oklahoma", lat: 35.565342, lng: -96.928917 },
  { value: "OR", label: "Oregon", lat: 44.572021, lng: -122.070938 },
  { value: "PA", label: "Pennsylvania", lat: 40.590752, lng: -77.209755 },
  { value: "RI", label: "Rhode Island", lat: 41.680893, lng: -71.511780 },
  { value: "SC", label: "South Carolina", lat: 33.856892, lng: -80.945007 },
  { value: "SD", label: "South Dakota", lat: 44.299782, lng: -99.438828 },
  { value: "TN", label: "Tennessee", lat: 35.747845, lng: -86.692345 },
  { value: "TX", label: "Texas", lat: 31.054487, lng: -97.563461 },
  { value: "UT", label: "Utah", lat: 40.150032, lng: -111.862434 },
  { value: "VT", label: "Vermont", lat: 44.045876, lng: -72.710686 },
  { value: "VA", label: "Virginia", lat: 37.769337, lng: -78.169968 },
  { value: "WA", label: "Washington", lat: 47.400902, lng: -121.490494 },
  { value: "WV", label: "West Virginia", lat: 38.491226, lng: -80.954453 },
  { value: "WI", label: "Wisconsin", lat: 44.268543, lng: -89.616508 },
  { value: "WY", label: "Wyoming", lat: 42.755966, lng: -107.302490 },
];

const SHIFT_OPTIONS = [
  { value: "Day Shift", label: "Day Shift" },
  { value: "Night Shift", label: "Night Shift" },
  { value: "Evening Shift", label: "Evening Shift" },
  { value: "Flexible", label: "Flexible" },
  { value: "Rotating", label: "Rotating" },
];

const URGENCY_OPTIONS = [
  { value: "immediate", label: "Immediate - Need someone now" },
  { value: "within_24hrs", label: "Within 24 hours" },
  { value: "scheduled", label: "Scheduled - Planned opening" },
];

const jobPostingSchema = z.object({
  title: z.string().min(1, "Job title is required"),
  facility: z.string().min(1, "Facility name is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pay: z.string().min(1, "Pay rate is required"),
  shift: z.string().min(1, "Shift type is required"),
  urgency: z.string().min(1, "Urgency level is required"),
});

type JobPostingFormData = z.infer<typeof jobPostingSchema>;

export default function JobPostingForm() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requirements, setRequirements] = useState<string[]>([]);
  const [newRequirement, setNewRequirement] = useState("");

  const form = useForm<JobPostingFormData>({
    resolver: zodResolver(jobPostingSchema),
    defaultValues: {
      title: "",
      facility: "",
      city: "",
      state: "",
      pay: "",
      shift: "",
      urgency: "",
    },
  });

  const addRequirement = () => {
    if (newRequirement.trim() && !requirements.includes(newRequirement.trim())) {
      setRequirements([...requirements, newRequirement.trim()]);
      setNewRequirement("");
    }
  };

  const removeRequirement = (req: string) => {
    setRequirements(requirements.filter((r) => r !== req));
  };

  const createJobMutation = useMutation({
    mutationFn: async (data: JobPostingFormData) => {
      const stateData = US_STATES.find((s) => s.value === data.state);
      if (!stateData) throw new Error("Invalid state");

      const jobData = {
        title: data.title,
        facility: data.facility,
        location: `${data.city}, ${data.state}`,
        state: data.state,
        lat: stateData.lat.toString(),
        lng: stateData.lng.toString(),
        pay: data.pay,
        shift: data.shift,
        urgency: data.urgency,
        requirements: requirements.length > 0 ? requirements : ["To be discussed"],
        status: "available",
      };

      const response = await apiRequest("POST", "/api/jobs", jobData);
      return response.json() as Promise<Job>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setSubmitted(true);
    },
  });

  const onSubmit = (data: JobPostingFormData) => {
    createJobMutation.mutate(data);
  };

  const resetForm = () => {
    form.reset();
    setRequirements([]);
    setNewRequirement("");
    setSubmitted(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="default" data-testid="button-post-job">
          <Plus className="w-4 h-4 mr-2" />
          Post a Job
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {submitted ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">Job Posted Successfully</h3>
            <p className="text-muted-foreground mb-6">
              Your job is now live on the map and visible to healthcare professionals nationwide.
            </p>
            <Button onClick={resetForm} data-testid="button-post-another">
              Post Another Job
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Post a Healthcare Job
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Registered Nurse - ICU"
                          data-testid="input-job-title"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="facility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Facility Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Memorial Hospital"
                          data-testid="input-facility"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Los Angeles"
                            data-testid="input-city"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-state">
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {US_STATES.map((state) => (
                              <SelectItem key={state.value} value={state.value}>
                                {state.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="pay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pay Rate</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., $45-55/hr"
                          data-testid="input-pay"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="shift"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shift Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-shift">
                              <SelectValue placeholder="Select shift" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SHIFT_OPTIONS.map((shift) => (
                              <SelectItem key={shift.value} value={shift.value}>
                                {shift.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="urgency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Urgency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-urgency">
                              <SelectValue placeholder="Select urgency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {URGENCY_OPTIONS.map((urgency) => (
                              <SelectItem key={urgency.value} value={urgency.value}>
                                {urgency.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div>
                  <Label className="mb-2 block">Requirements (Optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newRequirement}
                      onChange={(e) => setNewRequirement(e.target.value)}
                      placeholder="e.g., RN License, BLS"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addRequirement();
                        }
                      }}
                      data-testid="input-requirement"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addRequirement}
                      data-testid="button-add-requirement"
                    >
                      Add
                    </Button>
                  </div>
                  {requirements.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {requirements.map((req) => (
                        <Badge
                          key={req}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {req}
                          <button
                            type="button"
                            onClick={() => removeRequirement(req)}
                            className="ml-1"
                            data-testid={`button-remove-req-${req}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createJobMutation.isPending}
                  data-testid="button-submit-job"
                >
                  {createJobMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Posting Job...
                    </>
                  ) : (
                    "Post Job to Map"
                  )}
                </Button>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
