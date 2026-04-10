import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, UserCheck, ClipboardList, FileBarChart, AlertTriangle, CheckCircle, Copy, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_URL || "";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function getScoreColor(score: number) {
  if (score >= 90) return "text-green-600";
  if (score >= 70) return "text-yellow-600";
  return "text-red-600";
}

function getScoreBg(score: number) {
  if (score >= 90) return "bg-green-100 border-green-300";
  if (score >= 70) return "bg-yellow-100 border-yellow-300";
  return "bg-red-100 border-red-300";
}

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 90 ? "#16a34a" : score >= 70 ? "#ca8a04" : "#dc2626";
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
      <text x={size / 2} y={size / 2 + 8} textAnchor="middle" className="fill-current text-2xl font-bold" transform={`rotate(90, ${size / 2}, ${size / 2})`}>
        {score}%
      </text>
    </svg>
  );
}

export default function CompliancePage() {
  const [tab, setTab] = useState("scorecard");
  const [showAddInspector, setShowAddInspector] = useState(false);
  const [showGenerateReport, setShowGenerateReport] = useState(false);
  const [showScheduleVisit, setShowScheduleVisit] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: scorecard } = useQuery({ queryKey: ["/api/compliance/scorecard"], queryFn: () => apiFetch("/api/compliance/scorecard") });
  const { data: inspectors } = useQuery({ queryKey: ["/api/compliance/inspectors"], queryFn: () => apiFetch("/api/compliance/inspectors") });
  const { data: visits } = useQuery({ queryKey: ["/api/compliance/visits"], queryFn: () => apiFetch("/api/compliance/visits") });
  const { data: reports } = useQuery({ queryKey: ["/api/compliance/reports"], queryFn: () => apiFetch("/api/compliance/reports") });
  const { data: auditLog } = useQuery({ queryKey: ["/api/compliance/audit-log"], queryFn: () => apiFetch("/api/compliance/audit-log") });

  const addInspectorMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiFetch("/api/compliance/inspectors", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/compliance/inspectors"] });
      setShowAddInspector(false);
      toast({ title: "Inspector Added", description: `Access token: ${data.accessToken}. Copy it now — it won't be shown again.` });
    },
  });

  const generateReportMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiFetch("/api/compliance/reports/generate", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compliance/reports"] });
      setShowGenerateReport(false);
      toast({ title: "Report Generated" });
    },
  });

  const scheduleVisitMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiFetch("/api/compliance/visits", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compliance/visits"] });
      setShowScheduleVisit(false);
      toast({ title: "Inspection Scheduled" });
    },
  });

  const regenerateTokenMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/compliance/inspectors/${id}/regenerate-token`, { method: "POST" }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/compliance/inspectors"] });
      navigator.clipboard.writeText(data.accessToken);
      toast({ title: "Token Regenerated", description: "New token copied to clipboard" });
    },
  });

  const revokeInspectorMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/compliance/inspectors/${id}`, { method: "PATCH", body: JSON.stringify({ status: "revoked" }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compliance/inspectors"] });
      toast({ title: "Inspector access revoked" });
    },
  });

  const scores = scorecard?.scores || {};
  const overall = scorecard?.overall || 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">State Compliance</h1>
          <p className="text-gray-500 mt-1">Regulatory readiness, inspector management, and compliance reporting</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="scorecard">Readiness Scorecard</TabsTrigger>
          <TabsTrigger value="inspectors">State Inspectors</TabsTrigger>
          <TabsTrigger value="visits">Inspection History</TabsTrigger>
          <TabsTrigger value="reports">Compliance Reports</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="scorecard" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 flex flex-col items-center">
                <ScoreRing score={overall} size={140} />
                <p className="text-sm text-gray-500 mt-2">Overall Readiness</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Homes Monitored</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{scorecard?.homeCount || 0}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Total Staff</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{scorecard?.staffCount || 0}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Recent Inspections</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{scorecard?.recentInspections || 0}</div></CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(scores).map(([key, val]: [string, any]) => (
              <Card key={key} className={`border ${getScoreBg(val.score)}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{val.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${getScoreColor(val.score)}`}>{val.score}%</div>
                  <p className="text-xs text-gray-600 mt-1">{val.details}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="inspectors" className="space-y-4 mt-6">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddInspector(true)}>
              <UserCheck className="h-4 w-4 mr-2" /> Add Inspector
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(inspectors || []).map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell>{i.email}</TableCell>
                    <TableCell>{i.stateAgency}</TableCell>
                    <TableCell>{i.title || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={i.status === "active" ? "default" : "destructive"}>
                        {i.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{i.lastLoginAt ? new Date(i.lastLoginAt).toLocaleDateString() : "Never"}</TableCell>
                    <TableCell>{i.expiresAt ? new Date(i.expiresAt).toLocaleDateString() : "No expiry"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => regenerateTokenMut.mutate(i.id)} title="Regenerate Token">
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                        {i.status === "active" && (
                          <Button size="sm" variant="destructive" onClick={() => revokeInspectorMut.mutate(i.id)}>
                            Revoke
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!inspectors || inspectors.length === 0) && (
                  <TableRow><TableCell colSpan={8} className="text-center text-gray-500 py-8">No state inspectors configured</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="visits" className="space-y-4 mt-6">
          <div className="flex justify-end">
            <Button onClick={() => setShowScheduleVisit(true)}>
              <ClipboardList className="h-4 w-4 mr-2" /> Schedule Inspection
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Home</TableHead>
                  <TableHead>Inspector</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Follow-up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(visits || []).map((v: any) => (
                  <TableRow key={v.visit.id}>
                    <TableCell className="font-medium">{v.homeName}</TableCell>
                    <TableCell>{v.inspectorName}</TableCell>
                    <TableCell>{v.inspectorAgency}</TableCell>
                    <TableCell><Badge variant="outline">{v.visit.visitType}</Badge></TableCell>
                    <TableCell>{v.visit.visitDate ? new Date(v.visit.visitDate).toLocaleDateString() : v.visit.scheduledDate ? new Date(v.visit.scheduledDate).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={v.visit.status === "completed" ? "default" : v.visit.status === "scheduled" ? "secondary" : "destructive"}>
                        {v.visit.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {v.visit.overallScore != null ? (
                        <span className={`font-bold ${getScoreColor(v.visit.overallScore)}`}>{v.visit.overallScore}%</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{v.visit.followUpRequired ? <AlertTriangle className="h-4 w-4 text-yellow-600" /> : <CheckCircle className="h-4 w-4 text-green-600" />}</TableCell>
                  </TableRow>
                ))}
                {(!visits || visits.length === 0) && (
                  <TableRow><TableCell colSpan={8} className="text-center text-gray-500 py-8">No inspection visits recorded</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4 mt-6">
          <div className="flex justify-end">
            <Button onClick={() => setShowGenerateReport(true)}>
              <FileBarChart className="h-4 w-4 mr-2" /> Generate Report
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Type</TableHead>
                  <TableHead>Home</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Scores</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(reports || []).map((r: any) => (
                  <TableRow key={r.report.id}>
                    <TableCell className="font-medium capitalize">{r.report.reportType.replace(/_/g, " ")}</TableCell>
                    <TableCell>{r.homeName || "All Homes"}</TableCell>
                    <TableCell>
                      {new Date(r.report.reportPeriodStart).toLocaleDateString()} — {new Date(r.report.reportPeriodEnd).toLocaleDateString()}
                    </TableCell>
                    <TableCell><Badge variant={r.report.status === "generated" ? "default" : "secondary"}>{r.report.status}</Badge></TableCell>
                    <TableCell>{new Date(r.report.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {r.report.scores && Object.entries(r.report.scores).map(([k, v]: [string, any]) => (
                        <span key={k} className={`mr-2 text-sm ${getScoreColor(v)}`}>
                          {k.replace(/([A-Z])/g, " $1").trim()}: {v}%
                        </span>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
                {(!reports || reports.length === 0) && (
                  <TableRow><TableCell colSpan={6} className="text-center text-gray-500 py-8">No compliance reports generated</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">State Inspector Access Log</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Inspector</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(auditLog || []).map((l: any) => (
                  <TableRow key={l.log.id}>
                    <TableCell className="text-sm">{new Date(l.log.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="font-medium">{l.inspectorName}</TableCell>
                    <TableCell>{l.inspectorAgency}</TableCell>
                    <TableCell><Badge variant="outline">{l.log.action}</Badge></TableCell>
                    <TableCell>{l.log.resourceType}{l.log.resourceId ? ` #${l.log.resourceId}` : ""}</TableCell>
                    <TableCell className="text-sm font-mono">{l.log.ipAddress || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-500 max-w-[200px] truncate">{l.log.details}</TableCell>
                  </TableRow>
                ))}
                {(!auditLog || auditLog.length === 0) && (
                  <TableRow><TableCell colSpan={7} className="text-center text-gray-500 py-8">No inspector access recorded</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <AddInspectorDialog open={showAddInspector} onClose={() => setShowAddInspector(false)} onSubmit={(d) => addInspectorMut.mutate(d)} loading={addInspectorMut.isPending} />
      <GenerateReportDialog open={showGenerateReport} onClose={() => setShowGenerateReport(false)} onSubmit={(d) => generateReportMut.mutate(d)} loading={generateReportMut.isPending} />
      <ScheduleVisitDialog open={showScheduleVisit} onClose={() => setShowScheduleVisit(false)} onSubmit={(d) => scheduleVisitMut.mutate(d)} loading={scheduleVisitMut.isPending} inspectors={inspectors || []} />
    </div>
  );
}

function AddInspectorDialog({ open, onClose, onSubmit, loading }: { open: boolean; onClose: () => void; onSubmit: (d: any) => void; loading: boolean }) {
  const [form, setForm] = useState({ name: "", email: "", stateAgency: "", title: "", phone: "", expiresAt: "" });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add State Inspector</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Full Name</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div><Label>State Agency</Label><Input value={form.stateAgency} onChange={(e) => set("stateAgency", e.target.value)} placeholder="e.g., Department of Health" /></div>
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g., Licensing Surveyor" /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div><Label>Access Expires</Label><Input type="date" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSubmit({ ...form, expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null })} disabled={loading || !form.name || !form.email || !form.stateAgency}>
            Add Inspector
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenerateReportDialog({ open, onClose, onSubmit, loading }: { open: boolean; onClose: () => void; onSubmit: (d: any) => void; loading: boolean }) {
  const [form, setForm] = useState({ reportType: "comprehensive", periodStart: "", periodEnd: "" });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Generate Compliance Report</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Report Type</Label>
            <Select value={form.reportType} onValueChange={(v) => set("reportType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="comprehensive">Comprehensive</SelectItem>
                <SelectItem value="restraint_seclusion">Restraint & Seclusion</SelectItem>
                <SelectItem value="training_compliance">Training Compliance</SelectItem>
                <SelectItem value="incident_summary">Incident Summary</SelectItem>
                <SelectItem value="medication_compliance">Medication Compliance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Period Start</Label><Input type="date" value={form.periodStart} onChange={(e) => set("periodStart", e.target.value)} /></div>
          <div><Label>Period End</Label><Input type="date" value={form.periodEnd} onChange={(e) => set("periodEnd", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSubmit(form)} disabled={loading || !form.periodStart || !form.periodEnd}>Generate Report</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleVisitDialog({ open, onClose, onSubmit, loading, inspectors }: { open: boolean; onClose: () => void; onSubmit: (d: any) => void; loading: boolean; inspectors: any[] }) {
  const [form, setForm] = useState({ inspectorId: "", visitType: "routine", scheduledDate: "" });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const { data: homes } = useQuery({ queryKey: ["/api/homes"], queryFn: () => apiFetch("/api/homes") });
  const [homeId, setHomeId] = useState("");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Schedule Inspection Visit</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Inspector</Label>
            <Select value={form.inspectorId} onValueChange={(v) => set("inspectorId", v)}>
              <SelectTrigger><SelectValue placeholder="Select inspector" /></SelectTrigger>
              <SelectContent>
                {inspectors.filter((i: any) => i.status === "active").map((i: any) => (
                  <SelectItem key={i.id} value={String(i.id)}>{i.name} — {i.stateAgency}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Home</Label>
            <Select value={homeId} onValueChange={setHomeId}>
              <SelectTrigger><SelectValue placeholder="Select home" /></SelectTrigger>
              <SelectContent>
                {(homes || []).map((h: any) => (
                  <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Visit Type</Label>
            <Select value={form.visitType} onValueChange={(v) => set("visitType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="routine">Routine</SelectItem>
                <SelectItem value="complaint">Complaint Investigation</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="relicensure">Relicensure</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Scheduled Date</Label><Input type="date" value={form.scheduledDate} onChange={(e) => set("scheduledDate", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSubmit({ ...form, inspectorId: parseInt(form.inspectorId), homeId: parseInt(homeId), scheduledDate: new Date(form.scheduledDate).toISOString() })} disabled={loading || !form.inspectorId || !homeId || !form.scheduledDate}>
            Schedule Visit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
