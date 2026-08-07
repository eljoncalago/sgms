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
 *  6. Result shows download links for each PDF part and the full workbook.
 *
 * Refactor 1: one student per A4 page (Student 2 removed) — handled backend-side.
 * Refactor 2: students are sent in small BATCHES with a live progress bar.
 * Each batch gets its own PDF part while one workbook accumulates every page.
 *
 * THEME FIX: CSS variable classes used throughout so they respond to the theme.
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

// Keep each Apps Script call short so it never hits the timeout.
const BATCH_SIZE = 25;
const MAX_BATCH_RETRIES = 3;

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
  const [progress, setProgress] = useState(null);

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

  const makeJobId = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `print-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  const isRetryable = (res) => {
    if (res?.retryable) return true;
    const message = String(res?.message || '').toLowerCase();
    return [
      'network',
      'failed to fetch',
      'timeout',
      'timed out',
      'disconnect',
      'temporarily',
      'service unavailable',
      'server error',
    ].some((term) => message.includes(term));
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const generateBatchWithRetry = async (args) => {
    let lastResponse = null;
    for (let attempt = 1; attempt <= MAX_BATCH_RETRIES; attempt += 1) {
      lastResponse = await printAPI.generate(...args);
      if (lastResponse.success || !isRetryable(lastResponse) || attempt === MAX_BATCH_RETRIES) {
        return lastResponse;
      }
      await sleep(attempt * 1500);
    }
    return lastResponse;
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
    setProgress({ current: 0, total: 0, studentsDone: 0, totalStudents: selected.size });

    // Chunk selected students into batches so each request stays short.
    const allIds = Array.from(selected);
    const batches = [];
    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
      batches.push(allIds.slice(i, i + BATCH_SIZE));
    }
    const totalBatches = batches.length;
    const jobId = makeJobId();

    let workbookId = null;
    let totalProcessed = 0;
    let allErrors = [];
    let pdfParts = [];
    let lastRes = null;
    let failed = null;

    for (let bi = 0; bi < totalBatches; bi++) {
      setProgress({
        current: bi + 1,
        total: totalBatches,
        studentsDone: totalProcessed,
        totalStudents: allIds.length,
      });

      const res = await generateBatchWithRetry([
        batches[bi],
        Number(stage),
        templateId,
        bi,
        totalBatches,
        workbookId,
        jobId,
        bi * BATCH_SIZE,
      ]);

      if (!res.success) {
        failed = res;
        break;
      }

      lastRes = res;
      totalProcessed += res.data?.processed || 0;
      if (res.data?.errors?.length) allErrors = allErrors.concat(res.data.errors);
      workbookId = res.data?.workbookId || workbookId;
      if (res.data?.pdfParts?.length) {
        pdfParts = pdfParts.concat(
          res.data.pdfParts.filter((part) => !pdfParts.some((existing) => existing.url === part.url))
        );
      } else if (res.data?.pdfPart) {
        pdfParts.push(res.data.pdfPart);
      }
      setProgress({
        current: bi + 1,
        total: totalBatches,
        studentsDone: totalProcessed,
        totalStudents: allIds.length,
      });
    }

    setGenerating(false);
    setProgress(null);

    if (failed) {
      const partial = totalProcessed > 0 ? ` (stopped after ${totalProcessed} students)` : '';
      setResult({ type: 'error', message: (failed.message || 'Generation failed') + partial });
      toast.error(failed.message || 'Generation failed');
      return;
    }

    const pdfUrl = lastRes?.data?.pdfUrl || lastRes?.data?.fileUrl;
    const sheetUrl = lastRes?.data?.spreadsheetUrl;
    setResult({
      type: 'success',
      data: {
        fileUrl: pdfUrl,
        pdfParts,
        spreadsheetUrl: sheetUrl,
        processed: totalProcessed,
        errors: allErrors,
      },
      message: `Report cards generated for ${totalProcessed} student${totalProcessed === 1 ? '' : 's'}`
    });
    toast.success(`Report cards generated for ${totalProcessed} student${totalProcessed === 1 ? '' : 's'}`);
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
              <p className="text-xs text-[var(--muted-foreground)]">
                Found in the Google Drive URL: drive.google.com/file/d/<strong>[THIS_PART]</strong>/view
              </p>
            </div>

            {/* Grade Level */}
            <div className="space-y-2">
              <Label>Grade Level (Mathayom)</Label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
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
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
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
                        ? 'border-[var(--primary)] bg-[var(--accent)] text-[var(--accent-foreground)]'
                        : 'border-[var(--border)] hover:border-[var(--primary)]'
                    }`}
                  >
                    <div className="font-medium text-sm">{s.label}</div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-1">{s.description}</div>
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
                      <TableCell className="text-xs text-[var(--muted-foreground)]">{s.STUDENT_ID}</TableCell>
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

      {/* Batch progress */}
      {generating && progress && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating… Batch {progress.current} of {progress.total || 1}
              </span>
              <span className="text-[var(--muted-foreground)]">
                {progress.studentsDone} / {progress.totalStudents} students
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--muted)] overflow-hidden">
              <div
                className="h-full bg-[var(--primary)] transition-all"
                style={{
                  width: `${
                    progress.total
                      ? (progress.current / progress.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              Each batch is a short separate request. If the connection drops, the same batch is retried safely.
            </p>
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
            {result.data?.pdfParts?.length > 0 ? (
              <div className="space-y-1">
                <div className="text-sm font-medium">PDF report parts</div>
                {result.data.pdfParts.map((part, index) => (
                  <a
                    key={`${part.url}-${index}`}
                    href={part.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[var(--primary)] underline text-sm"
                  >
                    Open Report Part {part.part || index + 1}
                    {part.processed ? ` (${part.processed} students)` : ''}
                  </a>
                ))}
              </div>
            ) : result.data?.fileUrl && (
              <a
                href={result.data.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-1 text-[var(--primary)] underline text-sm"
              >
                Open Generated Report
              </a>
            )}
            {result.data?.spreadsheetUrl && (
              <a
                href={result.data.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-1 ml-2 text-[var(--primary)] underline text-sm"
              >
                Open Spreadsheet
              </a>
            )}
            {result.data?.message && (
              <div className="text-sm text-[var(--muted-foreground)]">{result.data.message}</div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default PrintReports;