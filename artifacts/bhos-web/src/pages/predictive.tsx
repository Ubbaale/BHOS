import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  Activity,
  Shield,
  RefreshCw,
  Zap,
  CheckCircle,
  Target,
  BarChart3,
  Pill,
  Heart,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function MetricCard({ title, value, icon: Icon, color, subtitle }: { title: string; value: string | number; icon: any; color: string; subtitle?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const severityBadge = (s: string) => {
  switch (s) {
    case "critical": return <Badge variant="destructive">Critical</Badge>;
    case "high": return <Badge className="bg-orange-100 text-orange-700 border-orange-200">High</Badge>;
    case "moderate": return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Moderate</Badge>;
    case "low": return <Badge className="bg-green-50 text-green-700 border-green-200">Low</Badge>;
    default: return <Badge variant="outline">{s}</Badge>;
  }
};

const riskTypeName = (t: string) => {
  switch (t) {
    case "incident_escalation": return "Incident Escalation";
    case "medication_nonadherence": return "Med Non-Adherence";
    case "behavioral_decline": return "Behavioral Decline";
    default: return t;
  }
};

const riskTypeIcon = (t: string) => {
  switch (t) {
    case "incident_escalation": return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "medication_nonadherence": return <Pill className="h-4 w-4 text-amber-500" />;
    case "behavioral_decline": return <Heart className="h-4 w-4 text-purple-500" />;
    default: return <Activity className="h-4 w-4" />;
  }
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-red-500" : score >= 60 ? "bg-orange-500" : score >= 40 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-bold" style={{ color: score >= 80 ? "#ef4444" : score >= 60 ? "#f97316" : score >= 40 ? "#f59e0b" : "#22c55e" }}>
        {score}
      </span>
    </div>
  );
}

export default function PredictivePage() {
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<any>({});
  const [riskScores, setRiskScores] = useState<any[]>([]);
  const [behaviorTrends, setBehaviorTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [calculating, setCalculating] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, scoresRes, patientsRes] = await Promise.all([
        fetch(`${BASE}/api/predictive/dashboard`),
        fetch(`${BASE}/api/predictive/risk-scores`),
        fetch(`${BASE}/api/patients`),
      ]);

      if (dashRes.ok) setDashboard(await dashRes.json());
      if (scoresRes.ok) setRiskScores(await scoresRes.json());
      if (patientsRes.ok) setPatients(await patientsRes.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchBehaviorTrends = async (patientId: string) => {
    setSelectedPatient(patientId);
    if (!patientId) { setBehaviorTrends([]); return; }
    try {
      const res = await fetch(`${BASE}/api/predictive/behavior-trends?patientId=${patientId}&days=30`);
      if (res.ok) setBehaviorTrends(await res.json());
    } catch (e) { console.error(e); }
  };

  const calculateRisks = async () => {
    setCalculating(true);
    try {
      const res = await fetch(`${BASE}/api/predictive/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: "Risk Analysis Complete", description: `Analyzed ${data.patientsAnalyzed} patients, identified ${data.risksIdentified} risk factors.` });
        fetchAll();
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
    setCalculating(false);
  };

  const acknowledgeRisk = async (id: number) => {
    try {
      const res = await fetch(`${BASE}/api/predictive/risk-scores/${id}/acknowledge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        toast({ title: "Acknowledged" });
        fetchAll();
      }
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-5 gap-4">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600" />
            Predictive Analytics & Risk Prevention
          </h1>
          <p className="text-muted-foreground">AI-powered risk detection using incident patterns, medication data, and behavioral trends</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
          <Button onClick={calculateRisks} disabled={calculating} className="bg-purple-600 hover:bg-purple-700">
            <Zap className="h-4 w-4 mr-2" /> {calculating ? "Analyzing..." : "Run Analysis"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricCard title="Total Active Risks" value={dashboard.totalActiveRisks || 0} icon={Target} color="text-purple-600 bg-purple-50" />
        <MetricCard title="Critical" value={dashboard.critical || 0} icon={AlertTriangle} color="text-red-600 bg-red-50" />
        <MetricCard title="High" value={dashboard.high || 0} icon={TrendingUp} color="text-orange-600 bg-orange-50" />
        <MetricCard title="Moderate" value={dashboard.moderate || 0} icon={Eye} color="text-amber-600 bg-amber-50" />
        <MetricCard title="Low" value={dashboard.low || 0} icon={Shield} color="text-green-600 bg-green-50" />
      </div>

      <Tabs defaultValue="risks" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          <TabsTrigger value="risks">Risk Scores</TabsTrigger>
          <TabsTrigger value="patients">High-Risk Patients</TabsTrigger>
          <TabsTrigger value="trends">Behavior Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="risks">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> Active Risk Assessments</CardTitle>
              <CardDescription>Risk scores calculated from incident history, medication adherence, and behavioral observations</CardDescription>
            </CardHeader>
            <CardContent>
              {riskScores.length > 0 ? (
                <div className="space-y-3">
                  {riskScores.map((r: any) => (
                    <div key={r.id} className={`p-4 rounded-lg border ${
                      r.severity === "critical" ? "border-red-300 bg-red-50/50" :
                      r.severity === "high" ? "border-orange-200 bg-orange-50/30" :
                      r.severity === "moderate" ? "border-amber-200 bg-amber-50/30" : ""
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {riskTypeIcon(r.riskType)}
                          <div>
                            <span className="font-medium">{r.patientName}</span>
                            <span className="text-muted-foreground mx-2">—</span>
                            <span className="text-sm">{riskTypeName(r.riskType)}</span>
                          </div>
                          {severityBadge(r.severity)}
                        </div>
                        <div className="flex items-center gap-3">
                          <ScoreBar score={parseFloat(r.score)} />
                          {!r.acknowledgedBy && (
                            <Button size="sm" variant="outline" onClick={() => acknowledgeRisk(r.id)}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Acknowledge
                            </Button>
                          )}
                          {r.acknowledgedBy && (
                            <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-1" /> Reviewed</Badge>
                          )}
                        </div>
                      </div>
                      <div className="ml-7 space-y-1">
                        <p className="text-sm"><span className="font-medium text-muted-foreground">Factors:</span> {r.factors}</p>
                        <p className="text-sm"><span className="font-medium text-muted-foreground">Recommendation:</span> {r.recommendation}</p>
                        <p className="text-xs text-muted-foreground">Based on {r.dataPoints} data points | Calculated {new Date(r.calculatedAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No risk assessments calculated yet.</p>
                  <Button onClick={calculateRisks} disabled={calculating} className="bg-purple-600 hover:bg-purple-700">
                    <Zap className="h-4 w-4 mr-2" /> Run First Analysis
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patients">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> High-Risk Patients</CardTitle>
              <CardDescription>Patients with risk scores of 60 or above requiring clinical attention</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Highest Score</TableHead>
                    <TableHead>Active Risks</TableHead>
                    <TableHead>Risk Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dashboard.highRiskPatients || []).map((p: any) => (
                    <TableRow key={p.patientId} className={p.maxScore >= 80 ? "bg-red-50/50" : "bg-orange-50/30"}>
                      <TableCell className="font-medium">{p.patientName}</TableCell>
                      <TableCell><ScoreBar score={Math.round(p.maxScore)} /></TableCell>
                      <TableCell><Badge variant="outline">{p.riskCount} active</Badge></TableCell>
                      <TableCell>{severityBadge(p.maxScore >= 80 ? "critical" : p.maxScore >= 60 ? "high" : "moderate")}</TableCell>
                    </TableRow>
                  ))}
                  {(!dashboard.highRiskPatients || dashboard.highRiskPatients.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No high-risk patients identified. Run an analysis to check current risk levels.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Behavior Trend Data</CardTitle>
                  <CardDescription>Daily behavioral observations scored 1-10 (mood, agitation, sleep, appetite, social engagement, anxiety, cooperation, self-care)</CardDescription>
                </div>
                <Select value={selectedPatient} onValueChange={fetchBehaviorTrends}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select patient" /></SelectTrigger>
                  <SelectContent>
                    {patients.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {behaviorTrends.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Mood</TableHead>
                      <TableHead>Agitation</TableHead>
                      <TableHead>Sleep</TableHead>
                      <TableHead>Appetite</TableHead>
                      <TableHead>Social</TableHead>
                      <TableHead>Anxiety</TableHead>
                      <TableHead>Cooperation</TableHead>
                      <TableHead>Self-Care</TableHead>
                      <TableHead>Shift</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {behaviorTrends.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm">{new Date(t.recordDate).toLocaleDateString()}</TableCell>
                        <TableCell>{scoreCell(t.moodScore)}</TableCell>
                        <TableCell>{scoreCell(t.agitationLevel, true)}</TableCell>
                        <TableCell>{scoreCell(t.sleepQuality)}</TableCell>
                        <TableCell>{scoreCell(t.appetiteLevel)}</TableCell>
                        <TableCell>{scoreCell(t.socialEngagement)}</TableCell>
                        <TableCell>{scoreCell(t.anxietyLevel, true)}</TableCell>
                        <TableCell>{scoreCell(t.cooperationLevel)}</TableCell>
                        <TableCell>{scoreCell(t.selfCareScore)}</TableCell>
                        <TableCell><Badge variant="outline">{t.shiftType || "—"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : selectedPatient ? (
                <p className="text-center text-muted-foreground py-8">No behavior trend data for this patient in the last 30 days.</p>
              ) : (
                <p className="text-center text-muted-foreground py-8">Select a patient to view their behavior trend data.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function scoreCell(value: number | null, inverse?: boolean) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  const isGood = inverse ? value <= 3 : value >= 7;
  const isBad = inverse ? value >= 7 : value <= 3;
  const color = isBad ? "text-red-600 font-bold" : isGood ? "text-green-600" : "text-muted-foreground";
  return <span className={color}>{value}</span>;
}
