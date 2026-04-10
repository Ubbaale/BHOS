import { useListPatients } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Plus, UserSquare, Home as HomeIcon, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInYears } from "date-fns";

export default function PatientsPage() {
  const { data: patients, isLoading } = useListPatients();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Patient Registry</h2>
          <p className="text-muted-foreground">Manage all patients across behavioral health facilities.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Admit Patient
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MRN</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Age / Gender</TableHead>
                <TableHead>Facility</TableHead>
                <TableHead>Insurance</TableHead>
                <TableHead>Admission Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-8 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : patients?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No patients found.
                  </TableCell>
                </TableRow>
              ) : (
                patients?.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell>
                      <span className="font-mono text-xs font-medium text-primary">{patient.mrn || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-medium text-xs">
                          {patient.firstName[0]}{patient.lastName[0]}
                        </div>
                        <div>
                          <span className="font-medium">{patient.firstName} {patient.lastName}</span>
                          {patient.diagnosis && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">
                              {patient.diagnosis}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {differenceInYears(new Date(), new Date(patient.dateOfBirth))}y / <span className="capitalize">{patient.gender}</span>
                    </TableCell>
                    <TableCell>
                      {patient.homeName ? (
                        <div className="flex items-center gap-1 text-sm">
                          <HomeIcon className="h-3 w-3 text-muted-foreground" />
                          <Link href={`/homes/${patient.homeId}`} className="hover:underline">
                            {patient.homeName}
                          </Link>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {(patient as any).insuranceProvider || <span className="text-muted-foreground italic text-xs">None</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(patient.admissionDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={patient.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/patients/${patient.id}`} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3">
                        Profile
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
