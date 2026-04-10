import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, Send, Plus, AlertCircle, Clock, User, Users, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;

function fetchApi(url: string, opts?: RequestInit) {
  return fetch(`${API}${url}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
    credentials: "include",
  }).then((r) => {
    if (!r.ok) throw new Error(`API error: ${r.status}`);
    return r.json();
  });
}

export default function StaffChatPage() {
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [selectedReceiver, setSelectedReceiver] = useState<string>("");
  const [urgency, setUrgency] = useState("normal");
  const [initialMessage, setInitialMessage] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: threads = [], isLoading: threadsLoading } = useQuery({
    queryKey: ["messaging-threads"],
    queryFn: () => fetchApi("/messaging/threads"),
    refetchInterval: 5000,
  });

  const { data: activeMessages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["messaging-thread", activeThread],
    queryFn: () => fetchApi(`/messaging/thread/${activeThread}`),
    enabled: !!activeThread,
    refetchInterval: 3000,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["messaging-contacts"],
    queryFn: () => fetchApi("/messaging/contacts"),
  });

  const { data: unreadData } = useQuery({
    queryKey: ["messaging-unread"],
    queryFn: () => fetchApi("/messaging/unread-count"),
    refetchInterval: 10000,
  });

  const sendMutation = useMutation({
    mutationFn: (data: any) => fetchApi("/messaging/send", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messaging-thread", activeThread] });
      qc.invalidateQueries({ queryKey: ["messaging-threads"] });
      setNewMessage("");
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (threadId: string) => fetchApi(`/messaging/read/${threadId}`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messaging-threads"] });
      qc.invalidateQueries({ queryKey: ["messaging-unread"] });
    },
  });

  const startNewChat = () => {
    if (!selectedReceiver || !initialMessage.trim()) return;
    sendMutation.mutate(
      { receiverId: Number(selectedReceiver), message: initialMessage.trim(), urgency, messageType: "direct" },
      {
        onSuccess: (data: any) => {
          setActiveThread(data.threadId);
          setShowNewChat(false);
          setSelectedReceiver("");
          setInitialMessage("");
          setUrgency("normal");
          toast({ title: "Message sent" });
        },
      }
    );
  };

  const sendReply = () => {
    if (!newMessage.trim() || !activeThread) return;
    const thread = threads.find((t: any) => t.threadId === activeThread);
    const otherParticipant = activeMessages.find((m: any) => m.receiverId && m.receiverId !== 0);
    const lastOtherMsg = [...activeMessages].reverse().find((m: any) => m.senderName !== activeMessages.find((msg: any) => msg.senderId)?.senderName);
    const receiverId = otherParticipant?.receiverId !== otherParticipant?.senderId
      ? (lastOtherMsg?.senderId || activeMessages[0]?.senderId)
      : activeMessages[0]?.senderId;
    sendMutation.mutate({
      receiverId,
      message: newMessage.trim(),
      urgency: "normal",
      messageType: "direct",
      threadId: activeThread,
      homeId: thread?.homeId,
    });
  };

  const openThread = (threadId: string) => {
    setActiveThread(threadId);
    markReadMutation.mutate(threadId);
  };

  const urgencyColor = (u: string) => {
    switch (u) {
      case "urgent": return "bg-red-100 text-red-700 border-red-200";
      case "high": return "bg-orange-100 text-orange-700 border-orange-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="h-7 w-7 text-primary" />
            Staff Messaging
          </h1>
          <p className="text-gray-500 mt-1">Internal communication between staff and administrators</p>
        </div>
        <div className="flex items-center gap-3">
          {unreadData?.unread > 0 && (
            <Badge variant="destructive">{unreadData.unread} unread</Badge>
          )}
          <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New Message</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Conversation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium">Send to</label>
                  <Select value={selectedReceiver} onValueChange={setSelectedReceiver}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select staff member..." />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.firstName} {c.lastName} ({c.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={urgency} onValueChange={setUrgency}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Message</label>
                  <Textarea
                    className="mt-1"
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                    placeholder="Type your message..."
                    rows={4}
                  />
                </div>
                <Button onClick={startNewChat} disabled={!selectedReceiver || !initialMessage.trim()} className="w-full">
                  <Send className="h-4 w-4 mr-2" /> Send Message
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Conversations
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            {threadsLoading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : threads.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No conversations yet</p>
                <p className="text-sm mt-1">Start a new message to begin</p>
              </div>
            ) : (
              <div className="divide-y">
                {threads.map((t: any) => (
                  <button
                    key={t.threadId}
                    onClick={() => openThread(t.threadId)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${activeThread === t.threadId ? "bg-blue-50 border-l-2 border-primary" : ""}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{t.latestSender || "Unknown"}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{t.latestMessage}</p>
                      </div>
                      <div className="flex flex-col items-end ml-2">
                        {t.unreadCount > 0 && (
                          <Badge variant="destructive" className="text-xs">{t.unreadCount}</Badge>
                        )}
                        <span className="text-xs text-gray-400 mt-1">
                          {t.latestTime ? new Date(t.latestTime).toLocaleDateString() : ""}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 flex flex-col">
          {activeThread ? (
            <>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setActiveThread(null)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <CardTitle className="text-base">Conversation</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesLoading ? (
                  <div className="text-center text-gray-500">Loading messages...</div>
                ) : (
                  activeMessages.map((msg: any) => (
                    <div key={msg.id} className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-sm font-medium">{msg.senderName}</span>
                        {msg.urgency !== "normal" && (
                          <Badge className={urgencyColor(msg.urgency)} variant="outline">
                            {msg.urgency === "urgent" && <AlertCircle className="h-3 w-3 mr-1" />}
                            {msg.urgency}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="ml-8 p-3 rounded-lg bg-gray-50 text-sm">{msg.message}</div>
                    </div>
                  ))
                )}
              </CardContent>
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a reply..."
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendReply()}
                  />
                  <Button onClick={sendReply} disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-200" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm mt-1">or start a new one</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
