import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToHome from "@/components/BackToHome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  FileCheck, 
  Upload, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Shield,
  Car,
  FileText,
  User,
  AlertCircle
} from "lucide-react";
import type { DriverProfile } from "@shared/schema";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export default function DriverKyc() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const { data: drivers = [] } = useQuery<DriverProfile[]>({
    queryKey: ["/api/drivers/approved"],
  });

  const storedDriverId = localStorage.getItem("selectedDriverId");
  const parsedDriverId = storedDriverId ? parseInt(storedDriverId) : null;
  
  // If no driver ID is stored, use the first approved driver
  const effectiveDriverId = parsedDriverId || (drivers.length > 0 ? drivers[0].id : null);

  const { data: driver, isLoading } = useQuery<DriverProfile>({
    queryKey: ["/api/drivers", effectiveDriverId],
    enabled: !!effectiveDriverId,
  });

  const [formData, setFormData] = useState({
    driversLicenseNumber: "",
    driversLicenseExpiry: "",
    driversLicenseState: "",
    insuranceProvider: "",
    insurancePolicyNumber: "",
    insuranceExpiry: "",
    vehicleYear: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleColor: "",
    vehicleInspectionDate: "",
    vehicleInspectionExpiry: "",
  });

  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const fileInputRefs = {
    driversLicense: useRef<HTMLInputElement>(null),
    vehicleRegistration: useRef<HTMLInputElement>(null),
    insurance: useRef<HTMLInputElement>(null),
    profilePhoto: useRef<HTMLInputElement>(null),
  };

  const updateKycMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("PATCH", `/api/drivers/${effectiveDriverId}/kyc`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", effectiveDriverId] });
      toast({
        title: "Information Saved",
        description: "Your KYC information has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save information.",
        variant: "destructive",
      });
    },
  });

  const uploadDocMutation = useMutation({
    mutationFn: async ({ file, documentType }: { file: File; documentType: string }) => {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("documentType", documentType);
      
      const response = await fetch(`/api/drivers/${effectiveDriverId}/kyc/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to upload document");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", effectiveDriverId] });
      setUploadingDoc(null);
      toast({
        title: "Document Uploaded",
        description: "Your document has been uploaded successfully.",
      });
    },
    onError: (error: Error) => {
      setUploadingDoc(null);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload document.",
        variant: "destructive",
      });
    },
  });

  const submitKycMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/drivers/${effectiveDriverId}/kyc/submit`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", effectiveDriverId] });
      toast({
        title: "KYC Submitted",
        description: "Your documents have been submitted for review.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Please upload all required documents.",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (documentType: string, file: File) => {
    setUploadingDoc(documentType);
    uploadDocMutation.mutate({ file, documentType });
  };

  const handleSaveInfo = () => {
    updateKycMutation.mutate(formData);
  };

  const handleSubmitKyc = () => {
    submitKycMutation.mutate();
  };

  const getKycStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Verified</Badge>;
      case "pending_review":
        return <Badge className="bg-yellow-600"><Clock className="w-3 h-3 mr-1" /> Under Review</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" /> Not Submitted</Badge>;
    }
  };

  const isDocUploaded = (docPath: string | null | undefined) => !!docPath;

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header title="Verification" showBack />
        <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header title="Verification" showBack />
        <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Driver Not Found</h2>
              <p className="text-muted-foreground mb-4">
                Please complete your driver application first.
              </p>
              <Button onClick={() => navigate("/driver/apply")} data-testid="button-apply-driver">
                Apply as Driver
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const kycStatus = driver.kycStatus || "not_submitted";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header title="Verification" showBack />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-4">
          <BackToHome />
        </div>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Shield className="w-8 h-8" />
                KYC Verification
              </h1>
              <p className="text-muted-foreground mt-1">
                Complete your identity verification to start accepting rides
              </p>
            </div>
            {getKycStatusBadge(kycStatus)}
          </div>

          {kycStatus === "rejected" && driver.kycNotes && (
            <Card className="mb-6 border-destructive">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Verification Rejected</p>
                    <p className="text-sm text-muted-foreground mt-1">{driver.kycNotes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {kycStatus === "pending_review" && (
            <Card className="mb-6 border-yellow-500">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-600">Under Review</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your documents are being reviewed. This usually takes 1-2 business days.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {kycStatus === "approved" && (
            <Card className="mb-6 border-green-500">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-600">Verification Complete</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your identity has been verified. You can now accept rides.
                    </p>
                    <Button 
                      className="mt-3" 
                      onClick={() => navigate("/driver")}
                      data-testid="button-go-to-dashboard"
                    >
                      Go to Dashboard
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Driver's License
                </CardTitle>
                <CardDescription>Upload your valid driver's license</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div>
                    <Label>License Number</Label>
                    <Input
                      placeholder="DL12345678"
                      value={formData.driversLicenseNumber || driver.driversLicenseNumber || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, driversLicenseNumber: e.target.value }))}
                      data-testid="input-license-number"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>State</Label>
                      <Select
                        value={formData.driversLicenseState || driver.driversLicenseState || ""}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, driversLicenseState: value }))}
                      >
                        <SelectTrigger data-testid="select-license-state">
                          <SelectValue placeholder="State" />
                        </SelectTrigger>
                        <SelectContent>
                          {US_STATES.map((state) => (
                            <SelectItem key={state} value={state}>{state}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Expiry Date</Label>
                      <Input
                        type="date"
                        value={formData.driversLicenseExpiry || driver.driversLicenseExpiry || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, driversLicenseExpiry: e.target.value }))}
                        data-testid="input-license-expiry"
                      />
                    </div>
                  </div>
                </div>
                <div className="border-2 border-dashed rounded-md p-4 text-center">
                  <input
                    ref={fileInputRefs.driversLicense}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload("driversLicense", e.target.files[0])}
                  />
                  {isDocUploaded(driver.driversLicenseDoc) ? (
                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Document Uploaded</span>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => fileInputRefs.driversLicense.current?.click()}
                      disabled={uploadingDoc === "driversLicense"}
                      data-testid="button-upload-license"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingDoc === "driversLicense" ? "Uploading..." : "Upload License"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="w-5 h-5" />
                  Vehicle Information
                </CardTitle>
                <CardDescription>Vehicle details and registration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Year</Label>
                      <Input
                        placeholder="2022"
                        value={formData.vehicleYear || driver.vehicleYear || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, vehicleYear: e.target.value }))}
                        data-testid="input-vehicle-year"
                      />
                    </div>
                    <div>
                      <Label>Make</Label>
                      <Input
                        placeholder="Toyota"
                        value={formData.vehicleMake || driver.vehicleMake || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, vehicleMake: e.target.value }))}
                        data-testid="input-vehicle-make"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Model</Label>
                      <Input
                        placeholder="Sienna"
                        value={formData.vehicleModel || driver.vehicleModel || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, vehicleModel: e.target.value }))}
                        data-testid="input-vehicle-model"
                      />
                    </div>
                    <div>
                      <Label>Color</Label>
                      <Input
                        placeholder="White"
                        value={formData.vehicleColor || driver.vehicleColor || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, vehicleColor: e.target.value }))}
                        data-testid="input-vehicle-color"
                      />
                    </div>
                  </div>
                </div>
                <div className="border-2 border-dashed rounded-md p-4 text-center">
                  <input
                    ref={fileInputRefs.vehicleRegistration}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload("vehicleRegistration", e.target.files[0])}
                  />
                  {isDocUploaded(driver.vehicleRegistrationDoc) ? (
                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Registration Uploaded</span>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => fileInputRefs.vehicleRegistration.current?.click()}
                      disabled={uploadingDoc === "vehicleRegistration"}
                      data-testid="button-upload-registration"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingDoc === "vehicleRegistration" ? "Uploading..." : "Upload Registration"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Vehicle Inspection
                </CardTitle>
                <CardDescription>Most recent vehicle safety inspection</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Inspection Date</Label>
                    <Input
                      type="date"
                      value={formData.vehicleInspectionDate || driver?.vehicleInspectionDate || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, vehicleInspectionDate: e.target.value }))}
                      data-testid="input-inspection-date"
                    />
                  </div>
                  <div>
                    <Label>Inspection Expiry</Label>
                    <Input
                      type="date"
                      value={formData.vehicleInspectionExpiry || driver?.vehicleInspectionExpiry || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, vehicleInspectionExpiry: e.target.value }))}
                      data-testid="input-inspection-expiry"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Insurance
                </CardTitle>
                <CardDescription>Vehicle insurance information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div>
                    <Label>Insurance Provider</Label>
                    <Input
                      placeholder="State Farm"
                      value={formData.insuranceProvider || driver.insuranceProvider || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, insuranceProvider: e.target.value }))}
                      data-testid="input-insurance-provider"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Policy Number</Label>
                      <Input
                        placeholder="POL-123456"
                        value={formData.insurancePolicyNumber || driver.insurancePolicyNumber || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, insurancePolicyNumber: e.target.value }))}
                        data-testid="input-policy-number"
                      />
                    </div>
                    <div>
                      <Label>Expiry Date</Label>
                      <Input
                        type="date"
                        value={formData.insuranceExpiry || driver.insuranceExpiry || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, insuranceExpiry: e.target.value }))}
                        data-testid="input-insurance-expiry"
                      />
                    </div>
                  </div>
                </div>
                <div className="border-2 border-dashed rounded-md p-4 text-center">
                  <input
                    ref={fileInputRefs.insurance}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload("insurance", e.target.files[0])}
                  />
                  {isDocUploaded(driver.insuranceDoc) ? (
                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Insurance Uploaded</span>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => fileInputRefs.insurance.current?.click()}
                      disabled={uploadingDoc === "insurance"}
                      data-testid="button-upload-insurance"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingDoc === "insurance" ? "Uploading..." : "Upload Insurance"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile Photo
                </CardTitle>
                <CardDescription>A clear photo of yourself (optional but recommended)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed rounded-md p-8 text-center">
                  <input
                    ref={fileInputRefs.profilePhoto}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload("profilePhoto", e.target.files[0])}
                  />
                  {isDocUploaded(driver.profilePhotoDoc) ? (
                    <div className="space-y-2">
                      <img 
                        src={driver.profilePhotoDoc || ""} 
                        alt="Profile" 
                        className="w-24 h-24 rounded-full object-cover mx-auto"
                      />
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm">Photo Uploaded</span>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => fileInputRefs.profilePhoto.current?.click()}
                      disabled={uploadingDoc === "profilePhoto"}
                      data-testid="button-upload-photo"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingDoc === "profilePhoto" ? "Uploading..." : "Upload Photo"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 flex flex-wrap gap-4 justify-between">
            <Button
              variant="outline"
              onClick={() => navigate("/driver")}
              data-testid="button-back-dashboard"
            >
              Back to Dashboard
            </Button>
            <div className="flex gap-4 flex-wrap">
              <Button
                variant="secondary"
                onClick={handleSaveInfo}
                disabled={updateKycMutation.isPending}
                data-testid="button-save-info"
              >
                {updateKycMutation.isPending ? "Saving..." : "Save Information"}
              </Button>
              {kycStatus !== "approved" && kycStatus !== "pending_review" && (
                <Button
                  onClick={handleSubmitKyc}
                  disabled={
                    submitKycMutation.isPending ||
                    !isDocUploaded(driver.driversLicenseDoc) ||
                    !isDocUploaded(driver.vehicleRegistrationDoc) ||
                    !isDocUploaded(driver.insuranceDoc)
                  }
                  data-testid="button-submit-kyc"
                >
                  <FileCheck className="w-4 h-4 mr-2" />
                  {submitKycMutation.isPending ? "Submitting..." : "Submit for Review"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
