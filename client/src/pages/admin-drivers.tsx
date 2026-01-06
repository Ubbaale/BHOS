import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToHome from "@/components/BackToHome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Car,
  Accessibility,
  Phone,
  Mail,
  ArrowLeft,
  Shield,
  FileText,
  Eye,
  ExternalLink
} from "lucide-react";
import type { DriverProfile } from "@shared/schema";
import { format } from "date-fns";

export default function AdminDrivers() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [kycRejectDialogOpen, setKycRejectDialogOpen] = useState(false);
  const [kycRejectionReason, setKycRejectionReason] = useState("");
  const [viewingKycDriver, setViewingKycDriver] = useState<DriverProfile | null>(null);

  const { data: drivers = [], isLoading } = useQuery<DriverProfile[]>({
    queryKey: ["/api/drivers/all"],
  });

  const pendingKycDrivers = drivers.filter(d => d.applicationStatus === "approved" && d.kycStatus === "pending_review");
  const approvedKycDrivers = drivers.filter(d => d.kycStatus === "approved");

  const approveMutation = useMutation({
    mutationFn: async (driverId: number) => {
      const response = await apiRequest("POST", `/api/drivers/${driverId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/all"] });
      toast({
        title: "Driver Approved",
        description: "The driver has been approved and can now accept rides.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ driverId, reason }: { driverId: number; reason: string }) => {
      const response = await apiRequest("POST", `/api/drivers/${driverId}/reject`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/all"] });
      setRejectDialogOpen(false);
      setRejectionReason("");
      setSelectedDriver(null);
      toast({
        title: "Application Rejected",
        description: "The driver application has been rejected.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Rejection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const approveKycMutation = useMutation({
    mutationFn: async (driverId: number) => {
      const response = await apiRequest("POST", `/api/drivers/${driverId}/kyc/approve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/all"] });
      setViewingKycDriver(null);
      toast({
        title: "KYC Approved",
        description: "The driver's identity has been verified.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectKycMutation = useMutation({
    mutationFn: async ({ driverId, notes }: { driverId: number; notes: string }) => {
      const response = await apiRequest("POST", `/api/drivers/${driverId}/kyc/reject`, { notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/all"] });
      setKycRejectDialogOpen(false);
      setKycRejectionReason("");
      setViewingKycDriver(null);
      toast({
        title: "KYC Rejected",
        description: "The driver has been notified to resubmit documents.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Rejection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const pendingDrivers = drivers.filter(d => d.applicationStatus === "pending");
  const approvedDrivers = drivers.filter(d => d.applicationStatus === "approved");
  const rejectedDrivers = drivers.filter(d => d.applicationStatus === "rejected");

  const handleApprove = (driver: DriverProfile) => {
    approveMutation.mutate(driver.id);
  };

  const handleRejectClick = (driver: DriverProfile) => {
    setSelectedDriver(driver);
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = () => {
    if (selectedDriver) {
      rejectMutation.mutate({ driverId: selectedDriver.id, reason: rejectionReason });
    }
  };

  const handleKycRejectClick = (driver: DriverProfile) => {
    setViewingKycDriver(driver);
    setKycRejectDialogOpen(true);
  };

  const handleKycRejectConfirm = () => {
    if (viewingKycDriver) {
      rejectKycMutation.mutate({ driverId: viewingKycDriver.id, notes: kycRejectionReason });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getKycStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400"><Shield className="w-3 h-3 mr-1" />Verified</Badge>;
      case "pending_review":
        return <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"><Clock className="w-3 h-3 mr-1" />Under Review</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">Not Submitted</Badge>;
    }
  };

  const DriverTable = ({ driverList, showActions = false }: { driverList: DriverProfile[]; showActions?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Driver</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Vehicle</TableHead>
          <TableHead>Capabilities</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Applied</TableHead>
          {showActions && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {driverList.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showActions ? 7 : 6} className="text-center text-muted-foreground py-8">
              No drivers found
            </TableCell>
          </TableRow>
        ) : (
          driverList.map((driver) => (
            <TableRow key={driver.id} data-testid={`row-driver-${driver.id}`}>
              <TableCell>
                <div className="font-medium">{driver.fullName}</div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1 text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="w-3 h-3" />{driver.phone}
                  </span>
                  {driver.email && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Mail className="w-3 h-3" />{driver.email}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Car className="w-4 h-4 text-muted-foreground" />
                  <span>{driver.vehicleType}</span>
                </div>
                <div className="text-sm text-muted-foreground">{driver.vehiclePlate}</div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {driver.wheelchairAccessible && (
                    <Badge variant="outline" className="text-xs">
                      <Accessibility className="w-3 h-3 mr-1" />Wheelchair
                    </Badge>
                  )}
                  {driver.stretcherCapable && (
                    <Badge variant="outline" className="text-xs">Stretcher</Badge>
                  )}
                  {!driver.wheelchairAccessible && !driver.stretcherCapable && (
                    <span className="text-muted-foreground text-sm">Standard</span>
                  )}
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(driver.applicationStatus)}</TableCell>
              <TableCell className="text-muted-foreground">
                {driver.createdAt ? format(new Date(driver.createdAt), "MMM d, yyyy") : "N/A"}
              </TableCell>
              {showActions && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(driver)}
                      disabled={approveMutation.isPending}
                      data-testid={`button-approve-${driver.id}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectClick(driver)}
                      data-testid={`button-reject-${driver.id}`}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-4">
          <BackToHome />
        </div>
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")} 
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Driver Management</h1>
              <p className="text-muted-foreground">Review and manage driver applications</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-3xl font-bold">{pendingDrivers.length}</p>
                </div>
                <Clock className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Approved Drivers</p>
                  <p className="text-3xl font-bold">{approvedDrivers.length}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">KYC Pending</p>
                  <p className="text-3xl font-bold">{pendingKycDrivers.length}</p>
                </div>
                <Shield className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                  <p className="text-3xl font-bold">{rejectedDrivers.length}</p>
                </div>
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Driver Applications</CardTitle>
            <CardDescription>
              Review pending applications and manage approved drivers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading drivers...</div>
            ) : (
              <Tabs defaultValue="pending">
                <TabsList className="mb-4">
                  <TabsTrigger value="pending" data-testid="tab-pending">
                    Pending ({pendingDrivers.length})
                  </TabsTrigger>
                  <TabsTrigger value="approved" data-testid="tab-approved">
                    Approved ({approvedDrivers.length})
                  </TabsTrigger>
                  <TabsTrigger value="rejected" data-testid="tab-rejected">
                    Rejected ({rejectedDrivers.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="pending">
                  <DriverTable driverList={pendingDrivers} showActions />
                </TabsContent>
                <TabsContent value="approved">
                  <DriverTable driverList={approvedDrivers} />
                </TabsContent>
                <TabsContent value="rejected">
                  <DriverTable driverList={rejectedDrivers} />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        {pendingKycDrivers.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                KYC Verification
              </CardTitle>
              <CardDescription>
                Review driver identity documents and verify their information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>License</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Insurance</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>KYC Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingKycDrivers.map((driver) => (
                    <TableRow key={driver.id} data-testid={`row-kyc-${driver.id}`}>
                      <TableCell>
                        <div className="font-medium">{driver.fullName}</div>
                        <div className="text-sm text-muted-foreground">{driver.phone}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {driver.driversLicenseNumber || "N/A"}
                          {driver.driversLicenseState && ` (${driver.driversLicenseState})`}
                        </div>
                        {driver.driversLicenseExpiry && (
                          <div className="text-xs text-muted-foreground">
                            Exp: {driver.driversLicenseExpiry}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {driver.vehicleYear} {driver.vehicleMake} {driver.vehicleModel}
                        </div>
                        {driver.vehicleColor && (
                          <div className="text-xs text-muted-foreground">{driver.vehicleColor}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{driver.insuranceProvider || "N/A"}</div>
                        {driver.insuranceExpiry && (
                          <div className="text-xs text-muted-foreground">
                            Exp: {driver.insuranceExpiry}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {driver.driversLicenseDoc && (
                            <a 
                              href={driver.driversLicenseDoc} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <FileText className="w-3 h-3" />
                              License
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {driver.vehicleRegistrationDoc && (
                            <a 
                              href={driver.vehicleRegistrationDoc} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <FileText className="w-3 h-3" />
                              Reg
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {driver.insuranceDoc && (
                            <a 
                              href={driver.insuranceDoc} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <FileText className="w-3 h-3" />
                              Ins
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getKycStatusBadge(driver.kycStatus)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => approveKycMutation.mutate(driver.id)}
                            disabled={approveKycMutation.isPending}
                            data-testid={`button-approve-kyc-${driver.id}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleKycRejectClick(driver)}
                            data-testid={`button-reject-kyc-${driver.id}`}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              {selectedDriver && `Reject ${selectedDriver.fullName}'s driver application?`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Reason for rejection (optional)</label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              data-testid="input-rejection-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRejectConfirm}
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={kycRejectDialogOpen} onOpenChange={setKycRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject KYC Verification</DialogTitle>
            <DialogDescription>
              {viewingKycDriver && `Reject ${viewingKycDriver.fullName}'s identity verification?`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Reason for rejection</label>
            <Textarea
              value={kycRejectionReason}
              onChange={(e) => setKycRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection (e.g., blurry document, expired license)..."
              data-testid="input-kyc-rejection-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKycRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleKycRejectConfirm}
              disabled={rejectKycMutation.isPending}
              data-testid="button-confirm-kyc-reject"
            >
              {rejectKycMutation.isPending ? "Rejecting..." : "Reject Verification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
