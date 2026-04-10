import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Target, TrendingUp, Plus, Eye, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;
function fetchApi(url: string, opts?: RequestInit) {
  return fetch(`${API}${url}`, { ...opts, headers: { "Content-Type": "application/json", ...opts?.headers }, credentials: "include" }).then(r => { if (!r.ok) throw new Error(`API error: ${r.status}`); return r.json(); });
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700", active: "bg-green-100 text-green-700", review: "bg-yellow-100 text-yellow-700", completed: "bg-blue-100 text-blue-700", discontinued: "bg-red-100 text-red-700",
};

export default function TreatmentPlansPage() {
  const [tab, setTab] = useState("plans");
  const [showNew, setShowNew] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [form, setForm] = useState({ patientId: "", title: "", planType: "isp", startDate: "", clinicianName: "", diagnosis: "", presentingProblems: "", strengths: "", barriers: "" });
  const [goalForm, setGoalForm] = useState({ domain: "", goalStatement: "", objectiveStatement: "", interventions: "", priority: "medium" });
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: plans = [] } = useQuery({ queryKey: ["treatment-plans"], queryFn: () => fetchApi("/treatment-plans") });
  const { data: patients = [] } = useQuery({ queryKey: ["patients"], queryFn: () => fetchApi("/patients") });
  const { data: planDetail } = useQuery({ queryKey: ["treatment-plan", selectedPlan?.id], queryFn: () => fetchApi(`/treatment-plans/${selectedPlan.id}`), enabled: !!selectedPlan?.id });

  const createPlan = useMutation({
    mutationFn: (data: any) => fetchApi("/treatment-plans", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["treatment-plans"] }); setShowNew(false); toast({ title: "Treatment plan created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addGoal = useMutation({
    mutationFn: (data: any) => fetchApi(`/treatment-plans/${selectedPlan.id}/goals`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["treatment-plan", selectedPlan.id] }); setShowGoal(false); toast({ title: "Goal added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updatePlanStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => fetchApi(`/treatment-plans/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["treatment-plans"] }); toast({ title: "Status updated" }); },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ClipboardList className="h-7 w-7 text-primary" /> Treatment Plans & ISP</h1>
          <p className="text-gray-500 mt-1">Individual Service Plans, goals, interventions, and progress tracking</p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> New Plan</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Treatment Plan</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
              <div><label className="text-sm font-medium">Patient</label>
                <Select value={form.patientId} onValueChange={v => setForm({ ...form, patientId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select patient" /></SelectTrigger>
                  <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><label className="text-sm font-medium">Title</label><Input className="mt-1" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g., Annual ISP Review 2026" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium">Plan Type</label>
                  <Select value={form.planType} onValueChange={v => setForm({ ...form, planType: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="isp">ISP</SelectItem><SelectItem value="treatment">Treatment Plan</SelectItem><SelectItem value="crisis">Crisis Plan</SelectItem><SelectItem value="safety">Safety Plan</SelectItem></SelectContent>
                  </Select></div>
                <div><label className="text-sm font-medium">Start Date</label><Input className="mt-1" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
              </div>
              <div><label className="text-sm font-medium">Clinician Name</label><Input className="mt-1" value={form.clinicianName} onChange={e => setForm({ ...form, clinicianName: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Diagnosis</label><Input className="mt-1" value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Presenting Problems</label><Textarea className="mt-1" rows={2} value={form.presentingProblems} onChange={e => setForm({ ...form, presentingProblems: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Strengths</label><Textarea className="mt-1" rows={2} value={form.strengths} onChange={e => setForm({ ...form, strengths: e.target.value })} /></div>
              <Button className="w-full" disabled={!form.patientId || !form.title || !form.startDate || !form.clinicianName}
                onClick={() => createPlan.mutate({ ...form, patientId: Number(form.patientId) })}>Create Plan</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{plans.length}</p><p className="text-xs text-gray-500">Total Plans</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{plans.filter((p: any) => p.status === "active").length}</p><p className="text-xs text-gray-500">Active</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-yellow-600">{plans.filter((p: any) => p.status === "review").length}</p><p className="text-xs text-gray-500">Due for Review</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Treatment Plans</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Patient</TableHead><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Goals</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {plans.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No treatment plans yet</TableCell></TableRow>
                  ) : plans.map((p: any) => (
                    <TableRow key={p.id} className={selectedPlan?.id === p.id ? "bg-blue-50" : ""}>
                      <TableCell className="font-medium">{p.patientName}</TableCell>
                      <TableCell>{p.title}</TableCell>
                      <TableCell><Badge variant="outline" className="uppercase text-xs">{p.planType}</Badge></TableCell>
                      <TableCell>{p.goalCount}</TableCell>
                      <TableCell><Badge variant="outline" className={statusColors[p.status]}>{p.status}</Badge></TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedPlan(p)}><Eye className="h-4 w-4" /></Button>
                        {p.status === "draft" && <Button variant="ghost" size="sm" onClick={() => updatePlanStatus.mutate({ id: p.id, status: "active" })}><CheckCircle className="h-4 w-4 text-green-600" /></Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div>
          {selectedPlan && planDetail ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{planDetail.title}</CardTitle>
                  <Badge variant="outline" className={statusColors[planDetail.status]}>{planDetail.status}</Badge>
                </div>
                <p className="text-sm text-gray-500">{planDetail.patientName} · {planDetail.clinicianName}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {planDetail.diagnosis && <div><p className="text-xs text-gray-500">Diagnosis</p><p className="text-sm">{planDetail.diagnosis}</p></div>}
                {planDetail.presentingProblems && <div><p className="text-xs text-gray-500">Presenting Problems</p><p className="text-sm">{planDetail.presentingProblems}</p></div>}
                {planDetail.strengths && <div><p className="text-xs text-gray-500">Strengths</p><p className="text-sm">{planDetail.strengths}</p></div>}

                <div className="flex items-center justify-between pt-2 border-t">
                  <h4 className="font-semibold text-sm">Goals ({planDetail.goals?.length || 0})</h4>
                  <Dialog open={showGoal} onOpenChange={setShowGoal}>
                    <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="h-3 w-3 mr-1" /> Add Goal</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add Goal</DialogTitle></DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div><label className="text-sm font-medium">Domain</label>
                          <Select value={goalForm.domain} onValueChange={v => setGoalForm({ ...goalForm, domain: v })}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder="Select domain" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="behavioral">Behavioral</SelectItem><SelectItem value="social">Social</SelectItem>
                              <SelectItem value="daily_living">Daily Living</SelectItem><SelectItem value="vocational">Vocational</SelectItem>
                              <SelectItem value="medical">Medical</SelectItem><SelectItem value="emotional">Emotional</SelectItem>
                              <SelectItem value="safety">Safety</SelectItem><SelectItem value="communication">Communication</SelectItem>
                            </SelectContent>
                          </Select></div>
                        <div><label className="text-sm font-medium">Goal Statement</label><Textarea className="mt-1" rows={2} value={goalForm.goalStatement} onChange={e => setGoalForm({ ...goalForm, goalStatement: e.target.value })} /></div>
                        <div><label className="text-sm font-medium">Objective</label><Textarea className="mt-1" rows={2} value={goalForm.objectiveStatement} onChange={e => setGoalForm({ ...goalForm, objectiveStatement: e.target.value })} /></div>
                        <div><label className="text-sm font-medium">Interventions</label><Textarea className="mt-1" rows={2} value={goalForm.interventions} onChange={e => setGoalForm({ ...goalForm, interventions: e.target.value })} /></div>
                        <Button className="w-full" disabled={!goalForm.domain || !goalForm.goalStatement} onClick={() => addGoal.mutate(goalForm)}>Add Goal</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {planDetail.goals?.map((g: any) => (
                    <div key={g.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs capitalize">{g.domain}</Badge>
                        <span className="text-xs text-gray-500">{g.progressPercentage}%</span>
                      </div>
                      <p className="text-sm">{g.goalStatement}</p>
                      {g.objectiveStatement && <p className="text-xs text-gray-500 mt-1">{g.objectiveStatement}</p>}
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2"><div className="bg-primary rounded-full h-1.5" style={{ width: `${g.progressPercentage}%` }} /></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <Target className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">Select a plan to view details and goals</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
