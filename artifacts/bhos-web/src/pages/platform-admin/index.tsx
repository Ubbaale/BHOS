import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, Building2, Users, Home as HomeIcon, LifeBuoy,
  ChevronRight, ArrowLeft, Send, AlertCircle, Clock,
  CheckCircle2, MessageSquare, Eye, Database, Download,
  RefreshCw, FileJson, Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;

interface AdminStats {
  totalOrganizations: number;
  totalStaff: number;
  totalHomes: number;
  totalTickets: number;
  openTickets: number;
}

interface Organization {
  orgId: number;
  homeCount: number;
  homeNames: string;
  staffCount: number;
  ticketCount: number;
  openTicketCount: number;
}

interface OrgDetail {
  orgId: number;
  homes: any[];
  staff: any[];
  tickets: any[];
}

interface Ticket {
  id: number;
  orgId: number;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: any[];
}

const statusConfig: Record<string, { color: string; label: string }> = {
  open: { color: "bg-blue-100 text-blue-700", label: "Open" },
  in_progress: { color: "bg-amber-100 text-amber-700", label: "In Progress" },
  waiting: { color: "bg-purple-100 text-purple-700", label: "Waiting" },
  resolved: { color: "bg-green-100 text-green-700", label: "Resolved" },
  closed: { color: "bg-gray-100 text-gray-700", label: "Closed" },
};

const priorityConfig: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-600",
  high: "bg-orange-100 text-orange-600",
  urgent: "bg-red-100 text-red-600",
};

function OrgDetailView({ orgId, onBack }: { orgId: number; onBack: () => void }) {
  const { data, isLoading } = useQuery<OrgDetail>({
    queryKey: ["admin-org", orgId],
    queryFn: () => fetch(`${API}/admin/organizations/${orgId}`).then(r => r.json()),
  });

  if (isLoading || !data) return <div className="py-12 text-center">Loading...</div>;

  const homes = data.homes || [];
  const staff = data.staff || [];
  const tickets = data.tickets || [];

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-2" />Back to Organizations
      </Button>

      <div>
        <h2 className="text-xl font-bold">Organization #{data.orgId}</h2>
        <p className="text-muted-foreground">{homes.length} homes, {staff.length} staff members</p>
      </div>

      <Tabs defaultValue="homes">
        <TabsList>
          <TabsTrigger value="homes">Homes ({homes.length})</TabsTrigger>
          <TabsTrigger value="staff">Staff ({staff.length})</TabsTrigger>
          <TabsTrigger value="tickets">Tickets ({tickets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="homes" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Capacity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {homes.map((h: any) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell>{h.address}, {h.city}, {h.state}</TableCell>
                  <TableCell><Badge variant="outline">{h.status}</Badge></TableCell>
                  <TableCell>{h.currentOccupancy}/{h.capacity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="staff" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                  <TableCell>{s.email}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{s.role}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          {tickets.length === 0 ? (
            <p className="text-muted-foreground py-4">No tickets from this organization</p>
          ) : (
            <div className="space-y-2">
              {tickets.map((t: any) => {
                const sc = statusConfig[t.status] || statusConfig.open;
                return (
                  <Card key={t.id}>
                    <CardContent className="py-3 flex items-center justify-between">
                      <div>
                        <span className="font-medium">{t.subject}</span>
                        <div className="text-sm text-muted-foreground">
                          #{t.id} — {t.createdByName} — {new Date(t.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={priorityConfig[t.priority] || ""}>{t.priority}</Badge>
                        <Badge className={sc.color}>{sc.label}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TicketDetailView({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  const [replyMessage, setReplyMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: ticket, isLoading } = useQuery<Ticket>({
    queryKey: ["admin-ticket", ticketId],
    queryFn: () => fetch(`${API}/admin/tickets/${ticketId}`).then(r => r.json()),
  });

  const sendReply = useMutation({
    mutationFn: () => fetch(`${API}/admin/tickets/${ticketId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: replyMessage }),
    }).then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      setReplyMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-ticket", ticketId] });
      toast({ title: "Reply sent" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => fetch(`${API}/admin/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      toast({ title: "Ticket status updated" });
    },
  });

  if (isLoading || !ticket) return <div className="py-12 text-center">Loading...</div>;

  const sc = statusConfig[ticket.status] || statusConfig.open;

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-2" />Back to Tickets
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{ticket.subject}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Ticket #{ticket.id} — Org #{ticket.orgId} — by {ticket.createdByName} ({ticket.createdByEmail})
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <Badge className={priorityConfig[ticket.priority] || ""}>{ticket.priority}</Badge>
              <Badge className={sc.color}>{sc.label}</Badge>
              <Select onValueChange={(v) => updateStatus.mutate(v)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Change Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticket.messages?.map((msg: any) => (
            <div
              key={msg.id}
              className={`p-3 rounded-lg ${msg.senderType === "admin" ? "bg-primary/5 border-l-4 border-primary" : "bg-muted"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">
                  {msg.senderName}
                  {msg.senderType === "admin" && <Badge variant="secondary" className="ml-2 text-xs">Admin</Badge>}
                  {msg.senderType === "user" && <Badge variant="outline" className="ml-2 text-xs">Customer</Badge>}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(msg.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
            </div>
          ))}

          <form
            onSubmit={(e) => { e.preventDefault(); if (replyMessage.trim()) sendReply.mutate(); }}
            className="pt-3 border-t space-y-2"
          >
            <Textarea
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Type your reply to the customer..."
              rows={3}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={!replyMessage.trim() || sendReply.isPending}>
                <Send className="h-4 w-4 mr-2" />
                {sendReply.isPending ? "Sending..." : "Send Reply"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PlatformAdminPage() {
  const [tab, setTab] = useState("overview");
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const { data: adminCheck, isLoading: checkingAuth } = useQuery<{ isSuperAdmin: boolean }>({
    queryKey: ["admin-check"],
    queryFn: () => fetch(`${API}/admin/me`).then(r => {
      if (r.status === 403) return { isSuperAdmin: false };
      return r.json();
    }),
  });

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: () => fetch(`${API}/admin/stats`).then(r => r.json()),
    enabled: adminCheck?.isSuperAdmin === true,
  });

  const { data: orgs = [] } = useQuery<Organization[]>({
    queryKey: ["admin-orgs"],
    queryFn: () => fetch(`${API}/admin/organizations`).then(r => r.json()),
    enabled: adminCheck?.isSuperAdmin === true,
  });

  const { data: allTickets = [] } = useQuery<Ticket[]>({
    queryKey: ["admin-tickets"],
    queryFn: () => fetch(`${API}/admin/tickets`).then(r => r.json()),
    enabled: adminCheck?.isSuperAdmin === true,
  });

  if (checkingAuth) {
    return <div className="flex items-center justify-center py-12">Checking access...</div>;
  }

  if (!adminCheck?.isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Shield className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground mt-2">You don't have platform admin access.</p>
        <p className="text-sm text-muted-foreground mt-1">Contact the BHOS team to request access.</p>
      </div>
    );
  }

  if (selectedOrgId) {
    return <OrgDetailView orgId={selectedOrgId} onBack={() => setSelectedOrgId(null)} />;
  }

  if (selectedTicketId) {
    return <TicketDetailView ticketId={selectedTicketId} onBack={() => setSelectedTicketId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          🛡️ Platform Admin
        </h1>
        <p className="text-muted-foreground mt-1">Manage all organizations and support tickets</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-sm text-muted-foreground">Organizations</p>
              <p className="text-2xl font-bold">{stats.totalOrganizations}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-sm text-muted-foreground">Total Staff</p>
              <p className="text-2xl font-bold">{stats.totalStaff}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-sm text-muted-foreground">Total Homes</p>
              <p className="text-2xl font-bold">{stats.totalHomes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-sm text-muted-foreground">Total Tickets</p>
              <p className="text-2xl font-bold">{stats.totalTickets}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-sm text-muted-foreground">Open Tickets</p>
              <p className="text-2xl font-bold text-red-600">{stats.openTickets}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Organizations</TabsTrigger>
          <TabsTrigger value="tickets">All Tickets ({allTickets.length})</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {orgs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">No organizations enrolled yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {orgs.map(org => (
                <Card
                  key={org.orgId}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedOrgId(org.orgId)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Organization #{org.orgId}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{org.homeNames}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <HomeIcon className="h-4 w-4 text-muted-foreground" />
                          <span>{org.homeCount} homes</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{org.staffCount} staff</span>
                        </div>
                        {org.openTicketCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {org.openTicketCount} open ticket{org.openTicketCount > 1 ? "s" : ""}
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          {allTickets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <LifeBuoy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">No tickets yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {allTickets.map(ticket => {
                const sc = statusConfig[ticket.status] || statusConfig.open;
                return (
                  <Card
                    key={ticket.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setSelectedTicketId(ticket.id)}
                  >
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{ticket.subject}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>#{ticket.id}</span>
                            <span>Org #{ticket.orgId}</span>
                            <span>{ticket.createdByName}</span>
                            <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Badge className={priorityConfig[ticket.priority] || ""}>{ticket.priority}</Badge>
                          <Badge className={sc.color}>{sc.label}</Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="backups" className="mt-4">
          <AdminBackupsTab orgs={orgs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface AdminBackup {
  id: number;
  orgId: number;
  backupType: string;
  status: string;
  fileName: string | null;
  fileSizeBytes: number | null;
  tableCount: number | null;
  recordCount: number | null;
  initiatedBy: string;
  initiatedByType: string;
  platformCopy: boolean;
  notes: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AdminBackupsTab({ orgs }: { orgs: Organization[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: backups = [] } = useQuery<AdminBackup[]>({
    queryKey: ["admin-backups"],
    queryFn: () => fetch(`${API}/admin/backups`).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (orgId: number) => fetch(`${API}/admin/backups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, notes: "Platform-initiated backup" }),
    }).then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: (data) => {
      toast({
        title: "Admin backup completed",
        description: `${data.recordCount} records from ${data.tableCount} tables.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-backups"] });
    },
    onError: () => toast({ title: "Backup failed", variant: "destructive" }),
  });

  const backupAllMutation = useMutation({
    mutationFn: async () => {
      const results = [];
      for (const org of orgs) {
        const resp = await fetch(`${API}/admin/backups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId: org.orgId, notes: "Platform-wide backup" }),
        });
        results.push(await resp.json());
      }
      return results;
    },
    onSuccess: (results) => {
      toast({
        title: "Platform backup completed",
        description: `Backed up ${results.length} organizations.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-backups"] });
    },
    onError: () => toast({ title: "Platform backup failed", variant: "destructive" }),
  });

  const bkStatusStyles: Record<string, string> = {
    completed: "bg-green-100 text-green-700",
    in_progress: "bg-blue-100 text-blue-700",
    failed: "bg-red-100 text-red-700",
    pending: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage backups for all organizations on the platform.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-backups"] })}
          >
            <RefreshCw className="h-4 w-4 mr-1" />Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => backupAllMutation.mutate()}
            disabled={backupAllMutation.isPending}
          >
            {backupAllMutation.isPending ? (
              <><RefreshCw className="h-4 w-4 mr-1 animate-spin" />Backing Up All...</>
            ) : (
              <><Database className="h-4 w-4 mr-1" />Backup All Orgs</>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {orgs.map(org => {
              const orgBackups = backups.filter(b => b.orgId === org.orgId);
              const lastBackup = orgBackups[0];
              return (
                <div key={org.orgId} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <span className="font-medium">Org #{org.orgId}</span>
                    <span className="text-sm text-muted-foreground ml-2">{org.homeNames}</span>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {orgBackups.length} backup{orgBackups.length !== 1 ? "s" : ""}
                      {lastBackup && ` — last: ${new Date(lastBackup.createdAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createMutation.mutate(org.orgId)}
                    disabled={createMutation.isPending}
                  >
                    <Plus className="h-3 w-3 mr-1" />Backup
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {backups.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">All Backups</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Org</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Initiated By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map(backup => (
                  <TableRow key={backup.id}>
                    <TableCell className="font-mono text-xs">#{backup.id}</TableCell>
                    <TableCell>Org #{backup.orgId}</TableCell>
                    <TableCell>
                      <Badge className={bkStatusStyles[backup.status] || ""}>
                        {backup.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{backup.recordCount?.toLocaleString() || "-"}</TableCell>
                    <TableCell>{backup.fileSizeBytes ? fmtBytes(backup.fileSizeBytes) : "-"}</TableCell>
                    <TableCell>
                      <span className="text-sm">{backup.initiatedBy}</span>
                      {backup.initiatedByType === "admin" && (
                        <Badge variant="outline" className="ml-1 text-xs">Admin</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{new Date(backup.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {backup.status === "completed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(`${API}/admin/backups/${backup.id}/download`, "_blank")}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
