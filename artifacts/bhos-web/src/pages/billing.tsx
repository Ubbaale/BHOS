import React, { useState } from "react";
import {
  useListPayers,
  useListClaims,
  useListBillableServices,
  useListPayments,
  useGetBillingSummary,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  FileText,
  CreditCard,
  Building2,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Send,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";

type ClaimStatus = "draft" | "ready" | "submitted" | "accepted" | "paid" | "denied" | "appealed" | "void";

function ClaimStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    draft: { label: "Draft", variant: "outline", icon: <FileText className="h-3 w-3" /> },
    ready: { label: "Ready", variant: "secondary", icon: <CheckCircle2 className="h-3 w-3" /> },
    submitted: { label: "Submitted", variant: "default", icon: <Send className="h-3 w-3" /> },
    accepted: { label: "Accepted", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
    paid: { label: "Paid", variant: "default", icon: <DollarSign className="h-3 w-3" /> },
    denied: { label: "Denied", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
    appealed: { label: "Appealed", variant: "secondary", icon: <AlertCircle className="h-3 w-3" /> },
    void: { label: "Void", variant: "outline", icon: <XCircle className="h-3 w-3" /> },
  };
  const c = config[status] || config.draft;
  return (
    <Badge variant={c.variant} className="gap-1 text-xs">
      {c.icon} {c.label}
    </Badge>
  );
}

function PayerTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    commercial: "bg-blue-100 text-blue-800",
    medicaid: "bg-green-100 text-green-800",
    medicare: "bg-purple-100 text-purple-800",
    state_agency: "bg-orange-100 text-orange-800",
    self_pay: "bg-gray-100 text-gray-800",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${colors[type] || colors.commercial}`}>
      {type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
    </span>
  );
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function SummaryCards({ summary }: { summary: any }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Charged</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalCharged)}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Collected</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalPaid)}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Outstanding</p>
              <p className="text-2xl font-bold text-amber-600">{formatCurrency(Math.max(0, summary.totalOutstanding))}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Denied</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalDenied)}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AgingReport({ buckets }: { buckets: any }) {
  const total = (buckets.current || 0) + (buckets.thirtyDays || 0) + (buckets.sixtyDays || 0) + (buckets.ninetyDays || 0) + (buckets.overNinety || 0);
  const getWidth = (val: number) => total > 0 ? Math.max(2, (val / total) * 100) : 20;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Accounts Receivable Aging</CardTitle>
        <CardDescription>Outstanding balances by age</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[
            { label: "Current (0-30 days)", value: buckets.current, color: "bg-green-500" },
            { label: "31-60 days", value: buckets.thirtyDays, color: "bg-yellow-500" },
            { label: "61-90 days", value: buckets.sixtyDays, color: "bg-orange-500" },
            { label: "91-120 days", value: buckets.ninetyDays, color: "bg-red-400" },
            { label: "120+ days", value: buckets.overNinety, color: "bg-red-600" },
          ].map((bucket) => (
            <div key={bucket.label} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-32 shrink-0">{bucket.label}</span>
              <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${bucket.color} rounded-full transition-all`} style={{ width: `${getWidth(bucket.value || 0)}%` }} />
              </div>
              <span className="text-sm font-medium w-24 text-right">{formatCurrency(bucket.value)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t flex justify-between">
          <span className="text-sm font-medium">Total A/R</span>
          <span className="text-sm font-bold">{formatCurrency(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function RevenueByPayer({ data }: { data: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Revenue by Payer</CardTitle>
        <CardDescription>Breakdown of charges and collections</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payer</TableHead>
              <TableHead className="text-right">Charged</TableHead>
              <TableHead className="text-right">Collected</TableHead>
              <TableHead className="text-right">Claims</TableHead>
              <TableHead className="text-right">Collection Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((payer) => (
              <TableRow key={payer.payerName}>
                <TableCell className="font-medium">{payer.payerName}</TableCell>
                <TableCell className="text-right">{formatCurrency(payer.totalCharged)}</TableCell>
                <TableCell className="text-right text-green-600">{formatCurrency(payer.totalPaid)}</TableCell>
                <TableCell className="text-right">{payer.claimCount}</TableCell>
                <TableCell className="text-right">
                  {payer.totalCharged > 0
                    ? `${Math.round((payer.totalPaid / payer.totalCharged) * 100)}%`
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ClaimsTab() {
  const { data: claims, isLoading } = useListClaims();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Claims</CardTitle>
          <CardDescription>{claims?.length || 0} total claims</CardDescription>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" /> Export
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Claim #</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Payer</TableHead>
              <TableHead>Service Period</TableHead>
              <TableHead className="text-right">Charged</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No claims found. Create billable services and generate claims.
                </TableCell>
              </TableRow>
            ) : (
              claims?.map((claim: any) => (
                <React.Fragment key={claim.id}>
                  <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedId(expandedId === claim.id ? null : claim.id)}>
                    <TableCell>
                      <span className="font-mono text-xs font-medium">{claim.claimNumber || `CLM-${claim.id}`}</span>
                    </TableCell>
                    <TableCell className="font-medium">{claim.patientName}</TableCell>
                    <TableCell className="text-sm">{claim.payerName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(claim.serviceStartDate), "MMM d")} — {format(new Date(claim.serviceEndDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(claim.totalCharged)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(claim.totalPaid)}</TableCell>
                    <TableCell><ClaimStatusBadge status={claim.status} /></TableCell>
                    <TableCell>
                      {expandedId === claim.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </TableCell>
                  </TableRow>
                  {expandedId === claim.id && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted/30 p-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Diagnosis</p>
                            <p className="font-mono">{claim.primaryDiagnosisCode || "—"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Provider</p>
                            <p>{claim.renderingProvider || "—"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Claim Type</p>
                            <p className="capitalize">{claim.claimType}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Services</p>
                            <p>{claim.serviceCount || 0} line items</p>
                          </div>
                          {claim.denialReason && (
                            <div className="col-span-2 md:col-span-4">
                              <p className="text-muted-foreground">Denial Reason</p>
                              <p className="text-red-600">{claim.denialReason} {claim.denialCode ? `(${claim.denialCode})` : ""}</p>
                            </div>
                          )}
                          {claim.notes && (
                            <div className="col-span-2 md:col-span-4">
                              <p className="text-muted-foreground">Notes</p>
                              <p>{claim.notes}</p>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ServicesTab() {
  const { data: services, isLoading } = useListBillableServices();

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Billable Services</CardTitle>
          <CardDescription>Track services rendered for billing</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>CPT</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No billable services recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              services?.map((svc: any) => (
                <TableRow key={svc.id}>
                  <TableCell className="font-medium">{svc.patientName}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{svc.serviceType}</p>
                      {svc.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{svc.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{svc.cptCode || svc.hcpcsCode || "—"}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(svc.serviceDate), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">{svc.units}</TableCell>
                  <TableCell className="text-right">{formatCurrency(svc.unitRate)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(svc.totalCharge)}</TableCell>
                  <TableCell>
                    <Badge variant={svc.status === "billed" ? "default" : svc.status === "void" ? "destructive" : "outline"}>
                      {svc.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PayersTab() {
  const { data: payers, isLoading } = useListPayers();

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Payers</CardTitle>
          <CardDescription>Insurance companies and government payers</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payer Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Payer ID</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payers?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No payers configured.
                </TableCell>
              </TableRow>
            ) : (
              payers?.map((payer: any) => (
                <TableRow key={payer.id}>
                  <TableCell className="font-medium">{payer.name}</TableCell>
                  <TableCell><PayerTypeBadge type={payer.type} /></TableCell>
                  <TableCell className="font-mono text-xs">{payer.payerId || "—"}</TableCell>
                  <TableCell className="text-sm">{payer.contactName || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{payer.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={payer.isActive ? "default" : "secondary"}>
                      {payer.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PaymentsTab() {
  const { data: payments, isLoading } = useListPayments();

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Payments</CardTitle>
          <CardDescription>Payment receipts and remittance</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Claim #</TableHead>
              <TableHead>Payer</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Adjustment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No payments recorded.
                </TableCell>
              </TableRow>
            ) : (
              payments?.map((payment: any) => (
                <TableRow key={payment.id}>
                  <TableCell className="text-sm">{format(new Date(payment.paymentDate), "MMM d, yyyy")}</TableCell>
                  <TableCell className="font-mono text-xs">{payment.claimNumber || `CLM-${payment.claimId}`}</TableCell>
                  <TableCell className="text-sm">{payment.payerName || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs uppercase">{payment.paymentMethod}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {payment.checkNumber || payment.eftTraceNumber || "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-600">{formatCurrency(payment.amount)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {payment.adjustmentAmount ? formatCurrency(payment.adjustmentAmount) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function BillingPage() {
  const { data: summary, isLoading: loadingSummary } = useGetBillingSummary();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Billing & Claims</h2>
          <p className="text-muted-foreground mt-1">Manage claims, track payments, and monitor revenue cycle</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button className="gap-2">
            <FileText className="h-4 w-4" /> New Claim
          </Button>
        </div>
      </div>

      {loadingSummary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[100px]" />)}
        </div>
      ) : summary ? (
        <SummaryCards summary={summary} />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {summary && <AgingReport buckets={summary.agingBuckets} />}
        {summary && <RevenueByPayer data={summary.revenueByPayer} />}
      </div>

      <Tabs defaultValue="claims" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="claims" className="gap-2"><FileText className="h-4 w-4" /> Claims</TabsTrigger>
          <TabsTrigger value="services" className="gap-2"><CreditCard className="h-4 w-4" /> Services</TabsTrigger>
          <TabsTrigger value="payments" className="gap-2"><DollarSign className="h-4 w-4" /> Payments</TabsTrigger>
          <TabsTrigger value="payers" className="gap-2"><Building2 className="h-4 w-4" /> Payers</TabsTrigger>
        </TabsList>

        <TabsContent value="claims"><ClaimsTab /></TabsContent>
        <TabsContent value="services"><ServicesTab /></TabsContent>
        <TabsContent value="payments"><PaymentsTab /></TabsContent>
        <TabsContent value="payers"><PayersTab /></TabsContent>
      </Tabs>
    </div>
  );
}
