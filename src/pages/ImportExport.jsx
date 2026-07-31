/**
 * ImportExport.js
 * Plan Page 12 — Bulk data management.
 * Covers: Student import, Score import, Student export.
 *
 * Import flow: Download template → Upload CSV → Preview → Validate → Commit
 */
import React, { useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
  Upload,
  Download,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { importExportAPI } from '@/api/sgmsAPI';
import { PageHeader } from '@/components/PageState';
import { toast } from 'sonner';

// ─── CSV helpers ────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) =>
    line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
  );
  return { headers, rows };
}

function downloadCSV(filename, headers, rows) {
  const content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Student template headers (must match backend STUDENTS sheet) ────────────
const STUDENT_HEADERS = [
  'STUDENT_ID',
  'THAI_NAME',
  'ENGLISH_NAME',
  'GRADE_LEVEL',
  'SECTION_NUMBER',
  'CLASS_NUMBER',
  'STATUS',
];

// ─── Score template headers ─────────────────────────────────────────────────
const SCORE_HEADERS = ['STUDENT_ID', 'ACTIVITY_ID', 'RAW_SCORE'];

// ─── ImportStudents tab ──────────────────────────────────────────────────────
const ImportStudentsTab = () => {
  const fileRef = useRef();
  const [preview, setPreview] = useState(null); // { headers, rows }
  const [parseError, setParseError] = useState('');
  const [mode, setMode] = useState('INSERT_NEW_ONLY');
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleDownloadTemplate = () => {
    downloadCSV('sgms_students_template.csv', STUDENT_HEADERS, [
      ['', 'ชื่อภาษาไทย', 'English Name', '5', '1', '1', 'Active'],
    ]);
    toast.success('Template downloaded');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setResult(null);
    setParseError('');
    setPreview(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { headers, rows } = parseCSV(ev.target.result);
        const missing = STUDENT_HEADERS.filter((h) => !headers.includes(h));
        if (missing.length > 0) {
          setParseError(`Missing required columns: ${missing.join(', ')}`);
          return;
        }
        setPreview({ headers, rows });
      } catch {
        setParseError('Could not parse CSV file. Please use the provided template.');
      }
    };
    reader.readAsText(file);
    // reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleCommit = async () => {
    if (!preview) return;
    setCommitting(true);
    const students = preview.rows.map((row) => {
      const obj = {};
      preview.headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
    const res = await importExportAPI.importStudents(students, mode);
    setCommitting(false);
    if (res.success) {
      setResult({ type: 'success', message: res.message, data: res.data });
      setPreview(null);
      toast.success(res.message || 'Import completed');
    } else {
      setResult({ type: 'error', message: res.message });
      toast.error(res.message || 'Import failed');
    }
  };

  return (
    <div className="space-y-4">
      {/* Step 1 — Download Template */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 1 — Download Template</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-3">
            Download the CSV template, fill in your student data, then upload it below.
            Leave STUDENT_ID blank — the system generates it automatically.
          </p>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="w-4 h-4 mr-2" />
            Download Student Template
          </Button>
        </CardContent>
      </Card>

      {/* Step 2 — Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 2 — Upload & Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Choose CSV File
            </Button>
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={handleFileChange} />
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Import Mode:</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="INSERT_NEW_ONLY">Insert New Only</option>
                <option value="UPDATE_EXISTING_AND_NEW">Update Existing + Create New</option>
              </select>
            </div>
          </div>

          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {preview && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Preview — <strong>{preview.rows.length}</strong> student{preview.rows.length !== 1 ? 's' : ''} found
              </p>
              <div className="border rounded overflow-x-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {preview.headers.map((h) => (
                        <TableHead key={h} className="whitespace-nowrap text-xs">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell, j) => (
                          <TableCell key={j} className="text-xs">{cell || '—'}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {preview.rows.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={preview.headers.length} className="text-center text-xs text-gray-400">
                          …and {preview.rows.length - 10} more rows
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <Button onClick={handleCommit} disabled={committing}>
                {committing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Commit Import ({preview.rows.length} records)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Alert variant={result.type === 'success' ? 'default' : 'destructive'}>
          {result.type === 'success'
            ? <CheckCircle className="w-4 h-4" />
            : <AlertCircle className="w-4 h-4" />}
          <AlertDescription>
            {result.message}
            {result.data && (
              <span className="ml-2 text-xs">
                (created: {result.data.created ?? 0}, updated: {result.data.updated ?? 0},
                errors: {result.data.errors ?? 0})
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

// ─── ImportScores tab ────────────────────────────────────────────────────────
const ImportScoresTab = () => {
  const fileRef = useRef();
  const [preview, setPreview] = useState(null);
  const [parseError, setParseError] = useState('');
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleDownloadTemplate = () => {
    downloadCSV('sgms_scores_template.csv', SCORE_HEADERS, [
      ['STD001', 'ACT001', '80'],
    ]);
    toast.success('Template downloaded');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setResult(null);
    setParseError('');
    setPreview(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { headers, rows } = parseCSV(ev.target.result);
        const missing = SCORE_HEADERS.filter((h) => !headers.includes(h));
        if (missing.length > 0) {
          setParseError(`Missing required columns: ${missing.join(', ')}`);
          return;
        }
        setPreview({ headers, rows });
      } catch {
        setParseError('Could not parse CSV file. Please use the provided template.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCommit = async () => {
    if (!preview) return;
    setCommitting(true);
    const scores = preview.rows.map((row) => {
      const obj = {};
      preview.headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
    const res = await importExportAPI.importScores(scores);
    setCommitting(false);
    if (res.success) {
      setResult({ type: 'success', message: res.message, data: res.data });
      setPreview(null);
      toast.success(res.message || 'Score import completed');
    } else {
      setResult({ type: 'error', message: res.message });
      toast.error(res.message || 'Import failed');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 1 — Download Template</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-3">
            Download the CSV template, fill in STUDENT_ID, ACTIVITY_ID, and RAW_SCORE,
            then upload.
          </p>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="w-4 h-4 mr-2" />
            Download Score Template
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 2 — Upload & Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Choose CSV File
          </Button>
          <input ref={fileRef} type="file" accept=".csv" hidden onChange={handleFileChange} />

          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {preview && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Preview — <strong>{preview.rows.length}</strong> score record{preview.rows.length !== 1 ? 's' : ''} found
              </p>
              <div className="border rounded overflow-x-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {preview.headers.map((h) => (
                        <TableHead key={h} className="text-xs">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell, j) => (
                          <TableCell key={j} className="text-xs">{cell || '—'}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {preview.rows.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={preview.headers.length} className="text-center text-xs text-gray-400">
                          …and {preview.rows.length - 10} more rows
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <Button onClick={handleCommit} disabled={committing}>
                {committing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Commit Import ({preview.rows.length} records)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Alert variant={result.type === 'success' ? 'default' : 'destructive'}>
          {result.type === 'success'
            ? <CheckCircle className="w-4 h-4" />
            : <AlertCircle className="w-4 h-4" />}
          <AlertDescription>
            {result.message}
            {result.data && (
              <span className="ml-2 text-xs">
                (saved: {result.data.saved ?? 0}, errors: {result.data.errors ?? 0})
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

// ─── ExportStudents tab ──────────────────────────────────────────────────────
const ExportStudentsTab = () => {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    const res = await importExportAPI.exportStudents();
    setExporting(false);
    if (res.success && res.data) {
      const students = Array.isArray(res.data) ? res.data : [];
      if (students.length === 0) {
        toast.info('No students to export');
        return;
      }
      const headers = Object.keys(students[0]);
      const rows = students.map((s) => headers.map((h) => String(s[h] ?? '')));
      downloadCSV('sgms_students_export.csv', headers, rows);
      toast.success(`Exported ${students.length} students`);
    } else {
      toast.error(res.message || 'Export failed');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export All Students</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            Download all active students as a CSV file. The exported file can be used as
            a reference or re-imported with the student import tool.
          </p>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <Download className="w-4 h-4 mr-2" />}
            Export Students to CSV
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Main page ───────────────────────────────────────────────────────────────
const ImportExport = () => (
  <div className="p-6 space-y-6">
    <PageHeader
      title="Import / Export"
      description="Bulk data management — import students and scores, export data for backup or migration."
    />
    <Tabs defaultValue="import-students">
      <TabsList>
        <TabsTrigger value="import-students">
          <FileText className="w-4 h-4 mr-2" />
          Import Students
        </TabsTrigger>
        <TabsTrigger value="import-scores">
          <FileText className="w-4 h-4 mr-2" />
          Import Scores
        </TabsTrigger>
        <TabsTrigger value="export">
          <Download className="w-4 h-4 mr-2" />
          Export
        </TabsTrigger>
      </TabsList>

      <TabsContent value="import-students" className="mt-4">
        <ImportStudentsTab />
      </TabsContent>
      <TabsContent value="import-scores" className="mt-4">
        <ImportScoresTab />
      </TabsContent>
      <TabsContent value="export" className="mt-4">
        <ExportStudentsTab />
      </TabsContent>
    </Tabs>
  </div>
);

export default ImportExport;
