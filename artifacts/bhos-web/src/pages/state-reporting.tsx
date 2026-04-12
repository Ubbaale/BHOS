import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Send, Plus, FileText, Calendar, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL;
function fetchApi(path: string, opts?: RequestInit) {
  return fetch(`${BASE}api${path}`, { credentials: "include", ...opts }).then(r => { if (!r.ok) throw new Error("Request failed"); return r.json(); });
}

export default function StateReportingPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const { data: reports = [] } = useQuery({ queryKey: ["state-reports"], queryFn: () => fetchApi("/state-reports") });
  const { data: schedules = [] } = useQuery({ queryKey: ["report-schedules"], queryFn: () => fetchApi("/report-schedules") });

  const createMut = useMutation({
    mutationFn: (data: any) => fetchApi("/state-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["state-reports"] }); setShowCreate(false); },
  });

  const submitMut = useMutation({
    mutationFn: (id: number) => fetchApi(`/state-reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "submitted" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["state-reports"] }),
  });

  const scheduleMut = useMutation({
    mutationFn: (data: any) => fetchApi("/report-schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["report-schedules"] }); setShowSchedule(false); },
  });

  const statusColors: Record<string, string> = { draft: "bg-gray-100 text-gray-800", ready: "bg-blue-100 text-blue-800", submitted: "bg-green-100 text-green-800", overdue: "bg-red-100 text-red-800" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">State Agency Reporting</h1><p className="text-muted-foreground">Manage and submit required state reports</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSchedule(true)}><Calendar className="h-4 w-4 mr-2" />Add Schedule</Button>
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />New Report</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Reports", value: reports.length, icon: FileText, color: "text-blue-600 bg-blue-50" },
          { label: "Submitted", value: reports.filter((r: any) => r.status === "submitted").length, icon: CheckCircle, color: "text-green-600 bg-green-50" },
          { label: "Pending", value: reports.filter((r: any) => r.status === "draft" || r.status === "ready").length, icon: Clock, color: "text-amber-600 bg-amber-50" },
          { label: "Schedules", value: schedules.length, icon: Calendar, color: "text-purple-600 bg-purple-50" },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4 flex items-center gap-3"><div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.color.split(" ")[1]}`}><s.icon className={`h-5 w-5 ${s.color.split(" ")[0]}`} /></div><div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div></CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="reports">
        <TabsList><TabsTrigger value="reports">Reports</TabsTrigger><TabsTrigger value="schedules">Schedules</TabsTrigger></TabsList>
        <TabsContent value="reports">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Report Type</TableHead><TableHead>State</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead><TableHead>Due Date</TableHead><TableHead>Submitted</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {reports.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No reports yet.</TableCell></TableRow> :
                  reports.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.reportType}</TableCell>
                      <TableCell>{r.state}</TableCell>
                      <TableCell className="text-sm">{r.reportPeriod || "—"}</TableCell>
                      <TableCell><Badge className={statusColors[r.status] || ""}>{r.status}</Badge></TableCell>
                      <TableCell className="text-sm">{r.dueDate ? format(new Date(r.dueDate), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell className="text-sm">{r.submittedAt ? format(new Date(r.submittedAt), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell>{r.status !== "submitted" && <Button size="sm" variant="outline" onClick={() => submitMut.mutate(r.id)}><Send className="h-3 w-3 mr-1" />Submit</Button>}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="schedules">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Report Type</TableHead><TableHead>State</TableHead><TableHead>Frequency</TableHead><TableHead>Next Due</TableHead><TableHead>Agency</TableHead><TableHead>Method</TableHead></TableRow></TableHeader>
              <TableBody>
                {schedules.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No schedules configured.</TableCell></TableRow> :
                  schedules.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.reportType}</TableCell>
                      <TableCell>{s.state}</TableCell>
                      <TableCell><Badge variant="outline">{s.frequency}</Badge></TableCell>
                      <TableCell className="text-sm">{s.nextDueDate ? format(new Date(s.nextDueDate), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell className="text-sm">{s.recipientAgency || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{s.submissionMethod}</Badge></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent><DialogHeader><DialogTitle>Create Report</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); createMut.mutate({ reportType: fd.get("reportType"), state: fd.get("state"), reportPeriod: fd.get("reportPeriod"), dueDate: fd.get("dueDate") || undefined, notes: fd.get("notes") }); }}>
            <div className="space-y-4">
              <select name="reportType" className="w-full border rounded-md p-2 text-sm" required><option value="">Select type...</option><option value="incident_report">Incident Report</option><option value="census_report">Census Report</option><option value="restraint_usage">Restraint Usage</option><option value="medication_error">Medication Error Report</option><option value="annual_inspection">Annual Inspection</option><option value="fire_safety">Fire Safety</option><option value="staffing_report">Staffing Report</option></select>
              <Input name="state" placeholder="State (e.g., CA, TX, NY)" required />
              <Input name="reportPeriod" placeholder="Report period (e.g., Q1 2026)" />
              <Input name="dueDate" type="date" placeholder="Due date" />
              <Input name="notes" placeholder="Notes" />
              <Button type="submit" className="w-full" disabled={createMut.isPending}>Create Report</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showSchedule} onOpenChange={setShowSchedule}>
        <DialogContent><DialogHeader><DialogTitle>Add Report Schedule</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); scheduleMut.mutate({ reportType: fd.get("reportType"), state: fd.get("state"), frequency: fd.get("frequency"), nextDueDate: fd.get("nextDueDate") || undefined, recipientAgency: fd.get("recipientAgency"), submissionMethod: fd.get("submissionMethod") }); }}>
            <div className="space-y-4">
              <Input name="reportType" placeholder="Report type" required />
              <Input name="state" placeholder="State" required />
              <select name="frequency" className="w-full border rounded-md p-2 text-sm"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Annually</option><option value="as_needed">As Needed</option></select>
              <Input name="nextDueDate" type="date" placeholder="Next due date" />
              <Input name="recipientAgency" placeholder="Recipient agency" />
              <select name="submissionMethod" className="w-full border rounded-md p-2 text-sm"><option value="electronic">Electronic</option><option value="portal">State Portal</option><option value="email">Email</option><option value="mail">Mail</option></select>
              <Button type="submit" className="w-full" disabled={scheduleMut.isPending}>Add Schedule</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
