import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToHome from "@/components/BackToHome";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Shield, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function ICAgreement() {
  const { driver } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [fullLegalName, setFullLegalName] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const { data: agreementData, isLoading: agreementLoading } = useQuery<{ version: string; content: string }>({
    queryKey: ["/api/drivers/ic-agreement-text"],
    enabled: !!driver,
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!driver) throw new Error("Driver not found");
      const response = await apiRequest("POST", `/api/drivers/${driver.id}/sign-ic-agreement`, {
        fullLegalName,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Agreement Signed",
        description: "Your Independent Contractor Agreement has been signed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      setLocation("/driver");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canSubmit = fullLegalName.trim().length >= 2 && acknowledged;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-3xl">
        <BackToHome />

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-md">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-ic-agreement-title">Independent Contractor Agreement</h1>
            <p className="text-sm text-muted-foreground">Please review and sign this agreement to continue</p>
          </div>
        </div>

        <Alert className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <AlertDescription>
            This is a legal agreement. Please read it carefully before signing. By signing, you acknowledge that you are entering into a binding contract as an independent contractor.
          </AlertDescription>
        </Alert>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Agreement Terms {agreementData && <span className="text-xs font-normal text-muted-foreground">(v{agreementData.version})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agreementLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div
                className="max-h-96 overflow-y-auto bg-muted p-4 rounded-md text-sm whitespace-pre-wrap font-mono leading-relaxed"
                data-testid="text-agreement-content"
              >
                {agreementData?.content || "Unable to load agreement text."}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Digital Signature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="fullLegalName">Full Legal Name</Label>
              <Input
                id="fullLegalName"
                value={fullLegalName}
                onChange={(e) => setFullLegalName(e.target.value)}
                placeholder="Enter your full legal name as your digital signature"
                data-testid="input-legal-name"
              />
              <p className="text-xs text-muted-foreground">
                Your typed name will serve as your electronic signature
              </p>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="acknowledge"
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
                data-testid="checkbox-acknowledge"
              />
              <Label htmlFor="acknowledge" className="text-sm leading-relaxed cursor-pointer">
                I acknowledge that I am signing this agreement electronically and that my electronic signature has the same legal effect as a handwritten signature
              </Label>
            </div>

            <Button
              className="w-full"
              onClick={() => signMutation.mutate()}
              disabled={!canSubmit || signMutation.isPending}
              data-testid="button-sign-agreement"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {signMutation.isPending ? "Signing..." : "Sign Agreement"}
            </Button>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
