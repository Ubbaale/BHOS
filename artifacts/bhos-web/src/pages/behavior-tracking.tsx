import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Plus, AlertCircle, TrendingUp, Shield, BarChart3 } from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL;
function fetchApi(path: string, opts?: RequestInit) {
  return fetch(`${BASE}api${path}`, { credentials: "include", ...opts }).then(r => { if (!r.ok) throw new Error("Request failed"); return r.json(); });
}

export default function BehaviorTrackingPage() {
  const qc = useQueryClient();
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [showDefForm, setShowDefForm] = useState(false);

  const { data: definitions = [] } = useQuery({ queryKey: ["behavior-defs"], queryFn: () => fetchApi("/behavior-definitions") });
  const { data: incidents = [] } = useQuery({ queryKey: ["behavior-incidents"], queryFn: () => fetchApi("/behavior-incidents") });
  const { data: plans = [] } = useQuery({ queryKey: ["behavior-plans"], queryFn: () => fetchApi("/behavior-plans") });
  const { data: patients = [] } = useQuery({ queryKey: ["patients-list"], queryFn: () => fetchApi("/patients") });

  const addDefMut = useMutation({
    mutationFn: (data: any) => fetchApi("/behavior-definitions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["behavior-defs"] }); setShowDefForm(false); },
  });

  const addIncidentMut = useMutation({
    mutationFn: (data: any) => fetchApi("/behavior-incidents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["behavior-incidents"] }); setShowIncidentForm(false); },
  });

  const severityColors: Record<string, string> = { low: "bg-green-100 text-green-800", moderate: "bg-amber-100 text-amber-800", high: "bg-orange-100 text-orange-800", severe: "bg-red-100 text-red-800" };
  const intensityColors = severityColors;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Behavior Tracking (ABC)</h1><p className="text-muted-foreground">Track antecedent-behavior-consequence data</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowDefForm(true)}><Plus className="h-4 w-4 mr-2" />Define Behavior</Button>
          <Button onClick={() => setShowIncidentForm(true)}><Plus className="h-4 w-4 mr-2" />Log Incident</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Defined Behaviors", value: definitions.length, icon: Activity, color: "text-blue-600 bg-blue-50" },
          { label: "Total Incidents", value: incidents.length, icon: AlertCircle, color: "text-red-600 bg-red-50" },
          { label: "This Week", value: incidents.filter((i: any) => new Date(i.occurredAt) > new Date(Date.now() - 7 * 24 * 3600000)).length, icon: TrendingUp, color: "text-amber-600 bg-amber-50" },
          { label: "Intervention Plans", value: plans.length, icon: Shield, color: "text-purple-600 bg-purple-50" },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4 flex items-center gap-3"><div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.color.split(" ")[1]}`}><s.icon className={`h-5 w-5 ${s.color.split(" ")[0]}`} /></div><div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div></CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="incidents">
        <TabsList><TabsTrigger value="incidents">Incidents Log</TabsTrigger><TabsTrigger value="definitions">Behavior Definitions</TabsTrigger><TabsTrigger value="plans">Intervention Plans</TabsTrigger></TabsList>
        <TabsContent value="incidents">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Date/Time</TableHead><TableHead>Patient</TableHead><TableHead>Behavior</TableHead><TableHead>Antecedent</TableHead><TableHead>Consequence</TableHead><TableHead>Intensity</TableHead></TableRow></TableHeader>
              <TableBody>
                {incidents.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No incidents recorded yet.</TableCell></TableRow> :
                  incidents.map((inc: any) => (
                    <TableRow key={inc.id}>
                      <TableCell className="text-sm">{format(new Date(inc.occurredAt), "MMM d, h:mm a")}</TableCell>
                      <TableCell>Patient #{inc.patientId}</TableCell>
                      <TableCell className="font-medium">{inc.behavior}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{inc.antecedent || "—"}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{inc.consequence || "—"}</TableCell>
                      <TableCell><Badge className={intensityColors[inc.intensity] || ""}>{inc.intensity}</Badge></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="definitions">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Behavior</TableHead><TableHead>Definition</TableHead><TableHead>Category</TableHead><TableHead>Severity</TableHead><TableHead>Measurement</TableHead></TableRow></TableHeader>
              <TableBody>
                {definitions.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No behaviors defined yet.</TableCell></TableRow> :
                  definitions.map((def: any) => (
                    <TableRow key={def.id}>
                      <TableCell className="font-medium">{def.behaviorName}</TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate">{def.operationalDefinition}</TableCell>
                      <TableCell><Badge variant="outline">{def.category}</Badge></TableCell>
                      <TableCell><Badge className={severityColors[def.severity] || ""}>{def.severity}</Badge></TableCell>
                      <TableCell className="text-sm">{def.measurementType}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="plans">
          <Card><CardContent className={plans.length === 0 ? "py-8 text-center text-muted-foreground" : "p-0"}>
            {plans.length === 0 ? "No behavior intervention plans yet." :
              <Table><TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Patient</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
                <TableBody>{plans.map((p: any) => <TableRow key={p.id}><TableCell className="font-medium">{p.title}</TableCell><TableCell>Patient #{p.patientId}</TableCell><TableCell><Badge variant="outline">{p.status}</Badge></TableCell><TableCell className="text-sm">{format(new Date(p.createdAt), "MMM d, yyyy")}</TableCell></TableRow>)}</TableBody></Table>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showDefForm} onOpenChange={setShowDefForm}>
        <DialogContent><DialogHeader><DialogTitle>Define Behavior</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addDefMut.mutate({ behaviorName: fd.get("behaviorName"), operationalDefinition: fd.get("operationalDefinition"), category: fd.get("category"), severity: fd.get("severity"), measurementType: fd.get("measurementType"), patientId: fd.get("patientId") ? Number(fd.get("patientId")) : undefined }); }}>
            <div className="space-y-4">
              <Input name="behaviorName" placeholder="Behavior name" required />
              <textarea name="operationalDefinition" className="w-full border rounded-md p-2 text-sm min-h-[80px]" placeholder="Operational definition (observable, measurable description)" required />
              <div className="grid grid-cols-2 gap-3">
                <select name="category" className="border rounded-md p-2 text-sm"><option value="target">Target</option><option value="replacement">Replacement</option><option value="precursor">Precursor</option></select>
                <select name="severity" className="border rounded-md p-2 text-sm"><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option><option value="severe">Severe</option></select>
              </div>
              <select name="measurementType" className="w-full border rounded-md p-2 text-sm"><option value="frequency">Frequency</option><option value="duration">Duration</option><option value="intensity">Intensity</option><option value="latency">Latency</option></select>
              <select name="patientId" className="w-full border rounded-md p-2 text-sm"><option value="">All patients (general)</option>{patients.map((p: any) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select>
              <Button type="submit" className="w-full" disabled={addDefMut.isPending}>Save Definition</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showIncidentForm} onOpenChange={setShowIncidentForm}>
        <DialogContent><DialogHeader><DialogTitle>Log ABC Incident</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addIncidentMut.mutate({ patientId: Number(fd.get("patientId")), behaviorId: Number(fd.get("behaviorId")), antecedent: fd.get("antecedent"), behavior: fd.get("behavior"), consequence: fd.get("consequence"), intensity: fd.get("intensity"), durationMinutes: fd.get("durationMinutes") ? Number(fd.get("durationMinutes")) : undefined, location: fd.get("location"), interventionUsed: fd.get("interventionUsed"), notes: fd.get("notes") }); }}>
            <div className="space-y-4">
              <select name="patientId" className="w-full border rounded-md p-2 text-sm" required><option value="">Select patient...</option>{patients.map((p: any) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select>
              <select name="behaviorId" className="w-full border rounded-md p-2 text-sm" required><option value="">Select behavior...</option>{definitions.map((d: any) => <option key={d.id} value={d.id}>{d.behaviorName}</option>)}</select>
              <textarea name="antecedent" className="w-full border rounded-md p-2 text-sm" placeholder="Antecedent — What happened before?" />
              <textarea name="behavior" className="w-full border rounded-md p-2 text-sm" placeholder="Behavior — What did the person do?" required />
              <textarea name="consequence" className="w-full border rounded-md p-2 text-sm" placeholder="Consequence — What happened after?" />
              <div className="grid grid-cols-2 gap-3">
                <select name="intensity" className="border rounded-md p-2 text-sm"><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option><option value="severe">Severe</option></select>
                <Input name="durationMinutes" type="number" placeholder="Duration (min)" />
              </div>
              <Input name="location" placeholder="Location" />
              <Input name="interventionUsed" placeholder="Intervention used" />
              <Input name="notes" placeholder="Notes" />
              <Button type="submit" className="w-full" disabled={addIncidentMut.isPending}>Save Incident</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
