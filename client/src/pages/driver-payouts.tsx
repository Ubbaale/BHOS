import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToHome from "@/components/BackToHome";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  DollarSign, 
  Wallet, 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Zap,
  Building2,
  ArrowRight,
  History,
  TrendingUp,
  ExternalLink,
  RefreshCw
} from "lucide-react";

interface PayoutBalance {
  availableBalance: string;
  pendingBalance: string;
  totalEarnings: string;
  totalPaidOut: string;
  stripeConnectOnboarded: boolean;
  payoutPreference: string;
  bankLinked: boolean;
}

interface StripeConnectStatus {
  hasAccount: boolean;
  onboarded: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  bankLast4: string | null;
}

interface Payout {
  id: number;
  amount: string;
  fee: string;
  netAmount: string;
  method: string;
  status: string;
  requestedAt: string;
  processedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
}

export default function DriverPayouts() {
  const { toast } = useToast();
  const [showCashOut, setShowCashOut] = useState(false);
  const [cashOutAmount, setCashOutAmount] = useState("");
  const [cashOutMethod, setCashOutMethod] = useState<"standard" | "instant">("standard");
  
  const driverId = parseInt(localStorage.getItem("driverId") || "0");

  const { data: balance, isLoading: balanceLoading, refetch: refetchBalance } = useQuery<PayoutBalance>({
    queryKey: ["/api/drivers", driverId, "payout-balance"],
    enabled: driverId > 0
  });

  const { data: connectStatus, refetch: refetchStatus } = useQuery<StripeConnectStatus>({
    queryKey: ["/api/drivers", driverId, "stripe-connect-status"],
    enabled: driverId > 0
  });

  const { data: payouts = [], isLoading: payoutsLoading } = useQuery<Payout[]>({
    queryKey: ["/api/drivers", driverId, "payouts"],
    enabled: driverId > 0
  });

  const connectOnboardMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/drivers/${driverId}/stripe-connect-onboard`);
      return response.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const requestPayoutMutation = useMutation({
    mutationFn: async (data: { amount: string; method: string }) => {
      const response = await apiRequest("POST", `/api/drivers/${driverId}/request-payout`, data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Payout Requested", description: data.message });
      setShowCashOut(false);
      setCashOutAmount("");
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", driverId, "payout-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", driverId, "payouts"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("onboarding") === "complete") {
      refetchStatus();
      refetchBalance();
      toast({ title: "Bank Account Connected", description: "Your bank account is now linked!" });
      window.history.replaceState({}, "", "/driver-payouts");
    }
    if (urlParams.get("refresh") === "true") {
      refetchStatus();
      window.history.replaceState({}, "", "/driver-payouts");
    }
  }, []);

  const availableBalance = parseFloat(balance?.availableBalance || "0");
  const pendingBalance = parseFloat(balance?.pendingBalance || "0");
  const instantFee = cashOutMethod === "instant" ? parseFloat(cashOutAmount || "0") * 0.015 : 0;
  const netCashOut = parseFloat(cashOutAmount || "0") - instantFee;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case "processing":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!driverId) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p>Please access this page from the driver dashboard.</p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-4">
          <BackToHome />
        </div>
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Wallet</h1>
            <p className="text-muted-foreground">Manage your earnings and payouts</p>
          </div>

          <Card className="bg-gradient-to-br from-green-600 to-emerald-700 text-white border-0">
            <CardHeader className="pb-2">
              <CardDescription className="text-green-100">Available Balance</CardDescription>
              <CardTitle className="text-5xl font-bold flex items-baseline gap-2">
                <span className="text-3xl">$</span>
                {balanceLoading ? "---" : availableBalance.toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-4 text-sm text-green-100 mb-6">
                {pendingBalance > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    ${pendingBalance.toFixed(2)} pending
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  ${balance?.totalEarnings || "0.00"} total earned
                </span>
              </div>
              {connectStatus?.onboarded ? (
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto bg-white text-green-700 hover:bg-green-50 font-semibold"
                  onClick={() => {
                    setCashOutAmount(availableBalance.toFixed(2));
                    setShowCashOut(true);
                  }}
                  disabled={availableBalance <= 0}
                  data-testid="button-cash-out"
                >
                  <Wallet className="w-5 h-5 mr-2" />
                  Cash Out
                </Button>
              ) : (
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto bg-white text-green-700 hover:bg-green-50 font-semibold"
                  onClick={() => connectOnboardMutation.mutate()}
                  disabled={connectOnboardMutation.isPending}
                  data-testid="button-setup-bank"
                >
                  <Building2 className="w-5 h-5 mr-2" />
                  {connectOnboardMutation.isPending ? "Setting up..." : "Set Up Bank Account"}
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                    <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Earnings</p>
                    <p className="text-xl font-bold">${balance?.totalEarnings || "0.00"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                    <Wallet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Paid Out</p>
                    <p className="text-xl font-bold">${balance?.totalPaidOut || "0.00"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
                    <CreditCard className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bank Account</p>
                    <p className="text-xl font-bold">
                      {connectStatus?.bankLast4 ? `••••${connectStatus.bankLast4}` : "Not linked"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {!connectStatus?.onboarded && (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-800 dark:text-amber-200">Link Your Bank Account</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                      Set up direct deposit to receive your earnings. Takes about 2 minutes.
                    </p>
                    <Button 
                      size="sm"
                      onClick={() => connectOnboardMutation.mutate()}
                      disabled={connectOnboardMutation.isPending}
                      data-testid="button-link-bank"
                    >
                      {connectOnboardMutation.isPending ? "Setting up..." : "Link Bank Account"}
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Payout History
              </CardTitle>
              <CardDescription>Your past cash outs and transfers</CardDescription>
            </CardHeader>
            <CardContent>
              {payoutsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : payouts.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No payouts yet</p>
                  <p className="text-sm text-muted-foreground">Complete rides to earn money and cash out</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payouts.map((payout) => (
                    <div 
                      key={payout.id} 
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover-elevate"
                      data-testid={`payout-item-${payout.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${payout.method === "instant" ? "bg-purple-100 dark:bg-purple-900" : "bg-blue-100 dark:bg-blue-900"}`}>
                          {payout.method === "instant" ? (
                            <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          ) : (
                            <ArrowRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">
                            {payout.method === "instant" ? "Instant Transfer" : "Standard Transfer"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(payout.requestedAt), "MMM d, yyyy 'at' h:mm a")}
                          </div>
                          {payout.failureReason && (
                            <div className="text-sm text-destructive">{payout.failureReason}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">${payout.netAmount}</div>
                        {parseFloat(payout.fee) > 0 && (
                          <div className="text-xs text-muted-foreground">-${payout.fee} fee</div>
                        )}
                        <div className="mt-1">{getStatusBadge(payout.status)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />

      <Dialog open={showCashOut} onOpenChange={setShowCashOut}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cash Out</DialogTitle>
            <DialogDescription>
              Transfer your earnings to your bank account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  max={availableBalance}
                  step="0.01"
                  placeholder="0.00"
                  className="pl-7 text-xl font-bold"
                  value={cashOutAmount}
                  onChange={(e) => setCashOutAmount(e.target.value)}
                  data-testid="input-cash-out-amount"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Available: ${availableBalance.toFixed(2)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Transfer Speed</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    cashOutMethod === "standard" 
                      ? "border-primary bg-primary/5" 
                      : "border-muted hover-elevate"
                  }`}
                  onClick={() => setCashOutMethod("standard")}
                  data-testid="button-standard-transfer"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowRight className="w-4 h-4" />
                    <span className="font-medium">Standard</span>
                  </div>
                  <p className="text-xs text-muted-foreground">1-2 business days</p>
                  <p className="text-sm font-semibold text-green-600 mt-1">Free</p>
                </button>
                <button
                  type="button"
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    cashOutMethod === "instant" 
                      ? "border-primary bg-primary/5" 
                      : "border-muted hover-elevate"
                  }`}
                  onClick={() => setCashOutMethod("instant")}
                  data-testid="button-instant-transfer"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-purple-600" />
                    <span className="font-medium">Instant</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Within 30 minutes</p>
                  <p className="text-sm font-semibold text-purple-600 mt-1">1.5% fee</p>
                </button>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Cash out amount</span>
                <span>${parseFloat(cashOutAmount || "0").toFixed(2)}</span>
              </div>
              {cashOutMethod === "instant" && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Instant transfer fee (1.5%)</span>
                  <span>-${instantFee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t pt-2">
                <span>You'll receive</span>
                <span className="text-green-600">${netCashOut.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCashOut(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => requestPayoutMutation.mutate({ amount: cashOutAmount, method: cashOutMethod })}
              disabled={
                !cashOutAmount || 
                parseFloat(cashOutAmount) <= 0 || 
                parseFloat(cashOutAmount) > availableBalance ||
                requestPayoutMutation.isPending
              }
              data-testid="button-confirm-cash-out"
            >
              {requestPayoutMutation.isPending ? "Processing..." : `Cash Out $${netCashOut.toFixed(2)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
