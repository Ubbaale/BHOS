import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Printer, Download, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import type { Ride } from "@shared/schema";

export default function TripReceipt() {
  const { id } = useParams<{ id: string }>();
  
  const { data: ride, isLoading, error } = useQuery<Ride>({
    queryKey: ['/api/rides', id],
    enabled: !!id,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading receipt...</div>
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-destructive">Receipt not found or an error occurred.</p>
            <Link href="/book-ride">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Booking
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const receiptNumber = `CH-${String(ride.id).padStart(6, '0')}`;
  const tripDate = ride.appointmentTime ? format(new Date(ride.appointmentTime), "MMMM d, yyyy") : "N/A";
  const tripTime = ride.appointmentTime ? format(new Date(ride.appointmentTime), "h:mm a") : "N/A";

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden p-4 bg-muted/50 border-b flex items-center justify-between gap-4 flex-wrap">
        <Link href="/book-ride">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button onClick={handlePrint} data-testid="button-print">
            <Printer className="w-4 h-4 mr-2" />
            Print Receipt
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 print:p-0">
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="text-center border-b">
            <div className="flex flex-col items-center gap-2">
              <CardTitle className="text-2xl font-bold">Carehub</CardTitle>
              <p className="text-sm text-muted-foreground">Medical Transportation Services</p>
              <p className="text-sm text-muted-foreground">www.carehubapp.com</p>
            </div>
          </CardHeader>
          
          <CardContent className="pt-6 space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold">Trip Receipt</h2>
              <p className="text-muted-foreground text-sm">For Insurance Reimbursement</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Receipt Number</p>
                <p className="font-medium" data-testid="text-receipt-number">{receiptNumber}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date of Service</p>
                <p className="font-medium" data-testid="text-trip-date">{tripDate}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Appointment Time</p>
                <p className="font-medium">{tripTime}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge variant={ride.status === "completed" ? "default" : "secondary"} data-testid="badge-status">
                  {ride.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-3">Patient Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Patient Name</p>
                  <p className="font-medium" data-testid="text-patient-name">{ride.patientName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{ride.patientPhone}</p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-3">Trip Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Pickup Location</p>
                  <p className="font-medium" data-testid="text-pickup">{ride.pickupAddress}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Dropoff Location</p>
                  <p className="font-medium" data-testid="text-dropoff">{ride.dropoffAddress}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground">Distance</p>
                    <p className="font-medium" data-testid="text-distance">
                      {ride.distanceMiles ? `${parseFloat(ride.distanceMiles).toFixed(1)} miles` : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Mobility Assistance</p>
                    <p className="font-medium">
                      {ride.mobilityNeeds && ride.mobilityNeeds.length > 0 
                        ? ride.mobilityNeeds.join(", ") 
                        : "Standard"}
                    </p>
                  </div>
                </div>
                {ride.notes && (
                  <div>
                    <p className="text-muted-foreground">Special Instructions</p>
                    <p className="font-medium">{ride.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-3">Payment Information</h3>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground">Payment Type</p>
                    <p className="font-medium" data-testid="text-payment-type">
                      {ride.paymentType === "insurance" ? "Insurance" : "Self Pay"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Trip Fare</p>
                    <p className="font-medium text-lg" data-testid="text-fare">
                      ${ride.estimatedFare ? parseFloat(ride.estimatedFare).toFixed(2) : "0.00"}
                    </p>
                  </div>
                </div>
                
                {ride.paymentType === "insurance" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-muted-foreground">Insurance Provider</p>
                        <p className="font-medium" data-testid="text-insurance-provider">
                          {ride.insuranceProvider || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Member ID</p>
                        <p className="font-medium" data-testid="text-member-id">
                          {ride.memberId || "N/A"}
                        </p>
                      </div>
                    </div>
                    {(ride.groupNumber || ride.priorAuthNumber) && (
                      <div className="grid grid-cols-2 gap-4">
                        {ride.groupNumber && (
                          <div>
                            <p className="text-muted-foreground">Group Number</p>
                            <p className="font-medium">{ride.groupNumber}</p>
                          </div>
                        )}
                        {ride.priorAuthNumber && (
                          <div>
                            <p className="text-muted-foreground">Prior Auth Number</p>
                            <p className="font-medium">{ride.priorAuthNumber}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <Separator />

            <div className="bg-muted/50 p-4 rounded-md text-sm print:bg-gray-100">
              <h3 className="font-semibold mb-2">Fare Breakdown</h3>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base Fare</span>
                  <span>$20.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Mileage ({ride.distanceMiles ? parseFloat(ride.distanceMiles).toFixed(1) : "0"} mi x $2.50)
                  </span>
                  <span>
                    ${ride.distanceMiles ? (parseFloat(ride.distanceMiles) * 2.50).toFixed(2) : "0.00"}
                  </span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span data-testid="text-total">
                    ${ride.estimatedFare ? parseFloat(ride.estimatedFare).toFixed(2) : "22.00"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Minimum fare: $22.00
                </p>
              </div>
            </div>

            <div className="text-center text-xs text-muted-foreground pt-4 border-t">
              <p>This receipt is provided for insurance reimbursement purposes.</p>
              <p>Please submit this receipt along with your insurance claim form.</p>
              <p className="mt-2">Carehub Medical Transportation Platform</p>
              <p>Questions? Contact support at www.carehubapp.com</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:bg-gray-100 {
            background-color: #f3f4f6 !important;
          }
        }
      `}</style>
    </div>
  );
}
