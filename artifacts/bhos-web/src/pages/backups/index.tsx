import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database, Download, RefreshCw, Clock, CheckCircle2,
  AlertCircle, Plus, HardDrive, FileJson, Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const API = `${import.meta.env.BASE_URL}api`;

interface Backup {
  id: number;
  orgId: number;
  backupType: string;
  status: string;
  fileName: string | null;
  fileSizeBytes: number | null;
  tableCount: number | null;
  recordCount: number | null;
  initiatedBy: string;
  initiatedByType: string;
  platformCopy: boolean;
  notes: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: "bg-gray-100 text-gray-700", icon: Clock, label: "Pending" },
  in_progress: { color: "bg-blue-100 text-blue-700", icon: RefreshCw, label: "In Progress" },
  completed: { color: "bg-green-100 text-green-700", icon: CheckCircle2, label: "Completed" },
  failed: { color: "bg-red-100 text-red-700", icon: AlertCircle, label: "Failed" },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CreateBackupDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => fetch(`${API}/backups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backupType: "full", notes: notes || undefined }),
    }).then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: (data) => {
      toast({
        title: "Backup completed",
        description: `${data.recordCount} records from ${data.tableCount} tables backed up successfully.`,
      });
      setOpen(false);
      setNotes("");
      onSuccess();
    },
    onError: () => toast({ title: "Backup failed", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Create Backup</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Data Backup</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">What gets backed up:</p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  <li>All homes, staff, and patient records</li>
                  <li>Medications, administrations, and safety data</li>
                  <li>Incidents, daily logs, shifts, and time punches</li>
                  <li>Treatment plans, progress notes, and vital signs</li>
                  <li>Billing, appointments, and transportation records</li>
                  <li>Cameras, meetings, and compliance data</li>
                </ul>
                <p className="mt-2 text-xs">A copy is also stored by BHOS for disaster recovery.</p>
              </div>
            </div>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for backup (e.g., before system upgrade)..."
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Creating Backup...</>
              ) : (
                <><Database className="h-4 w-4 mr-2" />Start Backup</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BackupsPage() {
  const queryClient = useQueryClient();

  const { data: backups = [], isLoading } = useQuery<Backup[]>({
    queryKey: ["backups"],
    queryFn: () => fetch(`${API}/backups`).then(r => r.json()),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["backups"] });

  const completedBackups = backups.filter(b => b.status === "completed");
  const totalSize = completedBackups.reduce((sum, b) => sum + (b.fileSizeBytes || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            💾 Data Backups
          </h1>
          <p className="text-muted-foreground mt-1">
            Back up your organization's data. Each backup is isolated to your organization only.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-2" />Refresh
          </Button>
          <CreateBackupDialog onSuccess={refresh} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">Total Backups</p>
            <p className="text-2xl font-bold">{backups.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-green-600">{completedBackups.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">Total Data Size</p>
            <p className="text-2xl font-bold">{formatBytes(totalSize)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="py-3 flex items-start gap-3">
          <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800">Your data is safe</p>
            <p className="text-amber-700 mt-0.5">
              Every backup only includes YOUR organization's data — never another company's. 
              BHOS also keeps a platform copy of each backup for disaster recovery purposes.
            </p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : backups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-medium">No backups yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Create your first backup to protect your data</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {backups.map(backup => {
            const sc = statusConfig[backup.status] || statusConfig.pending;
            const StatusIcon = sc.icon;
            return (
              <Card key={backup.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <FileJson className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{backup.fileName || "Backup"}</span>
                          <Badge className={sc.color}>{sc.label}</Badge>
                          {backup.platformCopy && (
                            <Badge variant="outline" className="text-xs">Platform Copy</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span>{new Date(backup.createdAt).toLocaleString()}</span>
                          <span>by {backup.initiatedBy}</span>
                          {backup.recordCount != null && (
                            <span>{backup.recordCount.toLocaleString()} records</span>
                          )}
                          {backup.tableCount != null && (
                            <span>{backup.tableCount} tables</span>
                          )}
                          {backup.fileSizeBytes != null && (
                            <span>{formatBytes(backup.fileSizeBytes)}</span>
                          )}
                        </div>
                        {backup.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{backup.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {backup.expiresAt && (
                        <span className="text-xs text-muted-foreground">
                          Expires {new Date(backup.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                      {backup.status === "completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            window.open(`${API}/backups/${backup.id}/download`, "_blank");
                          }}
                        >
                          <Download className="h-4 w-4 mr-1" />Download
                        </Button>
                      )}
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
