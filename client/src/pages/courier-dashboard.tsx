import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Plus, MapPin, Thermometer, Clock, CheckCircle2, XCircle, Truck } from "lucide-react";
import type { CourierDelivery, CourierCompany } from "@shared/schema";

const statusColors: Record<string, string> = {
  requested: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  en_route_pickup: "bg-indigo-100 text-indigo-800",
  picked_up: "bg-purple-100 text-purple-800",
  in_transit: "bg-orange-100 text-orange-800",
  arrived: "bg-teal-100 text-teal-800",
  delivered: "bg-green-100 text-green-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function CourierDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupContactName, setPickupContactName] = useState("");
  const [pickupContactPhone, setPickupContactPhone] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffContactName, setDropoffContactName] = useState("");
  const [dropoffContactPhone, setDropoffContactPhone] = useState("");
  const [packageType, setPackageType] = useState("medication");
  const [packageDescription, setPackageDescription] = useState("");
  const [temperatureControl, setTemperatureControl] = useState("ambient");
  const [signatureRequired, setSignatureRequired] = useState(true);
  const [chainOfCustody, setChainOfCustody] = useState(false);
  const [photoProofRequired, setPhotoProofRequired] = useState(false);
  const [priority, setPriority] = useState("standard");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [estimatedFare, setEstimatedFare] = useState("");

  const { data: company } = useQuery<CourierCompany>({
    queryKey: ["/api/courier/companies/mine"],
  });

  const { data: deliveries = [], isLoading } = useQuery<CourierDelivery[]>({
    queryKey: ["/api/courier/deliveries"],
    enabled: !!company,
  });

  const createDeliveryMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/courier/deliveries", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courier/deliveries"] });
      setCreateOpen(false);
      resetForm();
      toast({ title: "Delivery dispatched!", description: "Drivers will see this in their available deliveries." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create delivery", description: error.message, variant: "destructive" });
    },
  });

  const cancelDeliveryMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("PATCH", `/api/courier/deliveries/${id}/status`, {
        status: "cancelled", cancelledBy: "company", cancellationReason: "Cancelled by dispatcher",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courier/deliveries"] });
      toast({ title: "Delivery cancelled" });
    },
  });

  const confirmDeliveryMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("PATCH", `/api/courier/deliveries/${id}/status`, { status: "confirmed" });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courier/deliveries"] });
      toast({ title: "Delivery confirmed!" });
    },
  });

  const resetForm = () => {
    setPickupAddress(""); setPickupContactName(""); setPickupContactPhone("");
    setDropoffAddress(""); setDropoffContactName(""); setDropoffContactPhone("");
    setPackageType("medication"); setPackageDescription(""); setTemperatureControl("ambient");
    setSignatureRequired(true); setChainOfCustody(false); setPhotoProofRequired(false);
    setPriority("standard"); setSpecialInstructions(""); setRecipientName("");
    setRecipientPhone(""); setEstimatedFare("");
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createDeliveryMutation.mutate({
      pickupAddress, pickupContactName: pickupContactName || undefined,
      pickupContactPhone: pickupContactPhone || undefined,
      dropoffAddress, dropoffContactName: dropoffContactName || undefined,
      dropoffContactPhone: dropoffContactPhone || undefined,
      packageType, packageDescription: packageDescription || undefined,
      temperatureControl, signatureRequired, chainOfCustody, photoProofRequired,
      priority, specialInstructions: specialInstructions || undefined,
      recipientName: recipientName || undefined, recipientPhone: recipientPhone || undefined,
      estimatedFare: estimatedFare || undefined,
    });
  };

  const activeDeliveries = deliveries.filter(d => !["delivered", "confirmed", "cancelled"].includes(d.status));
  const completedDeliveries = deliveries.filter(d => ["delivered", "confirmed"].includes(d.status));
  const cancelledDeliveries = deliveries.filter(d => d.status === "cancelled");

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">No Courier Company Found</h2>
            <p className="text-muted-foreground mb-4">You need to register your courier company first.</p>
            <Button onClick={() => window.location.href = "/courier/onboard"} data-testid="button-register-redirect">Register Company</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-courier-dashboard-title">{company.companyName}</h1>
            <p className="text-sm text-muted-foreground">Medical Courier Dispatch</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-delivery"><Plus className="h-4 w-4 mr-2" /> New Delivery</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Dispatch New Medical Delivery</DialogTitle>
                <DialogDescription>Create a delivery request for drivers to pick up</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" /> Pickup Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <Label>Pickup Address *</Label>
                      <Input value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} placeholder="123 Pharmacy Blvd, Chicago, IL" required data-testid="input-pickup-address" />
                    </div>
                    <div>
                      <Label>Contact Name</Label>
                      <Input value={pickupContactName} onChange={e => setPickupContactName(e.target.value)} placeholder="John Doe" data-testid="input-pickup-contact" />
                    </div>
                    <div>
                      <Label>Contact Phone</Label>
                      <Input value={pickupContactPhone} onChange={e => setPickupContactPhone(e.target.value)} placeholder="(555) 123-4567" data-testid="input-pickup-phone" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" /> Delivery Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <Label>Delivery Address *</Label>
                      <Input value={dropoffAddress} onChange={e => setDropoffAddress(e.target.value)} placeholder="456 Patient Ave, Chicago, IL" required data-testid="input-dropoff-address" />
                    </div>
                    <div>
                      <Label>Recipient Name</Label>
                      <Input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Jane Smith" data-testid="input-recipient-name" />
                    </div>
                    <div>
                      <Label>Recipient Phone</Label>
                      <Input value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} placeholder="(555) 987-6543" data-testid="input-recipient-phone" />
                    </div>
                    <div>
                      <Label>Dropoff Contact Name</Label>
                      <Input value={dropoffContactName} onChange={e => setDropoffContactName(e.target.value)} data-testid="input-dropoff-contact" />
                    </div>
                    <div>
                      <Label>Dropoff Contact Phone</Label>
                      <Input value={dropoffContactPhone} onChange={e => setDropoffContactPhone(e.target.value)} data-testid="input-dropoff-phone" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2"><Package className="h-4 w-4" /> Package Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Package Type *</Label>
                      <Select value={packageType} onValueChange={setPackageType}>
                        <SelectTrigger data-testid="select-package-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="medication">Medication / Prescriptions</SelectItem>
                          <SelectItem value="lab_samples">Lab Samples / Specimens</SelectItem>
                          <SelectItem value="medical_equipment">Medical Equipment</SelectItem>
                          <SelectItem value="documents">Medical Documents</SelectItem>
                          <SelectItem value="supplies">Medical Supplies</SelectItem>
                          <SelectItem value="specimens">Biological Specimens</SelectItem>
                          <SelectItem value="dme">Durable Medical Equipment (DME)</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Temperature Control</Label>
                      <Select value={temperatureControl} onValueChange={setTemperatureControl}>
                        <SelectTrigger data-testid="select-temp-control"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ambient">Ambient (No special requirement)</SelectItem>
                          <SelectItem value="cold_chain">Cold Chain (2-8°C)</SelectItem>
                          <SelectItem value="frozen">Frozen (-20°C)</SelectItem>
                          <SelectItem value="controlled_room">Controlled Room Temp (20-25°C)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <Select value={priority} onValueChange={setPriority}>
                        <SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard (Same day)</SelectItem>
                          <SelectItem value="urgent">Urgent (2-4 hours)</SelectItem>
                          <SelectItem value="stat">STAT (Within 1 hour)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Estimated Fare ($)</Label>
                      <Input type="number" step="0.01" value={estimatedFare} onChange={e => setEstimatedFare(e.target.value)} placeholder="25.00" data-testid="input-fare" />
                    </div>
                  </div>
                  <div>
                    <Label>Package Description</Label>
                    <Textarea value={packageDescription} onChange={e => setPackageDescription(e.target.value)} placeholder="2x insulin pens, 1x test strips box" data-testid="input-package-desc" />
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold">Delivery Requirements</h3>
                  <div className="flex items-center gap-2">
                    <Checkbox id="sig" checked={signatureRequired} onCheckedChange={v => setSignatureRequired(v === true)} data-testid="checkbox-signature" />
                    <Label htmlFor="sig" className="text-sm">Signature required on delivery</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="coc" checked={chainOfCustody} onCheckedChange={v => setChainOfCustody(v === true)} data-testid="checkbox-chain-custody" />
                    <Label htmlFor="coc" className="text-sm">Chain of custody tracking (full log from pickup to delivery)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="photo" checked={photoProofRequired} onCheckedChange={v => setPhotoProofRequired(v === true)} data-testid="checkbox-photo-proof" />
                    <Label htmlFor="photo" className="text-sm">Photo proof of delivery required</Label>
                  </div>
                </div>

                <div>
                  <Label>Special Instructions</Label>
                  <Textarea value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} placeholder="Ring doorbell, leave with front desk nurse, etc." data-testid="input-instructions" />
                </div>

                <Button type="submit" className="w-full" disabled={createDeliveryMutation.isPending} data-testid="button-dispatch-delivery">
                  {createDeliveryMutation.isPending ? "Dispatching..." : "Dispatch Delivery"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold" data-testid="text-total-deliveries">{deliveries.length}</p>
              <p className="text-sm text-muted-foreground">Total Deliveries</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-blue-600" data-testid="text-active-deliveries">{activeDeliveries.length}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-green-600" data-testid="text-completed-deliveries">{completedDeliveries.length}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-red-600" data-testid="text-cancelled-deliveries">{cancelledDeliveries.length}</p>
              <p className="text-sm text-muted-foreground">Cancelled</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active" data-testid="tab-active">Active ({activeDeliveries.length})</TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">Completed ({completedDeliveries.length})</TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">All ({deliveries.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <DeliveryTable deliveries={activeDeliveries} onCancel={id => cancelDeliveryMutation.mutate(id)} onConfirm={id => confirmDeliveryMutation.mutate(id)} showActions />
          </TabsContent>
          <TabsContent value="completed">
            <DeliveryTable deliveries={completedDeliveries} />
          </TabsContent>
          <TabsContent value="all">
            <DeliveryTable deliveries={deliveries} onCancel={id => cancelDeliveryMutation.mutate(id)} onConfirm={id => confirmDeliveryMutation.mutate(id)} showActions />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function DeliveryTable({ deliveries, onCancel, onConfirm, showActions }: {
  deliveries: CourierDelivery[];
  onCancel?: (id: number) => void;
  onConfirm?: (id: number) => void;
  showActions?: boolean;
}) {
  if (deliveries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-no-deliveries">No deliveries found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Pickup</TableHead>
              <TableHead>Delivery To</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Temp</TableHead>
              <TableHead>Fare</TableHead>
              {showActions && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.map(d => (
              <TableRow key={d.id} data-testid={`row-delivery-${d.id}`}>
                <TableCell className="font-mono text-xs">#{d.id}</TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{d.packageType?.replace(/_/g, " ")}</div>
                  {d.packageDescription && <div className="text-xs text-muted-foreground truncate max-w-[150px]">{d.packageDescription}</div>}
                </TableCell>
                <TableCell>
                  <Badge variant={d.priority === "stat" ? "destructive" : d.priority === "urgent" ? "default" : "secondary"} data-testid={`badge-priority-${d.id}`}>
                    {d.priority?.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm max-w-[150px] truncate">{d.pickupAddress}</TableCell>
                <TableCell className="text-sm max-w-[150px] truncate">
                  {d.recipientName && <div className="font-medium">{d.recipientName}</div>}
                  <div className="text-xs text-muted-foreground truncate">{d.dropoffAddress}</div>
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[d.status] || "bg-gray-100"}`} data-testid={`badge-status-${d.id}`}>
                    {d.status?.replace(/_/g, " ")}
                  </span>
                </TableCell>
                <TableCell>
                  {d.temperatureControl !== "ambient" && (
                    <Badge variant="outline" className="text-xs">
                      <Thermometer className="h-3 w-3 mr-1" />
                      {d.temperatureControl === "cold_chain" ? "2-8°C" : d.temperatureControl === "frozen" ? "-20°C" : "CRT"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>${d.estimatedFare || d.finalFare || "—"}</TableCell>
                {showActions && (
                  <TableCell>
                    <div className="flex gap-1">
                      {d.status === "delivered" && onConfirm && (
                        <Button size="sm" variant="outline" onClick={() => onConfirm(d.id)} data-testid={`button-confirm-${d.id}`}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm
                        </Button>
                      )}
                      {["requested", "accepted"].includes(d.status) && onCancel && (
                        <Button size="sm" variant="outline" onClick={() => onCancel(d.id)} data-testid={`button-cancel-${d.id}`}>
                          <XCircle className="h-3 w-3 mr-1" /> Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
