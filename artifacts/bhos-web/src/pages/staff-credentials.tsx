import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Award, Plus, AlertTriangle, CheckCircle, Clock, Shield, Bell } from "lucide-react";
import { format, differenceInDays } from "date-fns";

const BASE = import.meta.env.BASE_URL;
function fetchApi(path: string, opts?: RequestInit) {
  return fetch(`${BASE}api${path}`, { credentials: "include", ...opts }).then(r => { if (!r.ok) throw new Error("Request failed"); return r.json(); });
}

export default function StaffCredentialsPage() {
  const qc = useQueryClient();
  const [showAddCred, setShowAddCred] = useState(false);
  const [showAddType, setShowAddType] = useState(false);

  const { data: credentials = [] } = useQuery({ queryKey: ["staff-creds"], queryFn: () => fetchApi("/staff-credentials") });
  const { data: credTypes = [] } = useQuery({ queryKey: ["cred-types"], queryFn: () => fetchApi("/credential-types") });
  const { data: expiring = [] } = useQuery({ queryKey: ["creds-expiring"], queryFn: () => fetchApi("/staff-credentials/expiring") });
  const { data: staff = [] } = useQuery({ queryKey: ["staff-list"], queryFn: () => fetchApi("/staff") });

  const addCredMut = useMutation({
    mutationFn: (data: any) => fetchApi("/staff-credentials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff-creds"] }); setShowAddCred(false); },
  });

  const addTypeMut = useMutation({
    mutationFn: (data: any) => fetchApi("/credential-types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cred-types"] }); setShowAddType(false); },
  });

  const verifyMut = useMutation({
    mutationFn: (id: number) => fetchApi(`/staff-credentials/${id}/verify`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-creds"] }),
  });

  function expiryStatus(date: string | null) {
    if (!date) return { label: "No Expiry", color: "bg-gray-100 text-gray-800" };
    const days = differenceInDays(new Date(date), new Date());
    if (days < 0) return { label: "Expired", color: "bg-red-100 text-red-800" };
    if (days <= 30) return { label: `${days}d left`, color: "bg-red-100 text-red-800" };
    if (days <= 90) return { label: `${days}d left`, color: "bg-amber-100 text-amber-800" };
    return { label: `${days}d left`, color: "bg-green-100 text-green-800" };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Staff Credentials & Licenses</h1><p className="text-muted-foreground">Track certifications, licenses, and expiration alerts</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAddType(true)}><Plus className="h-4 w-4 mr-2" />Credential Type</Button>
          <Button onClick={() => setShowAddCred(true)}><Plus className="h-4 w-4 mr-2" />Add Credential</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Credentials", value: credentials.length, icon: Award, color: "text-blue-600 bg-blue-50" },
          { label: "Verified", value: credentials.filter((c: any) => c.verifiedAt).length, icon: CheckCircle, color: "text-green-600 bg-green-50" },
          { label: "Expiring Soon", value: expiring.length, icon: AlertTriangle, color: "text-amber-600 bg-amber-50" },
          { label: "Credential Types", value: credTypes.length, icon: Shield, color: "text-purple-600 bg-purple-50" },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4 flex items-center gap-3"><div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.color.split(" ")[1]}`}><s.icon className={`h-5 w-5 ${s.color.split(" ")[0]}`} /></div><div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div></CardContent></Card>
        ))}
      </div>

      {expiring.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-amber-800"><Bell className="h-4 w-4" />Expiring Soon ({expiring.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {expiring.slice(0, 5).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span><span className="font-medium">{c.credentialName}</span> — Staff #{c.staffId}</span>
                <Badge className="bg-red-100 text-red-800">{c.expirationDate ? `Expires ${format(new Date(c.expirationDate), "MMM d, yyyy")}` : ""}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="credentials">
        <TabsList><TabsTrigger value="credentials">All Credentials</TabsTrigger><TabsTrigger value="types">Credential Types</TabsTrigger></TabsList>
        <TabsContent value="credentials">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Staff Member</TableHead><TableHead>Credential</TableHead><TableHead>Number</TableHead><TableHead>Issuing Authority</TableHead><TableHead>Expiry</TableHead><TableHead>Verified</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {credentials.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No credentials tracked yet.</TableCell></TableRow> :
                  credentials.map((c: any) => {
                    const exp = expiryStatus(c.expirationDate);
                    const staffMember = staff.find((s: any) => s.id === c.staffId);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{staffMember ? `${staffMember.firstName} ${staffMember.lastName}` : `Staff #${c.staffId}`}</TableCell>
                        <TableCell>{c.credentialName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.credentialNumber || "—"}</TableCell>
                        <TableCell className="text-sm">{c.issuingAuthority || "—"}</TableCell>
                        <TableCell><Badge className={exp.color}>{exp.label}</Badge></TableCell>
                        <TableCell>{c.verifiedAt ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-muted-foreground" />}</TableCell>
                        <TableCell>{!c.verifiedAt && <Button size="sm" variant="outline" onClick={() => verifyMut.mutate(c.id)}>Verify</Button>}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="types">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Required</TableHead><TableHead>Renewal Period</TableHead><TableHead>Reminder</TableHead></TableRow></TableHeader>
              <TableBody>
                {credTypes.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No credential types defined. Add types like CPR, state license, etc.</TableCell></TableRow> :
                  credTypes.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell><Badge variant="outline">{t.category}</Badge></TableCell>
                      <TableCell>{t.isRequired ? <Badge className="bg-red-100 text-red-800">Required</Badge> : "Optional"}</TableCell>
                      <TableCell>{t.renewalPeriodMonths ? `${t.renewalPeriodMonths} months` : "—"}</TableCell>
                      <TableCell>{t.reminderDaysBefore} days before</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddCred} onOpenChange={setShowAddCred}>
        <DialogContent><DialogHeader><DialogTitle>Add Credential</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addCredMut.mutate({ staffId: Number(fd.get("staffId")), credentialTypeId: fd.get("credentialTypeId") ? Number(fd.get("credentialTypeId")) : undefined, credentialName: fd.get("credentialName"), credentialNumber: fd.get("credentialNumber"), issuingAuthority: fd.get("issuingAuthority"), issueDate: fd.get("issueDate") || undefined, expirationDate: fd.get("expirationDate") || undefined }); }}>
            <div className="space-y-4">
              <select name="staffId" className="w-full border rounded-md p-2 text-sm" required><option value="">Select staff member...</option>{staff.map((s: any) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}</select>
              <select name="credentialTypeId" className="w-full border rounded-md p-2 text-sm"><option value="">Select type (optional)...</option>{credTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              <Input name="credentialName" placeholder="Credential name (e.g., CPR Certification)" required />
              <Input name="credentialNumber" placeholder="License/cert number" />
              <Input name="issuingAuthority" placeholder="Issuing authority" />
              <div className="grid grid-cols-2 gap-3"><Input name="issueDate" type="date" placeholder="Issue date" /><Input name="expirationDate" type="date" placeholder="Expiration date" /></div>
              <Button type="submit" className="w-full" disabled={addCredMut.isPending}>Add Credential</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddType} onOpenChange={setShowAddType}>
        <DialogContent><DialogHeader><DialogTitle>Add Credential Type</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addTypeMut.mutate({ name: fd.get("name"), category: fd.get("category"), description: fd.get("description"), isRequired: fd.get("isRequired") === "on", renewalPeriodMonths: fd.get("renewalPeriodMonths") ? Number(fd.get("renewalPeriodMonths")) : undefined, reminderDaysBefore: Number(fd.get("reminderDaysBefore") || 30) }); }}>
            <div className="space-y-4">
              <Input name="name" placeholder="Type name (e.g., CPR, State License)" required />
              <select name="category" className="w-full border rounded-md p-2 text-sm"><option value="license">License</option><option value="certification">Certification</option><option value="background_check">Background Check</option><option value="health_screening">Health Screening</option><option value="training">Training</option></select>
              <Input name="description" placeholder="Description" />
              <div className="grid grid-cols-2 gap-3"><Input name="renewalPeriodMonths" type="number" placeholder="Renewal period (months)" /><Input name="reminderDaysBefore" type="number" placeholder="Reminder days" defaultValue={30} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isRequired" />Required for all applicable staff</label>
              <Button type="submit" className="w-full" disabled={addTypeMut.isPending}>Add Type</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
