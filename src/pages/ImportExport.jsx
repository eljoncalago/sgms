/**
 * ImportExport.js
 * Plan Page 12 — Bulk data management.
 * Covers: Student import, Score import, Student export.
 *
 * Import flow: Download Excel template → open/edit in Excel or Google Sheets →
 *              download as .xlsx → Upload here → Preview → Validate → Commit
 *
 * FIX: This page used to read/write raw CSV text. CSV loses number formatting,
 * doesn't round-trip cleanly through Google Sheets ("File > Download > Excel"
 * re-adds a BOM / different quoting that the old hand-rolled parser choked
 * on), and isn't what the school actually works in day to day. Everything
 * here now goes through SheetJS (the `xlsx` package) so both the downloaded
 * template and the exported data are real .xlsx workbooks — the same files
 * can be opened directly in Excel or uploaded to Google Drive and edited as
 * a Google Sheet, then re-exported as .xlsx and uploaded back here.
 */
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
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

// ─── Excel (.xlsx) helpers ──────────────────────────────────────────────────

/**
 * Read an uploaded .xlsx/.xls file and return { headers, rows } — rows are
 * arrays of cell values in header order, mirroring the old CSV shape so the
 * rest of this file (preview table, commit handlers) didn't need to change.
 */
function parseXLSXFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // header:1 -> array-of-arrays, raw rows exactly as typed in the sheet
        const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
        const nonEmpty = aoa.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
        if (nonEmpty.length < 1) {
          resolve({ headers: [], rows: [] });
          return;
        }
        const headers = nonEmpty[0].map((h) => String(h).trim());
        const rows = nonEmpty.slice(1).map((r) =>
          headers.map((_, i) => String(r[i] ?? '').trim())
        );
        resolve({ headers, rows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/** Build and download a real .xlsx workbook (opens fine in Excel & Google Sheets). */
function downloadXLSX(filename, sheetName, headers, rows) {
  const aoa = [headers, ...rows];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  XLSX.writeFile(workbook, filename);
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
    downloadXLSX('sgms_students_template.xlsx', 'Students', STUDENT_HEADERS, [
      ['', 'ชื่อภาษาไทย', 'English Name', '5', '1', '1', 'Active'],
    ]);
    toast.success('Template downloaded');
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setResult(null);
    setParseError('');
    setPreview(null);
    try {
      const { headers, rows } = await parseXLSXFile(file);
      const missing = STUDENT_HEADERS.filter((h) => !headers.includes(h));
      if (missing.length > 0) {
        setParseError(`Missing required columns: ${missing.join(', ')}`);
        return;
      }
      setPreview({ headers, rows });
    } catch {
      setParseError('Could not read this Excel file. Please use the provided template (.xlsx).');
    }
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
            Download the Excel (.xlsx) template, fill in your student data — you can edit it
            in Excel or upload it to Google Drive and edit as a Google Sheet — then download it
            as .xlsx and upload it below. Leave STUDENT_ID blank — the system generates it
            automatically.
          </p>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="w-4 h-4 mr-2" />
            Download Student Template (.xlsx)
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
              Choose Excel File
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleFileChange} />
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
    downloadXLSX('sgms_scores_template.xlsx', 'Scores', SCORE_HEADERS, [
      ['STD001', 'ACT001', '80'],
    ]);
    toast.success('Template downloaded');
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setResult(null);
    setParseError('');
    setPreview(null);
    try {
      const { headers, rows } = await parseXLSXFile(file);
      const missing = SCORE_HEADERS.filter((h) => !headers.includes(h));
      if (missing.length > 0) {
        setParseError(`Missing required columns: ${missing.join(', ')}`);
        return;
      }
      setPreview({ headers, rows });
    } catch {
      setParseError('Could not read this Excel file. Please use the provided template (.xlsx).');
    }
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
            Download the Excel (.xlsx) template, fill in STUDENT_ID, ACTIVITY_ID, and
            RAW_SCORE — editable in Excel or as a Google Sheet — then upload it as .xlsx.
          </p>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="w-4 h-4 mr-2" />
            Download Score Template (.xlsx)
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
            Choose Excel File
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleFileChange} />

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
      downloadXLSX('sgms_students_export.xlsx', 'Students', headers, rows);
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
            Download all active students as an Excel (.xlsx) file. The exported file can be
            opened in Excel or Google Sheets, and re-imported with the student import tool.
          </p>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <Download className="w-4 h-4 mr-2" />}
            Export Students to Excel
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