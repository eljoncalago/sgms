import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Loader2, ClipboardList } from 'lucide-react';
import { activitiesAPI, termsAPI } from '@/api/sgmsAPI';
import { PageHeader, Loading, EmptyState } from '@/components/PageState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from 'sonner';

const emptyActivityForm = { activityName: '', activityType: 'General', maxScore: '' };

const Activities = () => {
  const [terms, setTerms] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTerm, setActiveTerm] = useState('');

  // Activity create/edit
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [actForm, setActForm] = useState(emptyActivityForm);
  const [savingAct, setSavingAct] = useState(false);

  // Term inline editing
  const [termEdits, setTermEdits] = useState({});
  const [savingTermId, setSavingTermId] = useState(null);

  // Delete activity
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    const [termsRes, actsRes] = await Promise.all([termsAPI.getAll(), activitiesAPI.getAll()]);
    if (termsRes.success) {
      const t = termsRes.data || [];
      setTerms(t);
      if (t.length && !activeTerm) setActiveTerm(t[0].TERM_ID);
    } else {
      toast.error(termsRes.message || 'Failed to load terms');
    }
    if (actsRes.success) setActivities(actsRes.data || []);
    else toast.error(actsRes.message || 'Failed to load activities');
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep a local copy of term weights/passing for inline editing
  useEffect(() => {
    const edits = {};
    terms.forEach((t) => {
      edits[t.TERM_ID] = {
        termName: t.TERM_NAME,
        weight: String(t.WEIGHT_PERCENT ?? ''),
        passingPercent: String(t.PASSING_PERCENT ?? ''),
      };
    });
    setTermEdits(edits);
  }, [terms]);

  const termActivities = activities.filter((a) => a.TERM_ID === activeTerm);

  const openCreateActivity = () => {
    setEditingActivity(null);
    setActForm(emptyActivityForm);
    setDialogOpen(true);
  };

  const openEditActivity = (a) => {
    setEditingActivity(a);
    setActForm({
      activityName: a.ACTIVITY_NAME || '',
      activityType: a.ACTIVITY_TYPE || 'General',
      maxScore: String(a.MAX_SCORE ?? ''),
    });
    setDialogOpen(true);
  };

  const handleSaveActivity = async (e) => {
    e.preventDefault();
    if (!activeTerm) {
      toast.error('Select a grading term first');
      return;
    }
    if (!actForm.activityName || !actForm.maxScore) {
      toast.error('Activity name and max score are required');
      return;
    }
    setSavingAct(true);
    const payload = {
      activityName: actForm.activityName.trim(),
      activityType: actForm.activityType.trim() || 'General',
      maxScore: Number(actForm.maxScore),
    };
    const result = editingActivity
      ? await activitiesAPI.update(editingActivity.ACTIVITY_ID, payload)
      : await activitiesAPI.create({ termId: activeTerm, ...payload });
    setSavingAct(false);
    if (result.success) {
      toast.success(editingActivity ? 'Activity updated' : 'Activity created');
      setDialogOpen(false);
      loadAll();
    } else {
      toast.error(result.message || 'Save failed');
    }
  };

  const toggleActive = async (a) => {
    const result = await activitiesAPI.update(a.ACTIVITY_ID, { isActive: !a.IS_ACTIVE });
    if (result.success) {
      setActivities((prev) =>
        prev.map((x) => (x.ACTIVITY_ID === a.ACTIVITY_ID ? { ...x, IS_ACTIVE: !x.IS_ACTIVE } : x))
      );
      toast.success(a.IS_ACTIVE ? 'Activity deactivated' : 'Activity activated');
    } else {
      toast.error(result.message || 'Update failed');
    }
  };

  const saveTerm = async (termId) => {
    const ed = termEdits[termId];
    if (!ed) return;
    setSavingTermId(termId);
    const result = await termsAPI.update(termId, {
      termName: ed.termName,
      weight: Number(ed.weight),
      passingPercent: Number(ed.passingPercent),
    });
    setSavingTermId(null);
    if (result.success) {
      toast.success('Term updated');
      setTerms((prev) =>
        prev.map((t) =>
          t.TERM_ID === termId
            ? { ...t, TERM_NAME: ed.termName, WEIGHT_PERCENT: Number(ed.weight), PASSING_PERCENT: Number(ed.passingPercent) }
            : t
        )
      );
    } else {
      toast.error(result.message || 'Update failed');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await activitiesAPI.delete(deleteTarget.ACTIVITY_ID);
    setDeleting(false);
    if (result.success) {
      toast.success('Activity deleted');
      setDeleteTarget(null);
      loadAll();
    } else {
      toast.error(result.message || 'Delete failed');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Activities & Grading Terms"
        description="Configure term weights and manage activities"
      />

      {/* Grading Terms */}
      <Card>
        <CardHeader>
          <CardTitle>Grading Terms</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loading label="Loading terms…" />
          ) : terms.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No grading terms" description="Run initializeSystem in Apps Script to create default terms." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Term Name</TableHead>
                    <TableHead className="w-28">Weight %</TableHead>
                    <TableHead className="w-32">Passing %</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terms.map((t) => {
                    const ed = termEdits[t.TERM_ID] || { termName: '', weight: '', passingPercent: '' };
                    return (
                      <TableRow key={t.TERM_ID}>
                        <TableCell>{t.TERM_ORDER}</TableCell>
                        <TableCell>
                          <Input
                            value={ed.termName}
                            onChange={(e) =>
                              setTermEdits({ ...termEdits, [t.TERM_ID]: { ...ed, termName: e.target.value } })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={ed.weight}
                            onChange={(e) =>
                              setTermEdits({ ...termEdits, [t.TERM_ID]: { ...ed, weight: e.target.value } })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={ed.passingPercent}
                            onChange={(e) =>
                              setTermEdits({ ...termEdits, [t.TERM_ID]: { ...ed, passingPercent: e.target.value } })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => saveTerm(t.TERM_ID)} disabled={savingTermId === t.TERM_ID}>
                            {savingTermId === t.TERM_ID && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                            Save
                          </Button>
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

      {/* Activities */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Activities</CardTitle>
          <Button onClick={openCreateActivity} disabled={!activeTerm}>
            <Plus className="w-4 h-4 mr-2" /> Add Activity
          </Button>
        </CardHeader>
        <CardContent>
          {!loading && terms.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {terms.map((t) => (
                <Button
                  key={t.TERM_ID}
                  size="sm"
                  variant={activeTerm === t.TERM_ID ? 'default' : 'outline'}
                  onClick={() => setActiveTerm(t.TERM_ID)}
                >
                  {t.TERM_NAME}
                </Button>
              ))}
            </div>
          )}

          {!loading && termActivities.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No activities for this term"
              description="Add an activity under the selected term."
              action={
                <Button onClick={openCreateActivity} disabled={!activeTerm}>
                  <Plus className="w-4 h-4 mr-2" /> Add Activity
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Max Score</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {termActivities.map((a) => (
                    <TableRow key={a.ACTIVITY_ID}>
                      <TableCell>{a.ACTIVITY_ORDER}</TableCell>
                      <TableCell className="font-medium">{a.ACTIVITY_NAME}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{a.ACTIVITY_TYPE}</Badge>
                      </TableCell>
                      <TableCell>{a.MAX_SCORE}</TableCell>
                      <TableCell>
                        <Switch checked={!!a.IS_ACTIVE} onCheckedChange={() => toggleActive(a)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditActivity(a)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(a)}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingActivity ? 'Edit Activity' : 'Add Activity'}</DialogTitle>
            <DialogDescription>
              {editingActivity ? 'Update activity details.' : `New activity for "${terms.find((t) => t.TERM_ID === activeTerm)?.TERM_NAME || ''}".`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveActivity} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Activity Name *</Label>
              <Input value={actForm.activityName} onChange={(e) => setActForm({ ...actForm, activityName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={actForm.activityType}
                onChange={(e) => setActForm({ ...actForm, activityType: e.target.value })}
              >
                <option value="General">General</option>
                <option value="Exam">Exam</option>
                <option value="Quiz">Quiz</option>
                <option value="Assignment">Assignment</option>
                <option value="Project">Project</option>
                <option value="Homework">Homework</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Max Score *</Label>
              <Input type="number" value={actForm.maxScore} onChange={(e) => setActForm({ ...actForm, maxScore: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={savingAct}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingAct}>
                {savingAct && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingActivity ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete activity?"
        description={deleteTarget ? `Delete "${deleteTarget.ACTIVITY_NAME}"? Existing scores for this activity will remain but may no longer calculate.` : ''}
        confirmText="Delete"
      />
    </div>
  );
};

export default Activities;