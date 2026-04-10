import { useState } from "react";
import { useGetStaffMember, useListShifts } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Phone, Home as HomeIcon, CalendarClock, Edit, Shield, ArrowRightLeft, UserCog } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, differenceInHours } from "date-fns";

const BASE = import.meta.env.BASE_URL;
function fetchApi(path: string, opts?: RequestInit) {
  return fetch(`${BASE}api${path}`, { credentials: "include", ...opts }).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.error || "Request failed"); });
    return r.json();
  });
}

export default function StaffDetail() {
  const { id } = useParams();
  const staffId = parseInt(id || "0", 10);
  const qc = useQueryClient();

  const { data: staff, isLoading: loadingStaff } = useGetStaffMember(staffId, { query: { enabled: !!staffId } });
  const { data: shifts, isLoading: loadingShifts } = useListShifts({ staffId }, { query: { enabled: !!staffId } });

  const { data: currentUser } = useQuery({
    queryKey: ["current-staff"],
    queryFn: () => fetchApi("/staff/me"),
  });

  const isAdmin = currentUser?.role === "admin";

  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [roleError, setRoleError] = useState("");

  const roleMut = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      fetchApi(`/staff/${id}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/staff"] });
      qc.invalidateQueries({ queryKey: [`/api/staff/${staffId}`] });
      setShowRoleDialog(false);
      setRoleError("");
    },
    onError: (e: Error) => setRoleError(e.message),
  });

  const transferMut = useMutation({
    mutationFn: (targetStaffId: number) =>
      fetchApi("/staff/transfer-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStaffId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/staff"] });
      qc.invalidateQueries({ queryKey: [`/api/staff/${staffId}`] });
      qc.invalidateQueries({ queryKey: ["current-staff"] });
      setShowTransferDialog(false);
    },
    onError: (e: Error) => setRoleError(e.message),
  });

  if (loadingStaff) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (!staff) return <div>Staff member not found</div>;

  const isSelf = currentUser?.id === staff.id;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
              {staff.firstName[0]}{staff.lastName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-3xl font-bold tracking-tight">{staff.firstName} {staff.lastName}</h2>
                <StatusBadge status={staff.status} />
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <RoleBadge role={staff.role} />
                {staff.homeName && (
                  <span className="flex items-center gap-1">
                    <HomeIcon className="h-3.5 w-3.5" />
                    {staff.homeName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && !isSelf && (
            <>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => { setSelectedRole(staff.role); setRoleError(""); setShowRoleDialog(true); }}
              >
                <UserCog className="h-4 w-4" />
                Change Role
              </Button>
              <Button
                variant="outline"
                className="gap-2 text-amber-600 border-amber-200 hover:bg-amber-50"
                onClick={() => { setRoleError(""); setShowTransferDialog(true); }}
              >
                <ArrowRightLeft className="h-4 w-4" />
                Transfer Admin
              </Button>
            </>
          )}
          <Button variant="outline" className="gap-2">
            <Edit className="h-4 w-4" />
            Edit Profile
          </Button>
        </div>
      </div>

      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role for {staff.firstName} {staff.lastName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg text-sm">
              <p>Current role: <span className="font-semibold capitalize">{staff.role}</span></p>
            </div>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select new role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin — Full access to all features</SelectItem>
                <SelectItem value="manager">Manager — Home management, staff oversight</SelectItem>
                <SelectItem value="supervisor">Supervisor — Staff supervision, shift oversight</SelectItem>
                <SelectItem value="nurse">Nurse — Medication admin, eMAR, patient care</SelectItem>
                <SelectItem value="caregiver">Caregiver — Daily logs, patient interactions</SelectItem>
              </SelectContent>
            </Select>
            {roleError && <p className="text-sm text-red-600">{roleError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRoleDialog(false)}>Cancel</Button>
              <Button
                onClick={() => roleMut.mutate({ id: staff.id, role: selectedRole })}
                disabled={roleMut.isPending || selectedRole === staff.role}
              >
                {roleMut.isPending ? "Updating..." : "Update Role"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Admin Ownership</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm">
              <p className="font-semibold text-amber-800 mb-1">This action cannot be easily undone</p>
              <p className="text-amber-700">
                You are about to transfer admin ownership to <strong>{staff.firstName} {staff.lastName}</strong>.
                Your role will be changed to <strong>Manager</strong> and you will lose admin privileges.
              </p>
            </div>
            {roleError && <p className="text-sm text-red-600">{roleError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowTransferDialog(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => transferMut.mutate(staff.id)}
                disabled={transferMut.isPending}
              >
                {transferMut.isPending ? "Transferring..." : "Transfer Admin Ownership"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{staff.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Phone</p>
                <p className="text-sm text-muted-foreground">{staff.phone || 'Not provided'}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-border">
              <p className="text-sm font-medium">Hire Date</p>
              <p className="text-sm text-muted-foreground">{format(new Date(staff.hireDate), "MMMM d, yyyy")}</p>
            </div>
          </CardContent>
        </Card>

        <div className="col-span-1 md:col-span-2">
          <Tabs defaultValue="shifts" className="w-full">
            <TabsList>
              <TabsTrigger value="shifts" className="gap-2"><CalendarClock className="h-4 w-4" /> Shift Schedule</TabsTrigger>
            </TabsList>
            
            <TabsContent value="shifts">
              <Card>
                <CardHeader>
                  <CardTitle>Shifts</CardTitle>
                  <CardDescription>Recent and upcoming shifts for {staff.firstName}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingShifts ? (
                        <TableRow><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                      ) : shifts?.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No shifts assigned</TableCell></TableRow>
                      ) : (
                        shifts?.map((shift) => {
                          const start = parseISO(shift.startTime);
                          const end = parseISO(shift.endTime);
                          return (
                            <TableRow key={shift.id}>
                              <TableCell className="font-medium text-sm">
                                {format(start, "EEE, MMM d, yyyy")}
                              </TableCell>
                              <TableCell className="text-sm">
                                {format(start, "h:mm a")} - {format(end, "h:mm a")}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {differenceInHours(end, start)} hrs
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">{shift.homeName}</span>
                              </TableCell>
                              <TableCell>
                                <ShiftStatusBadge status={shift.status} />
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case "admin":
      return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100 border-none font-normal capitalize gap-1"><Shield className="h-3 w-3" />{role}</Badge>;
    case "manager":
      return <Badge className="bg-purple-50 text-purple-600 hover:bg-purple-50 border-none font-normal capitalize">{role}</Badge>;
    case "nurse":
      return <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-50 border-none font-normal capitalize">{role}</Badge>;
    case "caregiver":
      return <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-none font-normal capitalize">{role}</Badge>;
    case "supervisor":
      return <Badge className="bg-purple-50 text-purple-600 hover:bg-purple-50 border-none font-normal capitalize">{role}</Badge>;
    default:
      return <Badge variant="outline" className="capitalize font-normal">{role}</Badge>;
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

function ShiftStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'scheduled':
      return <Badge variant="outline" className="font-normal text-blue-600 border-blue-200 bg-blue-50">Scheduled</Badge>;
    case 'in_progress':
      return <Badge className="bg-primary text-primary-foreground font-normal">In Progress</Badge>;
    case 'completed':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none font-normal">Completed</Badge>;
    case 'cancelled':
      return <Badge variant="secondary" className="font-normal text-muted-foreground">Cancelled</Badge>;
    case 'no_show':
      return <Badge variant="destructive" className="font-normal">No Show</Badge>;
    default:
      return <Badge variant="outline" className="capitalize">{status.replace('_', ' ')}</Badge>;
  }
}
