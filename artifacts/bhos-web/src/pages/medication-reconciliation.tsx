import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Package, AlertTriangle, FileText, ArrowRightLeft, Phone, Clock, CheckCircle2,
  RefreshCw, History, Pill, ShieldAlert, ArrowRight, CircleDot,
} from "lucide-react";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API = `${import.meta.env.BASE_URL}api`;

function fetchApi(url: string, opts?: RequestInit) {
  return fetch(`${API}${url}`, { ...opts, headers: { "Content-Type": "application/json", ...opts?.headers }, credentials: "include" }).then(r => { if (!r.ok) throw new Error(`API error: ${r.status}`); return r.json(); });
}

function useFetchQuery<T>(key: string[], url: string) {
  return useQuery<T>({ queryKey: key, queryFn: () => fetchApi(url) });
}

export default function MedicationReconciliationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: reconciliation, isLoading } = useFetchQuery<any>(["medication-reconciliation"], "/medication-reconciliation");
  const { data: refillRequests } = useFetchQuery<any[]>(["refill-requests"], "/refill-requests");

  const processOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      return fetchApi(`/physician-orders/${orderId}/process`, { method: "POST" });
    },
    onSuccess: (data) => {
      toast({ title: "Order Processed", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["medication-reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["refill-requests"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createRefillMutation = useMutation({
    mutationFn: async (body: any) => {
      return fetchApi("/refill-requests", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      toast({ title: "Refill Requested", description: "Pharmacy refill request created." });
      queryClient.invalidateQueries({ queryKey: ["medication-reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["refill-requests"] });
    },
  });

  const updateRefillMutation = useMutation({
    mutationFn: async ({ id, ...body }: any) => {
      return fetchApi(`/refill-requests/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      toast({ title: "Refill Updated" });
      queryClient.invalidateQueries({ queryKey: ["refill-requests"] });
      queryClient.invalidateQueries({ queryKey: ["medication-reconciliation"] });
    },
  });

  const summary = reconciliation?.summary || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Medication Reconciliation</h2>
        <p className="text-muted-foreground">
          Process provider orders, track refills, and review the complete medication change history.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <SummaryCard title="Pending Orders" value={summary.pendingOrderCount || 0} icon={FileText} color="text-purple-600 bg-purple-50" urgent={summary.pendingOrderCount > 0} />
            <SummaryCard title="Refill Alerts" value={summary.refillAlertCount || 0} icon={Package} color="text-amber-600 bg-amber-50" urgent={summary.refillAlertCount > 0} />
            <SummaryCard title="Active Refill Requests" value={summary.pendingRefillCount || 0} icon={RefreshCw} color="text-blue-600 bg-blue-50" />
            <SummaryCard title="Recent Changes" value={summary.recentChangeCount || 0} icon={History} color="text-slate-600 bg-slate-50" />
          </>
        )}
      </div>

      <Tabs defaultValue="orders">
        <TabsList className="grid grid-cols-4 w-full max-w-[700px]">
          <TabsTrigger value="orders" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            Provider Orders
            {summary.pendingOrderCount > 0 && <Badge className="ml-1 bg-purple-600 text-white text-xs px-1.5 py-0">{summary.pendingOrderCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="refills" className="flex items-center gap-1.5">
            <Package className="h-4 w-4" />
            Refill Alerts
            {summary.refillAlertCount > 0 && <Badge className="ml-1 bg-amber-500 text-white text-xs px-1.5 py-0">{summary.refillAlertCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-1.5">
            <RefreshCw className="h-4 w-4" />
            Refill Requests
          </TabsTrigger>
          <TabsTrigger value="changes" className="flex items-center gap-1.5">
            <History className="h-4 w-4" />
            Change History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                Pending Physician Orders
              </CardTitle>
              <CardDescription>Review and process medication orders from providers. Processing will automatically update the patient's medication list.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Type</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Medication</TableHead>
                    <TableHead>Ordered By</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!reconciliation?.pendingOrders?.length ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
                        No pending orders. All provider orders have been processed.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reconciliation.pendingOrders.map((o: any) => (
                      <TableRow key={o.id} className="bg-purple-50/30">
                        <TableCell>
                          <OrderTypeBadge type={o.orderType} />
                        </TableCell>
                        <TableCell className="font-medium">{o.patientName}</TableCell>
                        <TableCell>{o.medicationName || "New Rx"}</TableCell>
                        <TableCell>{o.orderedBy}</TableCell>
                        <TableCell className="max-w-[200px] text-sm">{formatOrderDetails(o.details)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(o.effectiveDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => processOrderMutation.mutate(o.id)}
                            disabled={processOrderMutation.isPending}
                          >
                            Process
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="refills" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <ShieldAlert className="h-5 w-5" />
                Low Stock Medications
              </CardTitle>
              <CardDescription>
                Medications at or below their refill threshold. Click "Request Refill" to initiate a pharmacy refill request.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Urgency</TableHead>
                    <TableHead>Medication</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Days Left</TableHead>
                    <TableHead>Pharmacy</TableHead>
                    <TableHead>Rx #</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!reconciliation?.refillAlerts?.length ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
                        All medications are adequately stocked.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reconciliation.refillAlerts.map((a: any) => (
                      <TableRow key={a.medicationId} className={a.urgency === "critical" || a.urgency === "out_of_stock" ? "bg-red-50/50" : "bg-amber-50/30"}>
                        <TableCell>
                          <UrgencyBadge urgency={a.urgency} />
                        </TableCell>
                        <TableCell className="font-medium">
                          {a.medicationName}
                          <span className="text-xs text-muted-foreground ml-1">({a.dosage})</span>
                        </TableCell>
                        <TableCell>{a.patientName}</TableCell>
                        <TableCell>
                          <span className="font-bold text-red-600">{a.quantityOnHand}</span>
                          <span className="text-muted-foreground text-xs"> / {a.refillThreshold} min</span>
                        </TableCell>
                        <TableCell>
                          {a.daysRemaining != null ? (
                            <Badge className={a.daysRemaining <= 3 ? "bg-red-600 text-white" : a.daysRemaining <= 7 ? "bg-amber-500 text-white" : "bg-blue-500 text-white"}>
                              {a.daysRemaining}d
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {a.pharmacyName || "—"}
                            {a.pharmacyPhone && (
                              <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" /> {a.pharmacyPhone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{a.rxNumber || "—"}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => createRefillMutation.mutate({ medicationId: a.medicationId })}
                            disabled={createRefillMutation.isPending}
                          >
                            Request Refill
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-600" />
                Refill Request Tracker
              </CardTitle>
              <CardDescription>Track refill requests from creation through pharmacy contact to receipt.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Medication</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Pharmacy</TableHead>
                    <TableHead>Qty Requested</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!refillRequests?.length ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No refill requests.</TableCell>
                    </TableRow>
                  ) : (
                    refillRequests.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <RefillStatusBadge status={r.status} />
                        </TableCell>
                        <TableCell className="font-medium">
                          {r.medicationName}
                          <span className="text-xs text-muted-foreground ml-1">({r.dosage})</span>
                        </TableCell>
                        <TableCell>{r.patientName}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {r.pharmacyName || "—"}
                            {r.pharmacyPhone && (
                              <div className="text-xs text-muted-foreground flex items-center gap-0.5"><Phone className="h-3 w-3" /> {r.pharmacyPhone}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{r.quantityRequested || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(r.createdAt), "MMM d, h:mm a")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {r.expectedFillDate ? format(new Date(r.expectedFillDate), "MMM d") : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {r.status === "pending" && (
                              <Button size="sm" variant="outline" onClick={() => updateRefillMutation.mutate({ id: r.id, status: "contacted" })}>
                                Mark Contacted
                              </Button>
                            )}
                            {r.status === "contacted" && (
                              <ReceiveRefillDialog
                                requestId={r.id}
                                medName={r.medicationName}
                                onReceive={(qty) => updateRefillMutation.mutate({ id: r.id, status: "received", quantityReceived: qty })}
                              />
                            )}
                            {r.status === "received" && (
                              <Badge className="bg-green-100 text-green-700 border-green-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Received
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="changes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-slate-600" />
                Medication Change History
              </CardTitle>
              <CardDescription>
                Complete trail of all medication changes — new starts, dose adjustments, switches, and discontinuations.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Change</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead></TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Ordered By</TableHead>
                    <TableHead>Processed By</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!reconciliation?.recentChanges?.length ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No medication changes recorded yet.</TableCell>
                    </TableRow>
                  ) : (
                    reconciliation.recentChanges.map((c: any) => {
                      const oldD = parseDetails(c.oldDetails);
                      const newD = parseDetails(c.newDetails);
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <ChangeTypeBadge type={c.changeType} />
                          </TableCell>
                          <TableCell className="font-medium">{c.patientName}</TableCell>
                          <TableCell>
                            {oldD ? (
                              <div className="text-sm">
                                <span className="font-medium">{oldD.name || c.oldMedName}</span>
                                {oldD.dosage && <span className="text-muted-foreground ml-1">{oldD.dosage}</span>}
                                {oldD.frequency && <div className="text-xs text-muted-foreground">{oldD.frequency}</div>}
                              </div>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            {c.changeType !== "new" && c.changeType !== "discontinue" && (
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell>
                            {newD ? (
                              <div className="text-sm">
                                <span className="font-medium">{newD.name || c.newMedName}</span>
                                {newD.dosage && <span className="text-muted-foreground ml-1">{newD.dosage}</span>}
                                {newD.frequency && <div className="text-xs text-muted-foreground">{newD.frequency}</div>}
                              </div>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-sm">{c.orderedBy}</TableCell>
                          <TableCell className="text-sm">{c.processedByName || "—"}</TableCell>
                          <TableCell className="max-w-[150px] text-sm truncate">{c.reason}</TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(c.effectiveDate), "MMM d, yyyy")}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color, urgent }: { title: string; value: number; icon: any; color: string; urgent?: boolean }) {
  const [textColor, bgColor] = color.split(" ");
  return (
    <Card className={urgent ? "ring-2 ring-amber-300" : ""}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${bgColor}`}>
          <Icon className={`h-5 w-5 ${textColor}`} />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderTypeBadge({ type }: { type: string }) {
  switch (type) {
    case "new":
      return <Badge className="bg-green-100 text-green-700 border-green-200"><Pill className="h-3 w-3 mr-1" />New Rx</Badge>;
    case "discontinue":
      return <Badge className="bg-red-100 text-red-700 border-red-200"><AlertTriangle className="h-3 w-3 mr-1" />Discontinue</Badge>;
    case "change":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><ArrowRightLeft className="h-3 w-3 mr-1" />Change</Badge>;
    default:
      return <Badge variant="outline" className="capitalize">{type}</Badge>;
  }
}

function ChangeTypeBadge({ type }: { type: string }) {
  switch (type) {
    case "new":
      return <Badge className="bg-green-100 text-green-700 border-green-200">New Start</Badge>;
    case "discontinue":
      return <Badge className="bg-red-100 text-red-700 border-red-200">Discontinued</Badge>;
    case "dose_change":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Dose Change</Badge>;
    case "switch":
      return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Switched</Badge>;
    default:
      return <Badge variant="outline" className="capitalize">{type.replace(/_/g, " ")}</Badge>;
  }
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  switch (urgency) {
    case "out_of_stock":
      return <Badge className="bg-red-600 text-white">OUT OF STOCK</Badge>;
    case "critical":
      return <Badge className="bg-red-500 text-white">Critical</Badge>;
    case "low":
      return <Badge className="bg-amber-500 text-white">Low</Badge>;
    default:
      return <Badge variant="secondary">OK</Badge>;
  }
}

function RefillStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
    case "contacted":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 flex items-center gap-1"><Phone className="h-3 w-3" />Contacted</Badge>;
    case "received":
      return <Badge className="bg-green-100 text-green-700 border-green-200 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Received</Badge>;
    case "cancelled":
      return <Badge variant="outline" className="text-muted-foreground">Cancelled</Badge>;
    default:
      return <Badge variant="outline" className="capitalize">{status}</Badge>;
  }
}

function ReceiveRefillDialog({ requestId, medName, onReceive }: { requestId: number; medName: string; onReceive: (qty: number) => void }) {
  const [qty, setQty] = useState("");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="default">Receive</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Receive Refill — {medName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Quantity Received</Label>
            <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Enter count" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={() => { if (qty) onReceive(Number(qty)); }}>Confirm Receipt</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatOrderDetails(details: string | null): string {
  if (!details) return "—";
  try {
    const parsed = JSON.parse(details);
    const parts: string[] = [];
    if (parsed.newName) parts.push(`→ ${parsed.newName}`);
    if (parsed.newDosage) parts.push(parsed.newDosage);
    if (parsed.newFrequency) parts.push(parsed.newFrequency);
    if (parsed.reason) parts.push(`(${parsed.reason})`);
    return parts.length > 0 ? parts.join(" ") : details;
  } catch {
    return details;
  }
}

function parseDetails(d: string | null): any {
  if (!d) return null;
  try { return JSON.parse(d); } catch { return null; }
}
