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
import { BedDouble, Home, Users, TrendingUp, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;
function fetchApi(url: string, opts?: RequestInit) {
  return fetch(`${API}${url}`, { ...opts, headers: { "Content-Type": "application/json", ...opts?.headers }, credentials: "include" }).then(r => { if (!r.ok) throw new Error(`API error: ${r.status}`); return r.json(); });
}

export default function CensusPage() {
  const [tab, setTab] = useState("overview");
  const [showAssign, setShowAssign] = useState(false);
  const [assignForm, setAssignForm] = useState({ homeId: "", patientId: "", bedNumber: "", roomNumber: "" });
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: summary } = useQuery({ queryKey: ["census-summary"], queryFn: () => fetchApi("/census/summary") });
  const { data: bedBoard = [] } = useQuery({ queryKey: ["bed-board"], queryFn: () => fetchApi("/census/bed-board") });
  const { data: homes = [] } = useQuery({ queryKey: ["homes"], queryFn: () => fetchApi("/homes") });
  const { data: patients = [] } = useQuery({ queryKey: ["patients"], queryFn: () => fetchApi("/patients") });

  const assignBed = useMutation({
    mutationFn: (data: any) => fetchApi("/census/bed-assignments", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bed-board"] }); qc.invalidateQueries({ queryKey: ["census-summary"] }); setShowAssign(false); toast({ title: "Bed assigned" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const vacateBed = useMutation({
    mutationFn: (id: number) => fetchApi(`/census/bed-assignments/${id}/vacate`, { method: "PATCH" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bed-board"] }); qc.invalidateQueries({ queryKey: ["census-summary"] }); toast({ title: "Bed vacated" }); },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BedDouble className="h-7 w-7 text-primary" /> Census & Bed Board</h1>
          <p className="text-gray-500 mt-1">Real-time bed tracking, occupancy, and census management</p>
        </div>
        <Dialog open={showAssign} onOpenChange={setShowAssign}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Assign Bed</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Assign Bed</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Home</label>
                <Select value={assignForm.homeId} onValueChange={v => setAssignForm({ ...assignForm, homeId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select home" /></SelectTrigger>
                  <SelectContent>{homes.map((h: any) => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><label className="text-sm font-medium">Patient</label>
                <Select value={assignForm.patientId} onValueChange={v => setAssignForm({ ...assignForm, patientId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select patient" /></SelectTrigger>
                  <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium">Bed #</label><Input className="mt-1" value={assignForm.bedNumber} onChange={e => setAssignForm({ ...assignForm, bedNumber: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Room #</label><Input className="mt-1" value={assignForm.roomNumber} onChange={e => setAssignForm({ ...assignForm, roomNumber: e.target.value })} /></div>
              </div>
              <Button className="w-full" disabled={!assignForm.homeId || !assignForm.patientId || !assignForm.bedNumber}
                onClick={() => assignBed.mutate({ homeId: Number(assignForm.homeId), patientId: Number(assignForm.patientId), bedNumber: assignForm.bedNumber, roomNumber: assignForm.roomNumber })}>Assign Bed</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><BedDouble className="h-5 w-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{summary.totals.totalBeds}</p><p className="text-xs text-gray-500">Total Beds</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center"><Users className="h-5 w-5 text-green-600" /></div><div><p className="text-2xl font-bold">{summary.totals.totalOccupied}</p><p className="text-xs text-gray-500">Occupied</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center"><Home className="h-5 w-5 text-amber-600" /></div><div><p className="text-2xl font-bold">{summary.totals.totalAvailable}</p><p className="text-xs text-gray-500">Available</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-purple-600" /></div><div><p className="text-2xl font-bold">{summary.totals.overallOccupancyRate}%</p><p className="text-xs text-gray-500">Occupancy Rate</p></div></div></CardContent></Card>
        </div>
      )}

      <Card>
        <Tabs value={tab} onValueChange={setTab}>
          <CardHeader><TabsList><TabsTrigger value="overview">By Home</TabsTrigger><TabsTrigger value="bedboard">Bed Board</TabsTrigger></TabsList></CardHeader>
          <CardContent>
            <TabsContent value="overview" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {summary?.homes?.map((h: any) => (
                  <Card key={h.homeId} className="border-2">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">{h.homeName}</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Capacity:</span><span className="font-medium">{h.totalBeds} beds</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Occupied:</span><span className="font-medium">{h.occupiedBeds}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Available:</span><span className="font-medium text-green-600">{h.availableBeds}</span></div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2"><div className="bg-primary rounded-full h-2" style={{ width: `${h.occupancyRate}%` }} /></div>
                        <p className="text-xs text-gray-500 text-right">{h.occupancyRate}% occupied</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(!summary?.homes || summary.homes.length === 0) && <p className="text-gray-500 col-span-3 text-center py-8">No active homes found</p>}
              </div>
            </TabsContent>
            <TabsContent value="bedboard" className="mt-0">
              <Table>
                <TableHeader><TableRow><TableHead>Home</TableHead><TableHead>Bed</TableHead><TableHead>Room</TableHead><TableHead>Patient</TableHead><TableHead>Assigned</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {bedBoard.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No bed assignments yet</TableCell></TableRow>
                  ) : bedBoard.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.homeName}</TableCell>
                      <TableCell><Badge variant="outline">{b.bedNumber}</Badge></TableCell>
                      <TableCell>{b.roomNumber || "—"}</TableCell>
                      <TableCell>{b.patientName}</TableCell>
                      <TableCell className="text-sm">{new Date(b.assignedAt).toLocaleDateString()}</TableCell>
                      <TableCell><Button variant="outline" size="sm" onClick={() => vacateBed.mutate(b.id)}>Vacate</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
