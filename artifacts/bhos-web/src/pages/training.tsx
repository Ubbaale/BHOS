import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  GraduationCap,
  Award,
  BookOpen,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileCheck,
} from "lucide-react";
import { useListStaff } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL;
function fetchApi(path: string, opts?: RequestInit) {
  return fetch(`${BASE}api${path}`, { credentials: "include", ...opts }).then(r => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });
}

export default function TrainingPage() {
  const qc = useQueryClient();
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showCertForm, setShowCertForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);

  const { data: courses = [] } = useQuery({ queryKey: ["training-courses"], queryFn: () => fetchApi("/training/courses") });
  const { data: certifications = [] } = useQuery({ queryKey: ["training-certs"], queryFn: () => fetchApi("/training/certifications") });
  const { data: records = [] } = useQuery({ queryKey: ["training-records"], queryFn: () => fetchApi("/training/records") });
  const { data: expiring = [] } = useQuery({ queryKey: ["training-expiring"], queryFn: () => fetchApi("/training/expiring") });
  const { data: staffList = [] } = useListStaff();

  const [courseForm, setCourseForm] = useState({
    name: "", description: "", category: "general", isRequired: false, renewalMonths: "", durationHours: "", provider: "",
  });

  const [certForm, setCertForm] = useState({
    staffId: "", certificationName: "", certificationNumber: "", issuingOrganization: "", earnedDate: "", expirationDate: "",
  });

  const [assignForm, setAssignForm] = useState({
    staffId: "", courseId: "", dueDate: "", method: "in_person",
  });

  const createCourse = useMutation({
    mutationFn: (data: any) => fetchApi("/training/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["training-courses"] }); setShowCourseForm(false); },
  });

  const createCert = useMutation({
    mutationFn: (data: any) => fetchApi("/training/certifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["training-certs"] }); setShowCertForm(false); },
  });

  const assignTraining = useMutation({
    mutationFn: (data: any) => fetchApi("/training/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["training-records"] }); setShowAssignForm(false); },
  });

  const markComplete = useMutation({
    mutationFn: (id: number) => fetchApi(`/training/records/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", completedAt: new Date().toISOString(), passFail: "pass" }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-records"] }),
  });

  const verifyCert = useMutation({
    mutationFn: (id: number) => fetchApi(`/training/certifications/${id}/verify`, { method: "PUT" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-certs"] }),
  });

  const completedCount = records.filter((r: any) => r.status === "completed").length;
  const pendingCount = records.filter((r: any) => r.status === "assigned").length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap className="h-6 w-6" />
          Training & Certifications
        </h1>
        <p className="text-muted-foreground">Track staff training, certifications, and compliance requirements.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold">{courses.length}</p>
            <p className="text-xs text-muted-foreground">Training Courses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold text-green-600">{completedCount}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className={expiring.length > 0 ? "ring-2 ring-amber-300" : ""}>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{expiring.length}</p>
            <p className="text-xs text-muted-foreground">Expiring Soon</p>
          </CardContent>
        </Card>
      </div>

      {expiring.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800 flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Certifications Expiring Within 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiring.map((cert: any) => (
                <div key={cert.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-amber-200">
                  <div>
                    <p className="font-medium">{cert.staffFirstName} {cert.staffLastName} <span className="text-muted-foreground capitalize">({cert.staffRole})</span></p>
                    <p className="text-sm text-amber-700">{cert.certificationName} — Expires {new Date(cert.expirationDate).toLocaleDateString()}</p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800">
                    {Math.ceil((new Date(cert.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records" className="gap-2"><BookOpen className="h-4 w-4" />Training Records</TabsTrigger>
          <TabsTrigger value="certifications" className="gap-2"><Award className="h-4 w-4" />Certifications</TabsTrigger>
          <TabsTrigger value="courses" className="gap-2"><GraduationCap className="h-4 w-4" />Courses</TabsTrigger>
        </TabsList>

        <TabsContent value="records">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Training Records</CardTitle>
              <Button onClick={() => setShowAssignForm(true)} className="gap-2"><Plus className="h-4 w-4" />Assign Training</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No training records</TableCell></TableRow>
                  ) : records.map((record: any) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.staffFirstName} {record.staffLastName}</TableCell>
                      <TableCell>{record.courseName}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{record.courseCategory}</Badge></TableCell>
                      <TableCell className="text-sm capitalize">{record.method?.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-sm">{record.dueDate ? new Date(record.dueDate).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        {record.status === "completed"
                          ? <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>
                          : record.status === "assigned"
                            ? <Badge className="bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />Assigned</Badge>
                            : <Badge variant="outline" className="capitalize">{record.status}</Badge>}
                      </TableCell>
                      <TableCell>
                        {record.status === "assigned" && (
                          <Button size="sm" variant="outline" onClick={() => markComplete.mutate(record.id)}
                            disabled={markComplete.isPending}>
                            Mark Complete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certifications">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Staff Certifications</CardTitle>
              <Button onClick={() => setShowCertForm(true)} className="gap-2"><Plus className="h-4 w-4" />Add Certification</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Certification</TableHead>
                    <TableHead>Issuing Org</TableHead>
                    <TableHead>Earned</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certifications.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No certifications recorded</TableCell></TableRow>
                  ) : certifications.map((cert: any) => (
                    <TableRow key={cert.id}>
                      <TableCell className="font-medium">{cert.staffFirstName} {cert.staffLastName}</TableCell>
                      <TableCell>{cert.certificationName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{cert.issuingOrganization || "—"}</TableCell>
                      <TableCell className="text-sm">{new Date(cert.earnedDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-sm">
                        {cert.expirationDate ? (
                          <span className={new Date(cert.expirationDate) < new Date() ? "text-red-600 font-medium" : ""}>
                            {new Date(cert.expirationDate).toLocaleDateString()}
                          </span>
                        ) : "N/A"}
                      </TableCell>
                      <TableCell>
                        {cert.verifiedAt
                          ? <Badge className="bg-green-100 text-green-800"><FileCheck className="h-3 w-3 mr-1" />Verified</Badge>
                          : <Badge variant="outline" className="text-muted-foreground">Unverified</Badge>}
                      </TableCell>
                      <TableCell>
                        {!cert.verifiedAt && (
                          <Button size="sm" variant="outline" onClick={() => verifyCert.mutate(cert.id)}>Verify</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Training Courses</CardTitle>
              <Button onClick={() => setShowCourseForm(true)} className="gap-2"><Plus className="h-4 w-4" />Add Course</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Renewal</TableHead>
                    <TableHead>Provider</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No courses defined</TableCell></TableRow>
                  ) : courses.map((course: any) => (
                    <TableRow key={course.id}>
                      <TableCell className="font-medium">{course.name}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{course.category}</Badge></TableCell>
                      <TableCell>
                        {course.isRequired
                          ? <Badge className="bg-red-100 text-red-800">Required</Badge>
                          : <Badge variant="outline">Optional</Badge>}
                      </TableCell>
                      <TableCell className="text-sm">{course.durationHours ? `${course.durationHours} hrs` : "—"}</TableCell>
                      <TableCell className="text-sm">{course.renewalMonths ? `Every ${course.renewalMonths} months` : "One-time"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{course.provider || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showCourseForm} onOpenChange={setShowCourseForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Training Course</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Course Name</label>
              <Input value={courseForm.name} onChange={e => setCourseForm({ ...courseForm, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                value={courseForm.description} onChange={e => setCourseForm({ ...courseForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select value={courseForm.category} onValueChange={v => setCourseForm({ ...courseForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="safety">Safety</SelectItem>
                    <SelectItem value="clinical">Clinical</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="medication">Medication</SelectItem>
                    <SelectItem value="crisis_intervention">Crisis Intervention</SelectItem>
                    <SelectItem value="first_aid">First Aid / CPR</SelectItem>
                    <SelectItem value="hipaa">HIPAA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Provider</label>
                <Input value={courseForm.provider} onChange={e => setCourseForm({ ...courseForm, provider: e.target.value })} placeholder="Training organization" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Duration (hours)</label>
                <Input type="number" value={courseForm.durationHours} onChange={e => setCourseForm({ ...courseForm, durationHours: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Renewal Period (months)</label>
                <Input type="number" value={courseForm.renewalMonths} onChange={e => setCourseForm({ ...courseForm, renewalMonths: e.target.value })} placeholder="Leave empty for one-time" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={courseForm.isRequired}
                onChange={e => setCourseForm({ ...courseForm, isRequired: e.target.checked })} />
              Required for all staff
            </label>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCourseForm(false)}>Cancel</Button>
              <Button onClick={() => createCourse.mutate({
                ...courseForm,
                durationHours: courseForm.durationHours ? parseInt(courseForm.durationHours) : null,
                renewalMonths: courseForm.renewalMonths ? parseInt(courseForm.renewalMonths) : null,
              })} disabled={!courseForm.name || createCourse.isPending}>
                {createCourse.isPending ? "Creating..." : "Create Course"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCertForm} onOpenChange={setShowCertForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Staff Certification</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Staff Member</label>
              <Select value={certForm.staffId} onValueChange={v => setCertForm({ ...certForm, staffId: v })}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {(staffList as any[]).map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Certification Name</label>
              <Input value={certForm.certificationName} onChange={e => setCertForm({ ...certForm, certificationName: e.target.value })} placeholder="e.g., CPR/First Aid, CPI, HIPAA" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Certification Number</label>
                <Input value={certForm.certificationNumber} onChange={e => setCertForm({ ...certForm, certificationNumber: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Issuing Organization</label>
                <Input value={certForm.issuingOrganization} onChange={e => setCertForm({ ...certForm, issuingOrganization: e.target.value })} placeholder="e.g., American Red Cross" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Date Earned</label>
                <Input type="date" value={certForm.earnedDate} onChange={e => setCertForm({ ...certForm, earnedDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Expiration Date</label>
                <Input type="date" value={certForm.expirationDate} onChange={e => setCertForm({ ...certForm, expirationDate: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCertForm(false)}>Cancel</Button>
              <Button onClick={() => createCert.mutate({
                ...certForm,
                staffId: parseInt(certForm.staffId),
              })} disabled={!certForm.staffId || !certForm.certificationName || !certForm.earnedDate || createCert.isPending}>
                {createCert.isPending ? "Adding..." : "Add Certification"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssignForm} onOpenChange={setShowAssignForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Training</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Staff Member</label>
              <Select value={assignForm.staffId} onValueChange={v => setAssignForm({ ...assignForm, staffId: v })}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {(staffList as any[]).map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Training Course</label>
              <Select value={assignForm.courseId} onValueChange={v => setAssignForm({ ...assignForm, courseId: v })}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Due Date</label>
                <Input type="date" value={assignForm.dueDate} onChange={e => setAssignForm({ ...assignForm, dueDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Method</label>
                <Select value={assignForm.method} onValueChange={v => setAssignForm({ ...assignForm, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_person">In Person</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="self_study">Self Study</SelectItem>
                    <SelectItem value="on_the_job">On the Job</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAssignForm(false)}>Cancel</Button>
              <Button onClick={() => assignTraining.mutate({
                staffId: parseInt(assignForm.staffId),
                courseId: parseInt(assignForm.courseId),
                dueDate: assignForm.dueDate || null,
                method: assignForm.method,
              })} disabled={!assignForm.staffId || !assignForm.courseId || assignTraining.isPending}>
                {assignTraining.isPending ? "Assigning..." : "Assign Training"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
