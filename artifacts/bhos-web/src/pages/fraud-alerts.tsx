import { useListFraudAlerts, useUpdateFraudAlert } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert, MapPin, Clock, Users, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function FraudAlertsPage() {
  const { data: alerts, isLoading } = useListFraudAlerts();
  const updateAlert = useUpdateFraudAlert();
  const queryClient = useQueryClient();

  const handleUpdateStatus = (id: number, status: "reviewed" | "dismissed") => {
    updateAlert.mutate(
      { id, data: { status } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/fraud-alerts"] }) }
    );
  };

  const openAlerts = alerts?.filter((a) => a.status === "open") || [];
  const resolvedAlerts = alerts?.filter((a) => a.status !== "open") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Fraud Detection</h2>
          <p className="text-muted-foreground">Monitor and investigate suspicious time-clock activity.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="text-sm px-3 py-1">
            {openAlerts.length} Open Alert{openAlerts.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          title="Off-Site Clock-ins"
          value={alerts?.filter((a) => a.alertType === "off_site_clock_in").length ?? 0}
          icon={MapPin}
          color="text-red-600 bg-red-50"
        />
        <StatCard
          title="Overlapping Shifts"
          value={alerts?.filter((a) => a.alertType === "overlapping_shift").length ?? 0}
          icon={Clock}
          color="text-orange-600 bg-orange-50"
        />
        <StatCard
          title="Rapid Punches"
          value={alerts?.filter((a) => a.alertType === "rapid_punch").length ?? 0}
          icon={AlertTriangle}
          color="text-amber-600 bg-amber-50"
        />
        <StatCard
          title="Ghost Employees"
          value={alerts?.filter((a) => a.alertType === "ghost_employee").length ?? 0}
          icon={Users}
          color="text-purple-600 bg-purple-50"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Open Alerts
          </CardTitle>
          <CardDescription>Alerts requiring investigation</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Home</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Time</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : openAlerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No open fraud alerts. All clear!
                  </TableCell>
                </TableRow>
              ) : (
                openAlerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell><AlertTypeBadge type={alert.alertType} /></TableCell>
                    <TableCell><SeverityBadge severity={alert.severity} /></TableCell>
                    <TableCell className="font-medium">{alert.staffName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{alert.homeName}</TableCell>
                    <TableCell className="max-w-[300px] text-sm truncate">{alert.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(alert.createdAt), "MMM d, h:mm a")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-green-600 hover:text-green-700"
                          onClick={() => handleUpdateStatus(alert.id, "reviewed")}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Review
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-muted-foreground"
                          onClick={() => handleUpdateStatus(alert.id, "dismissed")}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Dismiss
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {resolvedAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resolved Alerts</CardTitle>
            <CardDescription>{resolvedAlerts.length} alert{resolvedAlerts.length !== 1 ? "s" : ""} reviewed or dismissed</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resolved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedAlerts.map((alert) => (
                  <TableRow key={alert.id} className="opacity-60">
                    <TableCell><AlertTypeBadge type={alert.alertType} /></TableCell>
                    <TableCell><SeverityBadge severity={alert.severity} /></TableCell>
                    <TableCell className="font-medium">{alert.staffName}</TableCell>
                    <TableCell className="max-w-[300px] text-sm truncate">{alert.description}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{alert.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {alert.reviewedAt ? format(new Date(alert.reviewedAt), "MMM d, h:mm a") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

function AlertTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; className: string }> = {
    off_site_clock_in: { label: "Off-Site", className: "bg-red-50 text-red-700 border-red-200" },
    overlapping_shift: { label: "Overlap", className: "bg-orange-50 text-orange-700 border-orange-200" },
    rapid_punch: { label: "Rapid Punch", className: "bg-amber-50 text-amber-700 border-amber-200" },
    ghost_employee: { label: "Ghost", className: "bg-purple-50 text-purple-700 border-purple-200" },
    excessive_overtime: { label: "Overtime", className: "bg-blue-50 text-blue-700 border-blue-200" },
  };
  const info = map[type] || { label: type, className: "" };
  return <Badge variant="outline" className={info.className}>{info.label}</Badge>;
}

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case "critical":
      return <Badge className="bg-red-600 text-white hover:bg-red-600">Critical</Badge>;
    case "high":
      return <Badge className="bg-orange-500 text-white hover:bg-orange-500">High</Badge>;
    case "medium":
      return <Badge className="bg-amber-400 text-white hover:bg-amber-400">Medium</Badge>;
    case "low":
      return <Badge variant="secondary">Low</Badge>;
    default:
      return <Badge variant="outline">{severity}</Badge>;
  }
}
