import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, CreditCard, Home, Users, CheckCircle, AlertTriangle, Clock, Shield, ArrowUpCircle, XCircle, CalendarDays, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;

function fetchApi(url: string, opts?: RequestInit) {
  return fetch(`${API}${url}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
    credentials: "include",
  }).then((r) => {
    if (!r.ok) throw new Error(`API error: ${r.status}`);
    return r.json();
  });
}

const planColors: Record<string, string> = {
  starter: "bg-gray-100 text-gray-700 border-gray-300",
  professional: "bg-blue-100 text-blue-700 border-blue-300",
  enterprise: "bg-purple-100 text-purple-700 border-purple-300",
  unlimited: "bg-amber-100 text-amber-700 border-amber-300",
};

export default function OrganizationPage() {
  const [tab, setTab] = useState("overview");
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [orgForm, setOrgForm] = useState({ name: "", contactName: "", contactEmail: "", contactPhone: "", address: "", city: "", state: "", zipCode: "", planTier: "professional", website: "", taxId: "", npi: "" });
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: orgs = [] } = useQuery({ queryKey: ["organizations"], queryFn: () => fetchApi("/organizations") });
  const { data: plans } = useQuery({ queryKey: ["plans"], queryFn: () => fetchApi("/organizations/plans") });
  const { data: homes = [] } = useQuery({ queryKey: ["homes"], queryFn: () => fetchApi("/homes") });

  const selectedOrg = orgs[0];
  const orgId = selectedOrg?.id;

  const { data: subscription } = useQuery({
    queryKey: ["subscription", orgId],
    queryFn: () => fetchApi(`/organizations/${orgId}/subscription`),
    enabled: !!orgId,
  });

  const { data: licenseCheck } = useQuery({
    queryKey: ["license-check", orgId],
    queryFn: () => fetchApi(`/organizations/${orgId}/license-check`),
    enabled: !!orgId,
    refetchInterval: 60000,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["license-events", orgId],
    queryFn: () => fetchApi(`/organizations/${orgId}/license-events`),
    enabled: !!orgId,
  });

  const createOrg = useMutation({
    mutationFn: (data: any) => fetchApi("/organizations", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["organizations"] }); setShowCreateOrg(false); toast({ title: "Organization created" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const renewSub = useMutation({
    mutationFn: (data: any) => fetchApi(`/organizations/${orgId}/subscription/renew`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subscription"] }); qc.invalidateQueries({ queryKey: ["license-check"] }); qc.invalidateQueries({ queryKey: ["license-events"] }); toast({ title: "Subscription renewed" }); },
  });

  const upgradeSub = useMutation({
    mutationFn: (data: any) => fetchApi(`/organizations/${orgId}/subscription/upgrade`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subscription"] }); qc.invalidateQueries({ queryKey: ["license-events"] }); toast({ title: "Plan upgraded" }); },
  });

  const cancelSub = useMutation({
    mutationFn: (data: any) => fetchApi(`/organizations/${orgId}/subscription/cancel`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subscription"] }); qc.invalidateQueries({ queryKey: ["license-events"] }); toast({ title: "Subscription cancelled" }); },
  });

  const warningBanner = () => {
    if (!licenseCheck) return null;
    if (licenseCheck.warning === "expired" || licenseCheck.readOnly) {
      return (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800">License Expired — Read-Only Mode</p>
            <p className="text-sm text-red-600">{licenseCheck.message} All data is preserved, but you cannot create new records until you renew.</p>
          </div>
          <Button variant="destructive" className="ml-auto flex-shrink-0" onClick={() => renewSub.mutate({})}>Renew Now</Button>
        </div>
      );
    }
    if (licenseCheck.warning === "grace_period") {
      return (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-orange-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-orange-800">Grace Period — {licenseCheck.daysLeft} days remaining</p>
            <p className="text-sm text-orange-600">{licenseCheck.message}</p>
          </div>
          <Button className="ml-auto flex-shrink-0 bg-orange-600 hover:bg-orange-700" onClick={() => renewSub.mutate({})}>Renew Now</Button>
        </div>
      );
    }
    if (licenseCheck.warning === "urgent") {
      return (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
          <Clock className="h-5 w-5 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-yellow-800">Subscription renews in {licenseCheck.daysLeft} days</p>
            <p className="text-sm text-yellow-600">{subscription?.autoRenew ? "Auto-renewal is on." : "Auto-renewal is off. Please renew manually."}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" />
            Organization & Subscription
          </h1>
          <p className="text-gray-500 mt-1">Manage your company, homes, and subscription plan</p>
        </div>
        {orgs.length === 0 && (
          <Dialog open={showCreateOrg} onOpenChange={setShowCreateOrg}>
            <DialogTrigger asChild><Button>Set Up Organization</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Your Organization</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
                <div><label className="text-sm font-medium">Company Name</label><Input className="mt-1" value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} placeholder="Bright Horizons Behavioral Health" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Contact Name</label><Input className="mt-1" value={orgForm.contactName} onChange={(e) => setOrgForm({ ...orgForm, contactName: e.target.value })} /></div>
                  <div><label className="text-sm font-medium">Email</label><Input className="mt-1" value={orgForm.contactEmail} onChange={(e) => setOrgForm({ ...orgForm, contactEmail: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Phone</label><Input className="mt-1" value={orgForm.contactPhone} onChange={(e) => setOrgForm({ ...orgForm, contactPhone: e.target.value })} /></div>
                  <div><label className="text-sm font-medium">Website</label><Input className="mt-1" value={orgForm.website} onChange={(e) => setOrgForm({ ...orgForm, website: e.target.value })} /></div>
                </div>
                <div><label className="text-sm font-medium">Address</label><Input className="mt-1" value={orgForm.address} onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-sm font-medium">City</label><Input className="mt-1" value={orgForm.city} onChange={(e) => setOrgForm({ ...orgForm, city: e.target.value })} /></div>
                  <div><label className="text-sm font-medium">State</label><Input className="mt-1" value={orgForm.state} onChange={(e) => setOrgForm({ ...orgForm, state: e.target.value })} /></div>
                  <div><label className="text-sm font-medium">Zip</label><Input className="mt-1" value={orgForm.zipCode} onChange={(e) => setOrgForm({ ...orgForm, zipCode: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium">Tax ID / EIN</label><Input className="mt-1" value={orgForm.taxId} onChange={(e) => setOrgForm({ ...orgForm, taxId: e.target.value })} /></div>
                  <div><label className="text-sm font-medium">NPI Number</label><Input className="mt-1" value={orgForm.npi} onChange={(e) => setOrgForm({ ...orgForm, npi: e.target.value })} /></div>
                </div>
                <div>
                  <label className="text-sm font-medium">Select Plan</label>
                  <Select value={orgForm.planTier} onValueChange={(v) => setOrgForm({ ...orgForm, planTier: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter — $199/home/mo</SelectItem>
                      <SelectItem value="professional">Professional — $299/home/mo</SelectItem>
                      <SelectItem value="enterprise">Enterprise — $399/home/mo</SelectItem>
                      <SelectItem value="unlimited">Unlimited — $499/home/mo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => createOrg.mutate(orgForm)} disabled={!orgForm.name} className="w-full">Create Organization & Start Subscription</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {warningBanner()}

      {orgs.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold mb-2">Welcome to BHOS</h2>
          <p className="text-gray-500 mb-6">Set up your organization to get started. All your homes will be managed under one umbrella.</p>
          <Button onClick={() => setShowCreateOrg(true)}>Set Up Organization</Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><Home className="h-5 w-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{subscription?.enrolledHomes ?? homes.length}</p><p className="text-xs text-gray-500">Enrolled Homes</p></div></div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center"><CreditCard className="h-5 w-5 text-green-600" /></div><div><p className="text-2xl font-bold">${subscription ? subscription.monthlyTotal.toLocaleString() : 0}</p><p className="text-xs text-gray-500">Monthly Total</p></div></div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center"><Shield className="h-5 w-5 text-purple-600" /></div><div><p className="text-2xl font-bold capitalize">{selectedOrg?.planTier}</p><p className="text-xs text-gray-500">Current Plan</p></div></div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center"><CalendarDays className="h-5 w-5 text-amber-600" /></div><div><p className="text-2xl font-bold">{subscription?.daysRemaining ?? "—"}</p><p className="text-xs text-gray-500">Days Remaining</p></div></div></CardContent></Card>
          </div>

          <Card>
            <Tabs value={tab} onValueChange={setTab}>
              <CardHeader>
                <TabsList>
                  <TabsTrigger value="overview">Organization</TabsTrigger>
                  <TabsTrigger value="subscription">Subscription</TabsTrigger>
                  <TabsTrigger value="plans">Plans & Pricing</TabsTrigger>
                  <TabsTrigger value="history">License History</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="overview" className="mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">{selectedOrg?.name}</h3>
                      <div className="space-y-2 text-sm">
                        {selectedOrg?.contactName && <p><span className="text-gray-500">Contact:</span> {selectedOrg.contactName}</p>}
                        {selectedOrg?.contactEmail && <p><span className="text-gray-500">Email:</span> {selectedOrg.contactEmail}</p>}
                        {selectedOrg?.contactPhone && <p><span className="text-gray-500">Phone:</span> {selectedOrg.contactPhone}</p>}
                        {selectedOrg?.address && <p><span className="text-gray-500">Address:</span> {selectedOrg.address}{selectedOrg.city ? `, ${selectedOrg.city}` : ""}{selectedOrg.state ? `, ${selectedOrg.state}` : ""} {selectedOrg.zipCode}</p>}
                        {selectedOrg?.taxId && <p><span className="text-gray-500">Tax ID:</span> {selectedOrg.taxId}</p>}
                        {selectedOrg?.npi && <p><span className="text-gray-500">NPI:</span> {selectedOrg.npi}</p>}
                        {selectedOrg?.website && <p><span className="text-gray-500">Website:</span> {selectedOrg.website}</p>}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-3">Enrolled Homes ({homes.length})</h3>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {homes.map((h: any) => (
                          <div key={h.id} className="p-3 border rounded-lg flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{h.name}</p>
                              <p className="text-xs text-gray-500">{h.address || "No address"}</p>
                            </div>
                            <Badge className="bg-green-100 text-green-700" variant="outline">Active</Badge>
                          </div>
                        ))}
                        {homes.length === 0 && <p className="text-gray-500 text-sm">No homes enrolled yet. Add homes from the Homes page.</p>}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="subscription" className="mt-0">
                  {subscription ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="border-2"><CardContent className="p-4">
                          <p className="text-sm text-gray-500">Plan</p>
                          <p className="text-xl font-bold capitalize">{subscription.planType}</p>
                          <Badge className={planColors[subscription.planType]} variant="outline">{subscription.planDetails?.name}</Badge>
                        </CardContent></Card>
                        <Card className="border-2"><CardContent className="p-4">
                          <p className="text-sm text-gray-500">Billing</p>
                          <p className="text-xl font-bold">${Number(subscription.pricePerHome)}/home/mo</p>
                          <p className="text-xs text-gray-500">{subscription.billingCycle} billing</p>
                        </CardContent></Card>
                        <Card className="border-2"><CardContent className="p-4">
                          <p className="text-sm text-gray-500">Status</p>
                          <p className="text-xl font-bold flex items-center gap-1">
                            {subscription.licenseStatus === "active" && <><CheckCircle className="h-5 w-5 text-green-500" /> Active</>}
                            {subscription.licenseStatus === "grace_period" && <><AlertTriangle className="h-5 w-5 text-orange-500" /> Grace Period</>}
                            {subscription.licenseStatus === "expired" && <><XCircle className="h-5 w-5 text-red-500" /> Expired</>}
                            {subscription.licenseStatus === "cancelled" && <><XCircle className="h-5 w-5 text-gray-500" /> Cancelled</>}
                          </p>
                          <p className="text-xs text-gray-500">
                            {subscription.daysRemaining > 0 ? `${subscription.daysRemaining} days remaining` : "Expired"}
                          </p>
                        </CardContent></Card>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="text-gray-500">Start Date:</span> {new Date(subscription.startDate).toLocaleDateString()}</div>
                        <div><span className="text-gray-500">End Date:</span> {new Date(subscription.endDate).toLocaleDateString()}</div>
                        <div><span className="text-gray-500">Enrolled Homes:</span> {subscription.enrolledHomes ?? 0} (unlimited)</div>
                        <div><span className="text-gray-500">Auto-Renew:</span> {subscription.autoRenew ? "Yes" : "No"}</div>
                        {subscription.nextBillingDate && <div><span className="text-gray-500">Next Billing:</span> {new Date(subscription.nextBillingDate).toLocaleDateString()}</div>}
                        {subscription.lastPaymentDate && <div><span className="text-gray-500">Last Payment:</span> {new Date(subscription.lastPaymentDate).toLocaleDateString()}</div>}
                        <div className="col-span-2 text-gray-500 italic">Staff and employees are included at no additional charge. Billing is per enrolled home only.</div>
                      </div>
                      <div className="flex gap-3 pt-4 border-t">
                        <Button onClick={() => renewSub.mutate({})}>Renew Subscription</Button>
                        {subscription.status !== "cancelled" && (
                          <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => cancelSub.mutate({ reason: "User requested" })}>Cancel Subscription</Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">No active subscription. Create an organization to start.</div>
                  )}
                </TabsContent>

                <TabsContent value="plans" className="mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {plans && Object.entries(plans).map(([key, plan]: [string, any]) => (
                      <Card key={key} className={`border-2 ${selectedOrg?.planTier === key ? "border-primary ring-2 ring-primary/20" : ""}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg capitalize">{plan.name}</CardTitle>
                            {selectedOrg?.planTier === key && <Badge className="bg-primary text-white">Current</Badge>}
                          </div>
                          <CardDescription>Unlimited homes — per-home billing</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="mb-4">
                            <span className="text-3xl font-bold">${plan.price}</span>
                            <span className="text-gray-500">/home/mo</span>
                          </div>
                          <ul className="space-y-2 mb-6">
                            {plan.features.map((f: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                                {f}
                              </li>
                            ))}
                          </ul>
                          {selectedOrg?.planTier !== key && orgId && (
                            <Button variant="outline" className="w-full" onClick={() => upgradeSub.mutate({ planType: key })}>
                              <ArrowUpCircle className="h-4 w-4 mr-2" />
                              {Object.keys(plans).indexOf(key) > Object.keys(plans).indexOf(selectedOrg?.planTier || "") ? "Upgrade" : "Switch"}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-0">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Date</TableHead><TableHead>Event</TableHead><TableHead>Details</TableHead><TableHead>Notified</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {events.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-500">No license events yet</TableCell></TableRow>
                      ) : events.map((e: any) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-sm">{new Date(e.createdAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              e.eventType.includes("created") || e.eventType.includes("renewed") ? "bg-green-100 text-green-700" :
                              e.eventType.includes("cancelled") || e.eventType.includes("expired") ? "bg-red-100 text-red-700" :
                              e.eventType.includes("warning") ? "bg-yellow-100 text-yellow-700" :
                              "bg-blue-100 text-blue-700"
                            }>{e.eventType.replace(/_/g, " ")}</Badge>
                          </TableCell>
                          <TableCell className="text-sm max-w-md">{e.details}</TableCell>
                          <TableCell>{e.notificationSent ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Clock className="h-4 w-4 text-gray-400" />}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </>
      )}
    </div>
  );
}
