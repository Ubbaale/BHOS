import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, CheckCircle, XCircle, ExternalLink, RefreshCw, Clock } from "lucide-react";

const BASE = import.meta.env.BASE_URL;
function fetchApi(path: string, opts?: RequestInit) {
  return fetch(`${BASE}api${path}`, { credentials: "include", ...opts }).then(r => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });
}

export default function CalendarSyncPage() {
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ["calendar-status"],
    queryFn: () => fetchApi("/calendar/status"),
  });

  const { data: events = [], isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: () => fetchApi("/calendar/events"),
    enabled: status?.connected,
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings"],
    queryFn: () => fetchApi("/meetings?upcoming=true"),
    enabled: status?.connected,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => fetchApi("/appointments"),
    enabled: status?.connected,
  });

  const syncMeeting = useMutation({
    mutationFn: (meetingId: number) => fetchApi("/calendar/sync-meeting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId }),
    }),
    onSuccess: () => refetchEvents(),
  });

  const syncAppointment = useMutation({
    mutationFn: (appointmentId: number) => fetchApi("/calendar/sync-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId }),
    }),
    onSuccess: () => refetchEvents(),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            Calendar Sync
          </h1>
          <p className="text-muted-foreground">Sync meetings and appointments with Google Calendar</p>
        </div>
        <Button variant="outline" onClick={() => { refetchStatus(); refetchEvents(); }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connection Status</CardTitle>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
          ) : status?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Google Calendar Connected</span>
              </div>
              {status.calendars?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Available Calendars:</p>
                  <div className="flex flex-wrap gap-2">
                    {status.calendars.map((cal: any) => (
                      <Badge key={cal.id} variant={cal.primary ? "default" : "outline"}>
                        {cal.summary} {cal.primary ? "(Primary)" : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <span>Google Calendar not connected. Please connect it from Integrations.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {status?.connected && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">BHOS Meetings</CardTitle>
              </CardHeader>
              <CardContent>
                {meetings.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No upcoming meetings to sync.</p>
                ) : (
                  <div className="space-y-3">
                    {meetings.slice(0, 10).map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between border rounded-lg p-3">
                        <div>
                          <p className="font-medium text-sm">{m.title}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(m.startTime).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncMeeting.mutate(m.id)}
                          disabled={syncMeeting.isPending}
                        >
                          <CalendarDays className="h-3.5 w-3.5 mr-1" />
                          Sync
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">BHOS Appointments</CardTitle>
              </CardHeader>
              <CardContent>
                {appointments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No appointments to sync.</p>
                ) : (
                  <div className="space-y-3">
                    {appointments.slice(0, 10).map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between border rounded-lg p-3">
                        <div>
                          <p className="font-medium text-sm">{a.appointmentType} - {a.provider || "Provider"}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(a.scheduledAt).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncAppointment.mutate(a.id)}
                          disabled={syncAppointment.isPending}
                        >
                          <CalendarDays className="h-3.5 w-3.5 mr-1" />
                          Sync
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Google Calendar Events (Next 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              ) : events.length === 0 ? (
                <p className="text-muted-foreground text-sm">No upcoming events on your Google Calendar.</p>
              ) : (
                <div className="space-y-2">
                  {events.slice(0, 20).map((event: any) => (
                    <div key={event.id} className="flex items-center justify-between border rounded-lg p-3">
                      <div>
                        <p className="font-medium text-sm">{event.summary}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.start?.dateTime
                            ? new Date(event.start.dateTime).toLocaleString()
                            : event.start?.date || "All day"}
                          {event.end?.dateTime && ` - ${new Date(event.end.dateTime).toLocaleTimeString()}`}
                        </p>
                        {event.location && (
                          <p className="text-xs text-muted-foreground">{event.location}</p>
                        )}
                      </div>
                      {event.htmlLink && (
                        <Button size="sm" variant="ghost" asChild>
                          <a href={event.htmlLink} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
