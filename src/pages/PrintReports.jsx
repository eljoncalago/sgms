/**
 * PrintReports.js
 * Plan Page 10 — Generate official Excel/PDF report cards.
 *
 * Flow:
 *  1. Enter the Google Drive Excel template file ID (stored in Settings).
 *  2. Select grade level + section → student list loads.
 *  3. Select students (multi-select).
 *  4. Choose semester stage (1–4).
 *  5. Click Generate → triggers PrintService.gs → backend fills the template.
 *  6. Result shows download URL or status message.
 *
 * Note: PrintService.gs requires a properly formatted Excel template to exist
 * in Google Drive. See INSTALLATION_GUIDE.md → PrintService setup.
 *
 * FIX: printAPI.generate now requires templateId as a third argument so the
 * backend can open the template file from Google Drive.
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Printer, Loader2, CheckCircle, Info } from 'lucide-react';
import { studentsAPI, printAPI, settingsAPI } from '@/api/sgmsAPI';
import { PageHeader, Loading } from '@/components/PageState';
import { toast } from 'sonner';

const GRADE_LEVELS = [1, 2, 3, 4, 5, 6];
const SECTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const STAGES = [
  { value: '1', label: 'Stage 1', description: 'Midterm Collective + Midterm Exam' },
  { value: '2', label: 'Stage 2', description: 'Stage 1 + Final Collective Initial' },
  { value: '3', label: 'Stage 3', description: 'Stage 2 + Final Collective Final' },
  { value: '4', label: 'Stage 4 (Final)', description: 'All stages + Final Exam (complete)' },
];

const PrintReports = () => {
  // Filters
  const [gradeLevel, setGradeLevel] = useState('');
  const [section, setSection] = useState('');
  const [stage, setStage] = useState('4');
  const [templateId, setTemplateId] = useState('');

  // Students
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selected, setSelected] = useState(new Set());

  // State
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  // Load template ID from settings on mount
  useEffect(() => {
    (async () => {
      const res = await settingsAPI.getAll();
      if (res.success && res.data?.PRINT_TEMPLATE_ID) {
        setTemplateId(res.data.PRINT_TEMPLATE_ID);
      }
    })();
  }, []);

  const loadStudents = async () => {
    if (!gradeLevel || !section) {
      toast.warning('Please select a grade level and section first');
      return;
    }
    setLoadingStudents(true);
    setSelected(new Set());
    setResult(null);
    const res = await studentsAPI.getAll({
      gradeLevel: Number(gradeLevel),
      section: Number(section),
      status: 'Active',
    });
    setLoadingStudents(false);
    if (res.success) {
      const list = (res.data || []).sort((a, b) => a.CLASS_NUMBER - b.CLASS_NUMBER);
      setStudents(list);
      // Select all by default
      setSelected(new Set(list.map((s) => s.STUDENT_ID)));
    } else {
      toast.error(res.message || 'Failed to load students');
    }
  };

  const toggleStudent = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === students.length) setSelected(new Set());
    else setSelected(new Set(students.map((s) => s.STUDENT_ID)));
  };

  const handleGenerate = async () => {
    if (selected.size === 0) {
      toast.warning('Please select at least one student');
      return;
    }
    if (!templateId) {
      toast.warning('Please enter the Google Drive template file ID');
      return;
    }

    setGenerating(true);
    setResult(null);

    // FIX: pass templateId as the third argument so the backend can open the file
    const res = await printAPI.generate(
      Array.from(selected),
      Number(stage),
      templateId
    );

    setGenerating(false);
    if (res.success) {
      setResult({ type: 'success', data: res.data, message: res.message });
      toast.success(res.message || 'Report generated');
    } else {
      setResult({ type: 'error', message: res.message });
      toast.error(res.message || 'Generation failed');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Print Report Cards"
        description="Generate official Excel/PDF report cards using your school's template file."
      />

      {/* Template Info */}
      <Alert>
        <Info className="w-4 h-4" />
        <AlertDescription>
          You need an Excel report card template stored in Google Drive. 
          Copy its <strong>File ID</strong> from the Google Drive share URL and paste it below (or save it in Settings → PRINT_TEMPLATE_ID).
        </AlertDescription>
      </Alert>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Template ID */}
            <div className="md:col-span-2 space-y-2">
              <Label>Google Drive Template File ID</Label>
              <Input
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              />
              <p className="text-xs text-gray-400">
                Found in the Google Drive URL: drive.google.com/file/d/<strong>[THIS_PART]</strong>/view
              </p>
            </div>

            {/* Grade Level */}
            <div className="space-y-2">
              <Label>Grade Level (Mathayom)</Label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select grade</option>
                {GRADE_LEVELS.map((g) => (
                  <option key={g} value={g}>M{g}</option>
                ))}
              </select>
            </div>

            {/* Section */}
            <div className="space-y-2">
              <Label>Section</Label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select section</option>
                {SECTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Semester Stage */}
            <div className="space-y-2 md:col-span-2">
              <Label>Semester Stage</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {STAGES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStage(s.value)}
                    className={`text-left border rounded-lg p-3 transition-colors ${
                      stage === s.value
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-sm">{s.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{s.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button onClick={loadStudents} disabled={loadingStudents || !gradeLevel || !section}>
            {loadingStudents && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Load Students
          </Button>
        </CardContent>
      </Card>

      {/* Student Selection */}
      {loadingStudents && <Loading label="Loading students…" />}

      {!loadingStudents && students.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Select Students ({selected.size} / {students.length})</span>
              <Button variant="outline" size="sm" onClick={toggleAll}>
                {selected.size === students.length ? 'Deselect All' : 'Select All'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selected.size === students.length && students.length > 0}
                        onChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>#</TableHead>
                    <TableHead>English Name</TableHead>
                    <TableHead>Thai Name</TableHead>
                    <TableHead>Class No.</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => (
                    <TableRow
                      key={s.STUDENT_ID}
                      className="cursor-pointer"
                      onClick={() => toggleStudent(s.STUDENT_ID)}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(s.STUDENT_ID)}
                          onChange={() => toggleStudent(s.STUDENT_ID)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">{s.STUDENT_ID}</TableCell>
                      <TableCell className="font-medium">{s.ENGLISH_NAME}</TableCell>
                      <TableCell>{s.THAI_NAME}</TableCell>
                      <TableCell>{s.CLASS_NUMBER}</TableCell>
                      <TableCell>
                        <Badge variant={s.STATUS === 'Active' ? 'default' : 'secondary'}>
                          {s.STATUS}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4">
              <Button onClick={handleGenerate} disabled={generating || selected.size === 0}>
                {generating
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Printer className="w-4 h-4 mr-2" />}
                Generate Report Cards ({selected.size} students, Stage {stage})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Alert variant={result.type === 'success' ? 'default' : 'destructive'}>
          {result.type === 'success'
            ? <CheckCircle className="w-4 h-4" />
            : <Info className="w-4 h-4" />}
          <AlertDescription className="space-y-2">
            <div>{result.message}</div>
            {result.data?.fileUrl && (
              <a
                href={result.data.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-1 text-blue-600 underline text-sm"
              >
                Open Generated Report
              </a>
            )}
            {result.data?.message && (
              <div className="text-sm text-gray-600">{result.data.message}</div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default PrintReports;
