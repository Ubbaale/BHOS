import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle, AlertCircle, ExternalLink, Crown } from "lucide-react";

const BASE = import.meta.env.BASE_URL;

function fetchApi(path: string, opts?: RequestInit) {
  return fetch(`${BASE}api${path}`, { credentials: "include", ...opts }).then(r => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });
}

const PLAN_FEATURES: Record<string, string[]> = {
  starter: ["Medication Safety & eMAR", "Patient Management", "Incident Reporting", "Basic Reports", "Staff Scheduling"],
  professional: ["Everything in Starter", "Treatment Plans & ISP", "Progress Notes", "Admissions CRM", "Census & Bed Board", "Billing & Claims", "Discharge Planning"],
  enterprise: ["Everything in Professional", "Workforce Management", "Family Portal", "Predictive Analytics", "Transportation & Fleet", "Staff Messaging", "Priority Support"],
  unlimited: ["Everything in Enterprise", "Dedicated Account Manager", "Custom Integrations", "On-Site Training", "SLA Guarantees", "White-Label Options"],
};

export default function SubscriptionPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  const { data: orgData } = useQuery({
    queryKey: ["my-org-check"],
    queryFn: () => fetchApi("/organizations/my-org"),
  });

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["stripe-plans"],
    queryFn: () => fetchApi("/stripe/plans"),
  });

  const { data: subData } = useQuery({
    queryKey: ["subscription", orgData?.orgId],
    queryFn: () => fetchApi(`/stripe/subscription/${orgData.orgId}`),
    enabled: !!orgData?.orgId,
  });

  const checkout = useMutation({
    mutationFn: (priceId: string) => fetchApi("/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId, orgId: orgData?.orgId }),
    }),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const openPortal = useMutation({
    mutationFn: () => fetchApi("/stripe/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: orgData?.orgId }),
    }),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const currentTier = subData?.subscription?.planType || "professional";
  const isTrial = subData?.subscription?.status === "trial";
  const trialEnd = subData?.subscription?.trialEndsAt;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscription & Billing</h1>
          <p className="text-muted-foreground">Manage your BHOS subscription plan</p>
        </div>
        {subData?.subscription?.stripeCustomerId && (
          <Button variant="outline" onClick={() => openPortal.mutate()} disabled={openPortal.isPending}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Manage in Stripe
          </Button>
        )}
      </div>

      {success && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-medium text-green-800">Subscription activated!</p>
            <p className="text-sm text-green-600">Your payment has been processed. Thank you!</p>
          </div>
        </div>
      )}

      {canceled && (
        <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <div>
            <p className="font-medium text-yellow-800">Checkout canceled</p>
            <p className="text-sm text-yellow-600">No charges were made. You can try again anytime.</p>
          </div>
        </div>
      )}

      {subData?.subscription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold capitalize">{currentTier}</span>
                  {isTrial && <Badge variant="secondary">Free Trial</Badge>}
                  {!isTrial && subData.subscription.status === "active" && <Badge className="bg-green-100 text-green-800">Active</Badge>}
                </div>
                {isTrial && trialEnd && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Trial ends {new Date(trialEnd).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
        {plansLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : plans && plans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan: any) => {
              const tier = plan.metadata?.tier || plan.name.toLowerCase().replace("bhos ", "");
              const monthlyPrice = plan.prices?.find((p: any) => p.recurring?.interval === "month");
              const yearlyPrice = plan.prices?.find((p: any) => p.recurring?.interval === "year");
              const isCurrentPlan = tier === currentTier;
              const features = PLAN_FEATURES[tier] || [];

              return (
                <Card key={plan.id} className={`relative ${isCurrentPlan ? "border-primary border-2" : ""}`}>
                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary">Current Plan</Badge>
                    </div>
                  )}
                  {tier === "enterprise" && (
                    <div className="absolute -top-3 right-4">
                      <Badge className="bg-amber-500"><Crown className="h-3 w-3 mr-1" />Popular</Badge>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-lg">{plan.name.replace("BHOS ", "")}</CardTitle>
                    <p className="text-sm text-muted-foreground">{plan.description?.substring(0, 80)}...</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {monthlyPrice && (
                      <div>
                        <span className="text-3xl font-bold">${(monthlyPrice.unitAmount / 100).toFixed(0)}</span>
                        <span className="text-muted-foreground">/home/mo</span>
                      </div>
                    )}
                    {yearlyPrice && (
                      <p className="text-sm text-muted-foreground">
                        or ${(yearlyPrice.unitAmount / 100).toFixed(0)}/home/yr (save ~17%)
                      </p>
                    )}

                    <ul className="space-y-2 text-sm">
                      {features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    {!isCurrentPlan && monthlyPrice && (
                      <Button
                        className="w-full"
                        onClick={() => checkout.mutate(monthlyPrice.id)}
                        disabled={checkout.isPending}
                      >
                        {checkout.isPending ? "Redirecting..." : "Subscribe Monthly"}
                      </Button>
                    )}
                    {isCurrentPlan && (
                      <Button className="w-full" variant="outline" disabled>
                        Current Plan
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Plans Not Yet Available</h3>
              <p className="text-muted-foreground">
                Subscription plans are being configured. Check back soon or contact support.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
