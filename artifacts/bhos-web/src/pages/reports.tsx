import { useState, useMemo } from "react";
import {
  useListPatients,
  useListStaff,
  useListMedications,
  useListMedicationAdministrations,
  useListIncidents,
  useListDailyLogs,
  useListShifts,
  useListTimePunches,
  useListFraudAlerts,
  useListMedicationCounts,
  useListMedicationErrors,
  useListMedicationInventory,
  useListPhysicianOrders,
  useListVitalSigns,
  useListMedicationSideEffects,
  useListMedicationRefusals,
  useListMedicationAuditLog,
  useGetMedicationSafetyDashboard,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, Download, Filter, Calendar, Users, Pill, AlertTriangle,
  Activity, Shield, Clock, Clipboard, ChevronDown, ChevronUp,
  FileSpreadsheet, Printer,
} from "lucide-react";
import { format } from "date-fns";

type ReportType =
  | "medication_administration"
  | "controlled_substances"
  | "medication_errors"
  | "side_effects"
  | "refusals"
  | "audit_trail"
  | "vital_signs"
  | "incident_summary"
  | "patient_case_file"
  | "staff_activity"
  | "daily_logs"
  | "compliance_overview"
  | "inventory"
  | "physician_orders";

interface ReportConfig {
  id: ReportType;
  name: string;
  description: string;
  icon: typeof FileText;
  category: "medication" | "clinical" | "operations" | "compliance";
  color: string;
}

const REPORTS: ReportConfig[] = [
  { id: "medication_administration", name: "Medication Administration Report", description: "Full log of all medication administrations with status, staff, and timestamps", icon: Pill, category: "medication", color: "text-blue-600 bg-blue-50" },
  { id: "controlled_substances", name: "Controlled Substance Log", description: "DEA-compliant controlled substance count records with witness verification", icon: Shield, category: "medication", color: "text-purple-600 bg-purple-50" },
  { id: "medication_errors", name: "Medication Error Report", description: "All medication errors by type, severity, and resolution status", icon: AlertTriangle, category: "medication", color: "text-red-600 bg-red-50" },
  { id: "side_effects", name: "Side Effects Report", description: "Adverse reactions and side effects reported for all patients", icon: Activity, category: "clinical", color: "text-amber-600 bg-amber-50" },
  { id: "refusals", name: "Medication Refusal Report", description: "Patient medication refusals with reasons and physician notifications", icon: Clipboard, category: "clinical", color: "text-rose-600 bg-rose-50" },
  { id: "audit_trail", name: "Audit Trail Report", description: "Complete medication audit trail for regulatory compliance", icon: FileText, category: "compliance", color: "text-slate-600 bg-slate-50" },
  { id: "vital_signs", name: "Vital Signs Report", description: "Patient vital signs records — BP, heart rate, temperature, O2 saturation", icon: Activity, category: "clinical", color: "text-green-600 bg-green-50" },
  { id: "incident_summary", name: "Incident Summary Report", description: "All incidents by severity, category, and resolution status", icon: AlertTriangle, category: "operations", color: "text-orange-600 bg-orange-50" },
  { id: "patient_case_file", name: "Patient Case File", description: "Comprehensive patient record — medications, vitals, incidents, daily logs", icon: Users, category: "clinical", color: "text-teal-600 bg-teal-50" },
  { id: "staff_activity", name: "Staff Activity Report", description: "Staff shifts, time punches, and medication administration activity", icon: Clock, category: "operations", color: "text-indigo-600 bg-indigo-50" },
  { id: "daily_logs", name: "Daily Logs Report", description: "Patient daily observations — mood, appetite, sleep, activities, behaviors", icon: Clipboard, category: "clinical", color: "text-cyan-600 bg-cyan-50" },
  { id: "compliance_overview", name: "Compliance Overview", description: "Medication compliance rates, overdue meds, and safety dashboard metrics", icon: Shield, category: "compliance", color: "text-emerald-600 bg-emerald-50" },
  { id: "inventory", name: "Inventory & Refill Report", description: "Current medication inventory levels and stock movement history", icon: FileSpreadsheet, category: "medication", color: "text-violet-600 bg-violet-50" },
  { id: "physician_orders", name: "Physician Orders Report", description: "All physician orders — new, changes, and discontinuations", icon: FileText, category: "clinical", color: "text-sky-600 bg-sky-50" },
];

const CATEGORIES = [
  { id: "all", label: "All Reports" },
  { id: "medication", label: "Medication" },
  { id: "clinical", label: "Clinical" },
  { id: "operations", label: "Operations" },
  { id: "compliance", label: "Compliance" },
];

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "MMM d, yyyy h:mm a"); } catch { return d; }
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "MMM d, yyyy"); } catch { return d; }
}

export default function ReportsPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  const { data: patients } = useListPatients();
  const { data: staff } = useListStaff();
  const { data: medications } = useListMedications();
  const { data: administrations } = useListMedicationAdministrations();
  const { data: incidents } = useListIncidents();
  const { data: dailyLogs } = useListDailyLogs();
  const { data: shifts } = useListShifts();
  const { data: timePunches } = useListTimePunches();
  const { data: fraudAlerts } = useListFraudAlerts();
  const { data: medCounts } = useListMedicationCounts();
  const { data: medErrors } = useListMedicationErrors();
  const { data: inventory } = useListMedicationInventory();
  const { data: orders } = useListPhysicianOrders();
  const { data: vitals } = useListVitalSigns();
  const { data: sideEffects } = useListMedicationSideEffects();
  const { data: refusals } = useListMedicationRefusals();
  const { data: auditLog } = useListMedicationAuditLog();
  const { data: safetyDash } = useGetMedicationSafetyDashboard();

  const filtered = activeCategory === "all" ? REPORTS : REPORTS.filter((r) => r.category === activeCategory);

  const handleExport = (reportId: ReportType) => {
    switch (reportId) {
      case "medication_administration": {
        const headers = ["Date/Time", "Patient", "Medication", "Dosage", "Status", "Staff", "PRN Reason", "5 Rights", "Notes"];
        const rows = (administrations ?? []).map((a: any) => [
          fmt(a.administeredAt), a.patientName || "", a.medicationName || "", "",
          a.status || "", a.staffName || "", a.prnReason || "", a.fiveRightsVerified ? "Yes" : "No", a.notes || "",
        ]);
        downloadCSV("medication_administration_report", headers, rows);
        break;
      }
      case "controlled_substances": {
        const headers = ["Date", "Medication", "Staff", "Witness", "Count Before", "Count After", "Discrepancy", "Notes"];
        const rows = (medCounts ?? []).map((c: any) => [
          fmt(c.countedAt), c.medicationName || "", c.staffName || "", c.witnessName || "",
          String(c.countBefore ?? ""), String(c.countAfter ?? ""), String(c.discrepancy ?? ""), c.notes || "",
        ]);
        downloadCSV("controlled_substance_log", headers, rows);
        break;
      }
      case "medication_errors": {
        const headers = ["Date", "Patient", "Medication", "Error Type", "Severity", "Description", "Status", "Reported By"];
        const rows = (medErrors ?? []).map((e: any) => [
          fmt(e.occurredAt || e.createdAt), e.patientName || "", e.medicationName || "",
          e.errorType || "", e.severity || "", e.description || "", e.status || "", e.reportedByName || "",
        ]);
        downloadCSV("medication_error_report", headers, rows);
        break;
      }
      case "side_effects": {
        const headers = ["Date", "Patient", "Medication", "Side Effect", "Severity", "Resolved", "Notes"];
        const rows = (sideEffects ?? []).map((s: any) => [
          fmt(s.onsetTime || s.createdAt), s.patientName || `Patient #${s.patientId}`,
          s.medicationName || `Med #${s.medicationId}`, s.sideEffect || "", s.severity || "",
          s.resolved ? "Yes" : "No", s.notes || "",
        ]);
        downloadCSV("side_effects_report", headers, rows);
        break;
      }
      case "refusals": {
        const headers = ["Date", "Patient", "Medication", "Reason", "MD Notified", "Physician", "Follow-up Action"];
        const rows = (refusals ?? []).map((r: any) => [
          fmt(r.createdAt), r.patientName || `Patient #${r.patientId}`,
          r.medicationName || `Med #${r.medicationId}`, r.reason || "", r.physicianNotified ? "Yes" : "No",
          r.physicianName || "", r.followUpAction || "",
        ]);
        downloadCSV("medication_refusal_report", headers, rows);
        break;
      }
      case "audit_trail": {
        const headers = ["Date/Time", "Action", "Entity Type", "Entity ID", "Performed By", "Details", "Previous Value", "New Value"];
        const rows = (auditLog ?? []).map((a: any) => [
          fmt(a.createdAt), a.action || "", a.entityType || "", String(a.entityId ?? ""),
          a.performedByName || String(a.performedBy ?? ""), a.details || "",
          a.previousValue || "", a.newValue || "",
        ]);
        downloadCSV("audit_trail_report", headers, rows);
        break;
      }
      case "vital_signs": {
        const headers = ["Date/Time", "Patient", "Systolic BP", "Diastolic BP", "Heart Rate", "Temperature", "Resp Rate", "O2 Sat", "Pain Level", "Staff", "Notes"];
        const rows = (vitals ?? []).map((v: any) => [
          fmt(v.recordedAt), v.patientName || `Patient #${v.patientId}`,
          String(v.systolicBp ?? ""), String(v.diastolicBp ?? ""), String(v.heartRate ?? ""),
          String(v.temperature ?? ""), String(v.respiratoryRate ?? ""), String(v.oxygenSaturation ?? ""),
          String(v.painLevel ?? ""), v.staffName || "", v.notes || "",
        ]);
        downloadCSV("vital_signs_report", headers, rows);
        break;
      }
      case "incident_summary": {
        const headers = ["Date", "Title", "Severity", "Category", "Status", "Patient", "Home", "Reported By", "Description"];
        const rows = (incidents ?? []).map((i: any) => [
          fmt(i.occurredAt), i.title || "", i.severity || "", i.category || "", i.status || "",
          i.patientName || "", i.homeName || "", i.reportedByName || "", i.description || "",
        ]);
        downloadCSV("incident_summary_report", headers, rows);
        break;
      }
      case "patient_case_file": {
        const pid = selectedPatientId;
        const patient = patients?.find((p) => p.id === pid);
        if (!patient) return;
        const pMeds = (medications ?? []).filter((m: any) => m.patientId === pid);
        const pAdmins = (administrations ?? []).filter((a: any) => a.patientId === pid);
        const pVitals = (vitals ?? []).filter((v: any) => v.patientId === pid);
        const pLogs = (dailyLogs ?? []).filter((l: any) => l.patientId === pid);
        const pIncidents = (incidents ?? []).filter((i: any) => i.patientId === pid);
        const headers = ["Section", "Date", "Detail 1", "Detail 2", "Detail 3", "Notes"];
        const rows: string[][] = [
          ["PATIENT INFO", "", `${patient.firstName} ${patient.lastName}`, `DOB: ${fmtDate(patient.dateOfBirth)}`, `Diagnosis: ${(patient as any).diagnosis || ""}`, `Allergies: ${(patient as any).allergies || "None"}`],
          ...pMeds.map((m: any) => ["MEDICATION", fmtDate(m.startDate), m.name, m.dosage || "", m.frequency || "", m.prescribedBy || ""]),
          ...pAdmins.map((a: any) => ["ADMINISTRATION", fmt(a.administeredAt), a.medicationName || "", a.status || "", a.staffName || "", a.notes || ""]),
          ...pVitals.map((v: any) => ["VITALS", fmt(v.recordedAt), `BP: ${v.systolicBp ?? "-"}/${v.diastolicBp ?? "-"}`, `HR: ${v.heartRate ?? "-"}`, `Temp: ${v.temperature ?? "-"}`, v.notes || ""]),
          ...pLogs.map((l: any) => ["DAILY LOG", fmtDate(l.date), `Mood: ${l.mood || ""}`, `Sleep: ${l.sleep || ""}`, `Appetite: ${l.appetite || ""}`, l.notes || ""]),
          ...pIncidents.map((i: any) => ["INCIDENT", fmt(i.occurredAt), i.title || "", i.severity || "", i.status || "", i.description || ""]),
        ];
        downloadCSV(`patient_case_file_${patient.lastName}_${patient.firstName}`, headers, rows);
        break;
      }
      case "staff_activity": {
        const headers = ["Staff", "Date", "Shift Start", "Shift End", "Status", "Clock In", "Clock Out", "Administrations"];
        const rows = (staff ?? []).map((s: any) => {
          const sShifts = (shifts ?? []).filter((sh: any) => sh.staffId === s.id);
          const adminCount = (administrations ?? []).filter((a: any) => a.staffId === s.id).length;
          if (sShifts.length === 0) return [`${s.firstName} ${s.lastName}`, "", "", "", "", "", "", String(adminCount)];
          return sShifts.map((sh: any) => [
            `${s.firstName} ${s.lastName}`, fmtDate(sh.startTime), fmt(sh.startTime), fmt(sh.endTime), sh.status || "", "", "", String(adminCount),
          ]);
        }).flat();
        downloadCSV("staff_activity_report", headers, rows);
        break;
      }
      case "daily_logs": {
        const headers = ["Date", "Patient", "Mood", "Appetite", "Sleep", "Activities", "Behaviors", "Notes", "Staff"];
        const rows = (dailyLogs ?? []).map((l: any) => [
          fmtDate(l.date), l.patientName || "", l.mood || "", l.appetite || "", l.sleep || "",
          l.activities || "", l.behaviors || "", l.notes || "", l.staffName || "",
        ]);
        downloadCSV("daily_logs_report", headers, rows);
        break;
      }
      case "compliance_overview": {
        const headers = ["Metric", "Value"];
        const dash = safetyDash as any;
        const rows = [
          ["Compliance Rate", `${dash?.complianceRate ?? "N/A"}%`],
          ["Overdue Medications", String(dash?.overdueMeds ?? 0)],
          ["Open Errors", String(dash?.openErrors ?? 0)],
          ["Refills Needed", String(dash?.refillsNeeded ?? 0)],
          ["Today Administered", String(dash?.todayAdministered ?? 0)],
          ["Today Missed", String(dash?.todayMissed ?? 0)],
          ["Total Side Effects", String((sideEffects ?? []).length)],
          ["Total Refusals", String((refusals ?? []).length)],
          ["Total Audit Entries", String((auditLog ?? []).length)],
        ];
        downloadCSV("compliance_overview_report", headers, rows);
        break;
      }
      case "inventory": {
        const headers = ["Date", "Medication", "Change Type", "Quantity Change", "Performed By", "Notes"];
        const rows = (inventory ?? []).map((i: any) => [
          fmt(i.createdAt), i.medicationName || "", i.changeType || "",
          String(i.quantityChange ?? ""), i.performedByName || "", i.notes || "",
        ]);
        downloadCSV("inventory_report", headers, rows);
        break;
      }
      case "physician_orders": {
        const headers = ["Date", "Type", "Patient", "Medication", "Ordered By", "Status", "Details"];
        const rows = (orders ?? []).map((o: any) => [
          fmtDate(o.effectiveDate), o.type || "", o.patientName || "", o.medicationName || "",
          o.orderedBy || "", o.status || "", o.details || "",
        ]);
        downloadCSV("physician_orders_report", headers, rows);
        break;
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports Center</h2>
          <p className="text-muted-foreground">Generate, preview, and export reports across all system areas for auditing, compliance, and case files.</p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">
          <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
          {REPORTS.length} Report Types
        </Badge>
      </div>

      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {activeReport && (
        <ReportPreview
          reportId={activeReport}
          onClose={() => setActiveReport(null)}
          onExport={() => handleExport(activeReport)}
          administrations={administrations}
          medCounts={medCounts}
          medErrors={medErrors}
          sideEffects={sideEffects}
          refusals={refusals}
          auditLog={auditLog}
          vitals={vitals}
          incidents={incidents}
          dailyLogs={dailyLogs}
          safetyDash={safetyDash}
          inventory={inventory}
          orders={orders}
          patients={patients}
          selectedPatientId={selectedPatientId}
          onSelectPatient={setSelectedPatientId}
          medications={medications}
          staff={staff}
          shifts={shifts}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((report) => {
          const [textColor, bgColor] = report.color.split(" ");
          return (
            <Card
              key={report.id}
              className="cursor-pointer hover:shadow-md transition-shadow border"
              onClick={() => setActiveReport(report.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${bgColor}`}>
                    <report.icon className={`h-5 w-5 ${textColor}`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm">{report.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{report.description}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="secondary" className="text-xs capitalize">{report.category}</Badge>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleExport(report.id); }}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Download className="h-3 w-3" /> Export CSV
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ReportPreview({ reportId, onClose, onExport, administrations, medCounts, medErrors, sideEffects, refusals, auditLog, vitals, incidents, dailyLogs, safetyDash, inventory, orders, patients, selectedPatientId, onSelectPatient, medications, staff, shifts }: any) {
  const config = REPORTS.find((r) => r.id === reportId)!;
  const [textColor, bgColor] = config.color.split(" ");

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${bgColor}`}>
              <config.icon className={`h-5 w-5 ${textColor}`} />
            </div>
            <div>
              <CardTitle className="text-lg">{config.name}</CardTitle>
              <CardDescription>{config.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onExport} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button onClick={onClose} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted">
              Close
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {reportId === "patient_case_file" && (
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">Select a patient:</p>
            <div className="flex gap-2 flex-wrap">
              {(patients ?? []).map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => onSelectPatient(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedPatientId === p.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {p.firstName} {p.lastName}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="max-h-[400px] overflow-auto rounded-lg border">
          {reportId === "medication_administration" && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date/Time</TableHead><TableHead>Patient</TableHead><TableHead>Medication</TableHead><TableHead>Status</TableHead><TableHead>Staff</TableHead><TableHead>Notes</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(administrations ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No administration records</TableCell></TableRow>
                ) : (administrations ?? []).map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmt(a.administeredAt)}</TableCell>
                    <TableCell className="font-medium text-sm">{a.patientName}</TableCell>
                    <TableCell className="text-sm">{a.medicationName}</TableCell>
                    <TableCell><Badge variant={a.status === "given" ? "default" : "secondary"} className="capitalize text-xs">{a.status}</Badge></TableCell>
                    <TableCell className="text-sm">{a.staffName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{a.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {reportId === "controlled_substances" && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Medication</TableHead><TableHead>Staff</TableHead><TableHead>Witness</TableHead><TableHead>Before</TableHead><TableHead>After</TableHead><TableHead>Discrepancy</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(medCounts ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No controlled substance counts</TableCell></TableRow>
                ) : (medCounts ?? []).map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmt(c.countedAt)}</TableCell>
                    <TableCell className="font-medium text-sm">{c.medicationName}</TableCell>
                    <TableCell className="text-sm">{c.staffName}</TableCell>
                    <TableCell className="text-sm">{c.witnessName}</TableCell>
                    <TableCell>{c.countBefore}</TableCell>
                    <TableCell>{c.countAfter}</TableCell>
                    <TableCell><Badge variant={c.discrepancy !== 0 ? "destructive" : "secondary"}>{c.discrepancy}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {reportId === "medication_errors" && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Patient</TableHead><TableHead>Type</TableHead><TableHead>Severity</TableHead><TableHead>Status</TableHead><TableHead>Description</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(medErrors ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No medication errors</TableCell></TableRow>
                ) : (medErrors ?? []).map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmt(e.occurredAt || e.createdAt)}</TableCell>
                    <TableCell className="font-medium text-sm">{e.patientName}</TableCell>
                    <TableCell className="text-sm capitalize">{e.errorType?.replace(/_/g, " ")}</TableCell>
                    <TableCell><Badge variant={e.severity === "critical" ? "destructive" : "secondary"} className="capitalize">{e.severity}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{e.status}</Badge></TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{e.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {reportId === "side_effects" && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Side Effect</TableHead><TableHead>Severity</TableHead><TableHead>Resolved</TableHead><TableHead>Notes</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(sideEffects ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No side effects reported</TableCell></TableRow>
                ) : (sideEffects ?? []).map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmt(s.onsetTime || s.createdAt)}</TableCell>
                    <TableCell className="font-medium text-sm">{s.sideEffect}</TableCell>
                    <TableCell><Badge variant={s.severity === "severe" ? "destructive" : "secondary"} className="capitalize">{s.severity}</Badge></TableCell>
                    <TableCell>{s.resolved ? <Badge className="bg-green-100 text-green-800">Yes</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{s.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {reportId === "refusals" && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Reason</TableHead><TableHead>MD Notified</TableHead><TableHead>Physician</TableHead><TableHead>Follow-up</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(refusals ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No refusals</TableCell></TableRow>
                ) : (refusals ?? []).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmt(r.createdAt)}</TableCell>
                    <TableCell className="text-sm max-w-[250px] truncate">{r.reason}</TableCell>
                    <TableCell>{r.physicianNotified ? <Badge className="bg-green-100 text-green-800">Yes</Badge> : <Badge variant="destructive">No</Badge>}</TableCell>
                    <TableCell className="text-sm">{r.physicianName || "—"}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{r.followUpAction || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {reportId === "audit_trail" && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date/Time</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Performed By</TableHead><TableHead>Details</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(auditLog ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No audit entries</TableCell></TableRow>
                ) : (auditLog ?? []).map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmt(a.createdAt)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{(a.action || "").replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="text-sm capitalize">{(a.entityType || "").replace(/_/g, " ")} #{a.entityId}</TableCell>
                    <TableCell className="text-sm">{a.performedByName || `Staff #${a.performedBy}`}</TableCell>
                    <TableCell className="text-xs max-w-[250px] truncate">{a.details}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {reportId === "vital_signs" && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Patient</TableHead><TableHead>BP</TableHead><TableHead>HR</TableHead><TableHead>Temp</TableHead><TableHead>O2</TableHead><TableHead>Staff</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(vitals ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No vital signs recorded</TableCell></TableRow>
                ) : (vitals ?? []).map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmt(v.recordedAt)}</TableCell>
                    <TableCell className="font-medium text-sm">{v.patientName || `Patient #${v.patientId}`}</TableCell>
                    <TableCell className="text-sm">{v.systolicBp ?? "—"}/{v.diastolicBp ?? "—"}</TableCell>
                    <TableCell>{v.heartRate ?? "—"}</TableCell>
                    <TableCell>{v.temperature ?? "—"}</TableCell>
                    <TableCell>{v.oxygenSaturation ? `${v.oxygenSaturation}%` : "—"}</TableCell>
                    <TableCell className="text-sm">{v.staffName || ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {reportId === "incident_summary" && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Title</TableHead><TableHead>Severity</TableHead><TableHead>Category</TableHead><TableHead>Status</TableHead><TableHead>Patient</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(incidents ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No incidents</TableCell></TableRow>
                ) : (incidents ?? []).map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmt(i.occurredAt)}</TableCell>
                    <TableCell className="font-medium text-sm">{i.title}</TableCell>
                    <TableCell><Badge variant={i.severity === "high" || i.severity === "critical" ? "destructive" : "secondary"} className="capitalize">{i.severity}</Badge></TableCell>
                    <TableCell className="text-sm capitalize">{i.category}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{i.status}</Badge></TableCell>
                    <TableCell className="text-sm">{i.patientName || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {reportId === "patient_case_file" && (
            selectedPatientId ? (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Section</TableHead><TableHead>Date</TableHead><TableHead>Detail 1</TableHead><TableHead>Detail 2</TableHead><TableHead>Notes</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(() => {
                    const p = patients?.find((p: any) => p.id === selectedPatientId);
                    if (!p) return <TableRow><TableCell colSpan={5} className="text-center py-8">Patient not found</TableCell></TableRow>;
                    const pMeds = (medications ?? []).filter((m: any) => m.patientId === selectedPatientId);
                    const pAdmins = (administrations ?? []).filter((a: any) => a.patientId === selectedPatientId);
                    const pVitals = (vitals ?? []).filter((v: any) => v.patientId === selectedPatientId);
                    const rows: any[] = [
                      { section: "INFO", date: "", d1: `${p.firstName} ${p.lastName}`, d2: `DOB: ${fmtDate(p.dateOfBirth)}`, notes: `Dx: ${(p as any).diagnosis || ""}` },
                      ...pMeds.map((m: any) => ({ section: "MED", date: fmtDate(m.startDate), d1: m.name, d2: m.dosage, notes: m.prescribedBy })),
                      ...pAdmins.map((a: any) => ({ section: "ADMIN", date: fmt(a.administeredAt), d1: a.medicationName, d2: a.status, notes: a.notes || "" })),
                      ...pVitals.map((v: any) => ({ section: "VITALS", date: fmt(v.recordedAt), d1: `BP ${v.systolicBp ?? "-"}/${v.diastolicBp ?? "-"}`, d2: `HR ${v.heartRate ?? "-"}`, notes: "" })),
                    ];
                    return rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell><Badge variant="outline" className="text-xs">{r.section}</Badge></TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{r.date}</TableCell>
                        <TableCell className="text-sm">{r.d1}</TableCell>
                        <TableCell className="text-sm">{r.d2}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{r.notes}</TableCell>
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">Select a patient above to preview their case file</div>
            )
          )}

          {reportId === "staff_activity" && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Staff</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Shift Count</TableHead><TableHead>Administrations</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(staff ?? []).map((s: any) => {
                  const shiftCount = (shifts ?? []).filter((sh: any) => sh.staffId === s.id).length;
                  const adminCount = (administrations ?? []).filter((a: any) => a.staffId === s.id).length;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-sm">{s.firstName} {s.lastName}</TableCell>
                      <TableCell className="text-sm capitalize">{s.role}</TableCell>
                      <TableCell><Badge variant={s.status === "active" ? "default" : "secondary"} className="capitalize">{s.status}</Badge></TableCell>
                      <TableCell>{shiftCount}</TableCell>
                      <TableCell>{adminCount}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {reportId === "daily_logs" && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Patient</TableHead><TableHead>Mood</TableHead><TableHead>Sleep</TableHead><TableHead>Appetite</TableHead><TableHead>Notes</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(dailyLogs ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No daily logs</TableCell></TableRow>
                ) : (dailyLogs ?? []).map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(l.date)}</TableCell>
                    <TableCell className="font-medium text-sm">{l.patientName || ""}</TableCell>
                    <TableCell className="text-sm capitalize">{l.mood || "—"}</TableCell>
                    <TableCell className="text-sm capitalize">{l.sleep || "—"}</TableCell>
                    <TableCell className="text-sm capitalize">{l.appetite || "—"}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{l.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {reportId === "compliance_overview" && (
            <div className="p-6 space-y-4">
              {(() => {
                const dash = safetyDash as any;
                const metrics = [
                  { label: "Compliance Rate", value: `${dash?.complianceRate ?? "N/A"}%`, color: "text-green-700" },
                  { label: "Overdue Medications", value: dash?.overdueMeds ?? 0, color: "text-amber-700" },
                  { label: "Open Errors", value: dash?.openErrors ?? 0, color: "text-red-700" },
                  { label: "Refills Needed", value: dash?.refillsNeeded ?? 0, color: "text-blue-700" },
                  { label: "Today Administered", value: dash?.todayAdministered ?? 0, color: "text-green-700" },
                  { label: "Today Missed", value: dash?.todayMissed ?? 0, color: "text-red-700" },
                  { label: "Side Effects Reported", value: (sideEffects ?? []).length, color: "text-amber-700" },
                  { label: "Medication Refusals", value: (refusals ?? []).length, color: "text-rose-700" },
                  { label: "Audit Trail Entries", value: (auditLog ?? []).length, color: "text-slate-700" },
                ];
                return (
                  <div className="grid grid-cols-3 gap-4">
                    {metrics.map((m, i) => (
                      <div key={i} className="rounded-lg border p-4 text-center">
                        <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {reportId === "inventory" && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Medication</TableHead><TableHead>Change Type</TableHead><TableHead>Qty Change</TableHead><TableHead>Performed By</TableHead><TableHead>Notes</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(inventory ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No inventory changes</TableCell></TableRow>
                ) : (inventory ?? []).map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmt(i.createdAt)}</TableCell>
                    <TableCell className="font-medium text-sm">{i.medicationName || ""}</TableCell>
                    <TableCell className="text-sm capitalize">{(i.changeType || "").replace(/_/g, " ")}</TableCell>
                    <TableCell className="font-medium">{i.quantityChange > 0 ? `+${i.quantityChange}` : i.quantityChange}</TableCell>
                    <TableCell className="text-sm">{i.performedByName || ""}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{i.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {reportId === "physician_orders" && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Patient</TableHead><TableHead>Medication</TableHead><TableHead>Ordered By</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(orders ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No physician orders</TableCell></TableRow>
                ) : (orders ?? []).map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(o.effectiveDate)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{o.type}</Badge></TableCell>
                    <TableCell className="font-medium text-sm">{o.patientName}</TableCell>
                    <TableCell className="text-sm">{o.medicationName || "—"}</TableCell>
                    <TableCell className="text-sm">{o.orderedBy}</TableCell>
                    <TableCell><Badge variant={o.status === "pending" ? "secondary" : "outline"} className="capitalize">{o.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <span>Generated: {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</span>
          <span>BHOS Reports Center</span>
        </div>
      </CardContent>
    </Card>
  );
}
