/**
 * ScoreEntry.jsx — Enter scores for an activity across a class
 *
 * FIX: scoresAPI.getAll is now properly defined in sgmsAPI.jsx.
 *
 * NEW: Grade-level filter.
 *   When activities are grade-level specific, the activity dropdown
 *   automatically shows only activities relevant to the selected grade.
 *   Students are also filtered to only those in the selected grade + section.
 */
import React, { useState, useEffect, useMemo } from 'react';
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
import { Save, Loader2, PenTool } from 'lucide-react';
import { termsAPI, activitiesAPI, studentsAPI, scoresAPI } from '@/api/sgmsAPI';
import { PageHeader, Loading, EmptyState } from '@/components/PageState';
import { toast } from 'sonner';

const ScoreEntry = () => {
  const [terms, setTerms] = useState([]);
  const [activities, setActivities] = useState([]);
  const [students, setStudents] = useState([]);
  const [existingScores, setExistingScores] = useState({}); // studentId -> rawScore

  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedActivity, setSelectedActivity] = useState('');
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [saving, setSaving] = useState(false);

  const [scoreDraft, setScoreDraft] = useState({}); // studentId -> string

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

  // Derive unique grade levels and sections from students list
  const gradeLevels = useMemo(() => {
    const grades = [...new Set(students.map((s) => String(s.GRADE_LEVEL || '')).filter(Boolean))];
    return grades.sort((a, b) => Number(a) - Number(b));
  }, [students]);

  const sectionsForGrade = useMemo(() => {
    if (!selectedGrade) return [];
    const sections = [
      ...new Set(
        students
          .filter((s) => String(s.GRADE_LEVEL) === selectedGrade)
          .map((s) => String(s.SECTION_NUMBER || ''))
          .filter(Boolean)
      ),
    ];
    return sections.sort((a, b) => Number(a) - Number(b));
  }, [students, selectedGrade]);

  // Students shown in the scoring grid — filter by grade + section
  const filteredStudents = useMemo(() => {
    if (!selectedGrade) return [];
    return students.filter(
      (s) =>
        String(s.GRADE_LEVEL) === selectedGrade &&
        (!selectedSection || String(s.SECTION_NUMBER) === selectedSection)
    );
  }, [students, selectedGrade, selectedSection]);

  const currentActivity = useMemo(
    () => activities.find((a) => a.ACTIVITY_ID === selectedActivity),
    [activities, selectedActivity]
  );

  /**
   * Activities shown in the dropdown:
   *  - Must belong to the selected term
   *  - Must be active
   *  - GRADE_LEVEL must be empty (all grades) OR match the selected grade
   */
  const termActivities = useMemo(() => {
    return activities.filter((a) => {
      if (a.TERM_ID !== selectedTerm) return false;
      if (!a.IS_ACTIVE && a.IS_ACTIVE !== 'TRUE' && a.IS_ACTIVE !== 'true') {
        // include active activities only; undefined/null treated as active for backwards compat
        if (a.IS_ACTIVE === false || a.IS_ACTIVE === 'FALSE' || a.IS_ACTIVE === 'false') return false;
      }
      const actGrade = String(a.GRADE_LEVEL || '').trim();
      if (!actGrade) return true; // shared across all grades
      if (!selectedGrade) return true; // no grade filter applied yet
      return actGrade === selectedGrade;
    });
  }, [activities, selectedTerm, selectedGrade]);

  // When activity changes, load existing scores for it
  useEffect(() => {
    if (!selectedActivity) {
      setExistingScores({});
      setScoreDraft({});
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingGrid(true);
      const res = await scoresAPI.getAll({ activityId: selectedActivity });
      if (cancelled) return;
      const map = {};
      (res.data || []).forEach((s) => {
        map[s.STUDENT_ID] = s.RAW_SCORE;
      });
      setExistingScores(map);
      // Prefill drafts with existing values for the filtered students
      const drafts = {};
      filteredStudents.forEach((s) => {
        drafts[s.STUDENT_ID] = map[s.STUDENT_ID] !== undefined ? String(map[s.STUDENT_ID]) : '';
      });
      setScoreDraft(drafts);
      setLoadingGrid(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedActivity]);

  // Reset drafts when filtered students change (grade/section switch)
  useEffect(() => {
    if (!selectedActivity) return;
    const drafts = {};
    filteredStudents.forEach((s) => {
      drafts[s.STUDENT_ID] =
        existingScores[s.STUDENT_ID] !== undefined ? String(existingScores[s.STUDENT_ID]) : '';
    });
    setScoreDraft(drafts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredStudents]);

  const maxScore = currentActivity ? Number(currentActivity.MAX_SCORE) : 0;

  const handleSaveAll = async () => {
    if (!selectedActivity) return;
    const toSave = [];
    let invalid = 0;
    filteredStudents.forEach((s) => {
      const val = scoreDraft[s.STUDENT_ID];
      if (val === '' || val === undefined || val === null) return;
      const num = Number(val);
      if (Number.isNaN(num) || num < 0 || num > maxScore) {
        invalid++;
        return;
      }
      toSave.push({ studentId: s.STUDENT_ID, activityId: selectedActivity, rawScore: num });
    });

    if (invalid > 0) {
      toast.error(`Some scores are invalid (must be 0–${maxScore}). They were skipped.`);
    }
    if (toSave.length === 0) {
      toast.error('No valid scores to save');
      return;
    }
    setSaving(true);
    const res = await scoresAPI.bulkSave(toSave);
    setSaving(false);
    if (res.success) {
      toast.success(res.message || `Saved ${toSave.length} scores`);
      const map = { ...existingScores };
      toSave.forEach((x) => (map[x.studentId] = x.rawScore));
      setExistingScores(map);
    } else {
      toast.error(res.message || 'Save failed');
    }
  };

  if (loadingMeta) {
    return (
      <div className="p-6">
        <Loading label="Loading data…" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="Score Entry" description="Filter by grade, term, and activity — then enter scores" />

      <Card>
        <CardHeader>
          <CardTitle>Select Class &amp; Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Grade Level */}
            <div className="space-y-1.5">
              <Label>Grade Level</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={selectedGrade}
                onChange={(e) => {
                  setSelectedGrade(e.target.value);
                  setSelectedSection('');
                  setSelectedActivity('');
                }}
              >
                <option value="">Select grade…</option>
                {gradeLevels.map((g) => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </select>
            </div>

            {/* Section */}
            <div className="space-y-1.5">
              <Label>Section</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                disabled={!selectedGrade}
              >
                <option value="">All sections</option>
                {sectionsForGrade.map((s) => (
                  <option key={s} value={s}>Section {s}</option>
                ))}
              </select>
            </div>

            {/* Grading Term */}
            <div className="space-y-1.5">
              <Label>Grading Term</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={selectedTerm}
                onChange={(e) => {
                  setSelectedTerm(e.target.value);
                  setSelectedActivity('');
                }}
              >
                <option value="">Select term…</option>
                {terms.map((t) => (
                  <option key={t.TERM_ID} value={t.TERM_ID}>
                    {t.TERM_NAME}
                  </option>
                ))}
              </select>
            </div>

            {/* Activity */}
            <div className="space-y-1.5">
              <Label>Activity</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={selectedActivity}
                onChange={(e) => setSelectedActivity(e.target.value)}
                disabled={!selectedTerm}
              >
                <option value="">Select activity…</option>
                {termActivities.map((a) => (
                  <option key={a.ACTIVITY_ID} value={a.ACTIVITY_ID}>
                    {a.ACTIVITY_NAME} (max {a.MAX_SCORE})
                    {a.GRADE_LEVEL ? ` — Grade ${a.GRADE_LEVEL}` : ''}
                  </option>
                ))}
              </select>
              {selectedTerm && termActivities.length === 0 && selectedGrade && (
                <p className="text-xs text-amber-600">
                  No activities found for Grade {selectedGrade} in this term.
                  Add grade-specific activities in the Activities page.
                </p>
              )}
            </div>

            {/* Save button */}
            <div className="flex items-end sm:col-span-2 lg:col-span-2">
              <Button
                onClick={handleSaveAll}
                disabled={!selectedActivity || saving || filteredStudents.length === 0}
                className="w-full"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save All Scores
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>
            Student Scores
            {currentActivity && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                Max: {maxScore}
                {currentActivity.GRADE_LEVEL
                  ? ` · Grade ${currentActivity.GRADE_LEVEL} only`
                  : ' · All Grades'}
              </span>
            )}
          </CardTitle>
          {filteredStudents.length > 0 && (
            <span className="text-xs text-gray-500">{filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}</span>
          )}
        </CardHeader>
        <CardContent>
          {!selectedGrade ? (
            <EmptyState icon={PenTool} title="Select a grade level" description="Choose grade, term and activity to enter scores." />
          ) : !selectedActivity ? (
            <EmptyState icon={PenTool} title="No activity selected" description="Pick a term and activity above." />
          ) : loadingGrid ? (
            <Loading label="Loading scores…" />
          ) : filteredStudents.length === 0 ? (
            <EmptyState icon={PenTool} title="No students found" description={`No active students in Grade ${selectedGrade}${selectedSection ? ` Section ${selectedSection}` : ''}.`} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class #</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Grade / Section</TableHead>
                    <TableHead className="w-40">Score (0–{maxScore})</TableHead>
                    <TableHead>Saved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((s) => {
                    const draft = scoreDraft[s.STUDENT_ID] ?? '';
                    const num = Number(draft);
                    const hasDraft = draft !== '';
                    const isInvalid = hasDraft && (Number.isNaN(num) || num < 0 || num > maxScore);
                    const saved = existingScores[s.STUDENT_ID];
                    const changed = hasDraft && String(saved) !== String(num) && !Number.isNaN(num);
                    return (
                      <TableRow key={s.STUDENT_ID}>
                        <TableCell>{s.CLASS_NUMBER}</TableCell>
                        <TableCell className="font-mono text-xs">{s.STUDENT_ID}</TableCell>
                        <TableCell className="font-medium">{s.ENGLISH_NAME}</TableCell>
                        <TableCell className="text-xs text-gray-500">
                          G{s.GRADE_LEVEL}–S{s.SECTION_NUMBER}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={maxScore}
                            value={draft}
                            onChange={(e) =>
                              setScoreDraft({ ...scoreDraft, [s.STUDENT_ID]: e.target.value })
                            }
                            className={
                              isInvalid
                                ? 'border-red-500'
                                : changed
                                ? 'border-amber-500'
                                : ''
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {saved !== undefined ? (
                            <Badge variant="secondary">{saved}</Badge>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ScoreEntry;
