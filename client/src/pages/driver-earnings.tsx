import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { jsPDF } from "jspdf";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToHome from "@/components/BackToHome";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DollarSign, FileText, Download, Calendar, TrendingUp, AlertCircle, CheckCircle2, Car, MapPin, Printer } from "lucide-react";
import type { DriverProfile } from "@shared/schema";

interface AnnualEarnings {
  totalGrossEarnings: string;
  totalTips: string;
  totalTolls: string;
  totalRides: number;
  totalMiles: string;
}

interface Form1099Data {
  taxYear: number;
  requiresForm: boolean;
  payer: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    ein: string;
  };
  recipient: {
    name: string;
    ssnLast4: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  box1_nonemployeeCompensation: string;
  totalRides: number;
  totalMiles: string;
  grossEarnings: string;
  tips: string;
  tolls: string;
  message: string;
}

export default function DriverEarnings() {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showContractorForm, setShowContractorForm] = useState(false);
  const [show1099, setShow1099] = useState(false);
  const [form1099Data, setForm1099Data] = useState<Form1099Data | null>(null);
  
  const [contractorForm, setContractorForm] = useState({
    ssnLast4: "",
    taxClassification: "individual",
    businessName: "",
    taxAddress: "",
    taxCity: "",
    taxState: "",
    taxZip: "",
    agreementAccepted: false
  });

  const driverId = parseInt(localStorage.getItem("driverId") || "0");

  const { data: driver } = useQuery<DriverProfile>({
    queryKey: ["/api/drivers", driverId],
    enabled: driverId > 0
  });

  const { data: taxYears = [] } = useQuery<number[]>({
    queryKey: ["/api/drivers", driverId, "tax-years"],
    enabled: driverId > 0
  });

  const { data: earnings, isLoading: earningsLoading } = useQuery<AnnualEarnings>({
    queryKey: ["/api/drivers", driverId, "annual-earnings", selectedYear],
    enabled: driverId > 0 && selectedYear > 0
  });

  const contractorOnboardMutation = useMutation({
    mutationFn: async (data: typeof contractorForm) => {
      const response = await apiRequest("POST", `/api/drivers/${driverId}/contractor-onboard`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Contractor onboarding complete!" });
      setShowContractorForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", driverId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const generate1099Mutation = useMutation({
    mutationFn: async (year: number) => {
      const response = await apiRequest("GET", `/api/drivers/${driverId}/1099/${year}`);
      return response.json();
    },
    onSuccess: (data: Form1099Data) => {
      setForm1099Data(data);
      setShow1099(true);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handlePrint1099 = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    if (!form1099Data) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(18);
    doc.text("FORM 1099-NEC", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text("Nonemployee Compensation", pageWidth / 2, 28, { align: "center" });
    doc.text(`Tax Year ${form1099Data.taxYear}`, pageWidth / 2, 35, { align: "center" });
    
    doc.setFontSize(14);
    doc.text("PAYER'S Information", 20, 50);
    doc.setFontSize(11);
    doc.text(form1099Data.payer.name, 20, 58);
    doc.text(form1099Data.payer.address, 20, 65);
    doc.text(`${form1099Data.payer.city}, ${form1099Data.payer.state} ${form1099Data.payer.zip}`, 20, 72);
    doc.text(`EIN: ${form1099Data.payer.ein}`, 20, 79);
    
    doc.setFontSize(14);
    doc.text("RECIPIENT'S Information", 110, 50);
    doc.setFontSize(11);
    doc.text(form1099Data.recipient.name, 110, 58);
    doc.text(`SSN: XXX-XX-${form1099Data.recipient.ssnLast4}`, 110, 65);
    if (form1099Data.recipient.address) {
      doc.text(form1099Data.recipient.address, 110, 72);
      doc.text(`${form1099Data.recipient.city}, ${form1099Data.recipient.state} ${form1099Data.recipient.zip}`, 110, 79);
    }
    
    doc.setDrawColor(0);
    doc.line(20, 90, pageWidth - 20, 90);
    
    doc.setFontSize(12);
    doc.text("Box 1 - Nonemployee Compensation", 20, 100);
    doc.setFontSize(24);
    doc.setTextColor(34, 139, 34);
    doc.text(`$${form1099Data.box1_nonemployeeCompensation}`, 20, 115);
    doc.setTextColor(0);
    
    doc.setFontSize(11);
    doc.text(`Total Rides: ${form1099Data.totalRides}`, 110, 100);
    doc.text(`Total Miles: ${form1099Data.totalMiles}`, 110, 108);
    doc.text(`Tips Included: $${form1099Data.tips}`, 110, 116);
    doc.text(`Tolls (Deductible): $${form1099Data.tolls}`, 110, 124);
    
    doc.line(20, 135, pageWidth - 20, 135);
    
    doc.setFontSize(10);
    const messageLines = doc.splitTextToSize(form1099Data.message, pageWidth - 40);
    doc.text(messageLines, 20, 145);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("This document is for informational purposes. Keep for your tax records.", pageWidth / 2, 280, { align: "center" });
    
    doc.save(`1099-NEC-${form1099Data.taxYear}.pdf`);
    
    toast({ title: "Downloaded", description: "1099-NEC PDF saved to your device" });
  };

  const totalEarnings = parseFloat(earnings?.totalGrossEarnings || "0") + parseFloat(earnings?.totalTips || "0");
  const requiresForm = totalEarnings >= 600;

  if (!driverId) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p>Please access this page from the driver dashboard.</p>
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
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-4">
          <BackToHome />
        </div>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Earnings & Tax Documents</h1>
              <p className="text-muted-foreground">View your earnings and download tax forms</p>
            </div>
            {!driver?.isContractorOnboarded && (
              <Button onClick={() => setShowContractorForm(true)} data-testid="button-contractor-onboard">
                <FileText className="w-4 h-4 mr-2" />
                Complete Tax Setup
              </Button>
            )}
          </div>

          {!driver?.isContractorOnboarded && (
            <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-800 dark:text-orange-200">Complete Contractor Setup</p>
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      To receive your 1099-NEC tax form, please complete your contractor information.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-4">
            <Label>Tax Year:</Label>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-32" data-testid="select-tax-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...Array(5)].map((_, i) => {
                  const year = new Date().getFullYear() - i;
                  return (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Earnings</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  ${totalEarnings.toFixed(2)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Gross + Tips for {selectedYear}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Rides</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Car className="w-5 h-5 text-blue-600" />
                  {earnings?.totalRides || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Completed rides</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Miles</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-purple-600" />
                  {earnings?.totalMiles || "0"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Driven this year</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tips Received</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  ${earnings?.totalTips || "0.00"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">100% yours</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    1099-NEC Tax Form
                  </CardTitle>
                  <CardDescription>
                    {requiresForm 
                      ? "Your earnings require a 1099-NEC form for tax filing"
                      : "Earnings below $600 - 1099 not required, but income must be reported"}
                  </CardDescription>
                </div>
                {requiresForm && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Form Required
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 rounded-md bg-muted">
                    <p className="text-sm font-medium">Gross Earnings</p>
                    <p className="text-xl font-bold">${earnings?.totalGrossEarnings || "0.00"}</p>
                  </div>
                  <div className="p-4 rounded-md bg-muted">
                    <p className="text-sm font-medium">Tips</p>
                    <p className="text-xl font-bold">${earnings?.totalTips || "0.00"}</p>
                  </div>
                  <div className="p-4 rounded-md bg-muted">
                    <p className="text-sm font-medium">Tolls Paid (Deductible)</p>
                    <p className="text-xl font-bold">${earnings?.totalTolls || "0.00"}</p>
                  </div>
                  <div className="p-4 rounded-md bg-muted">
                    <p className="text-sm font-medium">Miles Driven (Deductible)</p>
                    <p className="text-xl font-bold">{earnings?.totalMiles || "0"} mi</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => generate1099Mutation.mutate(selectedYear)}
                disabled={!driver?.isContractorOnboarded || generate1099Mutation.isPending}
                data-testid="button-generate-1099"
              >
                <Download className="w-4 h-4 mr-2" />
                {generate1099Mutation.isPending ? "Generating..." : "View 1099-NEC"}
              </Button>
              {!driver?.isContractorOnboarded && (
                <p className="ml-4 text-sm text-muted-foreground">Complete tax setup first</p>
              )}
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tax Deductions Reminder</CardTitle>
              <CardDescription>Common deductions for rideshare drivers</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                  <span><strong>Mileage:</strong> Track your miles - IRS rate is $0.67/mile for 2024</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                  <span><strong>Tolls:</strong> ${earnings?.totalTolls || "0"} paid this year</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                  <span><strong>Phone:</strong> Portion of your cell phone bill used for work</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                  <span><strong>Supplies:</strong> Phone mounts, chargers, cleaning supplies</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />

      <Dialog open={showContractorForm} onOpenChange={setShowContractorForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Contractor Tax Information</DialogTitle>
            <DialogDescription>
              This information is required for your 1099-NEC tax form.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ssnLast4">Last 4 Digits of SSN *</Label>
              <Input
                id="ssnLast4"
                maxLength={4}
                placeholder="1234"
                value={contractorForm.ssnLast4}
                onChange={(e) => setContractorForm(prev => ({ ...prev, ssnLast4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                data-testid="input-ssn-last4"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Tax Classification</Label>
              <Select 
                value={contractorForm.taxClassification} 
                onValueChange={(v) => setContractorForm(prev => ({ ...prev, taxClassification: v }))}
              >
                <SelectTrigger data-testid="select-tax-classification">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual / Sole Proprietor</SelectItem>
                  <SelectItem value="llc">LLC</SelectItem>
                  <SelectItem value="corporation">Corporation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {contractorForm.taxClassification !== "individual" && (
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={contractorForm.businessName}
                  onChange={(e) => setContractorForm(prev => ({ ...prev, businessName: e.target.value }))}
                  data-testid="input-business-name"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="taxAddress">Street Address <span className="text-destructive">*</span></Label>
              <Input
                id="taxAddress"
                placeholder="123 Main St"
                value={contractorForm.taxAddress}
                onChange={(e) => setContractorForm(prev => ({ ...prev, taxAddress: e.target.value }))}
                data-testid="input-tax-address"
              />
            </div>

            <div className="grid grid-cols-6 gap-2">
              <div className="col-span-3">
                <Label htmlFor="taxCity">City <span className="text-destructive">*</span></Label>
                <Input
                  id="taxCity"
                  value={contractorForm.taxCity}
                  onChange={(e) => setContractorForm(prev => ({ ...prev, taxCity: e.target.value }))}
                  data-testid="input-tax-city"
                />
              </div>
              <div className="col-span-1">
                <Label htmlFor="taxState">State <span className="text-destructive">*</span></Label>
                <Input
                  id="taxState"
                  maxLength={2}
                  value={contractorForm.taxState}
                  onChange={(e) => setContractorForm(prev => ({ ...prev, taxState: e.target.value.toUpperCase() }))}
                  data-testid="input-tax-state"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="taxZip">ZIP <span className="text-destructive">*</span></Label>
                <Input
                  id="taxZip"
                  maxLength={5}
                  value={contractorForm.taxZip}
                  onChange={(e) => setContractorForm(prev => ({ ...prev, taxZip: e.target.value.replace(/\D/g, '') }))}
                  data-testid="input-tax-zip"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-muted rounded-md">
              <Checkbox 
                id="agreement" 
                checked={contractorForm.agreementAccepted}
                onCheckedChange={(checked) => setContractorForm(prev => ({ ...prev, agreementAccepted: checked === true }))}
                data-testid="checkbox-agreement"
              />
              <Label htmlFor="agreement" className="text-sm leading-relaxed">
                I confirm that I am an independent contractor, not an employee. I understand I am responsible for my own taxes, including self-employment tax. I agree to the Carehub Independent Contractor Agreement.
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContractorForm(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => contractorOnboardMutation.mutate(contractorForm)}
              disabled={!contractorForm.ssnLast4 || contractorForm.ssnLast4.length !== 4 || !contractorForm.taxAddress || !contractorForm.taxCity || !contractorForm.taxState || !contractorForm.taxZip || !contractorForm.agreementAccepted || contractorOnboardMutation.isPending}
              data-testid="button-submit-contractor"
            >
              {contractorOnboardMutation.isPending ? "Saving..." : "Complete Setup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={show1099} onOpenChange={setShow1099}>
        <DialogContent className="max-w-2xl print:max-w-full print:m-0 print:shadow-none">
          <DialogHeader className="print:hidden">
            <DialogTitle>1099-NEC Tax Form - {form1099Data?.taxYear}</DialogTitle>
          </DialogHeader>
          
          {form1099Data && (
            <div className="space-y-6 p-4 border rounded-md print:border-2 print:border-black">
              <div className="text-center border-b pb-4">
                <h2 className="text-xl font-bold">FORM 1099-NEC</h2>
                <p className="text-sm text-muted-foreground">Nonemployee Compensation</p>
                <p className="text-sm">Tax Year {form1099Data.taxYear}</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">PAYER'S Information</h3>
                  <div className="text-sm space-y-1 p-3 bg-muted rounded-md">
                    <p className="font-medium">{form1099Data.payer.name}</p>
                    <p>{form1099Data.payer.address}</p>
                    <p>{form1099Data.payer.city}, {form1099Data.payer.state} {form1099Data.payer.zip}</p>
                    <p>EIN: {form1099Data.payer.ein}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">RECIPIENT'S Information</h3>
                  <div className="text-sm space-y-1 p-3 bg-muted rounded-md">
                    <p className="font-medium">{form1099Data.recipient.name}</p>
                    <p>SSN: XXX-XX-{form1099Data.recipient.ssnLast4}</p>
                    {form1099Data.recipient.address && (
                      <>
                        <p>{form1099Data.recipient.address}</p>
                        <p>{form1099Data.recipient.city}, {form1099Data.recipient.state} {form1099Data.recipient.zip}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                    <p className="text-sm font-medium">Box 1 - Nonemployee Compensation</p>
                    <p className="text-3xl font-bold text-green-700 dark:text-green-400">${form1099Data.box1_nonemployeeCompensation}</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p><strong>Total Rides:</strong> {form1099Data.totalRides}</p>
                    <p><strong>Total Miles:</strong> {form1099Data.totalMiles}</p>
                    <p><strong>Tips Included:</strong> ${form1099Data.tips}</p>
                  </div>
                </div>
              </div>

              <div className="text-sm p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                <p className="font-medium text-blue-800 dark:text-blue-200">{form1099Data.message}</p>
              </div>
            </div>
          )}
          
          <DialogFooter className="print:hidden gap-2">
            <Button variant="outline" onClick={() => setShow1099(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={handlePrint1099} data-testid="button-print-1099">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button onClick={handleDownloadPdf} data-testid="button-download-1099">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
