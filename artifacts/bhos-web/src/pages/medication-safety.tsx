import { useState } from "react";
import {
  useGetMedicationSafetyDashboard,
  useListMedicationErrors,
  useGetRefillAlerts,
  useListPhysicianOrders,
  useListMedicationSideEffects,
  useListMedicationRefusals,
  useListMedicationAuditLog,
  useGetPendingPrnFollowups,
  useListMedications,
  useCreateMedicationError,
  useResolveMedicationError,
  useRunMedicationErrorAutoDetect,
  useListPatients,
  useListStaff,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldCheck, AlertTriangle, Clock, Package, FileText, Activity, XCircle, CheckCircle, Phone,
  Zap, Ban, ScrollText, Timer, CalendarX, Plus, ScanSearch, CheckCircle2, Search,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";

export default function MedicationSafetyPage() {
  const { data: dashboard, isLoading: dashLoading } = useGetMedicationSafetyDashboard();
  const { data: errors, refetch: refetchErrors } = useListMedicationErrors();
  const { data: refillAlerts } = useGetRefillAlerts();
  const { data: orders } = useListPhysicianOrders();
  const { data: sideEffects } = useListMedicationSideEffects();
  const { data: refusals } = useListMedicationRefusals();
  const { data: auditLog } = useListMedicationAuditLog();
  const { data: pendingFollowups } = useGetPendingPrnFollowups();
  const { data: medications } = useListMedications();

  const openErrors = errors?.filter((e) => e.status === "open") || [];
  const resolvedErrors = errors?.filter((e) => e.status === "resolved") || [];
  const pendingOrders = orders?.filter((o) => o.status === "pending") || [];

  const expiringMeds = (medications ?? []).filter((m) => {
    if (!m.expirationDate || !m.active) return false;
    const daysLeft = differenceInDays(new Date(m.expirationDate), new Date());
    return daysLeft <= 30;
  }).sort((a, b) => new Date(a.expirationDate!).getTime() - new Date(b.expirationDate!).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Medication Safety Dashboard</h2>
          <p className="text-muted-foreground">Compliance monitoring, error tracking & auto-detection, inventory alerts.</p>
        </div>
        <div className="flex gap-2">
          <AutoDetectButton onComplete={refetchErrors} />
          <ReportErrorDialog medications={medications ?? []} onCreated={refetchErrors} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {dashLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <MetricCard title="Compliance Rate" value={`${dashboard?.overallComplianceRate ?? 0}%`} icon={ShieldCheck} color="text-green-600 bg-green-50" />
            <MetricCard title="Overdue Meds" value={dashboard?.overdueMedications ?? 0} icon={Clock} color="text-red-600 bg-red-50" />
            <MetricCard title="Open Errors" value={dashboard?.openMedicationErrors ?? 0} icon={AlertTriangle} color="text-amber-600 bg-amber-50" />
            <MetricCard title="Refills Needed" value={dashboard?.refillsNeeded ?? 0} icon={Package} color="text-blue-600 bg-blue-50" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard title="Today Administered" value={dashboard?.todayAdministrations ?? 0} icon={CheckCircle} color="text-green-600 bg-green-50" />
        <MetricCard title="Today Missed" value={dashboard?.todayMissed ?? 0} icon={XCircle} color="text-red-600 bg-red-50" />
        <MetricCard title="Pending Orders" value={dashboard?.pendingOrders ?? 0} icon={FileText} color="text-purple-600 bg-purple-50" />
      </div>

      <Tabs defaultValue="errors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="errors" className="gap-1">
            <AlertTriangle className="h-4 w-4" />
            Errors
            {openErrors.length > 0 && (
              <Badge className="ml-1 bg-red-600 text-white text-xs h-5 min-w-5 flex items-center justify-center">{openErrors.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1">
            <Package className="h-4 w-4" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1">
            <FileText className="h-4 w-4" />
            Orders
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="gap-1">
            <Activity className="h-4 w-4" />
            Monitoring
          </TabsTrigger>
        </TabsList>

        <TabsContent value="errors" className="space-y-4">
          {openErrors.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  Open Medication Errors ({openErrors.length})
                </CardTitle>
                <CardDescription>Errors requiring attention — click Resolve to close with action taken</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Medication</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead className="w-[100px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openErrors.map((e) => (
                      <TableRow key={e.id} className={e.description?.startsWith("[Auto-detected]") ? "bg-amber-50/40" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="capitalize">{e.errorType.replace(/_/g, " ")}</Badge>
                            {e.description?.startsWith("[Auto-detected]") && (
                              <Badge className="bg-blue-100 text-blue-700 text-[10px] px-1">Auto</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell><SeverityBadge severity={e.severity} /></TableCell>
                        <TableCell className="font-medium">{e.medicationName}</TableCell>
                        <TableCell>{e.patientName}</TableCell>
                        <TableCell>{e.staffName}</TableCell>
                        <TableCell className="max-w-[300px] text-sm">
                          <span className="line-clamp-2">{e.description?.replace("[Auto-detected] ", "")}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(e.occurredAt), "MMM d, h:mm a")}
                        </TableCell>
                        <TableCell>
                          <ResolveErrorDialog errorId={e.id} medName={e.medicationName || ""} onResolved={refetchErrors} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {openErrors.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                <p className="text-lg font-medium text-green-700">No Open Errors</p>
                <p className="text-sm text-muted-foreground mt-1">All medication errors have been resolved. Run auto-detection to scan for new issues.</p>
              </CardContent>
            </Card>
          )}

          {resolvedErrors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Recently Resolved ({resolvedErrors.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Medication</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Action Taken</TableHead>
                      <TableHead>Resolved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resolvedErrors.slice(0, 10).map((e) => (
                      <TableRow key={e.id} className="opacity-70">
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{e.errorType.replace(/_/g, " ")}</Badge>
                        </TableCell>
                        <TableCell><SeverityBadge severity={e.severity} /></TableCell>
                        <TableCell className="font-medium">{e.medicationName}</TableCell>
                        <TableCell>{e.patientName}</TableCell>
                        <TableCell>{e.staffName}</TableCell>
                        <TableCell className="max-w-[250px] text-sm truncate">{e.actionTaken || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {e.resolvedAt ? format(new Date(e.resolvedAt), "MMM d, h:mm a") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {refillAlerts && refillAlerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700">
                  <Package className="h-5 w-5" />
                  Refill Alerts
                </CardTitle>
                <CardDescription>Medications below refill threshold — contact pharmacy</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medication</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Qty On Hand</TableHead>
                      <TableHead>Threshold</TableHead>
                      <TableHead>Days Remaining</TableHead>
                      <TableHead>Pharmacy</TableHead>
                      <TableHead>Rx #</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refillAlerts.map((a) => (
                      <TableRow key={a.medicationId} className="bg-amber-50/30">
                        <TableCell className="font-medium">{a.medicationName}</TableCell>
                        <TableCell>{a.patientName}</TableCell>
                        <TableCell className="font-bold text-red-600">{a.quantityOnHand}</TableCell>
                        <TableCell>{a.refillThreshold}</TableCell>
                        <TableCell>
                          {a.daysRemaining != null ? (
                            <Badge className={a.daysRemaining <= 3 ? "bg-red-600 text-white" : "bg-amber-500 text-white"}>
                              {a.daysRemaining} days
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {a.pharmacyName || "—"}
                            {a.pharmacyPhone && (
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <Phone className="h-3 w-3" /> {a.pharmacyPhone}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.rxNumber || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {expiringMeds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <CalendarX className="h-5 w-5" />
                  Expiration Alerts
                </CardTitle>
                <CardDescription>{expiringMeds.length} medication{expiringMeds.length !== 1 ? "s" : ""} expiring or expired</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medication</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Lot Number</TableHead>
                      <TableHead>Expiration Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Qty On Hand</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiringMeds.map((m) => {
                      const daysLeft = differenceInDays(new Date(m.expirationDate!), new Date());
                      const isExpired = daysLeft <= 0;
                      return (
                        <TableRow key={m.id} className={isExpired ? "bg-red-50/50" : "bg-amber-50/30"}>
                          <TableCell className="font-medium">{m.name} ({m.dosage})</TableCell>
                          <TableCell>{m.patientName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground font-mono">{m.lotNumber || "—"}</TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(m.expirationDate!), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            {isExpired ? (
                              <Badge className="bg-red-600 text-white hover:bg-red-600">EXPIRED {Math.abs(daysLeft)}d ago</Badge>
                            ) : daysLeft <= 7 ? (
                              <Badge className="bg-red-500 text-white hover:bg-red-500">Expires in {daysLeft}d</Badge>
                            ) : (
                              <Badge className="bg-amber-500 text-white hover:bg-amber-500">Expires in {daysLeft}d</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-bold">{m.quantityOnHand ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {(!refillAlerts || refillAlerts.length === 0) && expiringMeds.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                <p className="text-lg font-medium">No Active Alerts</p>
                <p className="text-sm text-muted-foreground mt-1">All medication inventory levels and expiration dates are within safe ranges.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                Physician Orders
              </CardTitle>
              <CardDescription>Active and pending physician orders</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Medication</TableHead>
                    <TableHead>Ordered By</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Effective</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!orders || orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No physician orders.
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>
                          <Badge variant="outline" className={
                            o.orderType === "new" ? "bg-green-50 text-green-700 border-green-200" :
                            o.orderType === "discontinue" ? "bg-red-50 text-red-700 border-red-200" :
                            "bg-blue-50 text-blue-700 border-blue-200"
                          }>
                            {o.orderType.charAt(0).toUpperCase() + o.orderType.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={o.status === "pending" ? "secondary" : "outline"} className="capitalize">
                            {o.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{o.patientName}</TableCell>
                        <TableCell>{o.medicationName || "—"}</TableCell>
                        <TableCell>{o.orderedBy}</TableCell>
                        <TableCell className="max-w-[200px] text-sm truncate">{o.details || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(o.effectiveDate), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Timer className="h-4 w-4 text-blue-600" />
                  PRN Follow-ups Due
                </CardTitle>
                <CardDescription>Effectiveness assessments pending</CardDescription>
              </CardHeader>
              <CardContent>
                {(pendingFollowups ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No pending PRN follow-ups</p>
                ) : (
                  <div className="space-y-3">
                    {(pendingFollowups ?? []).slice(0, 5).map((f: any) => (
                      <div key={f.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium text-sm">{f.medicationName || `Admin #${f.id}`}</p>
                          <p className="text-xs text-muted-foreground">Patient: {f.patientName || f.patientId}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50">
                            <Clock className="h-3 w-3 mr-1" />
                            Due {f.prnFollowUpDueAt ? format(new Date(f.prnFollowUpDueAt), "h:mm a") : "soon"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4 text-amber-600" />
                  Side Effects Reported
                </CardTitle>
                <CardDescription>Recent adverse reactions</CardDescription>
              </CardHeader>
              <CardContent>
                {(sideEffects ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No side effects reported</p>
                ) : (
                  <div className="space-y-3">
                    {(sideEffects ?? []).slice(0, 5).map((se: any) => (
                      <div key={se.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium text-sm">{se.sideEffect}</p>
                          <p className="text-xs text-muted-foreground">
                            Severity: <span className={se.severity === "severe" ? "text-red-600 font-semibold" : se.severity === "moderate" ? "text-amber-600" : ""}>{se.severity}</span>
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">{se.onsetTime ? format(new Date(se.onsetTime), "MMM d, h:mm a") : se.createdAt ? format(new Date(se.createdAt), "MMM d, h:mm a") : ""}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Ban className="h-4 w-4 text-red-600" />
                  Medication Refusals
                </CardTitle>
                <CardDescription>Patient refusals requiring follow-up</CardDescription>
              </CardHeader>
              <CardContent>
                {(refusals ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No medication refusals recorded</p>
                ) : (
                  <div className="space-y-3">
                    {(refusals ?? []).slice(0, 5).map((r: any) => (
                      <div key={r.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-sm">Patient #{r.patientId} — Med #{r.medicationId}</p>
                          <Badge variant={r.physicianNotified ? "default" : "destructive"} className="text-xs">
                            {r.physicianNotified ? "MD Notified" : "MD Not Notified"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Reason: {r.reason}</p>
                        {r.followUpAction && <p className="text-xs text-muted-foreground mt-1">Follow-up: {r.followUpAction}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ScrollText className="h-4 w-4 text-slate-600" />
                  Audit Trail
                </CardTitle>
                <CardDescription>Medication administration audit log</CardDescription>
              </CardHeader>
              <CardContent>
                {(auditLog ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No audit entries yet</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {(auditLog ?? []).slice(0, 10).map((entry: any) => (
                      <div key={entry.id} className="flex items-start gap-2 py-2 border-b last:border-0">
                        <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${entry.action === "administered" ? "bg-green-500" : entry.action === "refused" ? "bg-red-500" : entry.action === "count_decremented" ? "bg-amber-500" : "bg-slate-400"}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium capitalize">{(entry.action || "").replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted-foreground truncate">{entry.details}</p>
                          <p className="text-xs text-muted-foreground">{entry.createdAt ? format(new Date(entry.createdAt), "MMM d, h:mm a") : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AutoDetectButton({ onComplete }: { onComplete: () => void }) {
  const { mutateAsync, isPending } = useRunMedicationErrorAutoDetect();
  const [result, setResult] = useState<{ detected: number; created: number } | null>(null);
  const [open, setOpen] = useState(false);

  const handleScan = async () => {
    try {
      const res = await mutateAsync({ data: {} });
      setResult({ detected: (res as any).detected?.length || 0, created: (res as any).created || 0 });
      setOpen(true);
      onComplete();
    } catch {}
  };

  return (
    <>
      <Button variant="outline" onClick={handleScan} disabled={isPending} className="gap-2">
        <ScanSearch className="h-4 w-4" />
        {isPending ? "Scanning..." : "Auto-Detect Errors"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Auto-Detection Results</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
              <Search className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium">{result?.detected || 0} issues detected</p>
                <p className="text-sm text-muted-foreground">Scanned all scheduled medications for today</p>
              </div>
            </div>
            {(result?.created || 0) > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800">{result?.created} new errors created</p>
                  <p className="text-sm text-muted-foreground">Review them in the Errors tab</p>
                </div>
              </div>
            )}
            {result?.detected === 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">No issues found</p>
                  <p className="text-sm text-muted-foreground">All medications administered on schedule</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button>Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReportErrorDialog({ medications, onCreated }: { medications: any[]; onCreated: () => void }) {
  const { mutateAsync, isPending } = useCreateMedicationError();
  const { data: patients } = useListPatients();
  const { data: staffList } = useListStaff();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    medicationId: "",
    patientId: "",
    staffId: "",
    errorType: "",
    severity: "",
    description: "",
    actionTaken: "",
  });

  const activeMeds = medications.filter(m => m.active);

  const handleSubmit = async () => {
    if (!form.medicationId || !form.patientId || !form.staffId || !form.errorType || !form.severity || !form.description) return;
    try {
      await mutateAsync({
        data: {
          medicationId: Number(form.medicationId),
          patientId: Number(form.patientId),
          staffId: Number(form.staffId),
          errorType: form.errorType as any,
          severity: form.severity as any,
          description: form.description,
          actionTaken: form.actionTaken || null,
        },
      });
      setOpen(false);
      setForm({ medicationId: "", patientId: "", staffId: "", errorType: "", severity: "", description: "", actionTaken: "" });
      onCreated();
    } catch {}
  };

  const selectedMed = activeMeds.find(m => m.id === Number(form.medicationId));
  if (selectedMed && form.patientId !== String(selectedMed.patientId)) {
    setTimeout(() => setForm(f => ({ ...f, patientId: String(selectedMed.patientId) })), 0);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Report Error
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report Medication Error</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Medication</Label>
              <Select value={form.medicationId} onValueChange={v => setForm(f => ({ ...f, medicationId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select medication" /></SelectTrigger>
                <SelectContent>
                  {activeMeds.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name} ({m.dosage})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Patient</Label>
              <Select value={form.patientId} onValueChange={v => setForm(f => ({ ...f, patientId: v }))}>
                <SelectTrigger><SelectValue placeholder="Auto from medication" /></SelectTrigger>
                <SelectContent>
                  {(patients ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Staff Member Involved</Label>
            <Select value={form.staffId} onValueChange={v => setForm(f => ({ ...f, staffId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
              <SelectContent>
                {(staffList ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName} ({s.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Error Type</Label>
              <Select value={form.errorType} onValueChange={v => setForm(f => ({ ...f, errorType: v }))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="wrong_dose">Wrong Dose</SelectItem>
                  <SelectItem value="wrong_patient">Wrong Patient</SelectItem>
                  <SelectItem value="wrong_time">Wrong Time</SelectItem>
                  <SelectItem value="wrong_medication">Wrong Medication</SelectItem>
                  <SelectItem value="wrong_route">Wrong Route</SelectItem>
                  <SelectItem value="omission">Omission</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                <SelectTrigger><SelectValue placeholder="Select severity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe what happened..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Action Taken (optional)</Label>
            <Textarea
              placeholder="What was done to address the error..."
              value={form.actionTaken}
              onChange={e => setForm(f => ({ ...f, actionTaken: e.target.value }))}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isPending || !form.medicationId || !form.staffId || !form.errorType || !form.severity || !form.description}>
            {isPending ? "Submitting..." : "Submit Error Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResolveErrorDialog({ errorId, medName, onResolved }: { errorId: number; medName: string; onResolved: () => void }) {
  const { mutateAsync, isPending } = useResolveMedicationError();
  const [open, setOpen] = useState(false);
  const [actionTaken, setActionTaken] = useState("");
  const [notes, setNotes] = useState("");

  const handleResolve = async () => {
    if (!actionTaken.trim()) return;
    try {
      await mutateAsync({ id: errorId, data: { actionTaken, notes: notes || undefined } });
      setOpen(false);
      setActionTaken("");
      setNotes("");
      onResolved();
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 text-green-700 border-green-300 hover:bg-green-50">
          <CheckCircle2 className="h-3 w-3" />
          Resolve
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve Error — {medName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Action Taken *</Label>
            <Textarea
              placeholder="Describe corrective action taken..."
              value={actionTaken}
              onChange={e => setActionTaken(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <Input
              placeholder="Any follow-up notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleResolve} disabled={isPending || !actionTaken.trim()} className="bg-green-600 hover:bg-green-700">
            {isPending ? "Resolving..." : "Mark Resolved"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ title, value, icon: Icon, color }: { title: string; value: number | string; icon: any; color: string }) {
  const [textColor, bgColor] = color.split(" ");
  return (
    <Card>
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

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case "critical":
      return <Badge className="bg-red-600 text-white hover:bg-red-600">Critical</Badge>;
    case "high":
      return <Badge className="bg-orange-500 text-white hover:bg-orange-500">High</Badge>;
    case "medium":
      return <Badge className="bg-amber-400 text-white hover:bg-amber-400">Medium</Badge>;
    default:
      return <Badge variant="secondary">Low</Badge>;
  }
}
