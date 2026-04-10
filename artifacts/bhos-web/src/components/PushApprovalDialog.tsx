import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Smartphone, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle, Shield } from "lucide-react";

const API = `${import.meta.env.BASE_URL}api`;

interface PushApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved: (token: string) => void;
  patientName?: string;
  medicationName?: string;
}

export function PushApprovalDialog({ open, onOpenChange, onApproved, patientName, medicationName }: PushApprovalDialogProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "waiting" | "approved" | "denied" | "expired" | "error">("idle");
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(120);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open) {
      setStatus("idle");
      setChallengeId(null);
      setError("");
      setTimeLeft(120);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open]);

  const handleSendChallenge = async () => {
    setStatus("sending");
    setError("");
    try {
      const res = await fetch(`${API}/med-access/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientName, medicationName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send approval request");
        setStatus("error");
        return;
      }

      setChallengeId(data.challengeId);
      setStatus("waiting");
      setTimeLeft(120);

      if (!data.pushSent) {
        setError("No enrolled device found. Please use PIN verification instead, or register your phone in the BHOS mobile app.");
        setStatus("error");
        return;
      }

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`${API}/med-access/challenge/${data.challengeId}`);
          const pollData = await pollRes.json();

          if (pollData.status === "approved") {
            if (pollRef.current) clearInterval(pollRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
            setStatus("approved");
            setTimeout(() => {
              onApproved(pollData.pinVerificationToken);
              onOpenChange(false);
            }, 1500);
          } else if (pollData.status === "denied") {
            if (pollRef.current) clearInterval(pollRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
            setStatus("denied");
          } else if (pollData.status === "expired") {
            if (pollRef.current) clearInterval(pollRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
            setStatus("expired");
          }
        } catch {}
      }, 2000);
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) {
        if (pollRef.current) clearInterval(pollRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
      }
      onOpenChange(v);
    }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-blue-600" />
            Phone Approval
          </DialogTitle>
          <DialogDescription>
            A notification will be sent to your enrolled mobile device. Approve it to proceed.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {status === "idle" && (
            <div className="space-y-4">
              {(patientName || medicationName) && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm space-y-1">
                  {patientName && <p className="text-blue-800"><span className="font-medium">Patient:</span> {patientName}</p>}
                  {medicationName && <p className="text-blue-800"><span className="font-medium">Medication:</span> {medicationName}</p>}
                </div>
              )}
              <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                <p className="text-sm font-medium text-slate-800">How it works:</p>
                <ol className="text-sm text-slate-600 list-decimal list-inside space-y-1">
                  <li>A push notification is sent to your BHOS mobile app</li>
                  <li>Open it and tap "Approve" on your phone</li>
                  <li>Access is granted on this computer automatically</li>
                </ol>
              </div>
              <Button onClick={handleSendChallenge} className="w-full h-12">
                <Smartphone className="h-4 w-4 mr-2" />
                Send Approval Request
              </Button>
            </div>
          )}

          {status === "sending" && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
              <p className="text-sm text-slate-600">Sending to your device...</p>
            </div>
          )}

          {status === "waiting" && (
            <div className="flex flex-col items-center py-4 space-y-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-blue-200 flex items-center justify-center">
                  <Smartphone className="h-8 w-8 text-blue-600 animate-pulse" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                  <Clock className="h-3 w-3 text-white" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-medium text-slate-800">Waiting for approval...</p>
                <p className="text-sm text-slate-500 mt-1">Check your BHOS mobile app</p>
              </div>
              <div className="text-2xl font-mono font-bold text-blue-600">
                {formatTime(timeLeft)}
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${(timeLeft / 120) * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">Request expires in {formatTime(timeLeft)}</p>
            </div>
          )}

          {status === "approved" && (
            <div className="flex flex-col items-center py-8">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <p className="text-lg font-semibold text-green-800">Approved!</p>
              <p className="text-sm text-slate-500 mt-1">Identity verified via your device</p>
            </div>
          )}

          {status === "denied" && (
            <div className="flex flex-col items-center py-8 space-y-4">
              <XCircle className="h-16 w-16 text-red-500 mb-2" />
              <div className="text-center">
                <p className="text-lg font-semibold text-red-800">Denied</p>
                <p className="text-sm text-slate-500 mt-1">The request was denied from your device</p>
              </div>
              <Button variant="outline" onClick={() => { setStatus("idle"); setChallengeId(null); }}>
                Try Again
              </Button>
            </div>
          )}

          {status === "expired" && (
            <div className="flex flex-col items-center py-8 space-y-4">
              <Clock className="h-16 w-16 text-amber-500 mb-2" />
              <div className="text-center">
                <p className="text-lg font-semibold text-amber-800">Request Expired</p>
                <p className="text-sm text-slate-500 mt-1">The approval request timed out. Please try again.</p>
              </div>
              <Button variant="outline" onClick={() => { setStatus("idle"); setChallengeId(null); setTimeLeft(120); }}>
                Send New Request
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center py-6 space-y-4">
              <AlertTriangle className="h-12 w-12 text-amber-500 mb-2" />
              <p className="text-sm text-red-600 text-center">{error}</p>
              <Button variant="outline" onClick={() => setStatus("idle")}>
                Try Again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
