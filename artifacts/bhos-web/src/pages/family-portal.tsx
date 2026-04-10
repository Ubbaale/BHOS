import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Users,
  Heart,
  MessageSquare,
  FileCheck,
  Bell,
  Send,
  RefreshCw,
  UserPlus,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function MetricCard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const consentStatusBadge = (s: string) => {
  switch (s) {
    case "signed": return <Badge className="bg-green-50 text-green-700 border-green-200">Signed</Badge>;
    case "pending": return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>;
    case "expired": return <Badge variant="destructive">Expired</Badge>;
    case "revoked": return <Badge variant="secondary">Revoked</Badge>;
    default: return <Badge variant="outline">{s}</Badge>;
  }
};

const notifSeverityBadge = (s: string) => {
  switch (s) {
    case "critical": return <Badge variant="destructive">Critical</Badge>;
    case "warning": return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Warning</Badge>;
    default: return <Badge variant="outline">Info</Badge>;
  }
};

export default function FamilyPortalPage() {
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<any>({});
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [threads, setThreads] = useState<any[]>([]);
  const [consentDocs, setConsentDocs] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<any[]>([]);

  const [newMember, setNewMember] = useState({ patientId: "", firstName: "", lastName: "", email: "", phone: "", relationship: "" });
  const [newConsent, setNewConsent] = useState({ patientId: "", documentType: "", title: "", description: "" });
  const [newMessage, setNewMessage] = useState({ patientId: "", message: "", threadId: "" });
  const [genSummary, setGenSummary] = useState({ patientId: "" });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, membersRes, sumRes, threadsRes, consentRes, notifRes, patientsRes] = await Promise.all([
        fetch(`${BASE}/api/family/dashboard`),
        fetch(`${BASE}/api/family/members`),
        fetch(`${BASE}/api/family/daily-summaries`),
        fetch(`${BASE}/api/family/messages/threads`),
        fetch(`${BASE}/api/family/consent-documents`),
        fetch(`${BASE}/api/family/notifications`),
        fetch(`${BASE}/api/patients`),
      ]);

      if (dashRes.ok) setDashboard(await dashRes.json());
      if (membersRes.ok) setFamilyMembers(await membersRes.json());
      if (sumRes.ok) setSummaries(await sumRes.json());
      if (threadsRes.ok) setThreads(await threadsRes.json());
      if (consentRes.ok) setConsentDocs(await consentRes.json());
      if (notifRes.ok) setNotifications(await notifRes.json());
      if (patientsRes.ok) setPatients(await patientsRes.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addFamilyMember = async () => {
    try {
      const res = await fetch(`${BASE}/api/family/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newMember, patientId: parseInt(newMember.patientId) }),
      });
      if (res.ok) {
        toast({ title: "Family member added" });
        setNewMember({ patientId: "", firstName: "", lastName: "", email: "", phone: "", relationship: "" });
        fetchAll();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const generateSummary = async () => {
    try {
      const res = await fetch(`${BASE}/api/family/daily-summaries/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: parseInt(genSummary.patientId) }),
      });
      if (res.ok) {
        toast({ title: "Summary generated" });
        fetchAll();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const publishSummary = async (id: number) => {
    try {
      const res = await fetch(`${BASE}/api/family/daily-summaries/${id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        toast({ title: "Published to families" });
        fetchAll();
      }
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const sendMessage = async () => {
    try {
      const res = await fetch(`${BASE}/api/family/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: parseInt(newMessage.patientId), message: newMessage.message, threadId: newMessage.threadId || undefined }),
      });
      if (res.ok) {
        toast({ title: "Message sent" });
        setNewMessage({ patientId: "", message: "", threadId: "" });
        fetchAll();
      }
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const createConsent = async () => {
    try {
      const res = await fetch(`${BASE}/api/family/consent-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newConsent, patientId: parseInt(newConsent.patientId) }),
      });
      if (res.ok) {
        toast({ title: "Consent document created" });
        setNewConsent({ patientId: "", documentType: "", title: "", description: "" });
        fetchAll();
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-pink-500" />
            Family Portal
          </h1>
          <p className="text-muted-foreground">Manage family access, communication, daily summaries, and consent documents</p>
        </div>
        <Button variant="outline" onClick={fetchAll}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Active Family Members" value={dashboard.activeFamilyMembers || 0} icon={Users} color="text-blue-600 bg-blue-50" />
        <MetricCard title="Unread Messages" value={dashboard.unreadMessages || 0} icon={MessageSquare} color="text-green-600 bg-green-50" />
        <MetricCard title="Pending Consent" value={dashboard.pendingConsent || 0} icon={FileCheck} color="text-amber-600 bg-amber-50" />
        <MetricCard title="Unpublished Summaries" value={dashboard.unpublishedSummaries || 0} icon={CalendarDays} color="text-purple-600 bg-purple-50" />
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="members">Family Members</TabsTrigger>
          <TabsTrigger value="summaries">Daily Summaries</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="consent">Consent Docs</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Family Members</CardTitle>
                  <CardDescription>Manage family member access to patient information</CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="bg-[#0a7ea4] hover:bg-[#086f91]"><UserPlus className="h-4 w-4 mr-2" /> Add Family Member</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Family Member</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>Patient</Label>
                        <Select value={newMember.patientId} onValueChange={(v) => setNewMember({ ...newMember, patientId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                          <SelectContent>
                            {patients.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>First Name</Label><Input value={newMember.firstName} onChange={(e) => setNewMember({ ...newMember, firstName: e.target.value })} /></div>
                        <div><Label>Last Name</Label><Input value={newMember.lastName} onChange={(e) => setNewMember({ ...newMember, lastName: e.target.value })} /></div>
                      </div>
                      <div><Label>Email</Label><Input type="email" value={newMember.email} onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} /></div>
                      <div><Label>Phone</Label><Input value={newMember.phone} onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })} /></div>
                      <div>
                        <Label>Relationship</Label>
                        <Select value={newMember.relationship} onValueChange={(v) => setNewMember({ ...newMember, relationship: v })}>
                          <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                          <SelectContent>
                            {["Parent", "Spouse", "Sibling", "Child", "Legal Guardian", "Power of Attorney", "Other"].map((r) => <SelectItem key={r} value={r.toLowerCase()}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                      <DialogClose asChild><Button onClick={addFamilyMember} className="bg-[#0a7ea4]">Add Member</Button></DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Relationship</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Access Level</TableHead>
                    <TableHead>Notifications</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {familyMembers.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.firstName} {m.lastName}</TableCell>
                      <TableCell>{m.patientName || `Patient #${m.patientId}`}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{m.relationship}</Badge></TableCell>
                      <TableCell className="text-sm">{m.email}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{m.accessLevel}</Badge></TableCell>
                      <TableCell className="text-sm">
                        {m.notifyByEmail && <Badge variant="outline" className="mr-1">Email</Badge>}
                        {m.notifyBySms && <Badge variant="outline">SMS</Badge>}
                      </TableCell>
                      <TableCell>
                        {m.isActive ? <Badge className="bg-green-50 text-green-700 border-green-200">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {familyMembers.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No family members registered yet. Click "Add Family Member" to get started.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summaries">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Daily Summaries</CardTitle>
                  <CardDescription>Auto-generated daily reports shared with families. Includes medication adherence, incidents, and staff notes.</CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="bg-[#0a7ea4] hover:bg-[#086f91]"><Sparkles className="h-4 w-4 mr-2" /> Generate Summary</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Generate Daily Summary</DialogTitle></DialogHeader>
                    <div>
                      <Label>Patient</Label>
                      <Select value={genSummary.patientId} onValueChange={(v) => setGenSummary({ patientId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                        <SelectContent>
                          {patients.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                      <DialogClose asChild><Button onClick={generateSummary} className="bg-[#0a7ea4]">Generate</Button></DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Mood</TableHead>
                    <TableHead>Med Adherence</TableHead>
                    <TableHead>Incidents</TableHead>
                    <TableHead>Staff Notes</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaries.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{new Date(s.summaryDate).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{s.patientName || `Patient #${s.patientId}`}</TableCell>
                      <TableCell><Badge variant="outline">{s.moodOverall || "—"}</Badge></TableCell>
                      <TableCell>
                        {s.medicationAdherence !== null ? (
                          <Badge className={s.medicationAdherence >= 90 ? "bg-green-50 text-green-700 border-green-200" : s.medicationAdherence >= 75 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-700 border-red-200"}>
                            {s.medicationAdherence}%
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {s.incidentCount > 0 ? <Badge variant="destructive">{s.incidentCount}</Badge> : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{s.staffNotes || "—"}</TableCell>
                      <TableCell>
                        {s.isPublishedToFamily ? (
                          <Badge className="bg-green-50 text-green-700 border-green-200"><Eye className="h-3 w-3 mr-1" /> Published</Badge>
                        ) : (
                          <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!s.isPublishedToFamily && (
                          <Button size="sm" variant="outline" onClick={() => publishSummary(s.id)}>
                            <Send className="h-3 w-3 mr-1" /> Publish
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {summaries.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No daily summaries yet. Click "Generate Summary" to create one from today's data.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Message Threads</CardTitle>
                <CardDescription>Two-way communication between care team and families</CardDescription>
              </CardHeader>
              <CardContent>
                {threads.length > 0 ? (
                  <div className="space-y-3">
                    {threads.map((t: any) => (
                      <div key={t.threadId} className="p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{t.patientName || `Patient #${t.patientId}`}</span>
                          <div className="flex items-center gap-2">
                            {t.unreadCount > 0 && <Badge variant="destructive">{t.unreadCount} new</Badge>}
                            <span className="text-xs text-muted-foreground">{t.messageCount} messages</span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{t.lastMessage}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(t.lastMessageAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No message threads yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Send className="h-4 w-4" /> Send Message</CardTitle>
                <CardDescription>Send a message to a patient's family members</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Patient</Label>
                  <Select value={newMessage.patientId} onValueChange={(v) => setNewMessage({ ...newMessage, patientId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                    <SelectContent>
                      {patients.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea
                    value={newMessage.message}
                    onChange={(e) => setNewMessage({ ...newMessage, message: e.target.value })}
                    placeholder="Type your message to the family..."
                    rows={4}
                  />
                </div>
                <Button onClick={sendMessage} className="w-full bg-[#0a7ea4] hover:bg-[#086f91]">
                  <Send className="h-4 w-4 mr-2" /> Send Message
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="consent">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><FileCheck className="h-4 w-4" /> Consent Documents</CardTitle>
                  <CardDescription>Digital consent management with version tracking and e-signatures</CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="bg-[#0a7ea4] hover:bg-[#086f91]"><FileText className="h-4 w-4 mr-2" /> Create Document</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create Consent Document</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>Patient</Label>
                        <Select value={newConsent.patientId} onValueChange={(v) => setNewConsent({ ...newConsent, patientId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                          <SelectContent>
                            {patients.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Document Type</Label>
                        <Select value={newConsent.documentType} onValueChange={(v) => setNewConsent({ ...newConsent, documentType: v })}>
                          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent>
                            {["Release of Information", "Treatment Consent", "Medication Consent", "Photo/Video Release", "HIPAA Authorization", "Advance Directive", "Emergency Contact Auth"].map((t) => (
                              <SelectItem key={t} value={t.toLowerCase().replace(/ /g, "_")}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Title</Label><Input value={newConsent.title} onChange={(e) => setNewConsent({ ...newConsent, title: e.target.value })} /></div>
                      <div><Label>Description</Label><Textarea value={newConsent.description} onChange={(e) => setNewConsent({ ...newConsent, description: e.target.value })} rows={3} /></div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                      <DialogClose asChild><Button onClick={createConsent} className="bg-[#0a7ea4]">Create</Button></DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Document Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Signed By</TableHead>
                    <TableHead>Signed Date</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consentDocs.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.patientName || `Patient #${d.patientId}`}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{(d.documentType || "").replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell>{d.title}</TableCell>
                      <TableCell>v{d.version}</TableCell>
                      <TableCell>{consentStatusBadge(d.status)}</TableCell>
                      <TableCell className="text-sm">{d.signedByName || "—"}</TableCell>
                      <TableCell className="text-sm">{d.signedAt ? new Date(d.signedAt).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-sm">
                        {d.expiresAt ? (
                          new Date(d.expiresAt) < new Date()
                            ? <span className="text-red-600">{new Date(d.expiresAt).toLocaleDateString()}</span>
                            : new Date(d.expiresAt).toLocaleDateString()
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {consentDocs.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No consent documents. Click "Create Document" to start managing digital consent.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> Family Notifications</CardTitle>
              <CardDescription>Auto-generated notifications sent to family members about daily summaries, consent requests, and incidents</CardDescription>
            </CardHeader>
            <CardContent>
              {notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.map((n: any) => (
                    <div key={n.id} className={`p-4 rounded-lg border ${n.isRead ? "bg-muted/30" : "bg-white border-l-4 border-l-[#0a7ea4]"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {notifSeverityBadge(n.severity)}
                          <span className="font-medium">{n.title}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">Patient: {n.patientName || `#${n.patientId}`}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No notifications yet. Notifications are auto-generated when summaries are published or consent documents are created.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
