import { useGetDashboardSummary, useGetIncidentTrends, useGetMedicationCompliance, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Home, Users, UserSquare, AlertTriangle, Pill, CalendarClock, Activity as Pulse } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: trends, isLoading: loadingTrends } = useGetIncidentTrends();
  const { data: compliance, isLoading: loadingCompliance } = useGetMedicationCompliance();
  const { data: activity, isLoading: loadingActivity } = useGetRecentActivity();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Homes" value={summary?.totalHomes} icon={Home} loading={loadingSummary} />
        <MetricCard title="Total Patients" value={summary?.totalPatients} icon={UserSquare} loading={loadingSummary} />
        <MetricCard title="Total Staff" value={summary?.totalStaff} icon={Users} loading={loadingSummary} />
        <MetricCard title="Active Incidents" value={summary?.activeIncidents} icon={AlertTriangle} loading={loadingSummary} valueClass="text-destructive" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-7">
        <Card className="col-span-1 lg:col-span-4">
          <CardHeader>
            <CardTitle>Incident Trends (Last 30 Days)</CardTitle>
            <CardDescription>Frequency and severity of reported incidents</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTrends ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => format(new Date(val), "MMM d")} 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                      labelFormatter={(val) => format(new Date(val), "MMM d, yyyy")}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="bySeverity.critical" name="Critical" stroke="hsl(var(--destructive))" fillOpacity={1} fill="url(#colorCritical)" />
                    <Area type="monotone" dataKey="bySeverity.high" name="High" stroke="hsl(var(--chart-4))" fillOpacity={1} fill="url(#colorHigh)" />
                    <Area type="monotone" dataKey="bySeverity.medium" name="Medium" stroke="hsl(var(--chart-2))" fill="transparent" />
                    <Area type="monotone" dataKey="bySeverity.low" name="Low" stroke="hsl(var(--primary))" fill="transparent" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 lg:col-span-3">
          <CardHeader>
            <CardTitle>Medication Compliance</CardTitle>
            <CardDescription>Administration rates by home</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCompliance ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compliance} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis 
                      type="category" 
                      dataKey="homeName" 
                      width={120}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      formatter={(val: number) => [`${val.toFixed(1)}%`, 'Compliance']}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                    />
                    <Bar dataKey="complianceRate" name="Compliance Rate" radius={[0, 4, 4, 0]}>
                      {
                        compliance?.map((entry, index) => (
                          <cell key={`cell-${index}`} fill={entry.complianceRate < 90 ? "hsl(var(--destructive))" : entry.complianceRate < 95 ? "hsl(var(--chart-4))" : "hsl(var(--primary))"} />
                        ))
                      }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingActivity ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {activity?.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="mt-1 flex-shrink-0">
                        <ActivityIcon type={item.type} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{item.title}</p>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.timestamp), "MMM d, h:mm a")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                        {item.homeName && (
                          <Badge variant="secondary" className="mt-2 font-normal text-xs">{item.homeName}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!activity || activity.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingSummary ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <>
                <div className="flex items-center p-4 border rounded-lg bg-card hover:bg-accent/10 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-4">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Active Shifts</p>
                    <p className="text-sm text-muted-foreground">Scheduled for today</p>
                  </div>
                  <div className="text-2xl font-bold">{summary?.todayShifts || 0}</div>
                </div>

                <div className="flex items-center p-4 border rounded-lg bg-card hover:bg-accent/10 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mr-4">
                    <Pill className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Medications Due</p>
                    <p className="text-sm text-muted-foreground">To be administered today</p>
                  </div>
                  <div className="text-2xl font-bold">{summary?.medicationsDueToday || 0}</div>
                </div>

                <div className="flex items-center p-4 border rounded-lg bg-card hover:bg-accent/10 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-4">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Overall Compliance</p>
                    <p className="text-sm text-muted-foreground">Across all facilities</p>
                  </div>
                  <div className="text-2xl font-bold">{summary?.complianceRate ? `${summary.complianceRate.toFixed(1)}%` : '0%'}</div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, loading, valueClass = "" }: any) {
  return (
    <Card>
      <CardContent className="p-6 flex flex-row items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className={`text-3xl font-bold tracking-tight ${valueClass}`}>{value || 0}</p>
          )}
        </div>
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case 'incident': return <div className="h-8 w-8 rounded-full bg-destructive/20 text-destructive flex items-center justify-center"><AlertTriangle className="h-4 w-4" /></div>;
    case 'medication': return <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Pill className="h-4 w-4" /></div>;
    case 'daily_log': return <div className="h-8 w-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><Pulse className="h-4 w-4" /></div>;
    case 'shift': return <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center"><CalendarClock className="h-4 w-4" /></div>;
    case 'patient': return <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center"><UserSquare className="h-4 w-4" /></div>;
    case 'staff': return <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center"><Users className="h-4 w-4" /></div>;
    default: return <div className="h-8 w-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center"><Activity className="h-4 w-4" /></div>;
  }
}
