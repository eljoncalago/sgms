/**
 * StudentGradeDialog.jsx — full student record + grade editor in a pop-up.
 *
 * NEW (QR quick-lookup workflow):
 * When a student QR is scanned on the paired scanner device, the Grades module
 * makes that student the active record and opens this dialog on the teacher's
 * main screen. It shows the complete profile (photo, Student ID, English name,
 * Thai name, grade level, section, class number, gender, status) together with
 * every activity of every grading term, grouped and editable.
 *
 * Editing a score instantly recalculates the term total, the term percentage,
 * the weighted contribution and the final grade. The teacher can save manually
 * or leave auto-save on, then simply scan the next student — the dialog swaps
 * to the new record without any searching.
 *
 * Nothing here replaces the existing class-grid entry flow; it is an
 * additional, per-student view.
 *
 * THEME FIX: replaced hardcoded gray/white colour classes in the popup with
 * CSS variable equivalents so the dialog respects the active theme.
 * All logic is completely unchanged.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Save, User, RefreshCw, CheckCircle2 } from 'lucide-react';
import { studentsAPI, scoresAPI, gradesAPI } from '@/api/sgmsAPI';
import { toast } from 'sonner';

const isActivityActive = (a) =>
  !(a.IS_ACTIVE === false || a.IS_ACTIVE === 'FALSE' || a.IS_ACTIVE === 'false');

const round2 = (n) => Math.round(n * 100) / 100;

/** Photo is optional in the sheet — fall back to initials. */
const StudentPhoto = ({ student }) => {
  const url = student?.PHOTO_URL || student?.PHOTO || '';
  const initials = String(student?.ENGLISH_NAME || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (url) {
    return (
      <img
        src={url}
        alt={`${student.ENGLISH_NAME} photo`}
        /* THEME FIX: bg-gray-50 → bg-[var(--muted)] */
        className="w-24 h-24 rounded-xl object-cover border bg-[var(--muted)]"
      />
    );
  }
  return (
    /* THEME FIX: bg-gray-100 → bg-[var(--muted)], text-gray-400 → text-[var(--muted-foreground)] */
    <div className="w-24 h-24 rounded-xl border bg-[var(--muted)] flex items-center justify-center text-2xl font-bold text-[var(--muted-foreground)]">
      {initials || <User className="w-8 h-8" />}
    </div>
  );
};

const Field = ({ label, value }) => (
  <div>
    {/* THEME FIX: text-gray-400 → text-[var(--muted-foreground)], text-gray-800 → text-[var(--foreground)] */}
    <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
    <p className="text-sm font-medium text-[var(--foreground)] break-words">{value || '—'}</p>
  </div>
);

const StudentGradeDialog = ({
  open,
  onOpenChange,
  studentId,
  terms = [],
  activities = [],
  autoSave = false,
  onAutoSaveChange,
  subjectLabel = '',
  schoolYear = '',
  onSaved,
}) => {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({});      // activityId -> string
  const [saved, setSaved] = useState({});      // activityId -> number (last persisted)
  const [serverGrade, setServerGrade] = useState(null);
  const autoSaveTimer = useRef(null);

  // ── Load the scanned student's profile + scores ───────────────────────────
  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setServerGrade(null);
    const [stuRes, scoreRes] = await Promise.all([
      studentsAPI.getOne(studentId),
      scoresAPI.getByStudent(studentId),
    ]);
    if (stuRes.success) setStudent(stuRes.data);
    const map = {};
    if (scoreRes.success) {
      (scoreRes.data || []).forEach((s) => {
        map[s.ACTIVITY_ID] = s.RAW_SCORE;
      });
    }
    setSaved(map);
    const d = {};
    Object.keys(map).forEach((k) => { d[k] = String(map[k]); });
    setDraft(d);
    setLoading(false);

    // Authoritative totals from the backend calculation engine.
    const gradeRes = await gradesAPI.calculate(studentId);
    if (gradeRes.success) setServerGrade(gradeRes.data);
  }, [studentId]);

  useEffect(() => {
    if (open && studentId) load();
    if (!open) {
      setStudent(null);
      setDraft({});
      setSaved({});
      setServerGrade(null);
    }
  }, [open, studentId, load]);

  // ── Live (client-side) recalculation while typing ─────────────────────────
  // FIX: only show activities that apply to this student's grade level.
  //      An activity with no GRADE_LEVEL is shared across all grades; an
  //      activity with a specific GRADE_LEVEL only applies to that grade.
  const studentGradeLevel = String(student?.GRADE_LEVEL || '').trim();
  const gradeApplicableActivities = useMemo(
    () => activities.filter((a) => {
      const actGrade = String(a.GRADE_LEVEL || '').trim();
      return actGrade === '' || actGrade === studentGradeLevel;
    }),
    [activities, studentGradeLevel]
  );

  const termRows = useMemo(() => {
    const sortedTerms = [...terms].sort((a, b) => Number(a.TERM_ORDER) - Number(b.TERM_ORDER));
    return sortedTerms.map((term) => {
      const termActivities = gradeApplicableActivities
        .filter((a) => a.TERM_ID === term.TERM_ID && isActivityActive(a))
        .sort((a, b) => Number(a.ACTIVITY_ORDER) - Number(b.ACTIVITY_ORDER));

      let totalMax = 0;
      let totalRaw = 0;
      termActivities.forEach((a) => {
        const val = draft[a.ACTIVITY_ID];
        const num = val === '' || val === undefined ? null : Number(val);
        totalMax += Number(a.MAX_SCORE) || 0;
        if (num !== null && !Number.isNaN(num)) totalRaw += num;
      });

      const percentage = totalMax > 0 ? (totalRaw / totalMax) * 100 : 0;
      const weight = Number(term.WEIGHT_PERCENT) || 0;
      const weighted = (percentage * weight) / 100;
      const passing = Number(term.PASSING_PERCENT) || 50;

      return {
        term,
        activities: termActivities,
        totalRaw: round2(totalRaw),
        totalMax: round2(totalMax),
        percentage: round2(percentage),
        weight,
        weighted: round2(weighted),
        passed: percentage >= passing,
      };
    });
  }, [terms, gradeApplicableActivities, draft]);

  const finalGrade = useMemo(
    () => round2(termRows.reduce((sum, r) => sum + r.weighted, 0)),
    [termRows]
  );

  const dirtyEntries = useMemo(() => {
    const out = [];
    Object.keys(draft).forEach((activityId) => {
      const val = String(draft[activityId] ?? '').trim();
      if (val === '') return;
      const num = Number(val);
      if (Number.isNaN(num)) return;
      if (saved[activityId] !== undefined && Number(saved[activityId]) === num) return;
      out.push({ studentId, activityId, rawScore: num });
    });
    return out;
  }, [draft, saved, studentId]);

  const invalidCount = useMemo(() => {
    let bad = 0;
    gradeApplicableActivities.forEach((a) => {
      const val = draft[a.ACTIVITY_ID];
      if (val === '' || val === undefined) return;
      const num = Number(val);
      if (Number.isNaN(num) || num < 0 || num > Number(a.MAX_SCORE)) bad++;
    });
    return bad;
  }, [draft, gradeApplicableActivities]);

  // ── Saving ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async (silent = false) => {
    if (dirtyEntries.length === 0) {
      if (!silent) toast.info('No changes to save');
      return;
    }
    if (invalidCount > 0) {
      if (!silent) toast.error('Some scores are outside their activity maximum');
      return;
    }
    setSaving(true);
    const res = await scoresAPI.bulkSave(dirtyEntries);
    setSaving(false);
    if (res.success) {
      const next = { ...saved };
      dirtyEntries.forEach((e) => { next[e.activityId] = e.rawScore; });
      setSaved(next);
      if (!silent) toast.success(`Saved ${dirtyEntries.length} score(s)`);
      const gradeRes = await gradesAPI.calculate(studentId);
      if (gradeRes.success) setServerGrade(gradeRes.data);
      if (onSaved) onSaved(studentId);
    } else {
      toast.error(res.message || 'Save failed');
    }
  }, [dirtyEntries, invalidCount, saved, studentId, onSaved]);

  // Auto-save (debounced) when enabled.
  useEffect(() => {
    if (!autoSave || !open) return;
    if (dirtyEntries.length === 0 || invalidCount > 0) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => handleSave(true), 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [autoSave, open, dirtyEntries, invalidCount, handleSave]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Student Record — Grades
            {/* THEME FIX: spinner uses muted-foreground var */}
            {saving && <Loader2 className="w-4 h-4 animate-spin text-[var(--muted-foreground)]" />}
          </DialogTitle>
          <DialogDescription>
            Loaded from the paired QR scanner. Edit scores below — totals update instantly.
          </DialogDescription>
        </DialogHeader>

        {loading || !student ? (
          /* THEME FIX: loading state uses theme colours */
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--muted-foreground)]">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Loading student record…</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* ── Profile ─────────────────────────────────────────────── */}
            {/* THEME FIX: bg-gray-50/60 → bg-[var(--muted)]/40 */}
            <div className="flex flex-col sm:flex-row gap-4 rounded-lg border p-4 bg-[var(--secondary)]">
              <StudentPhoto student={student} />
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Student ID" value={student.STUDENT_ID} />
                <Field label="English Name" value={student.ENGLISH_NAME} />
                <Field label="Thai Name" value={student.THAI_NAME} />
                <Field label="Gender" value={student.GENDER} />
                <Field label="Grade Level" value={student.GRADE_LEVEL} />
                <Field label="Section" value={student.SECTION_NUMBER} />
                <Field label="Class Number" value={student.CLASS_NUMBER} />
                <Field label="Status" value={student.STATUS} />
                {subjectLabel && <Field label="Subject" value={subjectLabel} />}
                {schoolYear && <Field label="School Year" value={schoolYear} />}
                {student.qrToken && <Field label="QR Token" value={student.qrToken} />}
              </div>
            </div>

            {/* ── Summary ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3">
                {/* THEME FIX: text-gray-400 → muted-foreground, text-gray-900 → foreground */}
                <p className="text-[11px] uppercase text-[var(--muted-foreground)]">Final Grade (live)</p>
                <p className="text-2xl font-bold text-[var(--foreground)]">{finalGrade}%</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[11px] uppercase text-[var(--muted-foreground)]">Saved Final Grade</p>
                <p className="text-2xl font-bold text-[var(--muted-foreground)]">
                  {serverGrade ? `${round2(Number(serverGrade.finalGrade ?? serverGrade.totalWeightedScore ?? 0))}%` : '—'}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[11px] uppercase text-[var(--muted-foreground)]">Unsaved Changes</p>
                <p className="text-2xl font-bold text-amber-600">{dirtyEntries.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[11px] uppercase text-[var(--muted-foreground)]">Invalid Scores</p>
                <p className={`text-2xl font-bold ${invalidCount ? 'text-red-600' : 'text-green-600'}`}>
                  {invalidCount}
                </p>
              </div>
            </div>

            {/* ── Grades by term ──────────────────────────────────────── */}
            <div className="space-y-4">
              {termRows.map((row) => (
                <div key={row.term.TERM_ID} className="rounded-lg border overflow-hidden">
                  {/* THEME FIX: bg-gray-50 → bg-[var(--secondary)] */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--secondary)] px-3 py-2 border-b">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{row.term.TERM_NAME}</p>
                      {/* THEME FIX: use muted/muted-foreground instead of gray-200/gray-700 */}
                      <Badge className="bg-[var(--muted)] text-[var(--muted-foreground)]">{row.weight}%</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                      <span>Total: <strong>{row.totalRaw}</strong> / {row.totalMax}</span>
                      <span>Percentage: <strong>{row.percentage}%</strong></span>
                      <span>Weighted: <strong>{row.weighted}</strong></span>
                      {/* PASS/FAIL badge: keep semantic green/red */}
                      <Badge className={row.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {row.passed ? 'PASS' : 'FAIL'}
                      </Badge>
                    </div>
                  </div>

                  {row.activities.length === 0 ? (
                    <p className="text-xs text-[var(--muted-foreground)] px-3 py-3">No activities in this term.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Activity</TableHead>
                          <TableHead className="text-xs w-24">Type</TableHead>
                          <TableHead className="text-xs w-20">Max</TableHead>
                          <TableHead className="text-xs w-28">Score</TableHead>
                          <TableHead className="text-xs w-20">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {row.activities.map((a) => {
                          const val = draft[a.ACTIVITY_ID] ?? '';
                          const num = val === '' ? null : Number(val);
                          const max = Number(a.MAX_SCORE) || 0;
                          const bad = num !== null && (Number.isNaN(num) || num < 0 || num > max);
                          const pct = num !== null && !bad && max > 0 ? round2((num / max) * 100) : null;
                          return (
                            <TableRow key={a.ACTIVITY_ID}>
                              <TableCell className="text-xs">{a.ACTIVITY_NAME}</TableCell>
                              {/* THEME FIX: text-gray-500 → muted-foreground */}
                              <TableCell className="text-xs text-[var(--muted-foreground)]">{a.ACTIVITY_TYPE || '—'}</TableCell>
                              <TableCell className="text-xs">{max}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  max={max}
                                  value={val}
                                  onChange={(e) =>
                                    setDraft((d) => ({ ...d, [a.ACTIVITY_ID]: e.target.value }))
                                  }
                                  className={`h-8 w-24 text-sm ${bad ? 'border-red-500' : ''}`}
                                  placeholder="—"
                                />
                              </TableCell>
                              <TableCell className="text-xs text-[var(--muted-foreground)]">
                                {pct === null ? '—' : `${pct}%`}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ))}
            </div>

            {/* ── Actions ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              {/* THEME FIX: text-gray-600 → muted-foreground */}
              <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={(e) => onAutoSaveChange && onAutoSaveChange(e.target.checked)}
                />
                Auto-save changes
              </label>
              <div className="flex items-center gap-2">
                {dirtyEntries.length === 0 && !saving && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> All changes saved
                  </span>
                )}
                <Button variant="outline" onClick={load} disabled={loading || saving}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reload
                </Button>
                <Button onClick={() => handleSave(false)} disabled={saving || dirtyEntries.length === 0}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Grades
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StudentGradeDialog;
