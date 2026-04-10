import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Video, Plus, Users, Clock, Calendar, Link2, ExternalLink } from "lucide-react";

const BASE = import.meta.env.BASE_URL;
function fetchApi(path: string, opts?: RequestInit) {
  return fetch(`${BASE}api${path}`, { credentials: "include", ...opts }).then(r => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });
}

const MEETING_TYPES = [
  { value: "team", label: "Team Meeting" },
  { value: "clinical", label: "Clinical Review" },
  { value: "family", label: "Family Conference" },
  { value: "supervision", label: "Staff Supervision" },
  { value: "training", label: "Training Session" },
  { value: "admin", label: "Admin/Management" },
  { value: "emergency", label: "Emergency Meeting" },
];

const PROVIDERS = [
  { value: "zoom", label: "Zoom" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "google_meet", label: "Google Meet" },
  { value: "internal", label: "In-Person" },
  { value: "phone", label: "Phone Call" },
];

function statusColor(status: string) {
  switch (status) {
    case "scheduled": return "bg-blue-100 text-blue-800";
    case "in_progress": return "bg-green-100 text-green-800";
    case "completed": return "bg-gray-100 text-gray-800";
    case "canceled": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

export default function MeetingsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const qc = useQueryClient();

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["meetings", filter],
    queryFn: () => fetchApi(`/meetings${filter === "upcoming" ? "?upcoming=true" : ""}`),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-list"],
    queryFn: () => fetchApi("/staff"),
  });

  const createMeeting = useMutation({
    mutationFn: (data: any) => fetchApi("/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setShowCreate(false);
    },
  });

  const updateMeeting = useMutation({
    mutationFn: ({ id, ...data }: any) => fetchApi(`/meetings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });

  const rsvpMeeting = useMutation({
    mutationFn: ({ meetingId, status }: { meetingId: number; status: string }) =>
      fetchApi(`/meetings/${meetingId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });

  const [form, setForm] = useState({
    title: "", description: "", meetingType: "team", meetingProvider: "zoom",
    meetingLink: "", startTime: "", endTime: "", notes: "", attendeeIds: [] as number[],
  });

  const todayMeetings = meetings.filter((m: any) => {
    const d = new Date(m.startTime);
    const today = new Date();
    return d.toDateString() === today.toDateString() && m.status !== "canceled";
  });

  const upcomingMeetings = meetings.filter((m: any) => {
    const d = new Date(m.startTime);
    return d > new Date() && m.status === "scheduled";
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="h-6 w-6" />
            Meetings
          </h1>
          <p className="text-muted-foreground">Schedule and manage team meetings, clinical reviews, and family conferences</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Schedule Meeting</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Schedule New Meeting</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Meeting Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              <Textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <Select value={form.meetingType} onValueChange={v => setForm(f => ({ ...f, meetingType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MEETING_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Platform</label>
                  <Select value={form.meetingProvider} onValueChange={v => setForm(f => ({ ...f, meetingProvider: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.meetingProvider !== "internal" && (
                <Input placeholder="Meeting Link (e.g., https://zoom.us/j/123456)" value={form.meetingLink} onChange={e => setForm(f => ({ ...f, meetingLink: e.target.value }))} />
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Start Time</label>
                  <Input type="datetime-local" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium">End Time</label>
                  <Input type="datetime-local" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>
              </div>
              <Textarea placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              <Button
                className="w-full"
                disabled={!form.title || !form.startTime || !form.endTime || createMeeting.isPending}
                onClick={() => createMeeting.mutate({
                  ...form,
                  attendees: form.attendeeIds.map(id => ({ staffId: id })),
                })}
              >
                {createMeeting.isPending ? "Scheduling..." : "Schedule Meeting"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-3 rounded-lg"><Calendar className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{todayMeetings.length}</p>
                <p className="text-sm text-muted-foreground">Today's Meetings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-3 rounded-lg"><Clock className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-2xl font-bold">{upcomingMeetings.length}</p>
                <p className="text-sm text-muted-foreground">Upcoming</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-3 rounded-lg"><Video className="h-5 w-5 text-purple-600" /></div>
              <div>
                <p className="text-2xl font-bold">{meetings.length}</p>
                <p className="text-sm text-muted-foreground">Total Meetings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        {["all", "upcoming"].map(f => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {f === "all" ? "All Meetings" : "Upcoming"}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : meetings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Meetings Scheduled</h3>
            <p className="text-muted-foreground mb-4">Schedule your first team meeting to get started.</p>
            <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Schedule Meeting</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting: any) => (
            <Card key={meeting.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{meeting.title}</h3>
                      <Badge className={statusColor(meeting.status)}>{meeting.status}</Badge>
                      <Badge variant="outline">{MEETING_TYPES.find(t => t.value === meeting.meetingType)?.label || meeting.meetingType}</Badge>
                    </div>
                    {meeting.description && <p className="text-sm text-muted-foreground mb-2">{meeting.description}</p>}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(meeting.startTime).toLocaleString()} - {new Date(meeting.endTime).toLocaleTimeString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {meeting.organizerName}
                      </span>
                      {meeting.attendees?.length > 0 && (
                        <span>{meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? "s" : ""}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Video className="h-3.5 w-3.5" />
                        {PROVIDERS.find(p => p.value === meeting.meetingProvider)?.label || meeting.meetingProvider}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {meeting.meetingLink && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          Join
                        </a>
                      </Button>
                    )}
                    {meeting.status === "scheduled" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => updateMeeting.mutate({ id: meeting.id, status: "in_progress" })}>
                          Start
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => updateMeeting.mutate({ id: meeting.id, status: "canceled" })}>
                          Cancel
                        </Button>
                      </>
                    )}
                    {meeting.status === "in_progress" && (
                      <Button size="sm" onClick={() => updateMeeting.mutate({ id: meeting.id, status: "completed" })}>
                        End Meeting
                      </Button>
                    )}
                    {meeting.status === "scheduled" && (
                      <div className="flex gap-1 ml-2 border-l pl-2">
                        <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => rsvpMeeting.mutate({ meetingId: meeting.id, status: "accepted" })} disabled={rsvpMeeting.isPending}>
                          Accept
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => rsvpMeeting.mutate({ meetingId: meeting.id, status: "declined" })} disabled={rsvpMeeting.isPending}>
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
