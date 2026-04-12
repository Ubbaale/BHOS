import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, Layout, ClipboardCheck, Eye, Settings } from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL;
function fetchApi(path: string, opts?: RequestInit) {
  return fetch(`${BASE}api${path}`, { credentials: "include", ...opts }).then(r => { if (!r.ok) throw new Error("Request failed"); return r.json(); });
}

const defaultFormSchema = JSON.stringify({
  fields: [
    { id: "field_1", type: "text", label: "Text Field", required: true },
    { id: "field_2", type: "textarea", label: "Notes", required: false },
    { id: "field_3", type: "select", label: "Rating", options: ["Excellent", "Good", "Fair", "Poor"], required: true },
  ]
}, null, 2);

export default function CustomFormsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showSubmit, setShowSubmit] = useState<any>(null);
  const [formSchema, setFormSchema] = useState(defaultFormSchema);

  const { data: forms = [] } = useQuery({ queryKey: ["custom-forms"], queryFn: () => fetchApi("/custom-forms") });
  const { data: submissions = [] } = useQuery({ queryKey: ["form-submissions"], queryFn: () => fetchApi("/form-submissions") });
  const { data: patients = [] } = useQuery({ queryKey: ["patients-list"], queryFn: () => fetchApi("/patients") });

  const createMut = useMutation({
    mutationFn: (data: any) => fetchApi("/custom-forms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["custom-forms"] }); setShowCreate(false); },
  });

  const submitMut = useMutation({
    mutationFn: (data: any) => fetchApi("/form-submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["form-submissions"] }); setShowSubmit(null); },
  });

  const publishedForms = forms.filter((f: any) => f.isPublished);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Custom Forms Builder</h1><p className="text-muted-foreground">Create custom assessments, checklists, and documentation forms</p></div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Create Form</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Forms", value: forms.length, icon: Layout, color: "text-blue-600 bg-blue-50" },
          { label: "Published", value: publishedForms.length, icon: ClipboardCheck, color: "text-green-600 bg-green-50" },
          { label: "Submissions", value: submissions.length, icon: FileText, color: "text-purple-600 bg-purple-50" },
          { label: "Drafts", value: forms.filter((f: any) => !f.isPublished).length, icon: Settings, color: "text-gray-600 bg-gray-50" },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4 flex items-center gap-3"><div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.color.split(" ")[1]}`}><s.icon className={`h-5 w-5 ${s.color.split(" ")[0]}`} /></div><div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div></CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="forms">
        <TabsList><TabsTrigger value="forms">Forms</TabsTrigger><TabsTrigger value="submissions">Submissions</TabsTrigger></TabsList>
        <TabsContent value="forms">
          <div className="grid grid-cols-3 gap-4">
            {forms.length === 0 ? <Card className="col-span-3"><CardContent className="py-8 text-center text-muted-foreground">No forms created yet. Build custom forms for your organization.</CardContent></Card> :
              forms.map((form: any) => (
                <Card key={form.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div><p className="font-medium">{form.name}</p><p className="text-xs text-muted-foreground mt-1">{form.description || "No description"}</p></div>
                      <Badge className={form.isPublished ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>{form.isPublished ? "Published" : "Draft"}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="outline">{form.category}</Badge>
                      {form.isRequired && <Badge className="bg-red-100 text-red-800">Required</Badge>}
                    </div>
                    {form.isPublished && <Button size="sm" className="mt-3 w-full" variant="outline" onClick={() => setShowSubmit(form)}><FileText className="h-3 w-3 mr-1" />Fill Out</Button>}
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
        <TabsContent value="submissions">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Form</TableHead><TableHead>Patient</TableHead><TableHead>Status</TableHead><TableHead>Submitted</TableHead></TableRow></TableHeader>
              <TableBody>
                {submissions.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No submissions yet.</TableCell></TableRow> :
                  submissions.map((s: any) => {
                    const form = forms.find((f: any) => f.id === s.formId);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{form?.name || `Form #${s.formId}`}</TableCell>
                        <TableCell>{s.patientId ? `Patient #${s.patientId}` : "—"}</TableCell>
                        <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                        <TableCell className="text-sm">{format(new Date(s.submittedAt), "MMM d, yyyy h:mm a")}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Create Custom Form</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); createMut.mutate({ name: fd.get("name"), description: fd.get("description"), category: fd.get("category"), formSchema, isPublished: fd.get("isPublished") === "on", isRequired: fd.get("isRequired") === "on", frequency: fd.get("frequency") || undefined }); }}>
            <div className="space-y-4">
              <Input name="name" placeholder="Form name" required />
              <Input name="description" placeholder="Description" />
              <div className="grid grid-cols-2 gap-3">
                <select name="category" className="border rounded-md p-2 text-sm"><option value="assessment">Assessment</option><option value="checklist">Checklist</option><option value="intake">Intake</option><option value="discharge">Discharge</option><option value="daily">Daily</option><option value="incident">Incident</option><option value="other">Other</option></select>
                <select name="frequency" className="border rounded-md p-2 text-sm"><option value="">No schedule</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Annually</option></select>
              </div>
              <div>
                <label className="text-sm font-medium">Form Schema (JSON)</label>
                <textarea className="w-full border rounded-md p-2 text-sm font-mono min-h-[200px] mt-1" value={formSchema} onChange={e => setFormSchema(e.target.value)} />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublished" />Publish immediately</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isRequired" />Required form</label>
              </div>
              <Button type="submit" className="w-full" disabled={createMut.isPending}>Create Form</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showSubmit} onOpenChange={() => setShowSubmit(null)}>
        <DialogContent><DialogHeader><DialogTitle>{showSubmit?.name}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); const data: any = {}; fd.forEach((v, k) => { if (k !== "patientId") data[k] = v; }); submitMut.mutate({ formId: showSubmit.id, patientId: fd.get("patientId") ? Number(fd.get("patientId")) : undefined, formData: JSON.stringify(data) }); }}>
            <div className="space-y-4">
              <select name="patientId" className="w-full border rounded-md p-2 text-sm"><option value="">No patient (general)</option>{patients.map((p: any) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select>
              {(() => { try { const schema = JSON.parse(showSubmit?.formSchema || "{}"); return schema.fields?.map((f: any) => (
                <div key={f.id}>
                  <label className="text-sm font-medium">{f.label}{f.required && " *"}</label>
                  {f.type === "textarea" ? <textarea name={f.id} className="w-full border rounded-md p-2 text-sm mt-1" required={f.required} /> :
                    f.type === "select" ? <select name={f.id} className="w-full border rounded-md p-2 text-sm mt-1" required={f.required}><option value="">Select...</option>{f.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}</select> :
                    <Input name={f.id} className="mt-1" required={f.required} />}
                </div>
              )); } catch { return <p className="text-sm text-muted-foreground">Invalid form schema.</p>; }})()}
              <Button type="submit" className="w-full" disabled={submitMut.isPending}>Submit</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
