import { useGetHome, useListPatients, useListStaff, useListIncidents, useListShifts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Phone, Users, Home as HomeIcon, Activity, CalendarClock, UserSquare, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import { format } from "date-fns";

export default function HomeDetail() {
  const { id } = useParams();
  const homeId = parseInt(id || "0", 10);

  const { data: home, isLoading: loadingHome } = useGetHome(homeId, { query: { enabled: !!homeId } });
  const { data: patients, isLoading: loadingPatients } = useListPatients({ homeId }, { query: { enabled: !!homeId } });
  const { data: staff, isLoading: loadingStaff } = useListStaff({ homeId }, { query: { enabled: !!homeId } });
  const { data: incidents, isLoading: loadingIncidents } = useListIncidents({ homeId }, { query: { enabled: !!homeId } });
  const { data: shifts, isLoading: loadingShifts } = useListShifts({ homeId }, { query: { enabled: !!homeId } });

  if (loadingHome) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (!home) return <div>Home not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <HomeIcon className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">{home.name}</h2>
            <StatusBadge status={home.status} />
          </div>
          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {home.address}, {home.city}, {home.state}
            </span>
            {home.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {home.phone}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Occupancy: {home.currentOccupancy} / {home.capacity}
            </span>
          </div>
        </div>
        <Button variant="outline">Edit Facility</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Region</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{home.region}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Occupancy Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((home.currentOccupancy / home.capacity) * 100).toFixed(0)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Patients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{patients?.filter(p => p.status === 'active').length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {incidents?.filter(i => i.status === 'open' || i.status === 'investigating').length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="patients" className="space-y-4">
        <TabsList>
          <TabsTrigger value="patients" className="gap-2"><UserSquare className="h-4 w-4" /> Patients</TabsTrigger>
          <TabsTrigger value="staff" className="gap-2"><Users className="h-4 w-4" /> Staff</TabsTrigger>
          <TabsTrigger value="shifts" className="gap-2"><CalendarClock className="h-4 w-4" /> Shifts</TabsTrigger>
          <TabsTrigger value="incidents" className="gap-2"><AlertTriangle className="h-4 w-4" /> Incidents</TabsTrigger>
        </TabsList>
        
        <TabsContent value="patients">
          <Card>
            <CardHeader>
              <CardTitle>Patients</CardTitle>
              <CardDescription>Residents assigned to {home.name}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>DOB</TableHead>
                    <TableHead>Admission Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPatients ? (
                    <TableRow><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                  ) : patients?.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-4">No patients assigned</TableCell></TableRow>
                  ) : (
                    patients?.map((patient) => (
                      <TableRow key={patient.id}>
                        <TableCell className="font-medium">{patient.firstName} {patient.lastName}</TableCell>
                        <TableCell>{format(new Date(patient.dateOfBirth), "MMM d, yyyy")}</TableCell>
                        <TableCell>{format(new Date(patient.admissionDate), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant={patient.status === 'active' ? 'default' : 'secondary'} className="font-normal capitalize">
                            {patient.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/patients/${patient.id}`} className="text-primary hover:underline text-sm font-medium">View Profile</Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff">
          <Card>
            <CardHeader>
              <CardTitle>Staff</CardTitle>
              <CardDescription>Employees assigned to {home.name}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingStaff ? (
                    <TableRow><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                  ) : staff?.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-4">No staff assigned</TableCell></TableRow>
                  ) : (
                    staff?.map((person) => (
                      <TableRow key={person.id}>
                        <TableCell className="font-medium">
                          <Link href={`/staff/${person.id}`} className="hover:underline">{person.firstName} {person.lastName}</Link>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="capitalize font-normal">{person.role}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{person.email}</TableCell>
                        <TableCell>
                          <Badge variant={person.status === 'active' ? 'default' : 'secondary'} className="font-normal capitalize">
                            {person.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shifts">
          <Card>
            <CardHeader>
              <CardTitle>Recent & Upcoming Shifts</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingShifts ? (
                    <TableRow><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                  ) : shifts?.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-4">No shifts found</TableCell></TableRow>
                  ) : (
                    shifts?.slice(0, 10).map((shift) => (
                      <TableRow key={shift.id}>
                        <TableCell className="font-medium">{shift.staffName}</TableCell>
                        <TableCell>{format(new Date(shift.startTime), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          {format(new Date(shift.startTime), "h:mm a")} - {format(new Date(shift.endTime), "h:mm a")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={shift.status === 'completed' ? 'secondary' : shift.status === 'in_progress' ? 'default' : 'outline'} className="font-normal capitalize">
                            {shift.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents">
          <Card>
            <CardHeader>
              <CardTitle>Incidents</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Patient</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingIncidents ? (
                    <TableRow><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                  ) : incidents?.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-4">No incidents reported</TableCell></TableRow>
                  ) : (
                    incidents?.map((incident) => (
                      <TableRow key={incident.id}>
                        <TableCell>{format(new Date(incident.occurredAt), "MMM d, yyyy")}</TableCell>
                        <TableCell className="font-medium">{incident.title}</TableCell>
                        <TableCell>
                          <Badge variant={incident.severity === 'critical' ? 'destructive' : incident.severity === 'high' ? 'destructive' : 'outline'} className={incident.severity === 'critical' ? '' : incident.severity === 'high' ? 'bg-orange-500 hover:bg-orange-600' : 'font-normal capitalize'}>
                            {incident.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={incident.status === 'open' || incident.status === 'investigating' ? 'default' : 'secondary'} className="font-normal capitalize">
                            {incident.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{incident.patientName || 'N/A'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none font-normal">Active</Badge>;
    case 'inactive':
      return <Badge variant="secondary" className="font-normal text-muted-foreground">Inactive</Badge>;
    case 'maintenance':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none font-normal">Maintenance</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
