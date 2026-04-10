import { useState, useEffect, useRef, useCallback } from "react";
import { ScanLine, Keyboard, Camera, X, Check, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;

interface MedicationMatch {
  id: number;
  name: string;
  dosage: string;
  patientName: string;
  ndcCode: string | null;
  rxNumber: string | null;
  lotNumber: string | null;
  route: string;
  frequency: string;
  controlledSubstance: boolean;
}

interface BarcodeLookupResult {
  found: boolean;
  medications: MedicationMatch[];
  scannedCode: string;
}

interface BarcodeScannerProps {
  onMedicationFound?: (medication: MedicationMatch, barcode: string) => void;
  onClose?: () => void;
  triggerLabel?: string;
  compact?: boolean;
}

function useHandheldScanner(onScan: (code: string) => void, enabled: boolean) {
  const bufferRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (isInput) return;

      if (e.key === "Enter" && bufferRef.current.length >= 4) {
        e.preventDefault();
        onScan(bufferRef.current);
        bufferRef.current = "";
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          bufferRef.current = "";
        }, 100);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onScan, enabled]);
}

function ScannerResults({ result, onSelect, onScanAgain }: {
  result: BarcodeLookupResult;
  onSelect: (med: MedicationMatch) => void;
  onScanAgain: () => void;
}) {
  if (!result.found) {
    return (
      <div className="text-center py-6">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <p className="font-medium text-lg">No Medication Found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Barcode: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{result.scannedCode}</code>
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Make sure the medication's NDC code, Rx number, or lot number is entered in the system.
        </p>
        <Button variant="outline" className="mt-4" onClick={onScanAgain}>
          Scan Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Check className="h-5 w-5 text-green-600" />
        <span className="font-medium text-green-700">
          {result.medications.length} medication{result.medications.length > 1 ? "s" : ""} found
        </span>
        <Badge variant="outline" className="text-xs ml-auto">
          {result.scannedCode}
        </Badge>
      </div>
      {result.medications.map(med => (
        <Card
          key={med.id}
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onSelect(med)}
        >
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{med.name} {med.dosage}</p>
                <p className="text-sm text-muted-foreground">
                  Patient: {med.patientName} | {med.route} | {med.frequency}
                </p>
                <div className="flex gap-2 mt-1">
                  {med.ndcCode && <Badge variant="outline" className="text-xs">NDC: {med.ndcCode}</Badge>}
                  {med.rxNumber && <Badge variant="outline" className="text-xs">Rx: {med.rxNumber}</Badge>}
                  {med.controlledSubstance && <Badge variant="destructive" className="text-xs">Controlled</Badge>}
                </div>
              </div>
              <Button size="sm">Select</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function BarcodeScanner({ onMedicationFound, onClose, triggerLabel, compact }: BarcodeScannerProps) {
  const [open, setOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BarcodeLookupResult | null>(null);
  const [handheldListening, setHandheldListening] = useState(true);
  const { toast } = useToast();

  const lookupBarcode = useCallback(async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const resp = await fetch(`${API}/medications/barcode-lookup/${encodeURIComponent(code.trim())}`);
      if (!resp.ok) {
        toast({ title: "Lookup error", description: `Server returned ${resp.status}`, variant: "destructive" });
        setLoading(false);
        return;
      }
      const data: BarcodeLookupResult = await resp.json();
      setResult(data);

      if (data.found && data.medications.length === 1 && onMedicationFound) {
        toast({
          title: `Scanned: ${data.medications[0].name}`,
          description: `${data.medications[0].dosage} — ${data.medications[0].patientName}`,
        });
      }
    } catch {
      toast({ title: "Scan failed", description: "Could not look up barcode", variant: "destructive" });
    }
    setLoading(false);
  }, [onMedicationFound, toast]);

  useHandheldScanner((code) => {
    if (open && handheldListening) {
      lookupBarcode(code);
      toast({ title: "Barcode scanned", description: code });
    }
  }, open && handheldListening);

  const handleSelect = (med: MedicationMatch) => {
    if (onMedicationFound && result) {
      onMedicationFound(med, result.scannedCode);
    }
    setOpen(false);
    setResult(null);
    setManualCode("");
  };

  const handleManualSubmit = () => {
    lookupBarcode(manualCode);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleManualSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setResult(null); setManualCode(""); } }}>
      <DialogTrigger asChild>
        {compact ? (
          <Button variant="outline" size="sm">
            <ScanLine className="h-4 w-4 mr-1" />
            {triggerLabel || "Scan"}
          </Button>
        ) : (
          <Button variant="outline">
            <ScanLine className="h-4 w-4 mr-2" />
            {triggerLabel || "Scan Barcode"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            Medication Barcode Scanner
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="py-3">
              <div className="flex items-start gap-3">
                <Keyboard className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-blue-800">USB / Handheld Scanner Ready</p>
                  <p className="text-blue-700 mt-0.5">
                    Point your handheld scanner at a medication barcode — it will automatically read into this window.
                    Supported formats: NDC, UPC, EAN, Code128, QR, DataMatrix.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {handheldListening && !result && !loading && (
            <div className="flex items-center justify-center py-6 border-2 border-dashed rounded-lg">
              <div className="text-center">
                <div className="animate-pulse">
                  <ScanLine className="h-12 w-12 text-primary/50 mx-auto" />
                </div>
                <p className="text-sm font-medium mt-3">Waiting for scanner input...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Scan a barcode or enter a code manually below
                </p>
              </div>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">or enter manually</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Enter NDC, Rx#, lot#, or barcode number..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Button onClick={handleManualSubmit} disabled={!manualCode.trim() || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lookup"}
            </Button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">Looking up medication...</span>
            </div>
          )}

          {result && (
            <ScannerResults
              result={result}
              onSelect={handleSelect}
              onScanAgain={() => { setResult(null); setManualCode(""); }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InlineBarcodeListener({ onScan }: { onScan: (code: string) => void }) {
  useHandheldScanner(onScan, true);
  return null;
}
