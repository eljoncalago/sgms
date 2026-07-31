import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { studentsAPI, reportsAPI } from '@/api/sgmsAPI';
import { PageHeader, Loading, EmptyState } from '@/components/PageState';
import { toast } from 'sonner';

const PassFailBadge = ({ passed }) =>
  passed ? (
    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
      <CheckCircle2 className="w-3 h-3 mr-1" /> Pass
    </Badge>
  ) : (
    <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
      <XCircle className="w-3 h-3 mr-1" /> Fail
    </Badge>
  );

const Reports = () => {
  // Student report
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [studentReport, setStudentReport] = useState(null);
  const [loadingSR, setLoadingSR] = useState(false);

  // Class report
  const [gradeLevel, setGradeLevel] = useState('');
  const [section, setSection] = useState('');
  const [classReport, setClassReport] = useState(null);
  const [loadingCR, setLoadingCR] = useState(false);

  // Pass/fail
  const [pfGrade, setPfGrade] = useState('');
  const [pfSection, setPfSection] = useState('');
  const [passFail, setPassFail] = useState(null);
  const [loadingPF, setLoadingPF] = useState(false);

  useEffect(() => {
    studentsAPI.getAll({ status: 'Active' }).then((res) => {
      if (res.success) setStudents(res.data || []);
    });
  }, []);

  const generateStudentReport = async () => {
    if (!studentId) {
      toast.error('Select a student');
      return;
    }
    setLoadingSR(true);
    setStudentReport(null);
    const res = await reportsAPI.getStudentReport(studentId);
    setLoadingSR(false);
    if (res.success) setStudentReport(res.data);
    else toast.error(res.message || 'Failed to generate report');
  };

  const generateClassReport = async () => {
    if (!gradeLevel || !section) {
      toast.error('Grade level and section are required');
      return;
    }
    setLoadingCR(true);
    setClassReport(null);
    const res = await reportsAPI.getClassReport(Number(gradeLevel), Number(section));
    setLoadingCR(false);
    if (res.success) setClassReport(res.data);
    else toast.error(res.message || 'Failed to generate report');
  };

  const generatePassFail = async () => {
    if (!pfGrade || !pfSection) {
      toast.error('Grade level and section are required');
      return;
    }
    setLoadingPF(true);
    setPassFail(null);
    const res = await reportsAPI.getPassFailList(Number(pfGrade), Number(pfSection), null);
    setLoadingPF(false);
    if (res.success) setPassFail(res.data || {});
    else toast.error(res.message || 'Failed to generate list');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="Reports" description="Student transcripts, class reports and pass/fail lists" />

      <Tabs defaultValue="student">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="student">Student</TabsTrigger>
          <TabsTrigger value="class">Class</TabsTrigger>
          <TabsTrigger value="passfail">Pass/Fail</TabsTrigger>
        </TabsList>

        {/* Student report */}
        <TabsContent value="student">
          <Card>
            <CardHeader>
              <CardTitle>Student Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-3 md:items-end mb-6">
                <div className="space-y-1.5 flex-1">
                  <Label>Student</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                  >
                    <option value="">Select student…</option>
                    {students.map((s) => (
                      <option key={s.STUDENT_ID} value={s.STUDENT_ID}>
                        {s.ENGLISH_NAME} ({s.STUDENT_ID})
                      </option>
                    ))}
                  </select>
                </div>
                <Button onClick={generateStudentReport} disabled={loadingSR}>
                  {loadingSR && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Generate
                </Button>
              </div>

              {loadingSR ? (
                <Loading label="Generating report…" />
              ) : studentReport ? (
                <StudentReportView report={studentReport} />
              ) : (
                <EmptyState icon={FileText} title="No report yet" description="Select a student and generate a report." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Class report */}
        <TabsContent value="class">
          <Card>
            <CardHeader>
              <CardTitle>Class Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-3 md:items-end mb-6">
                <div className="space-y-1.5">
                  <Label>Grade Level</Label>
                  <Input type="number" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className="w-40" />
                </div>
                <div className="space-y-1.5">
                  <Label>Section</Label>
                  <Input type="number" value={section} onChange={(e) => setSection(e.target.value)} className="w-40" />
                </div>
                <Button onClick={generateClassReport} disabled={loadingCR}>
                  {loadingCR && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Generate
                </Button>
              </div>

              {loadingCR ? (
                <Loading label="Generating report…" />
              ) : classReport ? (
                <ClassReportView report={classReport} />
              ) : (
                <EmptyState icon={FileText} title="No report yet" description="Enter grade level and section to generate." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pass/Fail */}
        <TabsContent value="passfail">
          <Card>
            <CardHeader>
              <CardTitle>Pass / Fail List</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-3 md:items-end mb-6">
                <div className="space-y-1.5">
                  <Label>Grade Level</Label>
                  <Input type="number" value={pfGrade} onChange={(e) => setPfGrade(e.target.value)} className="w-40" />
                </div>
                <div className="space-y-1.5">
                  <Label>Section</Label>
                  <Input type="number" value={pfSection} onChange={(e) => setPfSection(e.target.value)} className="w-40" />
                </div>
                <Button onClick={generatePassFail} disabled={loadingPF}>
                  {loadingPF && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Generate
                </Button>
              </div>

              {loadingPF ? (
                <Loading label="Generating list…" />
              ) : passFail ? (
                <PassFailView data={passFail} />
              ) : (
                <EmptyState icon={FileText} title="No list yet" description="Enter grade level and section to generate." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const StudentReportView = ({ report }) => {
  const g = report.grades || {};
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-lg border bg-gray-50 p-4">
        <div>
          <p className="font-semibold text-lg">{report.student?.ENGLISH_NAME}</p>
          <p className="text-sm text-gray-500">
            {report.student?.STUDENT_ID} · Grade {report.student?.GRADE_LEVEL} · Section {report.student?.SECTION_NUMBER}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Overall Grade</p>
          <p className={`text-2xl font-bold ${g.overallPassed ? 'text-green-600' : 'text-red-600'}`}>
            {g.overallGrade}%
          </p>
          <PassFailBadge passed={g.overallPassed} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Term</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>Raw %</TableHead>
              <TableHead>Weighted</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(g.termGrades || []).map((t) => (
              <TableRow key={t.termId}>
                <TableCell className="font-medium">{t.termName}</TableCell>
                <TableCell>{t.weight}%</TableCell>
                <TableCell>{t.rawPercentage}%</TableCell>
                <TableCell>{t.weightedScore}</TableCell>
                <TableCell><PassFailBadge passed={t.passed} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Score Details</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Max</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report.scores || []).map((s, i) => (
                <TableRow key={i}>
                  <TableCell>{s.activityName}</TableCell>
                  <TableCell><Badge variant="secondary">{s.activityType}</Badge></TableCell>
                  <TableCell>{s.maxScore}</TableCell>
                  <TableCell className="font-medium">{s.RAW_SCORE}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

const ClassReportView = ({ report }) => {
  const students = report.students || [];
  const passCount = students.filter((s) => s.passed).length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Students" value={students.length} />
        <Stat label="Passed" value={passCount} />
        <Stat label="Failed" value={students.length - passCount} />
        <Stat label="Pass Rate" value={`${students.length ? Math.round((passCount / students.length) * 100) : 0}%`} />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Student ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Overall Grade</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s, i) => (
              <TableRow key={s.studentId}>
                <TableCell>{i + 1}</TableCell>
                <TableCell className="font-mono text-xs">{s.studentId}</TableCell>
                <TableCell className="font-medium">{s.studentName}</TableCell>
                <TableCell className={s.passed ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                  {s.overallGrade}%
                </TableCell>
                <TableCell><PassFailBadge passed={s.passed} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const PassFailView = ({ data }) => {
  const passing = data.passingStudents || [];
  const failing = data.failingStudents || [];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <PassFailTable title={`Passing (${passing.length})`} rows={passing} variant="pass" />
      <PassFailTable title={`Failing (${failing.length})`} rows={failing} variant="fail" />
    </div>
  );
};

const PassFailTable = ({ title, rows, variant }) => (
  <div>
    <h3 className={`font-semibold mb-2 ${variant === 'pass' ? 'text-green-700' : 'text-red-700'}`}>{title}</h3>
    {rows.length === 0 ? (
      <p className="text-sm text-gray-400">No students.</p>
    ) : (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Overall</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.studentId}>
                <TableCell>{s.classNumber}</TableCell>
                <TableCell className="font-medium">{s.englishName}</TableCell>
                <TableCell className={variant === 'pass' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                  {s.overallGrade}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )}
  </div>
);

const Stat = ({ label, value }) => (
  <div className="rounded-lg border bg-gray-50 p-3">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-xl font-bold">{value}</p>
  </div>
);

export default Reports;