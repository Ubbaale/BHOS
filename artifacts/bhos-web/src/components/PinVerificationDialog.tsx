import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, AlertTriangle, Lock, Loader2, Smartphone } from "lucide-react";
import { verifyPin, getPinStatus } from "@/lib/medPassPin";
import { PushApprovalDialog } from "./PushApprovalDialog";

interface PinVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (token: string) => void;
  staffName?: string;
  patientName?: string;
  medicationName?: string;
}

export function PinVerificationDialog({ open, onOpenChange, onVerified, staffName, patientName, medicationName }: PinVerificationDialogProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPushApproval, setShowPushApproval] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setError("");
      setShowPushApproval(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleVerify = async () => {
    if (!pin || pin.length < 4) {
      setError("Enter your 4-6 digit PIN");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await verifyPin(pin);
      onVerified(result.pinVerificationToken);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Verification failed");
      setPin("");
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && pin.length >= 4) handleVerify();
  };

  if (showPushApproval) {
    return (
      <PushApprovalDialog
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            setShowPushApproval(false);
            onOpenChange(false);
          }
        }}
        onApproved={(token) => {
          onVerified(token);
          onOpenChange(false);
        }}
        patientName={patientName}
        medicationName={medicationName}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            Identity Verification Required
          </DialogTitle>
          <DialogDescription>
            Enter your med-pass PIN or use your enrolled phone to verify your identity.
          </DialogDescription>
        </DialogHeader>

        {staffName && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
            <Lock className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Verifying as: {staffName}</span>
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="pin-input">Med-Pass PIN</Label>
            <Input
              ref={inputRef}
              id="pin-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Enter 4-6 digit PIN"
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                setPin(val);
                setError("");
              }}
              onKeyDown={handleKeyDown}
              className="text-center text-2xl tracking-[0.5em] font-mono"
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <Button onClick={handleVerify} disabled={loading || pin.length < 4} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Verify with PIN
              </>
            )}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => setShowPushApproval(true)}
            className="w-full gap-2"
          >
            <Smartphone className="h-4 w-4" />
            Approve from My Phone
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface PinSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  isUpdate?: boolean;
}

export function PinSetupDialog({ open, onOpenChange, onComplete, isUpdate }: PinSetupDialogProps) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setError("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (newPin.length < 4 || newPin.length > 6) {
      setError("PIN must be 4-6 digits");
      return;
    }
    if (!/^\d+$/.test(newPin)) {
      setError("PIN must contain only numbers");
      return;
    }
    if (newPin !== confirmPin) {
      setError("PINs do not match");
      return;
    }
    if (isUpdate && !currentPin) {
      setError("Current PIN is required");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { setPin } = await import("@/lib/medPassPin");
      await setPin(newPin, isUpdate ? currentPin : undefined);
      onComplete();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to set PIN");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-600" />
            {isUpdate ? "Update Med-Pass PIN" : "Set Up Med-Pass PIN"}
          </DialogTitle>
          <DialogDescription>
            {isUpdate
              ? "Enter your current PIN and choose a new 4-6 digit PIN."
              : "Create a personal 4-6 digit PIN used to verify your identity before administering medications."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isUpdate && (
            <div className="space-y-2">
              <Label htmlFor="current-pin">Current PIN</Label>
              <Input
                id="current-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="Current PIN"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                className="text-center text-xl tracking-[0.5em] font-mono"
                autoComplete="off"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-pin">New PIN</Label>
            <Input
              id="new-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="4-6 digits"
              value={newPin}
              onChange={(e) => { setNewPin(e.target.value.replace(/\D/g, "")); setError(""); }}
              className="text-center text-xl tracking-[0.5em] font-mono"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-pin">Confirm PIN</Label>
            <Input
              id="confirm-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Re-enter PIN"
              value={confirmPin}
              onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, "")); setError(""); }}
              className="text-center text-xl tracking-[0.5em] font-mono"
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <Button onClick={handleSubmit} disabled={loading || newPin.length < 4} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              isUpdate ? "Update PIN" : "Create PIN"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
