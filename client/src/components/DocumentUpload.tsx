import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Trash2, Eye, CheckCircle, Clock, XCircle } from "lucide-react";
import type { UserDocument } from "@shared/schema";

interface DocumentUploadProps {
  relatedEntityType?: "it_ticket" | "ride" | "delivery" | "driver_profile" | "general";
  relatedEntityId?: string;
  allowedTypes?: string[];
  compact?: boolean;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  signed_agreement: "Signed Agreement",
  signed_contract: "Signed Contract",
  ic_agreement: "IC Agreement",
  w9_form: "W-9 Form",
  certification: "Certification",
  insurance_doc: "Insurance Document",
  medical_clearance: "Medical Clearance",
  background_check: "Background Check",
  work_order_signoff: "Work Order Sign-off",
  invoice: "Invoice",
  receipt: "Receipt",
  other: "Other",
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  uploaded: { label: "Uploaded", icon: Clock, color: "bg-yellow-100 text-yellow-700" },
  approved: { label: "Approved", icon: CheckCircle, color: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", icon: XCircle, color: "bg-red-100 text-red-700" },
  under_review: { label: "Under Review", icon: Eye, color: "bg-blue-100 text-blue-700" },
};

export function DocumentUpload({
  relatedEntityType = "general",
  relatedEntityId,
  allowedTypes,
  compact = false,
}: DocumentUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>("");
  const [description, setDescription] = useState("");

  const queryKey = relatedEntityId
    ? ["/api/documents", relatedEntityType, relatedEntityId]
    : ["/api/documents"];

  const { data: documents = [] } = useQuery<UserDocument[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (relatedEntityType) params.set("entityType", relatedEntityType);
      if (relatedEntityId) params.set("entityId", relatedEntityId);
      const res = await fetch(`/api/documents?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !documentType) throw new Error("Missing file or type");
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("documentType", documentType);
      formData.append("documentName", selectedFile.name);
      if (description) formData.append("description", description);
      if (relatedEntityType) formData.append("relatedEntityType", relatedEntityType);
      if (relatedEntityId) formData.append("relatedEntityId", relatedEntityId);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Document uploaded", description: "Your document has been uploaded successfully." });
      setSelectedFile(null);
      setDocumentType("");
      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err: any) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => apiRequest("DELETE", `/api/documents/${docId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Document deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const displayTypes = allowedTypes
    ? Object.entries(DOC_TYPE_LABELS).filter(([key]) => allowedTypes.includes(key))
    : Object.entries(DOC_TYPE_LABELS);

  return (
    <Card data-testid="document-upload-card">
      <CardHeader className={compact ? "pb-2" : undefined}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="w-4 h-4" />
          Upload Documents
        </CardTitle>
        {!compact && (
          <CardDescription>
            Upload signed documents, agreements, certifications, or any required files.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div>
            <Label htmlFor="doc-type">Document Type</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger id="doc-type" data-testid="select-document-type">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {displayTypes.map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="doc-file">File</Label>
            <Input
              id="doc-file"
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              data-testid="input-document-file"
            />
            <p className="text-xs text-muted-foreground mt-1">
              PDF, PNG, JPG, DOC. Max 10MB.
            </p>
          </div>

          {!compact && (
            <div>
              <Label htmlFor="doc-desc">Notes (optional)</Label>
              <Textarea
                id="doc-desc"
                placeholder="Add a note about this document..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                data-testid="textarea-document-description"
              />
            </div>
          )}

          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={!selectedFile || !documentType || uploadMutation.isPending}
            data-testid="button-upload-document"
          >
            <Upload className="w-4 h-4 mr-1" />
            {uploadMutation.isPending ? "Uploading..." : "Upload Document"}
          </Button>
        </div>

        {documents.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2">Uploaded Documents ({documents.length})</p>
            <div className="space-y-2">
              {documents.map((doc) => {
                const statusInfo = STATUS_CONFIG[doc.status] || STATUS_CONFIG.uploaded;
                const StatusIcon = statusInfo.icon;
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-2 p-2 border rounded-lg text-sm"
                    data-testid={`document-row-${doc.id}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{doc.documentName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{DOC_TYPE_LABELS[doc.documentType] || doc.documentType}</span>
                          {doc.uploadedAt && <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className={statusInfo.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusInfo.label}
                      </Badge>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        data-testid={`button-view-doc-${doc.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => deleteMutation.mutate(doc.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-doc-${doc.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
