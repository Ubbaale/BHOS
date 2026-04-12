import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Upload, FolderOpen, Pen, Plus, Search, Download, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL;
function fetchApi(path: string, opts?: RequestInit) {
  return fetch(`${BASE}api${path}`, { credentials: "include", ...opts }).then(r => { if (!r.ok) throw new Error("Request failed"); return r.json(); });
}

export default function DocumentsPage() {
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [showSignDialog, setShowSignDialog] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: documents = [] } = useQuery({ queryKey: ["documents"], queryFn: () => fetchApi("/documents") });
  const { data: templates = [] } = useQuery({ queryKey: ["doc-templates"], queryFn: () => fetchApi("/document-templates") });
  const { data: folders = [] } = useQuery({ queryKey: ["doc-folders"], queryFn: () => fetchApi("/document-folders") });

  const uploadMut = useMutation({
    mutationFn: (data: any) => fetchApi("/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["documents"] }); setShowUpload(false); },
  });

  const signMut = useMutation({
    mutationFn: ({ docId, data }: { docId: number; data: any }) => fetchApi(`/documents/${docId}/signatures`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { setShowSignDialog(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => fetchApi(`/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  const filtered = documents.filter((d: any) => {
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== "all" && d.category !== categoryFilter) return false;
    return true;
  });

  const categories = ["consent", "intake", "authorization", "clinical", "legal", "general"];
  const stats = {
    total: documents.length,
    pending: documents.filter((d: any) => d.requiresSignature && d.status === "active").length,
    templates: templates.length,
    folders: folders.length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Document Management</h1>
          <p className="text-muted-foreground">Upload, organize, and e-sign documents</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowUpload(true)}><Upload className="h-4 w-4 mr-2" />Upload Document</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Documents", value: stats.total, icon: FileText, color: "text-blue-600 bg-blue-50" },
          { label: "Pending Signatures", value: stats.pending, icon: Pen, color: "text-amber-600 bg-amber-50" },
          { label: "Templates", value: stats.templates, icon: FolderOpen, color: "text-purple-600 bg-purple-50" },
          { label: "Folders", value: stats.folders, icon: FolderOpen, color: "text-green-600 bg-green-50" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.color.split(" ")[1]}`}>
                <s.icon className={`h-5 w-5 ${s.color.split(" ")[0]}`} />
              </div>
              <div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="documents">
        <TabsList><TabsTrigger value="documents">Documents</TabsTrigger><TabsTrigger value="templates">Templates</TabsTrigger></TabsList>
        <TabsContent value="documents" className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} /></div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Categories</SelectItem>{categories.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent></Select>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No documents found. Upload your first document to get started.</TableCell></TableRow>
                  ) : filtered.map((doc: any) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.title}</TableCell>
                      <TableCell><Badge variant="outline">{doc.category}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{doc.fileType || "—"}</TableCell>
                      <TableCell>
                        {doc.requiresSignature ? <Badge className="bg-amber-100 text-amber-800">Needs Signature</Badge> : <Badge className="bg-green-100 text-green-800">Complete</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(doc.createdAt), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {doc.requiresSignature && <Button size="sm" variant="outline" onClick={() => setShowSignDialog(doc.id)}><Pen className="h-3 w-3" /></Button>}
                          <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(doc.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="templates">
          <Card><CardContent className="py-8 text-center text-muted-foreground">{templates.length === 0 ? "No templates yet. Create templates to standardize your documents." : `${templates.length} templates available`}</CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); uploadMut.mutate({ title: fd.get("title"), category: fd.get("category"), description: fd.get("description"), requiresSignature: fd.get("requiresSignature") === "on" }); }}>
            <div className="space-y-4">
              <Input name="title" placeholder="Document title" required />
              <select name="category" className="w-full border rounded-md p-2 text-sm">{categories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}</select>
              <Input name="description" placeholder="Description (optional)" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requiresSignature" />Requires e-signature</label>
              <Button type="submit" className="w-full" disabled={uploadMut.isPending}>Upload</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showSignDialog !== null} onOpenChange={() => setShowSignDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Electronic Signature</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); signMut.mutate({ docId: showSignDialog!, data: { signerName: fd.get("signerName"), signerRole: fd.get("signerRole"), signerEmail: fd.get("signerEmail"), signatureType: "electronic" } }); }}>
            <div className="space-y-4">
              <Input name="signerName" placeholder="Full name" required />
              <Input name="signerRole" placeholder="Role/title" />
              <Input name="signerEmail" placeholder="Email" type="email" />
              <p className="text-xs text-muted-foreground">By signing, you agree this constitutes a legal electronic signature.</p>
              <Button type="submit" className="w-full" disabled={signMut.isPending}><Pen className="h-4 w-4 mr-2" />Sign Document</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
