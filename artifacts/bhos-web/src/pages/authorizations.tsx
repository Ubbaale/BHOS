import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Plus, AlertTriangle, CheckCircle, Clock, Ban } from "lucide-react";
import { format, differenceInDays } from "date-fns";

const BASE = import.meta.env.BASE_URL;
function fetchApi(path: string, opts?: RequestInit) {
  return fetch(`${BASE}api${path}`, { credentials: "include", ...opts }).then(r => { if (!r.ok) throw new Error("Request failed"); return r.json(); });
}

export default function AuthorizationsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<number | null>(null);

  const { data: auths = [] } = useQuery({ queryKey: ["authorizations"], queryFn: () => fetchApi("/authorizations") });
  const { data: detail } = useQuery({ queryKey: ["auth-detail", showDetail], queryFn: () => fetchApi(`/authorizations/${showDetail}`), enabled: !!showDetail });
  const { data: patients = [] } = useQuery({ queryKey: ["patients-list"], queryFn: () => fetchApi("/patients") });

  const createMut = useMutation({
    mutationFn: (data: any) => fetchApi("/authorizations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["authorizations"] }); setShowCreate(false); },
  });

  const statusColors: Record<string, string> = { active: "bg-green-100 text-green-800", pending: "bg-amber-100 text-amber-800", expired: "bg-red-100 text-red-800", denied: "bg-red-100 text-red-800", exhausted: "bg-gray-100 text-gray-800" };

  function utilizationColor(used: number, approved: number) {
    const pct = approved > 0 ? (used / approved) * 100 : 0;
    if (pct >= 90) return "bg-red-500";
    if (pct >= 70) return "bg-amber-500";
    return "bg-green-500";
  }

  const activeAuths = auths.filter((a: any) => a.status === "active");
  const nearExpiry = activeAuths.filter((a: any) => differenceInDays(new Date(a.endDate), new Date()) <= 30);
  const nearExhausted = activeAuths.filter((a: any) => a.approvedUnits > 0 && ((a.usedUnits / a.approvedUnits) * 100 >= a.alertThresholdPercent));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Insurance Authorizations</h1><p className="text-muted-foreground">Track prior authorizations, units, and expiration</p></div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />New Authorization</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Active", value: activeAuths.length, icon: CheckCircle, color: "text-green-600 bg-green-50" },
          { label: "Total", value: auths.length, icon: ShieldCheck, color: "text-blue-600 bg-blue-50" },
          { label: "Expiring Soon", value: nearExpiry.length, icon: Clock, color: "text-amber-600 bg-amber-50" },
          { label: "Near Exhausted", value: nearExhausted.length, icon: AlertTriangle, color: "text-red-600 bg-red-50" },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4 flex items-center gap-3"><div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.color.split(" ")[1]}`}><s.icon className={`h-5 w-5 ${s.color.split(" ")[0]}`} /></div><div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div></CardContent></Card>
        ))}
      </div>

      {(nearExpiry.length > 0 || nearExhausted.length > 0) && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-amber-800"><AlertTriangle className="h-4 w-4" />Alerts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {nearExpiry.map((a: any) => <div key={`exp-${a.id}`} className="text-sm flex items-center justify-between"><span>Auth #{a.authorizationNumber} — Patient #{a.patientId}</span><Badge className="bg-amber-100 text-amber-800">Expires {format(new Date(a.endDate), "MMM d")}</Badge></div>)}
            {nearExhausted.map((a: any) => <div key={`exh-${a.id}`} className="text-sm flex items-center justify-between"><span>Auth #{a.authorizationNumber} — Patient #{a.patientId}</span><Badge className="bg-red-100 text-red-800">{a.usedUnits}/{a.approvedUnits} units used</Badge></div>)}
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Auth #</TableHead><TableHead>Patient</TableHead><TableHead>Service</TableHead><TableHead>Units</TableHead><TableHead>Utilization</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {auths.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No authorizations tracked yet.</TableCell></TableRow> :
              auths.map((a: any) => {
                const pct = a.approvedUnits > 0 ? Math.round((a.usedUnits / a.approvedUnits) * 100) : 0;
                return (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setShowDetail(a.id)}>
                    <TableCell className="font-medium">{a.authorizationNumber}</TableCell>
                    <TableCell>Patient #{a.patientId}</TableCell>
                    <TableCell className="text-sm">{a.serviceType}</TableCell>
                    <TableCell className="text-sm">{a.usedUnits} / {a.approvedUnits} {a.unitType}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 bg-gray-100 rounded-full"><div className={`h-2 rounded-full ${utilizationColor(a.usedUnits, a.approvedUnits)}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                        <span className="text-xs">{pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{format(new Date(a.startDate), "M/d/yy")} – {format(new Date(a.endDate), "M/d/yy")}</TableCell>
                    <TableCell><Badge className={statusColors[a.status] || ""}>{a.status}</Badge></TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setShowDetail(a.id); }}>View</Button></TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent><DialogHeader><DialogTitle>New Authorization</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); createMut.mutate({ patientId: Number(fd.get("patientId")), authorizationNumber: fd.get("authorizationNumber"), serviceType: fd.get("serviceType"), approvedUnits: Number(fd.get("approvedUnits")), unitType: fd.get("unitType"), startDate: fd.get("startDate"), endDate: fd.get("endDate"), alertThresholdPercent: Number(fd.get("alertThresholdPercent") || 80) }); }}>
            <div className="space-y-4">
              <select name="patientId" className="w-full border rounded-md p-2 text-sm" required><option value="">Select patient...</option>{patients.map((p: any) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select>
              <Input name="authorizationNumber" placeholder="Authorization number" required />
              <Input name="serviceType" placeholder="Service type (e.g., Residential Treatment)" required />
              <div className="grid grid-cols-2 gap-3"><Input name="approvedUnits" type="number" placeholder="Approved units" required /><select name="unitType" className="border rounded-md p-2 text-sm"><option value="days">Days</option><option value="hours">Hours</option><option value="visits">Visits</option><option value="sessions">Sessions</option></select></div>
              <div className="grid grid-cols-2 gap-3"><Input name="startDate" type="date" required /><Input name="endDate" type="date" required /></div>
              <Input name="alertThresholdPercent" type="number" placeholder="Alert at % used (default: 80)" defaultValue={80} />
              <Button type="submit" className="w-full" disabled={createMut.isPending}>Create Authorization</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Authorization Details</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Auth #:</span> <span className="font-medium">{detail.authorizationNumber}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge className={statusColors[detail.status] || ""}>{detail.status}</Badge></div>
                <div><span className="text-muted-foreground">Service:</span> {detail.serviceType}</div>
                <div><span className="text-muted-foreground">Units:</span> {detail.usedUnits} / {detail.approvedUnits} {detail.unitType}</div>
                <div><span className="text-muted-foreground">Start:</span> {format(new Date(detail.startDate), "MMM d, yyyy")}</div>
                <div><span className="text-muted-foreground">End:</span> {format(new Date(detail.endDate), "MMM d, yyyy")}</div>
              </div>
              <div className="h-3 bg-gray-100 rounded-full"><div className={`h-3 rounded-full ${utilizationColor(detail.usedUnits, detail.approvedUnits)}`} style={{ width: `${Math.min(Math.round((detail.usedUnits / detail.approvedUnits) * 100), 100)}%` }} /></div>
              {detail.history?.length > 0 && (
                <div>
                  <p className="font-medium text-sm mb-2">History</p>
                  {detail.history.map((h: any) => (
                    <div key={h.id} className="text-xs border-l-2 border-gray-200 pl-3 py-1">
                      <span className="font-medium">{h.action}</span> — {h.notes} <span className="text-muted-foreground">{format(new Date(h.createdAt), "MMM d, h:mm a")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
