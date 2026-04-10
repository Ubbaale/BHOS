import { useListShifts } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarClock, Home as HomeIcon, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInHours, parseISO } from "date-fns";
import { Link } from "wouter";

export default function ShiftsPage() {
  const { data: shifts, isLoading } = useListShifts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Shift Schedule</h2>
          <p className="text-muted-foreground">Staff scheduling across all facilities.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Schedule Shift
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Staff Member</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : shifts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No shifts scheduled.
                  </TableCell>
                </TableRow>
              ) : (
                shifts?.map((shift) => {
                  const start = parseISO(shift.startTime);
                  const end = parseISO(shift.endTime);
                  const duration = differenceInHours(end, start);
                  
                  return (
                    <TableRow key={shift.id}>
                      <TableCell className="font-medium text-sm">
                        {format(start, "EEE, MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                          {format(start, "h:mm a")} - {format(end, "h:mm a")}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {duration} hrs
                      </TableCell>
                      <TableCell>
                        <Link href={`/staff/${shift.staffId}`} className="flex items-center gap-1.5 text-sm font-medium hover:underline">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {shift.staffName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <HomeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          {shift.homeName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={shift.status} />
                      </TableCell>
                    </TableRow>
                  );
                })
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
    case 'scheduled':
      return <Badge variant="outline" className="font-normal text-blue-600 border-blue-200 bg-blue-50">Scheduled</Badge>;
    case 'in_progress':
      return <Badge className="bg-primary text-primary-foreground font-normal">In Progress</Badge>;
    case 'completed':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none font-normal">Completed</Badge>;
    case 'cancelled':
      return <Badge variant="secondary" className="font-normal text-muted-foreground">Cancelled</Badge>;
    case 'no_show':
      return <Badge variant="destructive" className="font-normal">No Show</Badge>;
    default:
      return <Badge variant="outline" className="capitalize">{status.replace('_', ' ')}</Badge>;
  }
}
