import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageCircle, Navigation, Clock, MapPin, CheckCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RideMessage } from "@shared/schema";
import { format } from "date-fns";

interface RideChatProps {
  rideId: number;
  userType: "driver" | "patient";
  isOpen?: boolean;
  onClose?: () => void;
}

const quickMessages = [
  { id: "arrived", label: "I've arrived", icon: MapPin },
  { id: "on_my_way", label: "On my way", icon: Navigation },
  { id: "waiting", label: "Waiting outside", icon: Clock },
  { id: "need_assistance", label: "Need help?", icon: MessageCircle },
];

export function RideChat({ rideId, userType, isOpen = true, onClose }: RideChatProps) {
  const [message, setMessage] = useState("");
  const [wsMessages, setWsMessages] = useState<RideMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: messages = [], isLoading } = useQuery<RideMessage[]>({
    queryKey: ["/api/rides", rideId, "messages"],
    enabled: isOpen,
  });

  const allMessages = [...messages, ...wsMessages.filter(
    wsMsg => !messages.some(m => m.id === wsMsg.id)
  )].sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());

  useEffect(() => {
    setWsMessages([]);
  }, [messages]);

  useEffect(() => {
    if (!isOpen || !rideId) return;
    
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isMounted = true;

    const connectChatWebSocket = async () => {
      if (!isMounted) return;
      
      try {
        // Get authentication token for WebSocket
        const tokenResponse = await fetch("/api/auth/ws-token", { credentials: "include" });
        if (!tokenResponse.ok || !isMounted) {
          if (isMounted) console.log("Not authenticated for chat WebSocket");
          return;
        }
        const { token } = await tokenResponse.json();
        
        if (!isMounted) return;
        
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        ws = new WebSocket(`${protocol}//${window.location.host}/ws/chat?rideId=${rideId}&token=${token}`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === "chat" && data.message) {
              setWsMessages(prev => {
                if (prev.some(m => m.id === data.message.id)) return prev;
                return [...prev, data.message];
              });
            }
          } catch (error) {
            console.error("Error parsing chat message:", error);
          }
        };
        
        ws.onclose = () => {
          // Only reconnect if still mounted and open
          if (isMounted && isOpen) {
            reconnectTimeout = setTimeout(connectChatWebSocket, 30000);
          }
        };
      } catch (error) {
        console.error("Failed to connect chat WebSocket:", error);
      }
    };
    
    connectChatWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null; // Prevent onclose from triggering reconnect
        ws.close();
      }
      setWsMessages([]);
    };
  }, [isOpen, rideId]);

  useEffect(() => {
    const scrollArea = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (scrollArea) {
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }, [allMessages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (msg: string) => {
      const res = await apiRequest("POST", `/api/rides/${rideId}/messages`, {
        senderType: userType,
        message: msg,
        isQuickMessage: false,
      });
      return res.json();
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/rides", rideId, "messages"] });
    },
  });

  const sendQuickMessageMutation = useMutation({
    mutationFn: async (messageType: string) => {
      const res = await apiRequest("POST", `/api/rides/${rideId}/quick-message`, {
        messageType,
        senderType: userType,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rides", rideId, "messages"] });
    },
  });

  const handleSend = () => {
    if (message.trim()) {
      sendMessageMutation.mutate(message.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2 py-3 px-4 border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          Chat
        </CardTitle>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-chat">
            Close
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {userType === "driver" && (
          <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/30">
            {quickMessages.map((qm) => (
              <Button
                key={qm.id}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => sendQuickMessageMutation.mutate(qm.id)}
                disabled={sendQuickMessageMutation.isPending}
                data-testid={`button-quick-message-${qm.id}`}
              >
                <qm.icon className="w-3 h-3 mr-1" />
                {qm.label}
              </Button>
            ))}
          </div>
        )}
        
        <ScrollArea className="flex-1 p-3" ref={scrollRef}>
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading messages...</div>
          ) : allMessages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            <div className="space-y-3">
              {allMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderType === userType ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${msg.id}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      msg.senderType === userType
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs capitalize">
                        {msg.senderType}
                      </Badge>
                      {msg.isQuickMessage && (
                        <Badge variant="secondary" className="text-xs">Quick</Badge>
                      )}
                    </div>
                    <p className="text-sm">{msg.message}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-xs opacity-70">
                        {msg.createdAt && format(new Date(msg.createdAt), "HH:mm")}
                      </span>
                      {msg.senderType === userType && (
                        <CheckCheck className="w-3 h-3 opacity-70" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="flex items-center gap-2 p-3 border-t">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={sendMessageMutation.isPending}
            data-testid="input-chat-message"
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sendMessageMutation.isPending}
            size="icon"
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
