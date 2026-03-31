import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, Building2, Shield } from "lucide-react";

export default function CourierOnboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [companyType, setCompanyType] = useState("pharmacy");
  const [businessLicenseNumber, setBusinessLicenseNumber] = useState("");
  const [deaNumber, setDeaNumber] = useState("");
  const [hipaaCompliant, setHipaaCompliant] = useState(false);
  const [defaultDeliveryTerms, setDefaultDeliveryTerms] = useState("standard");

  const createCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/courier/companies", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Courier company registered!", description: "You can now post medical deliveries." });
      setLocation("/courier");
    },
    onError: (error: any) => {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCompanyMutation.mutate({
      companyName,
      contactEmail,
      contactPhone: contactPhone || undefined,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      zipCode: zipCode || undefined,
      companyType,
      businessLicenseNumber: businessLicenseNumber || undefined,
      deaNumber: deaNumber || undefined,
      hipaaCompliant,
      defaultDeliveryTerms,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-full">
              <Package className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-courier-onboard-title">Medical Courier Company Registration</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Register your organization to dispatch medical deliveries through CareHub</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Company Information</CardTitle>
              <CardDescription>Basic details about your organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input id="companyName" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Pharmacy" required data-testid="input-company-name" />
                </div>
                <div>
                  <Label htmlFor="contactEmail">Contact Email *</Label>
                  <Input id="contactEmail" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="dispatch@company.com" required data-testid="input-contact-email" />
                </div>
                <div>
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input id="contactPhone" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="(555) 123-4567" data-testid="input-contact-phone" />
                </div>
                <div>
                  <Label htmlFor="companyType">Company Type *</Label>
                  <Select value={companyType} onValueChange={setCompanyType}>
                    <SelectTrigger data-testid="select-company-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pharmacy">Pharmacy</SelectItem>
                      <SelectItem value="lab">Laboratory</SelectItem>
                      <SelectItem value="clinic">Clinic</SelectItem>
                      <SelectItem value="hospital">Hospital</SelectItem>
                      <SelectItem value="medical_supply">Medical Supply</SelectItem>
                      <SelectItem value="home_health">Home Health Agency</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Medical Blvd" data-testid="input-address" />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={city} onChange={e => setCity(e.target.value)} placeholder="Chicago" data-testid="input-city" />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input id="state" value={state} onChange={e => setState(e.target.value)} placeholder="IL" data-testid="input-state" />
                </div>
                <div>
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input id="zipCode" value={zipCode} onChange={e => setZipCode(e.target.value)} placeholder="60601" data-testid="input-zip" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Compliance & Licensing</CardTitle>
              <CardDescription>Required for handling controlled substances and medical materials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="businessLicense">Business License Number</Label>
                  <Input id="businessLicense" value={businessLicenseNumber} onChange={e => setBusinessLicenseNumber(e.target.value)} placeholder="BL-123456" data-testid="input-business-license" />
                </div>
                <div>
                  <Label htmlFor="deaNumber">DEA Number (if applicable)</Label>
                  <Input id="deaNumber" value={deaNumber} onChange={e => setDeaNumber(e.target.value)} placeholder="AB1234563" data-testid="input-dea-number" />
                  <p className="text-xs text-muted-foreground mt-1">Required for controlled substance deliveries</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Checkbox id="hipaa" checked={hipaaCompliant} onCheckedChange={(v) => setHipaaCompliant(v === true)} data-testid="checkbox-hipaa" />
                <Label htmlFor="hipaa" className="text-sm">Our organization is HIPAA compliant and maintains appropriate safeguards for Protected Health Information (PHI)</Label>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Default Delivery Terms</CardTitle>
              <CardDescription>Set default terms for your medical courier dispatches</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Default Priority Level</Label>
                <Select value={defaultDeliveryTerms} onValueChange={setDefaultDeliveryTerms}>
                  <SelectTrigger data-testid="select-delivery-terms">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (Same day / next business day)</SelectItem>
                    <SelectItem value="urgent">Urgent (Within 2-4 hours)</SelectItem>
                    <SelectItem value="stat">STAT (Within 1 hour - highest priority)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 text-sm">
                <p className="font-semibold mb-2">When posting deliveries, you can specify:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• <strong>Package type</strong> — Medication, lab samples, medical equipment, specimens, DME</li>
                  <li>• <strong>Temperature control</strong> — Ambient, cold chain (2-8°C), frozen (-20°C), controlled room temp</li>
                  <li>• <strong>Signature required</strong> — Recipient must sign upon delivery</li>
                  <li>• <strong>Chain of custody</strong> — Full tracking log from pickup to delivery</li>
                  <li>• <strong>Photo proof</strong> — Driver must photograph delivery confirmation</li>
                  <li>• <strong>Special instructions</strong> — Handling notes, access codes, recipient details</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" size="lg" disabled={createCompanyMutation.isPending} data-testid="button-register-company">
            {createCompanyMutation.isPending ? "Registering..." : "Register Courier Company"}
          </Button>
        </form>
      </div>
    </div>
  );
}
