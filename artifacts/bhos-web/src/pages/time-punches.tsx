import { useListTimePunches } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, MapPin, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function TimePunchesPage() {
  const { data: punches, isLoading } = useListTimePunches();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Time Punches</h2>
        <p className="text-muted-foreground">GPS-verified clock-in and clock-out records.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Punches
          </CardTitle>
          <CardDescription>All time punches with GPS verification status</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Home</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>GPS Status</TableHead>
                <TableHead>Distance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !punches?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No time punches recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                punches.map((punch) => (
                  <TableRow key={punch.id}>
                    <TableCell className="font-medium">{punch.staffName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{punch.homeName}</TableCell>
                    <TableCell>
                      {punch.type === "clock_in" ? (
                        <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50" variant="outline">
                          Clock In
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50" variant="outline">
                          Clock Out
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(punch.punchTime), "MMM d, h:mm a")}
                    </TableCell>
                    <TableCell>
                      {punch.isWithinGeofence === null ? (
                        <span className="text-xs text-muted-foreground">No GPS</span>
                      ) : punch.isWithinGeofence ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm">Verified</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm">Off-Site</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {punch.distanceFromHome != null ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {Number(punch.distanceFromHome).toFixed(0)}m
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
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
