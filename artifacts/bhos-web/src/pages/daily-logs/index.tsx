import { useListDailyLogs } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Activity, UserSquare, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Link } from "wouter";

export default function DailyLogsPage() {
  const { data: logs, isLoading } = useListDailyLogs();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Daily Behavioral Logs</h2>
          <p className="text-muted-foreground">Patient observation logs across all facilities.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Create Log
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Mood</TableHead>
                <TableHead>Appetite / Sleep</TableHead>
                <TableHead>Logged By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No daily logs found.
                  </TableCell>
                </TableRow>
              ) : (
                logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium text-sm">
                      {format(new Date(log.date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Link href={`/patients/${log.patientId}`} className="flex items-center gap-1.5 text-sm font-medium hover:underline">
                        <UserSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        {log.patientName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <MoodBadge mood={log.mood} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 text-xs">
                        <span className="text-muted-foreground">Appetite:</span> <span className="font-medium capitalize">{log.appetite}</span>
                        <span className="text-muted-foreground ml-2">Sleep:</span> <span className="font-medium capitalize">{log.sleep}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link href={`/staff/${log.staffId}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                        <Users className="h-3 w-3" />
                        {log.staffName}
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
