import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, ArrowRightLeft, MessageCircle, Phone, Stethoscope, Building } from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL;
function fetchApi(path: string, opts?: RequestInit) {
  return fetch(`${BASE}api${path}`, { credentials: "include", ...opts }).then(r => { if (!r.ok) throw new Error("Request failed"); return r.json(); });
}

export default function CareCoordinationPage() {
  const qc = useQueryClient();
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [showReferralForm, setShowReferralForm] = useState(false);
  const [showCommForm, setShowCommForm] = useState(false);

  const { data: providers = [] } = useQuery({ queryKey: ["ext-providers"], queryFn: () => fetchApi("/external-providers") });
  const { data: referrals = [] } = useQuery({ queryKey: ["referrals"], queryFn: () => fetchApi("/referrals") });
  const { data: commLogs = [] } = useQuery({ queryKey: ["comm-logs"], queryFn: () => fetchApi("/communication-logs") });
  const { data: patients = [] } = useQuery({ queryKey: ["patients-list"], queryFn: () => fetchApi("/patients") });

  const addProviderMut = useMutation({
    mutationFn: (data: any) => fetchApi("/external-providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ext-providers"] }); setShowProviderForm(false); },
  });

  const addReferralMut = useMutation({
    mutationFn: (data: any) => fetchApi("/referrals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["referrals"] }); setShowReferralForm(false); },
  });

  const addCommMut = useMutation({
    mutationFn: (data: any) => fetchApi("/communication-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["comm-logs"] }); setShowCommForm(false); },
  });

  const urgencyColors: Record<string, string> = { routine: "bg-gray-100 text-gray-800", urgent: "bg-amber-100 text-amber-800", emergent: "bg-red-100 text-red-800" };
  const statusColors: Record<string, string> = { pending: "bg-amber-100 text-amber-800", scheduled: "bg-blue-100 text-blue-800", completed: "bg-green-100 text-green-800", cancelled: "bg-gray-100 text-gray-800" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Care Coordination</h1><p className="text-muted-foreground">Manage external providers, referrals, and communications</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowProviderForm(true)}><Plus className="h-4 w-4 mr-2" />Provider</Button>
          <Button variant="outline" onClick={() => setShowReferralForm(true)}><ArrowRightLeft className="h-4 w-4 mr-2" />Referral</Button>
          <Button onClick={() => setShowCommForm(true)}><MessageCircle className="h-4 w-4 mr-2" />Log Communication</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "External Providers", value: providers.length, icon: Stethoscope, color: "text-blue-600 bg-blue-50" },
          { label: "Active Referrals", value: referrals.filter((r: any) => r.status === "pending" || r.status === "scheduled").length, icon: ArrowRightLeft, color: "text-amber-600 bg-amber-50" },
          { label: "Total Referrals", value: referrals.length, icon: Users, color: "text-purple-600 bg-purple-50" },
          { label: "Communications", value: commLogs.length, icon: MessageCircle, color: "text-green-600 bg-green-50" },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4 flex items-center gap-3"><div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.color.split(" ")[1]}`}><s.icon className={`h-5 w-5 ${s.color.split(" ")[0]}`} /></div><div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div></CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="providers">
        <TabsList><TabsTrigger value="providers">Providers</TabsTrigger><TabsTrigger value="referrals">Referrals</TabsTrigger><TabsTrigger value="communications">Communication Log</TabsTrigger></TabsList>
        <TabsContent value="providers">
          <div className="grid grid-cols-3 gap-4">
            {providers.length === 0 ? <Card className="col-span-3"><CardContent className="py-8 text-center text-muted-foreground">No external providers added yet.</CardContent></Card> :
              providers.map((p: any) => (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center"><Stethoscope className="h-5 w-5 text-blue-600" /></div>
                      <div className="flex-1">
                        <p className="font-medium">{p.providerName}</p>
                        <p className="text-xs text-muted-foreground">{p.specialty || p.providerType}</p>
                        {p.phone && <p className="text-xs mt-1 flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</p>}
                        {p.organization && <p className="text-xs flex items-center gap-1"><Building className="h-3 w-3" />{p.organization}</p>}
                      </div>
                      <Badge variant="outline">{p.providerType}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
        <TabsContent value="referrals">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Patient</TableHead><TableHead>From/To</TableHead><TableHead>Reason</TableHead><TableHead>Urgency</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
              <TableBody>
                {referrals.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No referrals yet.</TableCell></TableRow> :
                  referrals.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell><Badge variant="outline">{r.referralType}</Badge></TableCell>
                      <TableCell>{r.patientId ? `Patient #${r.patientId}` : "—"}</TableCell>
                      <TableCell className="text-sm">{r.referralType === "incoming" ? r.referredFrom : r.referredTo}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{r.reason}</TableCell>
                      <TableCell><Badge className={urgencyColors[r.urgency] || ""}>{r.urgency}</Badge></TableCell>
                      <TableCell><Badge className={statusColors[r.status] || ""}>{r.status}</Badge></TableCell>
                      <TableCell className="text-sm">{format(new Date(r.createdAt), "MMM d, yyyy")}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="communications">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Direction</TableHead><TableHead>Subject</TableHead><TableHead>Summary</TableHead><TableHead>Follow-up</TableHead></TableRow></TableHeader>
              <TableBody>
                {commLogs.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No communication logs.</TableCell></TableRow> :
                  commLogs.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-sm">{format(new Date(l.contactedAt), "MMM d, h:mm a")}</TableCell>
                      <TableCell><Badge variant="outline">{l.communicationType}</Badge></TableCell>
                      <TableCell className="text-sm">{l.direction}</TableCell>
                      <TableCell className="text-sm font-medium">{l.subject || "—"}</TableCell>
                      <TableCell className="text-sm max-w-[250px] truncate">{l.summary}</TableCell>
                      <TableCell>{l.followUpNeeded ? <Badge className="bg-amber-100 text-amber-800">Yes</Badge> : "—"}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showProviderForm} onOpenChange={setShowProviderForm}>
        <DialogContent><DialogHeader><DialogTitle>Add External Provider</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addProviderMut.mutate({ providerName: fd.get("providerName"), providerType: fd.get("providerType"), specialty: fd.get("specialty"), organization: fd.get("organization"), phone: fd.get("phone"), email: fd.get("email"), npiNumber: fd.get("npiNumber") }); }}>
            <div className="space-y-4">
              <Input name="providerName" placeholder="Provider name" required />
              <select name="providerType" className="w-full border rounded-md p-2 text-sm"><option value="psychiatrist">Psychiatrist</option><option value="therapist">Therapist</option><option value="case_manager">Case Manager</option><option value="physician">Physician</option><option value="specialist">Specialist</option><option value="pharmacy">Pharmacy</option><option value="lab">Laboratory</option><option value="other">Other</option></select>
              <Input name="specialty" placeholder="Specialty" />
              <Input name="organization" placeholder="Organization" />
              <div className="grid grid-cols-2 gap-3"><Input name="phone" placeholder="Phone" /><Input name="email" placeholder="Email" type="email" /></div>
              <Input name="npiNumber" placeholder="NPI number" />
              <Button type="submit" className="w-full" disabled={addProviderMut.isPending}>Add Provider</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showReferralForm} onOpenChange={setShowReferralForm}>
        <DialogContent><DialogHeader><DialogTitle>Create Referral</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addReferralMut.mutate({ patientId: fd.get("patientId") ? Number(fd.get("patientId")) : undefined, referralType: fd.get("referralType"), referredFrom: fd.get("referredFrom"), referredTo: fd.get("referredTo"), reason: fd.get("reason"), urgency: fd.get("urgency"), externalProviderId: fd.get("externalProviderId") ? Number(fd.get("externalProviderId")) : undefined }); }}>
            <div className="space-y-4">
              <select name="referralType" className="w-full border rounded-md p-2 text-sm"><option value="incoming">Incoming</option><option value="outgoing">Outgoing</option></select>
              <select name="patientId" className="w-full border rounded-md p-2 text-sm"><option value="">Select patient...</option>{patients.map((p: any) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select>
              <Input name="referredFrom" placeholder="Referred from" />
              <Input name="referredTo" placeholder="Referred to" />
              <select name="externalProviderId" className="w-full border rounded-md p-2 text-sm"><option value="">Link to provider (optional)...</option>{providers.map((p: any) => <option key={p.id} value={p.id}>{p.providerName}</option>)}</select>
              <textarea name="reason" className="w-full border rounded-md p-2 text-sm" placeholder="Reason for referral" required />
              <select name="urgency" className="w-full border rounded-md p-2 text-sm"><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="emergent">Emergent</option></select>
              <Button type="submit" className="w-full" disabled={addReferralMut.isPending}>Create Referral</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showCommForm} onOpenChange={setShowCommForm}>
        <DialogContent><DialogHeader><DialogTitle>Log Communication</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addCommMut.mutate({ patientId: fd.get("patientId") ? Number(fd.get("patientId")) : undefined, externalProviderId: fd.get("externalProviderId") ? Number(fd.get("externalProviderId")) : undefined, communicationType: fd.get("communicationType"), direction: fd.get("direction"), subject: fd.get("subject"), summary: fd.get("summary"), followUpNeeded: fd.get("followUpNeeded") || undefined }); }}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <select name="communicationType" className="border rounded-md p-2 text-sm"><option value="phone">Phone</option><option value="email">Email</option><option value="fax">Fax</option><option value="in_person">In Person</option><option value="video">Video Call</option></select>
                <select name="direction" className="border rounded-md p-2 text-sm"><option value="outgoing">Outgoing</option><option value="incoming">Incoming</option></select>
              </div>
              <select name="patientId" className="w-full border rounded-md p-2 text-sm"><option value="">Select patient (optional)...</option>{patients.map((p: any) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select>
              <select name="externalProviderId" className="w-full border rounded-md p-2 text-sm"><option value="">Select provider (optional)...</option>{providers.map((p: any) => <option key={p.id} value={p.id}>{p.providerName}</option>)}</select>
              <Input name="subject" placeholder="Subject" />
              <textarea name="summary" className="w-full border rounded-md p-2 text-sm min-h-[80px]" placeholder="Communication summary" required />
              <Input name="followUpNeeded" placeholder="Follow-up needed? (describe)" />
              <Button type="submit" className="w-full" disabled={addCommMut.isPending}>Save Log</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
