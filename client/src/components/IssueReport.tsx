import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";

const issueSchema = z.object({
  shiftId: z.string().min(1, "Please select a shift"),
  category: z.string().min(1, "Please select a category"),
  priority: z.string().min(1, "Please select a priority"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  email: z.string().email("Please enter a valid email"),
});

type IssueFormData = z.infer<typeof issueSchema>;

// todo: remove mock functionality
const mockShifts = [
  { id: "shift-001", label: "Dec 10, 2024 - Memorial Hospital (Night Shift)" },
  { id: "shift-002", label: "Dec 8, 2024 - Sunrise Senior Living (Day Shift)" },
  { id: "shift-003", label: "Dec 5, 2024 - HomeCare Plus (Evening Shift)" },
];

const categories = [
  { value: "late_cancellation", label: "Late Cancellation" },
  { value: "payment_issue", label: "Payment Issue" },
  { value: "facility_concern", label: "Facility Concern" },
  { value: "schedule_conflict", label: "Schedule Conflict" },
  { value: "other", label: "Other" },
];

export default function IssueReport() {
  const [submitted, setSubmitted] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");

  const form = useForm<IssueFormData>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      shiftId: "",
      category: "",
      priority: "medium",
      description: "",
      email: "",
    },
  });

  const onSubmit = (data: IssueFormData) => {
    console.log("Issue submitted:", data);
    // todo: remove mock functionality
    const ticket = `TKT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    setTicketNumber(ticket);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <section id="report" className="py-20 bg-background">
        <div className="max-w-2xl mx-auto px-6">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-semibold mb-2">Ticket Submitted</h3>
              <p className="text-muted-foreground mb-4">
                Your issue has been received. We'll respond within 24 hours.
              </p>
              <div className="bg-muted rounded-md p-4 mb-6">
                <p className="text-sm text-muted-foreground">Ticket Number</p>
                <p className="text-xl font-mono font-semibold" data-testid="text-ticket-number">
                  {ticketNumber}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSubmitted(false);
                  form.reset();
                }}
                data-testid="button-submit-another"
              >
                Submit Another Issue
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section id="report" className="py-20 bg-background">
      <div className="max-w-2xl mx-auto px-6">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-3xl font-semibold mb-2">Report an Issue</h2>
          <p className="text-muted-foreground">
            Having problems with a shift? Submit a ticket and we'll help resolve it.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Issue Details</CardTitle>
            <CardDescription>
              Please provide as much detail as possible so we can assist you quickly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="shiftId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Shift</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-shift">
                            <SelectValue placeholder="Choose a recent shift" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {mockShifts.map((shift) => (
                            <SelectItem key={shift.id} value={shift.id}>
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
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Select issue type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
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
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority Level</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-wrap gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="low" id="low" data-testid="radio-priority-low" />
                            <Label htmlFor="low" className="cursor-pointer">
                              Low
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="medium" id="medium" data-testid="radio-priority-medium" />
                            <Label htmlFor="medium" className="cursor-pointer">
                              Medium
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="high" id="high" data-testid="radio-priority-high" />
                            <Label htmlFor="high" className="cursor-pointer">
                              High
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="urgent" id="urgent" data-testid="radio-priority-urgent" />
                            <Label htmlFor="urgent" className="cursor-pointer">
                              Urgent
                            </Label>
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
                          placeholder="Describe the issue in detail..."
                          className="min-h-[120px] resize-none"
                          data-testid="textarea-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="your.email@example.com"
                          data-testid="input-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <Label className="mb-2 block">Attachments (Optional)</Label>
                  <div className="border-2 border-dashed rounded-md p-6 text-center hover-elevate cursor-pointer transition-colors">
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Drop files here or click to upload
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, JPG, PDF up to 10MB
                    </p>
                    <input
                      type="file"
                      className="hidden"
                      accept=".png,.jpg,.jpeg,.pdf"
                      data-testid="input-file"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" data-testid="button-submit-issue">
                  Submit Issue
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
