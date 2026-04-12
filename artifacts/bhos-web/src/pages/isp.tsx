import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Plus, Target, ChevronRight, CheckCircle, Clock, FileText } from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL;
function fetchApi(path: string, opts?: RequestInit) {
  return fetch(`${BASE}api${path}`, { credentials: "include", ...opts }).then(r => { if (!r.ok) throw new Error("Request failed"); return r.json(); });
}

export default function ISPPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);

  const { data: plans = [] } = useQuery({ queryKey: ["isp-plans"], queryFn: () => fetchApi("/isp") });
  const { data: planDetail } = useQuery({ queryKey: ["isp-plan", selectedPlan], queryFn: () => fetchApi(`/isp/${selectedPlan}`), enabled: !!selectedPlan });
  const { data: patients = [] } = useQuery({ queryKey: ["patients-list"], queryFn: () => fetchApi("/patients") });

  const createMut = useMutation({
    mutationFn: (data: any) => fetchApi("/isp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["isp-plans"] }); setShowCreate(false); },
  });

  const addGoalMut = useMutation({
    mutationFn: ({ ispId, data }: { ispId: number; data: any }) => fetchApi(`/isp/${ispId}/goals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["isp-plan", selectedPlan] }); setShowGoalForm(false); },
  });

  const statusColors: Record<string, string> = { draft: "bg-gray-100 text-gray-800", active: "bg-green-100 text-green-800", review: "bg-amber-100 text-amber-800", expired: "bg-red-100 text-red-800" };

  const stats = {
    total: plans.length,
    active: plans.filter((p: any) => p.status === "active").length,
    review: plans.filter((p: any) => p.status === "review").length,
    draft: plans.filter((p: any) => p.status === "draft").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Individual Service Plans (ISP)</h1><p className="text-muted-foreground">Create and manage individualized service plans</p></div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />New ISP</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Plans", value: stats.total, icon: ClipboardList, color: "text-blue-600 bg-blue-50" },
          { label: "Active", value: stats.active, icon: CheckCircle, color: "text-green-600 bg-green-50" },
          { label: "Due for Review", value: stats.review, icon: Clock, color: "text-amber-600 bg-amber-50" },
          { label: "Drafts", value: stats.draft, icon: FileText, color: "text-gray-600 bg-gray-50" },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4 flex items-center gap-3"><div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.color.split(" ")[1]}`}><s.icon className={`h-5 w-5 ${s.color.split(" ")[0]}`} /></div><div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div></CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <Card>
            <CardHeader><CardTitle className="text-sm">ISP Plans</CardTitle></CardHeader>
            <CardContent className="p-0">
              {plans.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No plans yet.</p> :
                plans.map((plan: any) => (
                  <button key={plan.id} onClick={() => setSelectedPlan(plan.id)} className={`w-full text-left px-4 py-3 border-b hover:bg-muted/50 flex items-center justify-between ${selectedPlan === plan.id ? "bg-muted" : ""}`}>
                    <div><p className="font-medium text-sm">{plan.title}</p><p className="text-xs text-muted-foreground">Patient #{plan.patientId}</p></div>
                    <div className="flex items-center gap-2"><Badge className={statusColors[plan.status] || ""}>{plan.status}</Badge><ChevronRight className="h-4 w-4 text-muted-foreground" /></div>
                  </button>
                ))}
            </CardContent>
          </Card>
        </div>
        <div className="col-span-2">
          {!selectedPlan ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Select a plan to view details, or create a new ISP.</CardContent></Card>
          ) : planDetail ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{planDetail.title}</CardTitle>
                  <Button size="sm" onClick={() => setShowGoalForm(true)}><Plus className="h-3 w-3 mr-1" />Add Goal</Button>
                </div>
                <div className="flex gap-2 text-sm text-muted-foreground">
                  <Badge className={statusColors[planDetail.status] || ""}>{planDetail.status}</Badge>
                  {planDetail.effectiveDate && <span>Effective: {format(new Date(planDetail.effectiveDate), "MMM d, yyyy")}</span>}
                  {planDetail.reviewDate && <span>Review: {format(new Date(planDetail.reviewDate), "MMM d, yyyy")}</span>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {planDetail.goals?.length === 0 ? <p className="text-sm text-muted-foreground">No goals added yet.</p> :
                  planDetail.goals?.map((goal: any, i: number) => (
                    <Card key={goal.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div><p className="font-medium"><Target className="h-4 w-4 inline mr-1" />Goal {i + 1}: {goal.domain}</p><p className="text-sm mt-1">{goal.goalStatement}</p></div>
                          <Badge variant="outline">{goal.status}</Badge>
                        </div>
                        {goal.objectives?.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {goal.objectives.map((obj: any, j: number) => (
                              <div key={obj.id} className="pl-4 border-l-2 border-gray-200">
                                <p className="text-sm">Objective {j + 1}: {obj.objectiveStatement}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="h-2 flex-1 bg-gray-100 rounded-full"><div className="h-2 bg-blue-500 rounded-full" style={{ width: `${obj.progressPercent}%` }} /></div>
                                  <span className="text-xs text-muted-foreground">{obj.progressPercent}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New ISP</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); createMut.mutate({ patientId: Number(fd.get("patientId")), title: fd.get("title"), effectiveDate: fd.get("effectiveDate") || undefined, reviewDate: fd.get("reviewDate") || undefined }); }}>
            <div className="space-y-4">
              <Input name="title" placeholder="Plan title" required />
              <select name="patientId" className="w-full border rounded-md p-2 text-sm" required><option value="">Select patient...</option>{patients.map((p: any) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select>
              <Input name="effectiveDate" type="date" placeholder="Effective date" />
              <Input name="reviewDate" type="date" placeholder="Review date" />
              <Button type="submit" className="w-full" disabled={createMut.isPending}>Create ISP</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showGoalForm} onOpenChange={setShowGoalForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Goal</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); addGoalMut.mutate({ ispId: selectedPlan!, data: { domain: fd.get("domain"), goalStatement: fd.get("goalStatement"), baselineBehavior: fd.get("baselineBehavior"), targetBehavior: fd.get("targetBehavior"), measurementMethod: fd.get("measurementMethod") } }); }}>
            <div className="space-y-4">
              <select name="domain" className="w-full border rounded-md p-2 text-sm"><option value="behavioral">Behavioral</option><option value="social">Social</option><option value="daily_living">Daily Living</option><option value="vocational">Vocational</option><option value="health">Health & Wellness</option><option value="community">Community Integration</option></select>
              <textarea name="goalStatement" className="w-full border rounded-md p-2 text-sm min-h-[80px]" placeholder="Goal statement" required />
              <Input name="baselineBehavior" placeholder="Baseline behavior" />
              <Input name="targetBehavior" placeholder="Target behavior" />
              <Input name="measurementMethod" placeholder="Measurement method" />
              <Button type="submit" className="w-full" disabled={addGoalMut.isPending}>Add Goal</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
