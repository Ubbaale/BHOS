import { useGetEmar } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardCheck, Clock, AlertTriangle, CheckCircle, XCircle, Shield, ScanLine } from "lucide-react";
import { format } from "date-fns";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useToast } from "@/hooks/use-toast";

export default function EmarPage() {
  const { data: entries, isLoading } = useGetEmar();

  const overdue = entries?.filter((e) => e.status === "overdue") || [];
  const pending = entries?.filter((e) => e.status === "pending") || [];
  const given = entries?.filter((e) => e.status === "given") || [];
  const missed = entries?.filter((e) => e.status === "missed" || e.status === "refused" || e.status === "held") || [];

  const grouped = entries?.reduce((acc, e) => {
    const key = `${e.patientId}-${e.patientName}`;
    if (!acc[key]) acc[key] = { patientName: e.patientName, homeName: e.homeName, entries: [] };
    acc[key].entries.push(e);
    return acc;
  }, {} as Record<string, { patientName: string; homeName: string | null; entries: typeof entries }>) || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">eMAR</h2>
          <p className="text-muted-foreground">Electronic Medication Administration Record — {format(new Date(), "MMMM d, yyyy")}</p>
        </div>
        <div className="flex items-center gap-3">
          {overdue.length > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1 animate-pulse">
              {overdue.length} Overdue
            </Badge>
          )}
          <BarcodeScanner
            triggerLabel="Scan Medication"
            onMedicationFound={(med, barcode) => {
              const row = document.querySelector(`[data-med-id="${med.id}"]`);
              if (row) {
                row.scrollIntoView({ behavior: "smooth", block: "center" });
                row.classList.add("bg-primary/10");
                setTimeout(() => row.classList.remove("bg-primary/10"), 3000);
              }
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Pending" value={pending.length} icon={Clock} color="text-blue-600 bg-blue-50" />
        <StatCard title="Given" value={given.length} icon={CheckCircle} color="text-green-600 bg-green-50" />
        <StatCard title="Overdue" value={overdue.length} icon={AlertTriangle} color="text-red-600 bg-red-50" />
        <StatCard title="Missed/Refused/Held" value={missed.length} icon={XCircle} color="text-amber-600 bg-amber-50" />
      </div>

      {Object.entries(grouped).map(([key, group]) => (
        <Card key={key}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              {group.patientName}
            </CardTitle>
            <CardDescription>{group.homeName}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medication</TableHead>
                  <TableHead>Dosage</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Administered By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  group.entries!.map((entry, i) => (
                    <TableRow key={i} data-med-id={entry.medicationId} className={`transition-colors ${entry.status === "overdue" ? "bg-red-50/50" : ""}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entry.medicationName}</span>
                          {entry.controlledSubstance && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                              <Shield className="h-3 w-3 mr-1" />
                              {entry.deaSchedule || "Controlled"}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{entry.dosage}</TableCell>
                      <TableCell className="capitalize">{entry.route}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(entry.scheduledTime), "h:mm a")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(entry.windowStart), "h:mm a")} – {format(new Date(entry.windowEnd), "h:mm a")}
                      </TableCell>
                      <TableCell>
                        <EmarStatusBadge status={entry.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          {entry.administeredBy || "—"}
                          {(entry as any).barcodeScanVerified && (
                            <span className="inline-flex items-center gap-0.5 bg-green-50 text-green-700 text-[10px] font-medium px-1.5 py-0.5 rounded border border-green-200">
                              <ScanLine className="h-2.5 w-2.5" />
                              Verified
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {!isLoading && entries?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No scheduled medications for today.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) {
  const [textColor, bgColor] = color.split(" ");
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${bgColor}`}>
          <Icon className={`h-5 w-5 ${textColor}`} />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmarStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "given":
      return <Badge className="bg-green-600 text-white hover:bg-green-600">Given</Badge>;
    case "overdue":
      return <Badge className="bg-red-600 text-white hover:bg-red-600 animate-pulse">Overdue</Badge>;
    case "pending":
      return <Badge variant="secondary">Pending</Badge>;
    case "missed":
      return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Missed</Badge>;
    case "refused":
      return <Badge className="bg-orange-500 text-white hover:bg-orange-500">Refused</Badge>;
    case "held":
      return <Badge variant="outline" className="border-blue-300 text-blue-700">Held</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
