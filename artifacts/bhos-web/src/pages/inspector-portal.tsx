import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Users, Home, AlertTriangle, Activity, Pill, GraduationCap, Eye, LogOut } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

function inspectorFetch(path: string, token: string) {
  return fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  }).then((r) => {
    if (!r.ok) throw new Error("Unauthorized or invalid token");
    return r.json();
  });
}

function InspectorLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await inspectorFetch("/api/inspector/overview", token);
      localStorage.setItem("inspector-token", token);
      onLogin(token);
    } catch {
      setError("Invalid or expired access token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">State Inspector Portal</CardTitle>
          <p className="text-gray-500 mt-2">Enter your access token to view facility compliance data</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="password"
            placeholder="Access Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button className="w-full" onClick={handleLogin} disabled={loading || !token}>
            {loading ? "Verifying..." : "Access Portal"}
          </Button>
          <p className="text-xs text-gray-400 text-center">
            This portal provides read-only access. All activity is logged and audited.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function InspectorDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [tab, setTab] = useState("overview");

  const fetcher = (path: string) => () => inspectorFetch(path, token);

  const { data: overview } = useQuery({ queryKey: ["inspector-overview"], queryFn: fetcher("/api/inspector/overview") });
  const { data: patients } = useQuery({ queryKey: ["inspector-patients"], queryFn: fetcher("/api/inspector/patients"), enabled: tab === "patients" });
  const { data: incidents } = useQuery({ queryKey: ["inspector-incidents"], queryFn: fetcher("/api/inspector/incidents"), enabled: tab === "incidents" });
  const { data: crisisEvents } = useQuery({ queryKey: ["inspector-crisis"], queryFn: fetcher("/api/inspector/crisis-events"), enabled: tab === "crisis" });
  const { data: medLogs } = useQuery({ queryKey: ["inspector-meds"], queryFn: fetcher("/api/inspector/medication-logs"), enabled: tab === "medications" });
  const { data: training } = useQuery({ queryKey: ["inspector-training"], queryFn: fetcher("/api/inspector/training-status"), enabled: tab === "training" });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">State Inspector Portal</h1>
          <Badge variant="secondary">Read-Only Access</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={onLogout}>
          <LogOut className="h-4 w-4 mr-2" /> Sign Out
        </Button>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="patients">Census</TabsTrigger>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
            <TabsTrigger value="crisis">Crisis / Restraint</TabsTrigger>
            <TabsTrigger value="medications">Medications</TabsTrigger>
            <TabsTrigger value="training">Training</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500 flex items-center gap-2"><Users className="h-4 w-4" /> Total Patients</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{overview?.totalPatients || 0}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500 flex items-center gap-2"><Users className="h-4 w-4" /> Total Staff</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{overview?.totalStaff || 0}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500 flex items-center gap-2"><Home className="h-4 w-4" /> Homes</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{overview?.homes?.length || 0}</div></CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-yellow-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Incidents (90 days)</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-yellow-700">{overview?.last90Days?.incidents || 0}</div></CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700 flex items-center gap-2"><Activity className="h-4 w-4" /> Crisis Events (90 days)</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-red-700">{overview?.last90Days?.crisisEvents || 0}</div></CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Restraint Events (90 days)</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-red-700">{overview?.last90Days?.restraintEvents || 0}</div></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Facilities</CardTitle></CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Home Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Licensed Capacity</TableHead>
                    <TableHead>License #</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(overview?.homes || []).map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{h.name}</TableCell>
                      <TableCell>{h.address || "—"}</TableCell>
                      <TableCell>{h.capacity || "—"}</TableCell>
                      <TableCell>{h.licenseNumber || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="patients" className="mt-6">
            <Card>
              <CardHeader><CardTitle>Patient Census</CardTitle></CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Date of Birth</TableHead>
                    <TableHead>Home</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Admission Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(patients || []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.lastName}, {p.firstName}</TableCell>
                      <TableCell>{p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>{p.homeName}</TableCell>
                      <TableCell><Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                      <TableCell>{p.admissionDate ? new Date(p.admissionDate).toLocaleDateString() : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {(!patients || patients.length === 0) && (
                    <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-8">No patients found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="incidents" className="mt-6">
            <Card>
              <CardHeader><CardTitle>Incident Reports</CardTitle></CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Home</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(incidents || []).map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell>{new Date(i.occurredAt).toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{i.type}</TableCell>
                      <TableCell><Badge variant={i.severity === "critical" ? "destructive" : i.severity === "high" ? "destructive" : "secondary"}>{i.severity}</Badge></TableCell>
                      <TableCell>{i.homeName}</TableCell>
                      <TableCell><Badge variant={i.status === "resolved" ? "default" : "secondary"}>{i.status}</Badge></TableCell>
                      <TableCell className="max-w-[300px] truncate">{i.description}</TableCell>
                    </TableRow>
                  ))}
                  {(!incidents || incidents.length === 0) && (
                    <TableRow><TableCell colSpan={6} className="text-center text-gray-500 py-8">No incidents found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="crisis" className="mt-6">
            <Card>
              <CardHeader><CardTitle>Crisis Events & Restraint/Seclusion Log</CardTitle></CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Home</TableHead>
                    <TableHead>Crisis Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Restraint</TableHead>
                    <TableHead>Seclusion</TableHead>
                    <TableHead>Hospital</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(crisisEvents || []).map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>{new Date(e.occurredAt).toLocaleString()}</TableCell>
                      <TableCell>{e.patientLastName}, {e.patientFirstName}</TableCell>
                      <TableCell>{e.homeName}</TableCell>
                      <TableCell className="capitalize">{e.crisisType}</TableCell>
                      <TableCell><Badge variant={e.severity === "critical" ? "destructive" : "secondary"}>{e.severity}</Badge></TableCell>
                      <TableCell>
                        {e.restraintUsed ? (
                          <span className="text-red-600 font-medium">
                            Yes — {e.restraintType}
                            {e.restraintStartTime && <><br />{new Date(e.restraintStartTime).toLocaleTimeString()} – {e.restraintEndTime ? new Date(e.restraintEndTime).toLocaleTimeString() : "ongoing"}</>}
                          </span>
                        ) : <span className="text-green-600">No</span>}
                      </TableCell>
                      <TableCell>{e.seclusionUsed ? <span className="text-red-600 font-medium">Yes</span> : <span className="text-green-600">No</span>}</TableCell>
                      <TableCell>{e.hospitalTransport ? <span className="text-orange-600">{e.hospitalName || "Yes"}</span> : "No"}</TableCell>
                      <TableCell><Badge variant={e.status === "resolved" ? "default" : "destructive"}>{e.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {(!crisisEvents || crisisEvents.length === 0) && (
                    <TableRow><TableCell colSpan={9} className="text-center text-gray-500 py-8">No crisis events found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="medications" className="space-y-6 mt-6">
            <Card>
              <CardHeader><CardTitle>Medication Administration Log</CardTitle></CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Medication</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(medLogs?.administrations || []).map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell>{new Date(a.administeredAt).toLocaleString()}</TableCell>
                      <TableCell>{a.patientLastName}, {a.patientFirstName}</TableCell>
                      <TableCell>{a.medicationName}</TableCell>
                      <TableCell><Badge variant={a.status === "administered" ? "default" : "secondary"}>{a.status}</Badge></TableCell>
                      <TableCell className="max-w-[200px] truncate">{a.notes || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {(!medLogs?.administrations || medLogs.administrations.length === 0) && (
                    <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-8">No medication logs</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>

            {medLogs?.errors?.length > 0 && (
              <Card className="border-red-200">
                <CardHeader><CardTitle className="text-red-700">Medication Errors</CardTitle></CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Error Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Home</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {medLogs.errors.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell>{new Date(e.occurredAt).toLocaleString()}</TableCell>
                        <TableCell className="capitalize">{e.errorType}</TableCell>
                        <TableCell><Badge variant="destructive">{e.severity}</Badge></TableCell>
                        <TableCell>{e.homeName}</TableCell>
                        <TableCell className="max-w-[300px] truncate">{e.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="training" className="space-y-6 mt-6">
            <Card>
              <CardHeader><CardTitle>Staff Certifications</CardTitle></CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Certification</TableHead>
                    <TableHead>Issuing Org</TableHead>
                    <TableHead>Earned</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(training?.certifications || []).map((c: any) => {
                    const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
                    return (
                      <TableRow key={c.id} className={expired ? "bg-red-50" : ""}>
                        <TableCell className="font-medium">{c.staffLastName}, {c.staffFirstName}</TableCell>
                        <TableCell className="capitalize">{c.staffRole}</TableCell>
                        <TableCell>{c.certificationName}</TableCell>
                        <TableCell>{c.issuingOrganization || "—"}</TableCell>
                        <TableCell>{c.earnedDate ? new Date(c.earnedDate).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className={expired ? "text-red-600 font-bold" : ""}>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "No expiry"}</TableCell>
                        <TableCell>{c.verified ? <Badge variant="default">Verified</Badge> : <Badge variant="secondary">Unverified</Badge>}</TableCell>
                        <TableCell>{expired ? <Badge variant="destructive">Expired</Badge> : <Badge variant="default">Current</Badge>}</TableCell>
                      </TableRow>
                    );
                  })}
                  {(!training?.certifications || training.certifications.length === 0) && (
                    <TableRow><TableCell colSpan={8} className="text-center text-gray-500 py-8">No certifications found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>

            <Card>
              <CardHeader><CardTitle>Training Records</CardTitle></CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(training?.trainingRecords || []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.staffLastName}, {r.staffFirstName}</TableCell>
                      <TableCell>{r.courseName}</TableCell>
                      <TableCell><Badge variant={r.status === "completed" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                      <TableCell>{r.completedAt ? new Date(r.completedAt).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>{r.score != null ? `${r.score}%` : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {(!training?.trainingRecords || training.trainingRecords.length === 0) && (
                    <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-8">No training records</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default function InspectorPortalPage() {
  const [token, setToken] = useState(() => localStorage.getItem("inspector-token") || "");

  const handleLogout = () => {
    localStorage.removeItem("inspector-token");
    setToken("");
  };

  if (!token) return <InspectorLogin onLogin={setToken} />;
  return <InspectorDashboard token={token} onLogout={handleLogout} />;
}
