import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToHome from "@/components/BackToHome";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { usePlatform } from "@/hooks/use-platform";
import { Phone, Mail, MapPin, Clock, Send, CheckCircle2 } from "lucide-react";

const contactSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(7, "Please enter a valid phone number"),
  company: z.string().optional(),
  subject: z.string().min(3, "Subject is required"),
  inquiryType: z.string().min(1, "Please select an inquiry type"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const inquiryTypes = [
  { value: "general", label: "General Inquiry" },
  { value: "staffing", label: "Healthcare Staffing" },
  { value: "transportation", label: "Medical Transportation (NEMT)" },
  { value: "it_services", label: "IT Services" },
  { value: "courier", label: "Medical Courier" },
  { value: "partnership", label: "Partnership / Business" },
  { value: "billing", label: "Billing / Payments" },
  { value: "support", label: "Technical Support" },
  { value: "feedback", label: "Feedback / Suggestions" },
];

export default function ContactPage() {
  const { showMobileUI } = usePlatform();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      company: "",
      subject: "",
      inquiryType: "",
      message: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const res = await apiRequest("POST", "/api/contact", data);
      return res.json();
    },
    onSuccess: (data) => {
      setSubmitted(true);
      toast({ title: "Message Sent", description: data.message });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactFormData) => {
    mutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header title="Contact Us" showBack />
      <main className="flex-1">
        <div className="bg-primary/5 py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="mb-4">
              <BackToHome />
            </div>
            <div className="text-center max-w-2xl mx-auto">
              <h1 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-contact-title">Contact Us</h1>
              <p className="text-muted-foreground text-lg" data-testid="text-contact-subtitle">
                Have a question or need assistance? We'd love to hear from you. Fill out the form below and our team will get back to you promptly.
              </p>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10 md:py-14">
          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="lg:col-span-1 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Get in Touch</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Reach out to us through any of the channels below, or fill out the contact form and we'll respond within 24 hours.
                </p>
              </div>

              <Card data-testid="card-contact-phone">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Phone</h3>
                    <a href="tel:774-581-9700" className="text-sm text-primary hover:underline" data-testid="link-contact-phone">
                      774-581-9700
                    </a>
                    <p className="text-xs text-muted-foreground mt-1">Available 24/7 for urgent needs</p>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-contact-email">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Email</h3>
                    <a href="mailto:support@carehubapp.com" className="text-sm text-primary hover:underline" data-testid="link-contact-email">
                      support@carehubapp.com
                    </a>
                    <p className="text-xs text-muted-foreground mt-1">We respond within 24 hours</p>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-contact-location">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Location</h3>
                    <p className="text-sm" data-testid="text-contact-location">Massachusetts, USA</p>
                    <p className="text-xs text-muted-foreground mt-1">Serving all of New England</p>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-contact-hours">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Business Hours</h3>
                    <p className="text-sm" data-testid="text-contact-hours">24/7 Support Available</p>
                    <p className="text-xs text-muted-foreground mt-1">Office: Mon-Fri 8AM - 6PM EST</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              {submitted ? (
                <Card className="h-full" data-testid="card-contact-success">
                  <CardContent className="p-8 md:p-12 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
                    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
                      <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold mb-3" data-testid="text-success-title">Message Sent!</h2>
                    <p className="text-muted-foreground mb-6 max-w-md">
                      Thank you for reaching out. Our team will review your message and get back to you within 24 hours.
                    </p>
                    <Button onClick={() => setSubmitted(false)} data-testid="button-send-another">
                      Send Another Message
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card data-testid="card-contact-form">
                  <CardContent className="p-6 md:p-8">
                    <h2 className="text-xl font-semibold mb-1">Send Us a Message</h2>
                    <p className="text-sm text-muted-foreground mb-6">
                      Fill out the form below and we'll get back to you as soon as possible.
                    </p>

                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                        <div className="grid md:grid-cols-2 gap-5">
                          <FormField
                            control={form.control}
                            name="fullName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Full Name *</FormLabel>
                                <FormControl>
                                  <Input placeholder="John Doe" {...field} data-testid="input-fullname" />
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
                                <FormLabel>Email Address *</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="john@example.com" {...field} data-testid="input-email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid md:grid-cols-2 gap-5">
                          <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone Number *</FormLabel>
                                <FormControl>
                                  <Input type="tel" placeholder="(555) 123-4567" {...field} data-testid="input-phone" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="company"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Company / Organization</FormLabel>
                                <FormControl>
                                  <Input placeholder="Optional" {...field} data-testid="input-company" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid md:grid-cols-2 gap-5">
                          <FormField
                            control={form.control}
                            name="inquiryType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Inquiry Type *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-inquiry-type">
                                      <SelectValue placeholder="Select a topic" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {inquiryTypes.map((type) => (
                                      <SelectItem key={type.value} value={type.value} data-testid={`option-inquiry-${type.value}`}>
                                        {type.label}
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
                            name="subject"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Subject *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Brief description of your inquiry" {...field} data-testid="input-subject" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="message"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Message *</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Tell us how we can help you..."
                                  rows={6}
                                  {...field}
                                  data-testid="textarea-message"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          size="lg"
                          className="w-full md:w-auto"
                          disabled={mutation.isPending}
                          data-testid="button-submit-contact"
                        >
                          {mutation.isPending ? (
                            "Sending..."
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Send Message
                            </>
                          )}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
      {!showMobileUI && <Footer />}
    </div>
  );
}
