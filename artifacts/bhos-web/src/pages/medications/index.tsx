import { useListMedications } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pill, UserSquare, Shield, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { BarcodeScanner } from "@/components/BarcodeScanner";

export default function MedicationsPage() {
  const { data: medications, isLoading } = useListMedications();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Medications Directory</h2>
          <p className="text-muted-foreground">Master list of all medications across facilities.</p>
        </div>
        <div className="flex items-center gap-2">
          <BarcodeScanner
            triggerLabel="Scan Barcode"
            onMedicationFound={(med) => {
              const row = document.querySelector(`[data-med-id="${med.id}"]`);
              if (row) {
                row.scrollIntoView({ behavior: "smooth", block: "center" });
                row.classList.add("bg-primary/10");
                setTimeout(() => row.classList.remove("bg-primary/10"), 3000);
              }
            }}
          />
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Prescription
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medication</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Dosage & Freq</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Prescribed By</TableHead>
                <TableHead>Inventory</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : medications?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No medications found.
                  </TableCell>
                </TableRow>
              ) : (
                medications?.map((med) => (
                  <TableRow key={med.id} data-med-id={med.id} className="transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`h-8 w-8 rounded-md flex items-center justify-center ${
                          med.controlledSubstance ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {med.controlledSubstance ? <Shield className="h-4 w-4" /> : <Pill className="h-4 w-4" />}
                        </div>
                        <div>
                          <span className="font-medium">{med.name}</span>
                          {med.controlledSubstance && med.deaSchedule && (
                            <Badge variant="outline" className="ml-2 text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                              {med.deaSchedule}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link href={`/patients/${med.patientId}`} className="flex items-center gap-1 text-sm hover:underline">
                        <UserSquare className="h-3 w-3 text-muted-foreground" />
                        {med.patientName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-medium">{med.dosage}</span> — <span className="text-muted-foreground">{med.frequency}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize font-normal text-xs">{med.route}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        med.medicationType === "prn"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }>
                        {med.medicationType === "prn" ? "PRN" : "Scheduled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {med.prescribedBy || "Unknown"}
                    </TableCell>
                    <TableCell>
                      {med.quantityOnHand != null ? (
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3 text-muted-foreground" />
                          <span className={`text-sm font-medium ${
                            med.refillThreshold && med.quantityOnHand <= med.refillThreshold
                              ? "text-red-600" : "text-green-600"
                          }`}>
                            {med.quantityOnHand}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
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
    </div>
  );
}
