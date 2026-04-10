import { useListIncidents } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle, Home as HomeIcon, UserSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Link } from "wouter";

export default function IncidentsPage() {
  const { data: incidents, isLoading } = useListIncidents();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Incident Reports</h2>
          <p className="text-muted-foreground">Track and manage all facility incidents.</p>
        </div>
        <Button className="gap-2" variant="destructive">
          <Plus className="h-4 w-4" />
          Report Incident
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Date/Time</TableHead>
                <TableHead>Incident</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Severity & Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : incidents?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No incidents reported.
                  </TableCell>
                </TableRow>
              ) : (
                incidents?.map((incident) => (
                  <TableRow key={incident.id}>
                    <TableCell className="text-sm">
                      <div className="font-medium">{format(new Date(incident.occurredAt), "MMM d")}</div>
                      <div className="text-muted-foreground text-xs">{format(new Date(incident.occurredAt), "h:mm a")}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{incident.title}</div>
                      {incident.patientName && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <UserSquare className="h-3 w-3" />
                          {incident.patientName}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <HomeIcon className="h-3 w-3 text-muted-foreground" />
                        {incident.homeName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <SeverityBadge severity={incident.severity} />
                        <Badge variant="outline" className="capitalize text-xs font-normal">{incident.category}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={incident.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">Review</Button>
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

function SeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case 'critical':
      return <Badge variant="destructive" className="uppercase text-[10px] tracking-wider">Critical</Badge>;
    case 'high':
      return <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600 uppercase text-[10px] tracking-wider">High</Badge>;
    case 'medium':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none uppercase text-[10px] tracking-wider">Medium</Badge>;
    case 'low':
      return <Badge variant="outline" className="uppercase text-[10px] tracking-wider font-medium text-muted-foreground">Low</Badge>;
    default:
      return <Badge variant="outline">{severity}</Badge>;
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'open':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-none font-normal">Open</Badge>;
    case 'investigating':
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none font-normal">Investigating</Badge>;
    case 'resolved':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none font-normal">Resolved</Badge>;
    case 'closed':
      return <Badge variant="secondary" className="font-normal text-muted-foreground">Closed</Badge>;
    default:
      return <Badge variant="outline" className="capitalize">{status}</Badge>;
  }
}
