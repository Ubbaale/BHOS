import { useState } from "react";
import { useListStaff } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Plus, Users, Mail, Phone, Home as HomeIcon, Send, Copy, Check, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const API = `${import.meta.env.BASE_URL}api`;

export default function StaffPage() {
  const { data: staff, isLoading } = useListStaff();
  const { toast } = useToast();
  const [inviteDialog, setInviteDialog] = useState<{ open: boolean; staffId?: number; staffName?: string }>({ open: false });
  const [inviteResult, setInviteResult] = useState<{ token: string; email: string; enrollmentLink: string; expiresAt: string } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSendInvite = async (staffId: number) => {
    setInviting(true);
    try {
      const res = await fetch(`${API}/staff/${staffId}/invite`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Cannot Invite", description: data.error, variant: "destructive" });
        setInviting(false);
        return;
      }
      setInviteResult(data.invitation);
      toast({ title: "Invitation Created", description: data.message });
    } catch {
      toast({ title: "Error", description: "Failed to create invitation", variant: "destructive" });
    }
    setInviting(false);
  };

  const handleCopyCode = () => {
    if (inviteResult) {
      navigator.clipboard.writeText(inviteResult.token);
      setCopied(true);
      toast({ title: "Copied", description: "Enrollment code copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Staff Directory</h2>
          <p className="text-muted-foreground">Manage employees, home assignments, and enrollment.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Staff
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Assignment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Hire Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-8 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : staff?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No staff found.
                  </TableCell>
                </TableRow>
              ) : (
                staff?.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{person.firstName} {person.lastName}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {person.email}</span>
                          {person.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {person.phone}</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={person.role} />
                    </TableCell>
                    <TableCell>
                      <EmployeeTypeBadge type={person.employeeType} agencyName={person.agencyName} />
                    </TableCell>
                    <TableCell>
                      {person.homeName ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <HomeIcon className="h-3 w-3" />
                          {person.homeName}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={person.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(person.hireDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => {
                            setInviteResult(null);
                            setCopied(false);
                            setInviteDialog({ open: true, staffId: person.id, staffName: `${person.firstName} ${person.lastName}` });
                          }}
                        >
                          <Send className="h-3 w-3" />
                          Invite
                        </Button>
                        <Link href={`/staff/${person.id}`} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3">
                          View
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={inviteDialog.open} onOpenChange={(open) => setInviteDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              Invite Staff Member
            </DialogTitle>
            <DialogDescription>
              Send an enrollment invitation to {inviteDialog.staffName}. They'll use this code in the BHOS mobile app to set up their account.
            </DialogDescription>
          </DialogHeader>

          {!inviteResult ? (
            <div className="space-y-4 py-2">
              <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800 space-y-1">
                <p className="font-medium">How enrollment works:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click "Generate Code" to create an enrollment invitation</li>
                  <li>Share the code with {inviteDialog.staffName}</li>
                  <li>They open the BHOS app and tap "Set up account"</li>
                  <li>They enter the code, create their password, and verify their email</li>
                </ol>
              </div>
              <Button
                onClick={() => inviteDialog.staffId && handleSendInvite(inviteDialog.staffId)}
                disabled={inviting}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                {inviting ? "Generating..." : "Generate Enrollment Code"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm font-medium text-green-800 mb-2">Enrollment code generated!</p>
                <p className="text-xs text-green-700 mb-3">Share this code with the staff member. They'll enter it in the BHOS mobile app.</p>

                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border rounded px-3 py-2 font-mono text-sm break-all select-all">
                    {inviteResult.token}
                  </code>
                  <Button variant="outline" size="sm" onClick={handleCopyCode}>
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Expires: {format(new Date(inviteResult.expiresAt), "MMM d, yyyy h:mm a")}
              </div>

              <div className="text-xs text-muted-foreground bg-amber-50 p-3 rounded border border-amber-200">
                <p className="font-medium text-amber-800">Security note:</p>
                <p className="text-amber-700 mt-1">This code is single-use and expires in 7 days. Only share it directly with the staff member through a secure channel.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case 'nurse':
      return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Nurse</Badge>;
    case 'caregiver':
      return <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Caregiver</Badge>;
    case 'manager':
    case 'supervisor':
      return <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50 capitalize">{role}</Badge>;
    case 'admin':
      return <Badge variant="outline" className="text-gray-600 border-gray-200 bg-gray-50">Admin</Badge>;
    default:
      return <Badge variant="outline" className="capitalize">{role}</Badge>;
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none font-normal">Active</Badge>;
    case 'inactive':
      return <Badge variant="secondary" className="font-normal text-muted-foreground">Inactive</Badge>;
    case 'on_leave':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none font-normal">On Leave</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function EmployeeTypeBadge({ type, agencyName }: { type: string; agencyName?: string | null }) {
  switch (type) {
    case 'permanent':
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Permanent</Badge>;
    case 'contractor':
      return <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">Contractor</Badge>;
    case 'agency':
      return (
        <div className="flex flex-col gap-0.5">
          <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">Agency</Badge>
          {agencyName && <span className="text-[10px] text-muted-foreground">{agencyName}</span>}
        </div>
      );
    default:
      return <Badge variant="outline" className="capitalize">{type}</Badge>;
  }
}
