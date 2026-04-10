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
import { UserPlus, Users, Clock, CheckCircle, XCircle, Plus, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;
function fetchApi(url: string, opts?: RequestInit) {
  return fetch(`${API}${url}`, { ...opts, headers: { "Content-Type": "application/json", ...opts?.headers }, credentials: "include" }).then(r => { if (!r.ok) throw new Error(`API error: ${r.status}`); return r.json(); });
}

const stageLabels: Record<string, string> = {
  new_lead: "New Lead", contacted: "Contacted", screening: "Screening", assessment: "Assessment",
  insurance_verification: "Insurance Verify", waitlist: "Waitlist", approved: "Approved", admitted: "Admitted", denied: "Denied",
};
const stageColors: Record<string, string> = {
  new_lead: "bg-blue-100 text-blue-700", contacted: "bg-cyan-100 text-cyan-700", screening: "bg-indigo-100 text-indigo-700",
  assessment: "bg-purple-100 text-purple-700", insurance_verification: "bg-orange-100 text-orange-700",
  waitlist: "bg-yellow-100 text-yellow-700", approved: "bg-green-100 text-green-700", admitted: "bg-emerald-100 text-emerald-700", denied: "bg-red-100 text-red-700",
};

export default function AdmissionsPage() {
  const [tab, setTab] = useState("pipeline");
  const [showNewRef, setShowNewRef] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", referralSource: "hospital", referralSourceName: "", diagnosis: "", insuranceProvider: "", priorityLevel: "normal", notes: "" });
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: pipeline } = useQuery({ queryKey: ["pipeline"], queryFn: () => fetchApi("/admissions/pipeline") });
  const { data: dashboard } = useQuery({ queryKey: ["admissions-dashboard"], queryFn: () => fetchApi("/admissions/dashboard") });
  const { data: waitlist = [] } = useQuery({ queryKey: ["waitlist"], queryFn: () => fetchApi("/admissions/waitlist") });

  const createRef = useMutation({
    mutationFn: (data: any) => fetchApi("/admissions/referrals", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pipeline"] }); qc.invalidateQueries({ queryKey: ["admissions-dashboard"] }); setShowNewRef(false); toast({ title: "Referral created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const advanceStage = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: string }) => fetchApi(`/admissions/referrals/${id}`, { method: "PATCH", body: JSON.stringify({ stage }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pipeline"] }); toast({ title: "Stage updated" }); },
  });

  const activeStages = ["new_lead", "contacted", "screening", "assessment", "insurance_verification", "waitlist", "approved"];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><UserPlus className="h-7 w-7 text-primary" /> Admissions & Intake</h1>
          <p className="text-gray-500 mt-1">Referral pipeline, intake assessments, and waitlist management</p>
        </div>
        <Dialog open={showNewRef} onOpenChange={setShowNewRef}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> New Referral</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Referral</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium">First Name</label><Input className="mt-1" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Last Name</label><Input className="mt-1" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium">Phone</label><Input className="mt-1" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Email</label><Input className="mt-1" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div><label className="text-sm font-medium">Referral Source</label>
                <Select value={form.referralSource} onValueChange={v => setForm({ ...form, referralSource: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hospital">Hospital</SelectItem><SelectItem value="physician">Physician</SelectItem>
                    <SelectItem value="self">Self-Referral</SelectItem><SelectItem value="family">Family</SelectItem>
                    <SelectItem value="court">Court/Legal</SelectItem><SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="community">Community Org</SelectItem><SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select></div>
              <div><label className="text-sm font-medium">Referring Contact Name</label><Input className="mt-1" value={form.referralSourceName} onChange={e => setForm({ ...form, referralSourceName: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Diagnosis</label><Input className="mt-1" value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Insurance Provider</label><Input className="mt-1" value={form.insuranceProvider} onChange={e => setForm({ ...form, insuranceProvider: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Priority</label>
                <Select value={form.priorityLevel} onValueChange={v => setForm({ ...form, priorityLevel: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent>
                </Select></div>
              <div><label className="text-sm font-medium">Notes</label><Textarea className="mt-1" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <Button className="w-full" disabled={!form.firstName || !form.lastName} onClick={() => createRef.mutate(form)}>Create Referral</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{dashboard.totalReferrals}</p><p className="text-xs text-gray-500">Total Referrals</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-blue-600">{dashboard.activeReferrals}</p><p className="text-xs text-gray-500">Active</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{dashboard.admitted}</p><p className="text-xs text-gray-500">Admitted</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-600">{dashboard.denied}</p><p className="text-xs text-gray-500">Denied</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-600">{dashboard.waitlistSize}</p><p className="text-xs text-gray-500">Waitlist</p></CardContent></Card>
        </div>
      )}

      <Card>
        <Tabs value={tab} onValueChange={setTab}>
          <CardHeader><TabsList><TabsTrigger value="pipeline">Pipeline</TabsTrigger><TabsTrigger value="waitlist">Waitlist</TabsTrigger><TabsTrigger value="sources">Sources</TabsTrigger></TabsList></CardHeader>
          <CardContent>
            <TabsContent value="pipeline" className="mt-0">
              <div className="flex gap-3 overflow-x-auto pb-4">
                {activeStages.map(stage => (
                  <div key={stage} className="min-w-[220px] flex-shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold">{stageLabels[stage]}</h3>
                      <Badge variant="outline" className="text-xs">{pipeline?.[stage]?.length || 0}</Badge>
                    </div>
                    <div className="space-y-2">
                      {pipeline?.[stage]?.map((ref: any) => (
                        <Card key={ref.id} className="border cursor-pointer hover:shadow-sm">
                          <CardContent className="p-3">
                            <p className="font-medium text-sm">{ref.firstName} {ref.lastName}</p>
                            <p className="text-xs text-gray-500">{ref.referralSource} {ref.referralSourceName ? `· ${ref.referralSourceName}` : ""}</p>
                            {ref.diagnosis && <p className="text-xs text-gray-400 mt-1 truncate">{ref.diagnosis}</p>}
                            <div className="flex items-center justify-between mt-2">
                              <Badge variant="outline" className={`text-xs ${ref.priorityLevel === "urgent" ? "bg-red-100 text-red-700" : ref.priorityLevel === "high" ? "bg-orange-100 text-orange-700" : ""}`}>{ref.priorityLevel}</Badge>
                              {activeStages.indexOf(stage) < activeStages.length - 1 && (
                                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => advanceStage.mutate({ id: ref.id, stage: activeStages[activeStages.indexOf(stage) + 1] })}>
                                  <ArrowRight className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="waitlist" className="mt-0">
              <Table>
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Name</TableHead><TableHead>Home</TableHead><TableHead>Priority</TableHead><TableHead>Added</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {waitlist.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No one on the waitlist</TableCell></TableRow>
                  ) : waitlist.map((w: any) => (
                    <TableRow key={w.id}>
                      <TableCell>{w.position}</TableCell>
                      <TableCell className="font-medium">{w.referralName}</TableCell>
                      <TableCell>{w.homeName || "Any"}</TableCell>
                      <TableCell><Badge variant="outline">{w.priority}</Badge></TableCell>
                      <TableCell className="text-sm">{new Date(w.addedAt).toLocaleDateString()}</TableCell>
                      <TableCell><Badge className="bg-yellow-100 text-yellow-700" variant="outline">{w.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="sources" className="mt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {dashboard?.referralSources?.map((s: any) => (
                  <Card key={s.source}><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{s.count}</p><p className="text-sm text-gray-500 capitalize">{s.source}</p></CardContent></Card>
                ))}
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
