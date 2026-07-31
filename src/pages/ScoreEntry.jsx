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

  const currentActivity = useMemo(
    () => activities.find((a) => a.ACTIVITY_ID === selectedActivity),
    [activities, selectedActivity]
  );

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
      // prefill drafts with existing values
      const drafts = {};
      students.forEach((s) => {
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

  const maxScore = currentActivity ? Number(currentActivity.MAX_SCORE) : 0;

  const termActivities = activities.filter((a) => a.TERM_ID === selectedTerm);

  const handleSaveAll = async () => {
    if (!selectedActivity) return;
    const toSave = [];
    let invalid = 0;
    students.forEach((s) => {
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
      // refresh existing scores
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
      <PageHeader title="Score Entry" description="Enter scores for an activity across a class" />

      <Card>
        <CardHeader>
          <CardTitle>Select Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleSaveAll} disabled={!selectedActivity || saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>
            Student Scores
            {currentActivity && <span className="text-sm font-normal text-gray-500 ml-2">Max: {maxScore}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedActivity ? (
            <EmptyState icon={PenTool} title="No activity selected" description="Pick a term and activity to enter scores." />
          ) : loadingGrid ? (
            <Loading label="Loading scores…" />
          ) : students.length === 0 ? (
            <EmptyState icon={PenTool} title="No active students" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class #</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-40">Score (0–{maxScore})</TableHead>
                    <TableHead>Saved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => {
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
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={maxScore}
                            value={draft}
                            onChange={(e) => setScoreDraft({ ...scoreDraft, [s.STUDENT_ID]: e.target.value })}
                            className={isInvalid ? 'border-red-500' : changed ? 'border-amber-500' : ''}
                          />
                        </TableCell>
                        <TableCell>
                          {saved !== undefined ? <Badge variant="secondary">{saved}</Badge> : <span className="text-gray-400 text-xs">—</span>}
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