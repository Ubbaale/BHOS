import { useGetPatient, useListMedications, useListDailyLogs, useListIncidents } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Home as HomeIcon, Edit, Activity, Pill, AlertTriangle, FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, differenceInYears } from "date-fns";

export default function PatientDetail() {
  const { id } = useParams();
  const patientId = parseInt(id || "0", 10);

  const { data: patient, isLoading: loadingPatient } = useGetPatient(patientId, { query: { enabled: !!patientId } });
  const { data: medications, isLoading: loadingMeds } = useListMedications({ patientId }, { query: { enabled: !!patientId } });
  const { data: logs, isLoading: loadingLogs } = useListDailyLogs({ patientId }, { query: { enabled: !!patientId } });
  const { data: incidents, isLoading: loadingIncidents } = useListIncidents({ }, { query: { enabled: false } }); // Would normally filter by patientId, but API hook doesn't support it directly in params type yet

  // Filter incidents locally for now since the API params type doesn't include patientId
  const patientIncidents = incidents?.filter(i => i.patientId === patientId) || [];

  if (loadingPatient) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (!patient) return <div>Patient not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-xl">
              {patient.firstName[0]}{patient.lastName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-3xl font-bold tracking-tight">{patient.firstName} {patient.lastName}</h2>
                <StatusBadge status={patient.status} />
              </div>
              {patient.mrn && (
                <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded mt-0.5 inline-block">MRN: {patient.mrn}</span>
              )}
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium">DOB: {format(new Date(patient.dateOfBirth), "MMM d, yyyy")} ({differenceInYears(new Date(), new Date(patient.dateOfBirth))}y)</span>
                <span className="capitalize">{patient.gender}</span>
                {patient.homeName && (
                  <span className="flex items-center gap-1 ml-2">
                    <HomeIcon className="h-3.5 w-3.5" />
                    {patient.homeName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <Button variant="outline" className="gap-2">
          <Edit className="h-4 w-4" />
          Edit Patient
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Medical Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Diagnosis</p>
              <p className="text-sm text-muted-foreground">{patient.diagnosis || 'None recorded'}</p>
              {(patient as any).primaryDiagnosisCode && (
                <Badge variant="outline" className="mt-1 text-xs font-mono">{(patient as any).primaryDiagnosisCode}</Badge>
              )}
            </div>
            {((patient as any).primaryPhysician || (patient as any).psychiatrist) && (
              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium">Care Team</p>
                {(patient as any).primaryPhysician && (
                  <p className="text-sm text-muted-foreground mt-1">PCP: {(patient as any).primaryPhysician} {(patient as any).primaryPhysicianPhone ? `(${(patient as any).primaryPhysicianPhone})` : ""}</p>
                )}
                {(patient as any).psychiatrist && (
                  <p className="text-sm text-muted-foreground mt-1">Psych: {(patient as any).psychiatrist} {(patient as any).psychiatristPhone ? `(${(patient as any).psychiatristPhone})` : ""}</p>
                )}
              </div>
            )}
            {(patient as any).insuranceProvider && (
              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium">Insurance</p>
                <p className="text-sm text-muted-foreground">{(patient as any).insuranceProvider}</p>
                {(patient as any).insurancePolicyNumber && <p className="text-xs text-muted-foreground mt-0.5">Policy: {(patient as any).insurancePolicyNumber}</p>}
                {(patient as any).medicaidId && <p className="text-xs text-muted-foreground mt-0.5">Medicaid: {(patient as any).medicaidId}</p>}
              </div>
            )}
            <div className="pt-4 border-t border-border">
              <p className="text-sm font-medium">Emergency Contact</p>
              <p className="text-sm text-muted-foreground">{patient.emergencyContact || 'Not provided'}</p>
              {patient.emergencyPhone && (
                <p className="text-sm text-muted-foreground mt-1">{patient.emergencyPhone}</p>
              )}
            </div>
            <div className="pt-4 border-t border-border">
              <p className="text-sm font-medium">Admission Date</p>
              <p className="text-sm text-muted-foreground">{format(new Date(patient.admissionDate), "MMMM d, yyyy")}</p>
            </div>
            {patient.notes && (
              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium">Notes</p>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{patient.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="col-span-1 md:col-span-2">
          <Tabs defaultValue="medications" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="medications" className="gap-2"><Pill className="h-4 w-4" /> Medications</TabsTrigger>
              <TabsTrigger value="logs" className="gap-2"><Activity className="h-4 w-4" /> Daily Logs</TabsTrigger>
              <TabsTrigger value="incidents" className="gap-2"><AlertTriangle className="h-4 w-4" /> Incidents</TabsTrigger>
            </TabsList>
            
            <TabsContent value="medications">
              <Card>
                <CardHeader>
                  <CardTitle>Active Medications</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medication</TableHead>
                        <TableHead>Dosage</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingMeds ? (
                        <TableRow><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                      ) : medications?.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No medications recorded</TableCell></TableRow>
                      ) : (
                        medications?.map((med) => (
                          <TableRow key={med.id}>
                            <TableCell className="font-medium text-sm">
                              {med.name}
                              <div className="text-xs text-muted-foreground capitalize">{med.route}</div>
                            </TableCell>
                            <TableCell className="text-sm">{med.dosage}</TableCell>
                            <TableCell className="text-sm">{med.frequency}</TableCell>
                            <TableCell>
                              {med.active ? (
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none font-normal">Active</Badge>
                              ) : (
                                <Badge variant="secondary" className="font-normal text-muted-foreground">Inactive</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="logs">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Behavioral Logs</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Mood</TableHead>
                        <TableHead>Appetite</TableHead>
                        <TableHead>Sleep</TableHead>
                        <TableHead>Staff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingLogs ? (
                        <TableRow><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                      ) : logs?.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No logs recorded</TableCell></TableRow>
                      ) : (
                        logs?.slice(0, 10).map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium text-sm">
                              {format(new Date(log.date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell><MoodBadge mood={log.mood} /></TableCell>
                            <TableCell className="text-sm capitalize">{log.appetite}</TableCell>
                            <TableCell className="text-sm capitalize">{log.sleep}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{log.staffName}</TableCell>
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
                  <CardTitle>Involved Incidents</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingIncidents ? (
                        <TableRow><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                      ) : patientIncidents.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No incidents reported</TableCell></TableRow>
                      ) : (
                        patientIncidents.map((incident) => (
                          <TableRow key={incident.id}>
                            <TableCell className="font-medium text-sm">
                              {format(new Date(incident.occurredAt), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-sm">{incident.title}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize text-xs font-normal">{incident.severity}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize text-xs font-normal">{incident.status}</Badge>
                            </TableCell>
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
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none font-normal">Active</Badge>;
    case 'discharged':
      return <Badge variant="secondary" className="font-normal text-muted-foreground">Discharged</Badge>;
    case 'transferred':
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none font-normal">Transferred</Badge>;
    default:
      return <Badge variant="outline" className="capitalize">{status}</Badge>;
  }
}

function MoodBadge({ mood }: { mood: string }) {
  switch (mood) {
    case 'excellent':
    case 'good':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none font-normal capitalize">{mood}</Badge>;
    case 'fair':
      return <Badge variant="outline" className="font-normal capitalize">{mood}</Badge>;
    case 'poor':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none font-normal capitalize">{mood}</Badge>;
    case 'agitated':
      return <Badge variant="destructive" className="font-normal capitalize">{mood}</Badge>;
    default:
      return <Badge variant="outline" className="capitalize">{mood}</Badge>;
  }
}
