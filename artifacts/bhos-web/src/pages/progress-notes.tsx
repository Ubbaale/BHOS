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
import { FileText, PenLine, CheckCircle, Clock, Plus, Eye, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;
function fetchApi(url: string, opts?: RequestInit) {
  return fetch(`${API}${url}`, { ...opts, headers: { "Content-Type": "application/json", ...opts?.headers }, credentials: "include" }).then(r => { if (!r.ok) throw new Error(`API error: ${r.status}`); return r.json(); });
}

const noteTypeLabels: Record<string, string> = { soap: "SOAP", dap: "DAP", birp: "BIRP", narrative: "Narrative", group: "Group", incident: "Incident" };
const statusColors: Record<string, string> = { draft: "bg-gray-100 text-gray-700", signed: "bg-green-100 text-green-700", cosigned: "bg-blue-100 text-blue-700", amended: "bg-yellow-100 text-yellow-700" };

export default function ProgressNotesPage() {
  const [showNew, setShowNew] = useState(false);
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [noteType, setNoteType] = useState("soap");
  const [form, setForm] = useState({
    patientId: "", staffId: "", sessionDate: "", duration: "60", sessionType: "individual", noteType: "soap",
    subjective: "", objective: "", assessment: "", plan: "",
    behavior: "", intervention: "", response: "",
    data: "", action: "", narrative: "",
    moodRating: "", riskLevel: "low", followUpNeeded: false, followUpDate: "",
  });
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: notes = [] } = useQuery({ queryKey: ["progress-notes"], queryFn: () => fetchApi("/progress-notes") });
  const { data: patients = [] } = useQuery({ queryKey: ["patients"], queryFn: () => fetchApi("/patients") });
  const { data: staff = [] } = useQuery({ queryKey: ["staff"], queryFn: () => fetchApi("/staff") });

  const createNote = useMutation({
    mutationFn: (data: any) => fetchApi("/progress-notes", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["progress-notes"] }); setShowNew(false); toast({ title: "Progress note created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const signNote = useMutation({
    mutationFn: (id: number) => fetchApi(`/progress-notes/${id}/sign`, { method: "PATCH" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["progress-notes"] }); setSelectedNote(null); toast({ title: "Note signed" }); },
  });

  const supervisorSign = useMutation({
    mutationFn: ({ id, supervisorName }: { id: number; supervisorName: string }) => fetchApi(`/progress-notes/${id}/supervisor-sign`, { method: "PATCH", body: JSON.stringify({ supervisorName }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["progress-notes"] }); toast({ title: "Supervisor co-signed" }); },
  });

  const handleSubmit = () => {
    const payload: any = {
      patientId: Number(form.patientId), staffId: Number(form.staffId), sessionDate: form.sessionDate,
      duration: Number(form.duration), sessionType: form.sessionType, noteType: form.noteType,
      moodRating: form.moodRating ? Number(form.moodRating) : null, riskLevel: form.riskLevel,
      followUpNeeded: form.followUpNeeded, followUpDate: form.followUpDate || null,
    };
    if (form.noteType === "soap") { payload.subjective = form.subjective; payload.objective = form.objective; payload.assessment = form.assessment; payload.plan = form.plan; }
    else if (form.noteType === "dap") { payload.data = form.data; payload.assessment = form.assessment; payload.plan = form.plan; }
    else if (form.noteType === "birp") { payload.behavior = form.behavior; payload.intervention = form.intervention; payload.response = form.response; payload.plan = form.plan; }
    else { payload.narrative = form.narrative; }
    createNote.mutate(payload);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FileText className="h-7 w-7 text-primary" /> Progress Notes</h1>
          <p className="text-gray-500 mt-1">Clinical documentation with SOAP, DAP, BIRP, and narrative formats</p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> New Note</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Create Progress Note</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4 max-h-[65vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium">Patient</label>
                  <Select value={form.patientId} onValueChange={v => setForm({ ...form, patientId: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select patient" /></SelectTrigger>
                    <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><label className="text-sm font-medium">Staff / Clinician</label>
                  <Select value={form.staffId} onValueChange={v => setForm({ ...form, staffId: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select staff" /></SelectTrigger>
                    <SelectContent>{staff.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}</SelectContent>
                  </Select></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-sm font-medium">Session Date</label><Input className="mt-1" type="date" value={form.sessionDate} onChange={e => setForm({ ...form, sessionDate: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Duration (min)</label><Input className="mt-1" type="number" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Session Type</label>
                  <Select value={form.sessionType} onValueChange={v => setForm({ ...form, sessionType: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="individual">Individual</SelectItem><SelectItem value="group">Group</SelectItem><SelectItem value="family">Family</SelectItem><SelectItem value="crisis">Crisis</SelectItem></SelectContent>
                  </Select></div>
              </div>
              <div><label className="text-sm font-medium">Note Format</label>
                <Tabs value={form.noteType} onValueChange={v => setForm({ ...form, noteType: v })} className="mt-1">
                  <TabsList><TabsTrigger value="soap">SOAP</TabsTrigger><TabsTrigger value="dap">DAP</TabsTrigger><TabsTrigger value="birp">BIRP</TabsTrigger><TabsTrigger value="narrative">Narrative</TabsTrigger></TabsList>
                  <TabsContent value="soap" className="space-y-3 mt-3">
                    <div><label className="text-sm font-medium">Subjective</label><Textarea className="mt-1" rows={2} placeholder="Patient's reported symptoms, feelings, concerns..." value={form.subjective} onChange={e => setForm({ ...form, subjective: e.target.value })} /></div>
                    <div><label className="text-sm font-medium">Objective</label><Textarea className="mt-1" rows={2} placeholder="Observable behaviors, appearance, measurements..." value={form.objective} onChange={e => setForm({ ...form, objective: e.target.value })} /></div>
                    <div><label className="text-sm font-medium">Assessment</label><Textarea className="mt-1" rows={2} placeholder="Clinical interpretation and analysis..." value={form.assessment} onChange={e => setForm({ ...form, assessment: e.target.value })} /></div>
                    <div><label className="text-sm font-medium">Plan</label><Textarea className="mt-1" rows={2} placeholder="Next steps, interventions, follow-up..." value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} /></div>
                  </TabsContent>
                  <TabsContent value="dap" className="space-y-3 mt-3">
                    <div><label className="text-sm font-medium">Data</label><Textarea className="mt-1" rows={3} value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} /></div>
                    <div><label className="text-sm font-medium">Assessment</label><Textarea className="mt-1" rows={3} value={form.assessment} onChange={e => setForm({ ...form, assessment: e.target.value })} /></div>
                    <div><label className="text-sm font-medium">Plan</label><Textarea className="mt-1" rows={3} value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} /></div>
                  </TabsContent>
                  <TabsContent value="birp" className="space-y-3 mt-3">
                    <div><label className="text-sm font-medium">Behavior</label><Textarea className="mt-1" rows={2} value={form.behavior} onChange={e => setForm({ ...form, behavior: e.target.value })} /></div>
                    <div><label className="text-sm font-medium">Intervention</label><Textarea className="mt-1" rows={2} value={form.intervention} onChange={e => setForm({ ...form, intervention: e.target.value })} /></div>
                    <div><label className="text-sm font-medium">Response</label><Textarea className="mt-1" rows={2} value={form.response} onChange={e => setForm({ ...form, response: e.target.value })} /></div>
                    <div><label className="text-sm font-medium">Plan</label><Textarea className="mt-1" rows={2} value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} /></div>
                  </TabsContent>
                  <TabsContent value="narrative" className="mt-3">
                    <div><label className="text-sm font-medium">Narrative</label><Textarea className="mt-1" rows={6} value={form.narrative} onChange={e => setForm({ ...form, narrative: e.target.value })} /></div>
                  </TabsContent>
                </Tabs>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium">Mood Rating (1-10)</label><Input className="mt-1" type="number" min="1" max="10" value={form.moodRating} onChange={e => setForm({ ...form, moodRating: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Risk Level</label>
                  <Select value={form.riskLevel} onValueChange={v => setForm({ ...form, riskLevel: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="low">Low</SelectItem><SelectItem value="moderate">Moderate</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="imminent">Imminent</SelectItem></SelectContent>
                  </Select></div>
              </div>
              <Button className="w-full" disabled={!form.patientId || !form.staffId || !form.sessionDate} onClick={handleSubmit}>Create Note</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{notes.length}</p><p className="text-xs text-gray-500">Total Notes</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-gray-600">{notes.filter((n: any) => n.status === "draft").length}</p><p className="text-xs text-gray-500">Drafts</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{notes.filter((n: any) => n.signed).length}</p><p className="text-xs text-gray-500">Signed</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-blue-600">{notes.filter((n: any) => n.supervisorReview).length}</p><p className="text-xs text-gray-500">Co-Signed</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>All Notes</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Patient</TableHead><TableHead>Clinician</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {notes.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No progress notes yet</TableCell></TableRow>
                  ) : notes.map((n: any) => (
                    <TableRow key={n.id} className={selectedNote?.id === n.id ? "bg-blue-50" : ""}>
                      <TableCell className="text-sm">{new Date(n.sessionDate).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{n.patientName}</TableCell>
                      <TableCell className="text-sm">{n.staffName}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{noteTypeLabels[n.noteType] || n.noteType}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={statusColors[n.status] || ""}>{n.status}</Badge></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedNote(n)}><Eye className="h-4 w-4" /></Button>
                        {!n.signed && <Button variant="ghost" size="sm" onClick={() => signNote.mutate(n.id)}><PenLine className="h-4 w-4 text-green-600" /></Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div>
          {selectedNote ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{noteTypeLabels[selectedNote.noteType] || selectedNote.noteType} Note</CardTitle>
                  <Badge variant="outline" className={statusColors[selectedNote.status]}>{selectedNote.status}</Badge>
                </div>
                <p className="text-sm text-gray-500">{selectedNote.patientName} · {new Date(selectedNote.sessionDate).toLocaleDateString()}</p>
                <p className="text-xs text-gray-400">By {selectedNote.staffName} · {selectedNote.duration}min · {selectedNote.sessionType}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedNote.subjective && <div><p className="text-xs font-semibold text-gray-500 uppercase">Subjective</p><p className="text-sm mt-1">{selectedNote.subjective}</p></div>}
                {selectedNote.objective && <div><p className="text-xs font-semibold text-gray-500 uppercase">Objective</p><p className="text-sm mt-1">{selectedNote.objective}</p></div>}
                {selectedNote.behavior && <div><p className="text-xs font-semibold text-gray-500 uppercase">Behavior</p><p className="text-sm mt-1">{selectedNote.behavior}</p></div>}
                {selectedNote.intervention && <div><p className="text-xs font-semibold text-gray-500 uppercase">Intervention</p><p className="text-sm mt-1">{selectedNote.intervention}</p></div>}
                {selectedNote.response && <div><p className="text-xs font-semibold text-gray-500 uppercase">Response</p><p className="text-sm mt-1">{selectedNote.response}</p></div>}
                {selectedNote.data && <div><p className="text-xs font-semibold text-gray-500 uppercase">Data</p><p className="text-sm mt-1">{selectedNote.data}</p></div>}
                {selectedNote.assessment && <div><p className="text-xs font-semibold text-gray-500 uppercase">Assessment</p><p className="text-sm mt-1">{selectedNote.assessment}</p></div>}
                {selectedNote.plan && <div><p className="text-xs font-semibold text-gray-500 uppercase">Plan</p><p className="text-sm mt-1">{selectedNote.plan}</p></div>}
                {selectedNote.narrative && <div><p className="text-xs font-semibold text-gray-500 uppercase">Narrative</p><p className="text-sm mt-1">{selectedNote.narrative}</p></div>}
                {selectedNote.moodRating && <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Mood:</span><Badge variant="outline">{selectedNote.moodRating}/10</Badge></div>}
                {selectedNote.riskLevel && selectedNote.riskLevel !== "none" && (
                  <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Risk:</span><Badge variant="outline" className={selectedNote.riskLevel === "high" || selectedNote.riskLevel === "imminent" ? "bg-red-100 text-red-700" : ""}>{selectedNote.riskLevel}</Badge></div>
                )}
                <div className="pt-3 border-t space-y-2">
                  {selectedNote.signed ? (
                    <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Signed {selectedNote.signedAt ? `on ${new Date(selectedNote.signedAt).toLocaleDateString()}` : ""}</p>
                  ) : (
                    <Button size="sm" className="w-full" onClick={() => signNote.mutate(selectedNote.id)}><PenLine className="h-4 w-4 mr-2" /> Sign Note</Button>
                  )}
                  {selectedNote.supervisorReview && <p className="text-xs text-blue-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Co-signed by {selectedNote.supervisorName}</p>}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">Select a note to view details</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
