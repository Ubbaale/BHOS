import { useListMedicationCounts, useListMedications } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";

export default function ControlledSubstancesPage() {
  const { data: medications, isLoading: medsLoading } = useListMedications();
  const { data: counts, isLoading: countsLoading } = useListMedicationCounts();

  const controlledMeds = medications?.filter((m) => m.controlledSubstance) || [];
  const discrepancies = counts?.filter((c) => c.discrepancy > 0) || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Controlled Substances</h2>
        <p className="text-muted-foreground">DEA-regulated medication tracking, count sheets, and chain of custody.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-purple-50">
              <Shield className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{controlledMeds.length}</p>
              <p className="text-xs text-muted-foreground">Controlled Medications</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-green-50">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Counts Recorded</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{discrepancies.length}</p>
              <p className="text-xs text-muted-foreground">Count Discrepancies</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-600" />
            Controlled Medication Inventory
          </CardTitle>
          <CardDescription>DEA-scheduled medications and current stock levels</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medication</TableHead>
                <TableHead>DEA Schedule</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Dosage</TableHead>
                <TableHead>Qty on Hand</TableHead>
                <TableHead>Rx Number</TableHead>
                <TableHead>Pharmacy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {medsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : controlledMeds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No controlled substances currently prescribed.
                  </TableCell>
                </TableRow>
              ) : (
                controlledMeds.map((med) => (
                  <TableRow key={med.id}>
                    <TableCell className="font-medium">{med.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        {med.deaSchedule || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>{med.patientName}</TableCell>
                    <TableCell>{med.dosage}</TableCell>
                    <TableCell>
                      <span className={`font-semibold ${(med.quantityOnHand ?? 0) <= (med.refillThreshold ?? 0) ? "text-red-600" : "text-green-600"}`}>
                        {med.quantityOnHand ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{med.rxNumber || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{med.pharmacyName || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Count Sheet Log</CardTitle>
          <CardDescription>Shift-to-shift controlled substance counts with witness verification</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medication</TableHead>
                <TableHead>Counted By</TableHead>
                <TableHead>Witness</TableHead>
                <TableHead>Before</TableHead>
                <TableHead>After</TableHead>
                <TableHead>Discrepancy</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {countsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !counts || counts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No count records yet.
                  </TableCell>
                </TableRow>
              ) : (
                counts.map((c) => (
                  <TableRow key={c.id} className={c.discrepancy > 0 ? "bg-red-50/50" : ""}>
                    <TableCell className="font-medium">{c.medicationName}</TableCell>
                    <TableCell>{c.staffName}</TableCell>
                    <TableCell>{c.witnessName || <span className="text-red-500 text-xs">No witness</span>}</TableCell>
                    <TableCell>{c.countBefore}</TableCell>
                    <TableCell>{c.countAfter}</TableCell>
                    <TableCell>
                      {c.discrepancy > 0 ? (
                        <Badge className="bg-red-600 text-white hover:bg-red-600">{c.discrepancy}</Badge>
                      ) : (
                        <Badge className="bg-green-600 text-white hover:bg-green-600">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(c.countedAt), "MMM d, h:mm a")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {c.notes || "—"}
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
