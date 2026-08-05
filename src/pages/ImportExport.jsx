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
import React, { useState, useRef, useEffect, useMemo } from 'react';
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
import { importExportAPI, termsAPI, activitiesAPI, studentsAPI, scoresAPI } from '@/api/sgmsAPI';
import { PageHeader, Loading } from '@/components/PageState';
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
            as .xlsx and upload it below. Enter the student's existing STUDENT_ID in the
            STUDENT_ID column — the system keeps it exactly as written. Leave it blank only for
            brand-new students with no assigned ID, and the system will generate one.
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
/**
 * Guided score import.
 *
 * FIX: the old version just handed out an empty 3-column template
 * (STUDENT_ID / ACTIVITY_ID / RAW_SCORE) and expected the teacher to know
 * every internal ID by heart. Now the teacher picks:
 *
 *    1. Grade level  — a specific grade, or ALL grade levels
 *    2. Section      — a specific section of that grade, or ALL sections
 *    3. Term         — the grading term
 *    4. Activity     — the activity being scored
 *
 * …and the system generates the workbook for them: one row per matching
 * student, already carrying STUDENT_ID, the student's name/grade/section/class
 * number (read-only context), the chosen ACTIVITY_ID + ACTIVITY_NAME and its
 * MAX_SCORE. Any score already recorded is pre-filled so the sheet doubles as
 * a correction sheet. The teacher only types into RAW_SCORE.
 *
 * On upload the ACTIVITY_ID travels back with every row, so the backend knows
 * exactly which activity each score belongs to, and STUDENT_ID says which
 * student — no guessing, no re-selecting anything.
 */
const ALL = '__ALL__';

// Columns of the generated score workbook. STUDENT_ID / ACTIVITY_ID /
// RAW_SCORE are what the backend consumes; the rest is human context.
const SCORE_TEMPLATE_HEADERS = [
  'STUDENT_ID',
  'ENGLISH_NAME',
  'THAI_NAME',
  'GRADE_LEVEL',
  'SECTION_NUMBER',
  'CLASS_NUMBER',
  'ACTIVITY_ID',
  'ACTIVITY_NAME',
  'MAX_SCORE',
  'RAW_SCORE',
];

// Minimum columns an uploaded file must still contain.
const SCORE_REQUIRED_HEADERS = ['STUDENT_ID', 'ACTIVITY_ID', 'RAW_SCORE'];

const ImportScoresTab = () => {
  const fileRef = useRef();

  // Reference data
  const [terms, setTerms] = useState([]);
  const [activities, setActivities] = useState([]);
  const [students, setStudents] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Selection
  const [grade, setGrade] = useState(ALL);
  const [section, setSection] = useState(ALL);
  const [termId, setTermId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [generating, setGenerating] = useState(false);

  // Upload
  const [preview, setPreview] = useState(null);
  const [parseError, setParseError] = useState('');
  const [rowIssues, setRowIssues] = useState([]);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      const [termsRes, actsRes, studsRes] = await Promise.all([
        termsAPI.getAll(),
        activitiesAPI.getAll(),
        studentsAPI.getAll({ status: 'Active' }),
      ]);
      if (termsRes.success) setTerms(termsRes.data || []);
      if (actsRes.success) setActivities(actsRes.data || []);
      if (studsRes.success) setStudents(studsRes.data || []);
      setLoadingMeta(false);
    })();
  }, []);

  const gradeLevels = useMemo(() => {
    const list = [...new Set(students.map((s) => String(s.GRADE_LEVEL || '').trim()).filter(Boolean))];
    return list.sort((a, b) => Number(a) - Number(b));
  }, [students]);

  const sections = useMemo(() => {
    const pool = grade === ALL ? students : students.filter((s) => String(s.GRADE_LEVEL) === grade);
    const list = [...new Set(pool.map((s) => String(s.SECTION_NUMBER || '').trim()).filter(Boolean))];
    return list.sort((a, b) => Number(a) - Number(b));
  }, [students, grade]);

  // Activities of the chosen term, restricted to the chosen grade when the
  // activity is grade-specific (activities with no GRADE_LEVEL apply to all).
  const termActivities = useMemo(() => {
    return activities.filter((a) => {
      if (termId && a.TERM_ID !== termId) return false;
      if (a.IS_ACTIVE === false || a.IS_ACTIVE === 'FALSE' || a.IS_ACTIVE === 'false') return false;
      const actGrade = String(a.GRADE_LEVEL || '').trim();
      if (!actGrade || grade === ALL) return true;
      return actGrade === grade;
    });
  }, [activities, termId, grade]);

  const activity = useMemo(
    () => activities.find((a) => a.ACTIVITY_ID === activityId) || null,
    [activities, activityId]
  );

  // Students that will appear in the generated workbook.
  const targetStudents = useMemo(() => {
    return students
      .filter((s) => (grade === ALL ? true : String(s.GRADE_LEVEL) === grade))
      .filter((s) => (section === ALL ? true : String(s.SECTION_NUMBER) === section))
      .sort((a, b) => {
        const g = Number(a.GRADE_LEVEL) - Number(b.GRADE_LEVEL);
        if (g) return g;
        const sec = Number(a.SECTION_NUMBER) - Number(b.SECTION_NUMBER);
        if (sec) return sec;
        return Number(a.CLASS_NUMBER) - Number(b.CLASS_NUMBER);
      });
  }, [students, grade, section]);

  // Reset the dependent pickers when a parent selection changes.
  useEffect(() => { setSection(ALL); }, [grade]);
  useEffect(() => { setActivityId(''); }, [termId, grade]);

  const scopeLabel = `${grade === ALL ? 'All grade levels' : `Grade ${grade}`} · ${
    section === ALL ? 'all sections' : `Section ${section}`
  }`;

  const handleDownloadTemplate = async () => {
    if (!activity) {
      toast.error('Choose a term and an activity first');
      return;
    }
    if (targetStudents.length === 0) {
      toast.error('No students match this grade level / section');
      return;
    }

    setGenerating(true);
    // Pre-fill any score already recorded for this activity so the workbook
    // can be used to review and correct existing marks too.
    const existing = {};
    const scoresRes = await scoresAPI.getAll({ activityId: activity.ACTIVITY_ID });
    if (scoresRes.success) {
      (scoresRes.data || []).forEach((s) => { existing[s.STUDENT_ID] = s.RAW_SCORE; });
    }

    const rows = targetStudents.map((s) => [
      s.STUDENT_ID,
      s.ENGLISH_NAME || '',
      s.THAI_NAME || '',
      String(s.GRADE_LEVEL ?? ''),
      String(s.SECTION_NUMBER ?? ''),
      String(s.CLASS_NUMBER ?? ''),
      activity.ACTIVITY_ID,
      activity.ACTIVITY_NAME || '',
      String(activity.MAX_SCORE ?? ''),
      existing[s.STUDENT_ID] !== undefined ? String(existing[s.STUDENT_ID]) : '',
    ]);

    const safeName = String(activity.ACTIVITY_NAME || 'activity').replace(/[^\w\-]+/g, '_');
    const scopePart = `${grade === ALL ? 'AllGrades' : `G${grade}`}_${section === ALL ? 'AllSections' : `S${section}`}`;
    downloadXLSX(
      `sgms_scores_${safeName}_${scopePart}.xlsx`,
      'Scores',
      SCORE_TEMPLATE_HEADERS,
      rows
    );
    setGenerating(false);
    toast.success(`Template generated — ${rows.length} student${rows.length !== 1 ? 's' : ''}`);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setResult(null);
    setParseError('');
    setPreview(null);
    setRowIssues([]);
    try {
      const { headers, rows } = await parseXLSXFile(file);
      const missing = SCORE_REQUIRED_HEADERS.filter((h) => !headers.includes(h));
      if (missing.length > 0) {
        setParseError(
          `Missing required columns: ${missing.join(', ')}. Please upload the workbook generated above (you may edit RAW_SCORE only).`
        );
        return;
      }

      // Client-side validation against the known activities so mistakes are
      // caught before anything is written to the database.
      const idx = (h) => headers.indexOf(h);
      const issues = [];
      rows.forEach((row, i) => {
        const sid = row[idx('STUDENT_ID')];
        const aid = row[idx('ACTIVITY_ID')];
        const raw = row[idx('RAW_SCORE')];
        if (!sid) { issues.push(`Row ${i + 2}: missing STUDENT_ID`); return; }
        if (!aid) { issues.push(`Row ${i + 2}: missing ACTIVITY_ID`); return; }
        if (raw === '' || raw === undefined) return; // blank = not graded, skipped
        const act = activities.find((a) => a.ACTIVITY_ID === aid);
        if (!act) { issues.push(`Row ${i + 2}: unknown ACTIVITY_ID "${aid}"`); return; }
        const num = Number(raw);
        if (Number.isNaN(num)) { issues.push(`Row ${i + 2}: "${raw}" is not a number`); return; }
        const max = Number(act.MAX_SCORE);
        if (num < 0 || num > max) issues.push(`Row ${i + 2}: score ${num} is outside 0–${max}`);
      });

      setRowIssues(issues);
      setPreview({ headers, rows });
    } catch {
      setParseError('Could not read this Excel file. Please use the generated template (.xlsx).');
    }
    e.target.value = '';
  };

  const filledCount = useMemo(() => {
    if (!preview) return 0;
    const i = preview.headers.indexOf('RAW_SCORE');
    return preview.rows.filter((r) => String(r[i] ?? '').trim() !== '').length;
  }, [preview]);

  const handleCommit = async () => {
    if (!preview) return;
    setCommitting(true);
    const scores = preview.rows.map((row) => {
      const obj = {};
      preview.headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
    const res = await importExportAPI.importScores(scores, activityId);
    setCommitting(false);
    if (res.success) {
      setResult({ type: 'success', message: res.message, data: res.data });
      setPreview(null);
      setRowIssues([]);
      toast.success(res.message || 'Score import completed');
    } else {
      setResult({ type: 'error', message: res.message });
      toast.error(res.message || 'Import failed');
    }
  };

  if (loadingMeta) {
    return <Loading label="Loading classes and activities…" />;
  }

  return (
    <div className="space-y-4">
      {/* Step 1 — Choose what to score */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 1 — Choose class &amp; activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Pick the grade level (or all grade levels), the section (or all sections), then the
            grading term and the activity you are recording scores for. The generated Excel file
            contains one row per student with the activity already attached — so when you upload
            it back, the system knows exactly which activity and which student every score
            belongs to.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Grade Level</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full border rounded px-2 py-2 text-sm bg-white"
              >
                <option value={ALL}>All grade levels</option>
                {gradeLevels.map((g) => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Section</label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full border rounded px-2 py-2 text-sm bg-white"
              >
                <option value={ALL}>All sections</option>
                {sections.map((s) => (
                  <option key={s} value={s}>Section {s}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Grading Term</label>
              <select
                value={termId}
                onChange={(e) => setTermId(e.target.value)}
                className="w-full border rounded px-2 py-2 text-sm bg-white"
              >
                <option value="">Select term…</option>
                {terms.map((t) => (
                  <option key={t.TERM_ID} value={t.TERM_ID}>{t.TERM_NAME}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Activity</label>
              <select
                value={activityId}
                onChange={(e) => setActivityId(e.target.value)}
                disabled={!termId}
                className="w-full border rounded px-2 py-2 text-sm bg-white disabled:bg-gray-100"
              >
                <option value="">{termId ? 'Select activity…' : 'Choose a term first'}</option>
                {termActivities.map((a) => (
                  <option key={a.ACTIVITY_ID} value={a.ACTIVITY_ID}>
                    {a.ACTIVITY_NAME} (max {a.MAX_SCORE})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button variant="outline" onClick={handleDownloadTemplate} disabled={!activity || generating}>
              {generating
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Download className="w-4 h-4 mr-2" />}
              Download Score Sheet (.xlsx)
            </Button>
            <span className="text-xs text-gray-500">
              {scopeLabel} — <strong>{targetStudents.length}</strong> student
              {targetStudents.length !== 1 ? 's' : ''}
              {activity ? ` · ${activity.ACTIVITY_NAME} (ACTIVITY_ID ${activity.ACTIVITY_ID}, max ${activity.MAX_SCORE})` : ''}
            </span>
          </div>

          <Alert>
            <FileText className="w-4 h-4" />
            <AlertDescription className="text-xs">
              Only the <strong>RAW_SCORE</strong> column should be edited. Leave a row blank if the
              student has no score yet — blank rows are skipped, not zeroed. Do not change
              STUDENT_ID or ACTIVITY_ID: those tell the system where each score is recorded. The
              file opens in Excel or as a Google Sheet; download it back as .xlsx before uploading.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Step 2 — Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 2 — Upload &amp; Preview</CardTitle>
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

          {rowIssues.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                <p className="font-medium mb-1">{rowIssues.length} row(s) need attention:</p>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  {rowIssues.slice(0, 8).map((issue, i) => <li key={i}>{issue}</li>)}
                  {rowIssues.length > 8 && <li>…and {rowIssues.length - 8} more</li>}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {preview && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Preview — <strong>{preview.rows.length}</strong> row
                {preview.rows.length !== 1 ? 's' : ''}, <strong>{filledCount}</strong> with a score
                ({preview.rows.length - filledCount} blank row(s) will be skipped)
              </p>
              <div className="border rounded overflow-x-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {preview.headers.map((h) => (
                        <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
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
              <Button onClick={handleCommit} disabled={committing || rowIssues.length > 0 || filledCount === 0}>
                {committing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save {filledCount} Score{filledCount !== 1 ? 's' : ''}
              </Button>
              {rowIssues.length > 0 && (
                <p className="text-xs text-red-500">Fix the issues above, then upload the file again.</p>
              )}
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
                (saved: {result.data.saved ?? 0}, skipped blanks: {result.data.skipped ?? 0},
                errors: {Array.isArray(result.data.errors) ? result.data.errors.length : (result.data.errors ?? 0)})
              </span>
            )}
            {Array.isArray(result.data?.errors) && result.data.errors.length > 0 && (
              <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                {result.data.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>{e.studentId ? `${e.studentId}: ` : ''}{e.error}</li>
                ))}
              </ul>
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