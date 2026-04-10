import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LifeBuoy, Plus, MessageSquare, Clock, CheckCircle2, AlertCircle,
  ChevronRight, Send, ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;

interface Ticket {
  id: number;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  messages?: TicketMessage[];
}

interface TicketMessage {
  id: number;
  senderType: string;
  senderName: string;
  message: string;
  createdAt: string;
}

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  open: { color: "bg-blue-100 text-blue-700", icon: AlertCircle, label: "Open" },
  in_progress: { color: "bg-amber-100 text-amber-700", icon: Clock, label: "In Progress" },
  waiting: { color: "bg-purple-100 text-purple-700", icon: Clock, label: "Waiting" },
  resolved: { color: "bg-green-100 text-green-700", icon: CheckCircle2, label: "Resolved" },
  closed: { color: "bg-gray-100 text-gray-700", icon: CheckCircle2, label: "Closed" },
};

const priorityConfig: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-600",
  high: "bg-orange-100 text-orange-600",
  urgent: "bg-red-100 text-red-600",
};

const categoryLabels: Record<string, string> = {
  general: "General",
  technical: "Technical Issue",
  billing: "Billing",
  feature_request: "Feature Request",
  bug: "Bug Report",
  account: "Account Help",
};

function CreateTicketDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({
    subject: "", description: "", category: "general", priority: "medium",
  });

  const mutation = useMutation({
    mutationFn: () => fetch(`${API}/support-tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      toast({ title: "Ticket submitted successfully" });
      setOpen(false);
      setForm({ subject: "", description: "", category: "general", priority: "medium" });
      onSuccess();
    },
    onError: () => toast({ title: "Failed to submit ticket", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />New Ticket</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Submit Support Ticket</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
          <div>
            <Label>Subject *</Label>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Brief description of your issue" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Description *</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe your issue in detail. Include any steps to reproduce, error messages, or screenshots."
              rows={5}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || !form.subject || !form.description}>
              {mutation.isPending ? "Submitting..." : "Submit Ticket"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TicketDetail({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  const [newMessage, setNewMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: ticket, isLoading } = useQuery<Ticket>({
    queryKey: ["support-ticket", ticketId],
    queryFn: () => fetch(`${API}/support-tickets/${ticketId}`).then(r => r.json()),
  });

  const sendMessage = useMutation({
    mutationFn: () => fetch(`${API}/support-tickets/${ticketId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: newMessage }),
    }).then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
    },
    onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
  });

  if (isLoading || !ticket) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  const sc = statusConfig[ticket.status] || statusConfig.open;

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" />Back to Tickets
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{ticket.subject}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Ticket #{ticket.id} — opened by {ticket.createdByName} on {new Date(ticket.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge className={priorityConfig[ticket.priority] || ""}>{ticket.priority}</Badge>
              <Badge className={sc.color}>{sc.label}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Badge variant="outline" className="mb-3">{categoryLabels[ticket.category] || ticket.category}</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticket.messages?.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded-lg ${msg.senderType === "admin" ? "bg-primary/5 border-l-4 border-primary" : "bg-muted"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">
                  {msg.senderName}
                  {msg.senderType === "admin" && (
                    <Badge variant="secondary" className="ml-2 text-xs">BHOS Support</Badge>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(msg.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
            </div>
          ))}

          {ticket.status !== "resolved" && ticket.status !== "closed" && (
            <form
              onSubmit={(e) => { e.preventDefault(); if (newMessage.trim()) sendMessage.mutate(); }}
              className="flex gap-2 pt-3 border-t"
            >
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your reply..."
                rows={2}
                className="flex-1"
              />
              <Button type="submit" size="sm" disabled={!newMessage.trim() || sendMessage.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SupportPage() {
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ["support-tickets"],
    queryFn: () => fetch(`${API}/support-tickets`).then(r => r.json()),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["support-tickets"] });

  if (selectedTicketId) {
    return (
      <div className="space-y-6">
        <TicketDetail ticketId={selectedTicketId} onBack={() => setSelectedTicketId(null)} />
      </div>
    );
  }

  const openCount = tickets.filter(t => t.status === "open").length;
  const inProgressCount = tickets.filter(t => t.status === "in_progress").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            🎫 Support Center
          </h1>
          <p className="text-muted-foreground mt-1">Submit and track support requests</p>
        </div>
        <CreateTicketDialog onSuccess={refresh} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">Total Tickets</p>
            <p className="text-2xl font-bold">{tickets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">Open</p>
            <p className="text-2xl font-bold text-blue-600">{openCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold text-amber-600">{inProgressCount}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">Loading tickets...</div>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LifeBuoy className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-medium">No support tickets yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Click "New Ticket" to submit a support request</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => {
            const sc = statusConfig[ticket.status] || statusConfig.open;
            return (
              <Card
                key={ticket.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedTicketId(ticket.id)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{ticket.subject}</span>
                        <Badge variant="outline" className="text-xs">{categoryLabels[ticket.category] || ticket.category}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>#{ticket.id}</span>
                        <span>by {ticket.createdByName}</span>
                        <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge className={priorityConfig[ticket.priority] || ""}>{ticket.priority}</Badge>
                      <Badge className={sc.color}>{sc.label}</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
