import { useState } from "react";
import { useListHomes } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Plus, Home as HomeIcon, MapPin, Users, Map, List } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { HomesMap } from "@/components/HomesMap";

export default function HomesPage() {
  const { data: homes, isLoading } = useListHomes();
  const [view, setView] = useState<"list" | "map">("list");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">🏠 Homes</h2>
          <p className="text-muted-foreground">Manage all behavioral health facilities.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-input overflow-hidden">
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
            >
              <List className="h-4 w-4" />
              List
            </button>
            <button
              onClick={() => setView("map")}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${view === "map" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
            >
              <Map className="h-4 w-4" />
              Map
            </button>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Home
          </Button>
        </div>
      </div>

      {view === "map" && homes && homes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">📍 Facility Locations</CardTitle>
            <CardDescription>All group home locations on the map. Click a pin for details.</CardDescription>
          </CardHeader>
          <CardContent>
            <HomesMap homes={homes as any} />
          </CardContent>
        </Card>
      )}

      {view === "map" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {homes?.map((home) => {
            const occupancyRate = (home.currentOccupancy / home.capacity) * 100;
            return (
              <Link key={home.id} href={`/homes/${home.id}`} className="block">
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🏠</span>
                        <div>
                          <p className="font-semibold">{home.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {home.city}, {home.state}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={home.status} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1">
                          🛏️ {home.currentOccupancy} / {home.capacity} beds
                        </span>
                        <span className="font-medium">{occupancyRate.toFixed(0)}%</span>
                      </div>
                      <Progress value={occupancyRate} className={occupancyRate >= 100 ? "bg-destructive/20 [&>div]:bg-destructive" : ""} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {view === "list" && <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Facility</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[200px]">Occupancy</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : homes?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No homes found.
                  </TableCell>
                </TableRow>
              ) : (
                homes?.map((home) => {
                  const occupancyRate = (home.currentOccupancy / home.capacity) * 100;
                  return (
                    <TableRow key={home.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                            <HomeIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">{home.name}</p>
                            <p className="text-xs text-muted-foreground">{home.phone}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {home.city}, {home.state}
                        </div>
                        <p className="text-xs text-muted-foreground ml-4">{home.region}</p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={home.status} />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {home.currentOccupancy} / {home.capacity}
                            </span>
                            <span className="font-medium">{occupancyRate.toFixed(0)}%</span>
                          </div>
                          <Progress value={occupancyRate} className={occupancyRate >= 100 ? "bg-destructive/20 [&>div]:bg-destructive" : ""} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/homes/${home.id}`} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3">
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none font-normal">Active</Badge>;
    case 'inactive':
      return <Badge variant="secondary" className="font-normal text-muted-foreground">Inactive</Badge>;
    case 'maintenance':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none font-normal">Maintenance</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
