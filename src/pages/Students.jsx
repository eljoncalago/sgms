import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
import { Plus, Search, Pencil, Trash2, Users, Loader2 } from 'lucide-react';
import { studentsAPI } from '@/api/sgmsAPI';
import { PageHeader, Loading, EmptyState } from '@/components/PageState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from 'sonner';

const STATUS_VARIANT = {
  Active: 'bg-green-100 text-green-800',
  Inactive: 'bg-gray-100 text-gray-700',
  Deleted: 'bg-red-100 text-red-800',
};

const emptyForm = {
  thaiName: '',
  englishName: '',
  gradeLevel: '',
  sectionNumber: '',
  classNumber: '',
  status: 'Active',
};

const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null); // student object or null
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadStudents = async () => {
    setLoading(true);
    const result = await studentsAPI.getAll();
    if (result.success) {
      setStudents(result.data || []);
    } else {
      toast.error(result.message || 'Failed to load students');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students.filter((s) => {
      if (statusFilter !== 'all' && s.STATUS !== statusFilter) return false;
      if (!term) return true;
      return (
        String(s.STUDENT_ID || '').toLowerCase().includes(term) ||
        String(s.THAI_NAME || '').toLowerCase().includes(term) ||
        String(s.ENGLISH_NAME || '').toLowerCase().includes(term) ||
        String(s.CLASS_NUMBER || '').toLowerCase().includes(term)
      );
    });
  }, [students, search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (student) => {
    setEditing(student);
    setForm({
      thaiName: student.THAI_NAME || '',
      englishName: student.ENGLISH_NAME || '',
      gradeLevel: String(student.GRADE_LEVEL ?? ''),
      sectionNumber: String(student.SECTION_NUMBER ?? ''),
      classNumber: String(student.CLASS_NUMBER ?? ''),
      status: student.STATUS || 'Active',
    });
    setDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.thaiName || !form.englishName || !form.gradeLevel || !form.sectionNumber || !form.classNumber) {
      toast.error('All fields are required');
      return;
    }
    setSaving(true);
    const data = {
      thaiName: form.thaiName.trim(),
      englishName: form.englishName.trim(),
      gradeLevel: Number(form.gradeLevel),
      sectionNumber: Number(form.sectionNumber),
      classNumber: Number(form.classNumber),
      ...(editing ? { status: form.status } : {}),
    };
    const result = editing
      ? await studentsAPI.update(editing.STUDENT_ID, data)
      : await studentsAPI.create(data);
    setSaving(false);
    if (result.success) {
      toast.success(editing ? 'Student updated' : 'Student created');
      setDialogOpen(false);
      loadStudents();
    } else {
      toast.error(result.message || 'Save failed');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await studentsAPI.delete(deleteTarget.STUDENT_ID);
    setDeleting(false);
    if (result.success) {
      toast.success('Student deleted');
      setDeleteTarget(null);
      loadStudents();
    } else {
      toast.error(result.message || 'Delete failed');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Students"
        description="Add, edit and manage student records"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Add Student
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-3 md:items-center mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by ID, name or class number…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              {['all', 'Active', 'Inactive', 'Deleted'].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'all' ? 'All' : s}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <Loading label="Loading students…" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No students found"
              description="Add your first student or adjust your search/filter."
              action={
                <Button onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-2" /> Add Student
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Thai Name</TableHead>
                    <TableHead>English Name</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Class #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.STUDENT_ID}>
                      <TableCell className="font-mono text-xs">{s.STUDENT_ID}</TableCell>
                      <TableCell>{s.THAI_NAME}</TableCell>
                      <TableCell className="font-medium">{s.ENGLISH_NAME}</TableCell>
                      <TableCell>{s.GRADE_LEVEL}</TableCell>
                      <TableCell>{s.SECTION_NUMBER}</TableCell>
                      <TableCell>{s.CLASS_NUMBER}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_VARIANT[s.STATUS] || STATUS_VARIANT.Inactive}`}>
                          {s.STATUS}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(s)}>
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

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Student' : 'Add Student'}</DialogTitle>
            <DialogDescription>
              {editing ? `Update record ${editing.STUDENT_ID}` : 'Enter the student details below.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Thai Name *</Label>
                <Input value={form.thaiName} onChange={(e) => setForm({ ...form, thaiName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>English Name *</Label>
                <Input value={form.englishName} onChange={(e) => setForm({ ...form, englishName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Grade Level *</Label>
                <Input type="number" value={form.gradeLevel} onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Section Number *</Label>
                <Input type="number" value={form.sectionNumber} onChange={(e) => setForm({ ...form, sectionNumber: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Class Number *</Label>
                <Input type="number" value={form.classNumber} onChange={(e) => setForm({ ...form, classNumber: e.target.value })} />
              </div>
              {editing && (
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Deleted">Deleted</option>
                  </select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editing ? 'Save Changes' : 'Create Student'}
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
        title="Delete student?"
        description={
          deleteTarget
            ? `This will mark ${deleteTarget.ENGLISH_NAME} (${deleteTarget.STUDENT_ID}) as deleted. This action can be reversed by changing the status back.`
            : ''
        }
        confirmText="Delete"
      />
    </div>
  );
};

export default Students;