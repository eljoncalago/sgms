/**
 * Settings.js
 * Plan Page 13 — System customization.
 *
 * Sections (per plan §13):
 *  - School Information & Branding (name, logo, address, contact, email, principal, system name)
 *  - Theme Selection (purple, midnight, amber, forest)
 *  - Calculation Settings (STRICT/PROGRESS mode, passing percentages per stage + per component)
 *  - Print Report Template ID
 *  - Change Password
 *  - Administrator Management (create, enable/disable)
 *
 * FIX: Added School Branding section which was missing from original Settings.js.
 * The plan explicitly requires: School Name, Logo, School Image, Admin Name,
 * Profile Picture, Signature, Theme, Calculation mode.
 *
 * NEW: Theme selector with 4 elegant themes (purple, midnight, amber, forest).
 * NEW: Per-component passing score inputs for the report card.
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Settings as SettingsIcon,
  Loader2,
  Save,
  UserPlus,
  KeyRound,
  Building2,
  Calculator,
  Printer,
  Palette,
  Check,
} from 'lucide-react';
import { settingsAPI, adminsAPI, authAPI } from '@/api/sgmsAPI';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, THEMES } from '@/contexts/ThemeContext';
import { PageHeader, Loading, EmptyState } from '@/components/PageState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from 'sonner';

// Keys whose values should be normalised to strings before save
const NUMERIC_KEYS = [
  'OVERALL_PASSING_PERCENT',
  'MIDTERM_COLLECTIVE_PASSING',
  'FINAL_COLLECTIVE_INITIAL_PASSING',
  'FINAL_COLLECTIVE_FINAL_PASSING',
  'MIDTERM_EXAM_PASSING',
  'FINAL_EXAM_PASSING',
  'STAGE1_PASSING',
  'STAGE2_PASSING',
  'STAGE3_PASSING',
  'STAGE4_PASSING',
];

// ─── Theme Selector ───────────────────────────────────────────────────────────
const ThemeSelector = () => {
  const { theme, changeTheme, themes } = useTheme();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Object.values(themes).map((t) => (
        <button
          key={t.id}
          onClick={() => changeTheme(t.id)}
          className={`relative border-2 rounded-xl p-4 text-left transition-all ${
            theme === t.id
              ? 'border-[var(--primary)] ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--background)]'
              : 'border-[var(--border)] hover:border-[var(--primary)]'
          }`}
        >
          {/* Preview swatch */}
          <div
            className="h-16 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden"
            style={{ backgroundColor: t.preview.bg }}
          >
            <div
              className="w-8 h-8 rounded-full"
              style={{ backgroundColor: t.preview.accent }}
            />
            {theme === t.id && (
              <div className="absolute top-1 right-1 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-full p-0.5">
                <Check className="w-3 h-3" />
              </div>
            )}
          </div>
          <div className="font-medium text-sm text-[var(--foreground)]">{t.name}</div>
          <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{t.description}</div>
        </button>
      ))}
    </div>
  );
};

// ─── School Branding Tab ──────────────────────────────────────────────────────
const BrandingTab = ({ settings, update, saving, onSave }) => (
  <div className="space-y-4">
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Theme Selection
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-[var(--muted-foreground)] mb-4">
          Choose a theme for your interface. The theme applies instantly and is saved to this browser.
        </p>
        <ThemeSelector />
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          School Information &amp; Branding
        </CardTitle>
        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* School Name */}
          <div className="space-y-1.5 md:col-span-2">
            <Label>School Name</Label>
            <Input
              value={settings?.SCHOOL_NAME || ''}
              onChange={(e) => update('SCHOOL_NAME', e.target.value)}
              placeholder="e.g. Bangkok International School"
            />
          </div>

          {/* System Name */}
          <div className="space-y-1.5">
            <Label>System Name</Label>
            <Input
              value={settings?.SYSTEM_NAME || ''}
              onChange={(e) => update('SYSTEM_NAME', e.target.value)}
              placeholder="SGMS"
            />
          </div>

          {/* Principal Name */}
          <div className="space-y-1.5">
            <Label>Principal Name</Label>
            <Input
              value={settings?.PRINCIPAL_NAME || ''}
              onChange={(e) => update('PRINCIPAL_NAME', e.target.value)}
              placeholder="e.g. Dr. Somchai Jaidee"
            />
          </div>

          {/* School Address */}
          <div className="space-y-1.5 md:col-span-2">
            <Label>School Address</Label>
            <Input
              value={settings?.SCHOOL_ADDRESS || ''}
              onChange={(e) => update('SCHOOL_ADDRESS', e.target.value)}
              placeholder="123 Education Road, Bangkok 10110"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label>Contact Phone</Label>
            <Input
              value={settings?.SCHOOL_PHONE || ''}
              onChange={(e) => update('SCHOOL_PHONE', e.target.value)}
              placeholder="+66 2 123 4567"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label>School Email</Label>
            <Input
              type="email"
              value={settings?.SCHOOL_EMAIL || ''}
              onChange={(e) => update('SCHOOL_EMAIL', e.target.value)}
              placeholder="admin@school.ac.th"
            />
          </div>

          {/* School Logo URL */}
          <div className="space-y-1.5 md:col-span-2">
            <Label>School Logo URL</Label>
            <Input
              value={settings?.SCHOOL_LOGO_URL || ''}
              onChange={(e) => update('SCHOOL_LOGO_URL', e.target.value)}
              placeholder="https://yourschool.com/logo.png"
            />
            <p className="text-xs text-gray-400">
              Host your logo image publicly (e.g. in Google Drive with sharing set to "Anyone with link") and paste the direct URL here.
            </p>
            {settings?.SCHOOL_LOGO_URL && (
              <img
                src={settings.SCHOOL_LOGO_URL}
                alt="School logo preview"
                className="h-16 object-contain border rounded p-1 mt-1"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
          </div>

          {/* School Image URL */}
          <div className="space-y-1.5 md:col-span-2">
            <Label>School Image / Banner URL</Label>
            <Input
              value={settings?.SCHOOL_IMAGE_URL || ''}
              onChange={(e) => update('SCHOOL_IMAGE_URL', e.target.value)}
              placeholder="https://yourschool.com/school.jpg"
            />
            <p className="text-xs text-gray-400">Displayed on the Login screen and Dashboard header.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);

// ─── Calculation Settings Tab ─────────────────────────────────────────────────
const CalculationTab = ({ settings, update, saving, onSave }) => (
  <div className="space-y-4">
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-4 h-4" />
          Grade Calculation
        </CardTitle>
        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Calculation Mode */}
          <div className="space-y-1.5 md:col-span-2">
            <Label>Calculation Mode</Label>
            <div className="flex gap-3">
              {['STRICT', 'PROGRESS'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => update('CALCULATION_MODE', mode)}
                  className={`flex-1 border rounded-lg p-3 text-left transition-colors ${
                    (settings?.CALCULATION_MODE || 'STRICT') === mode
                      ? 'border-[var(--primary)] bg-[var(--accent)] text-[var(--accent-foreground)]'
                      : 'border-[var(--border)] hover:border-[var(--primary)]'
                  }`}
                >
                  <div className="font-medium text-sm">{mode}</div>
                  <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    {mode === 'STRICT'
                      ? 'Missing scores count as 0 — used for official grades'
                      : 'Only recorded activities are calculated — used for progress monitoring'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Per-component passing scores */}
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-base font-semibold">Individual Component Passing Scores</Label>
            <p className="text-xs text-[var(--muted-foreground)] mb-2">
              These thresholds control the PASS/FAIL remark for each individual score component on the report card.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Midterm Collective Passing</Label>
            <Input
              type="number"
              min="0"
              value={settings?.MIDTERM_COLLECTIVE_PASSING ?? ''}
              onChange={(e) => update('MIDTERM_COLLECTIVE_PASSING', e.target.value)}
              placeholder="50"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Final Collective Initial Passing</Label>
            <Input
              type="number"
              min="0"
              value={settings?.FINAL_COLLECTIVE_INITIAL_PASSING ?? ''}
              onChange={(e) => update('FINAL_COLLECTIVE_INITIAL_PASSING', e.target.value)}
              placeholder="50"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Final Collective Final Passing</Label>
            <Input
              type="number"
              min="0"
              value={settings?.FINAL_COLLECTIVE_FINAL_PASSING ?? ''}
              onChange={(e) => update('FINAL_COLLECTIVE_FINAL_PASSING', e.target.value)}
              placeholder="50"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Midterm Examination Passing</Label>
            <Input
              type="number"
              min="0"
              value={settings?.MIDTERM_EXAM_PASSING ?? ''}
              onChange={(e) => update('MIDTERM_EXAM_PASSING', e.target.value)}
              placeholder="50"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Final Examination Passing</Label>
            <Input
              type="number"
              min="0"
              value={settings?.FINAL_EXAM_PASSING ?? ''}
              onChange={(e) => update('FINAL_EXAM_PASSING', e.target.value)}
              placeholder="50"
            />
          </div>

          {/* Cumulative stage passing scores */}
          <div className="space-y-1.5 md:col-span-2 mt-2">
            <Label className="text-base font-semibold">Cumulative Stage Passing Scores</Label>
            <p className="text-xs text-[var(--muted-foreground)] mb-2">
              These thresholds control the PASS/FAIL remarks in the semester grade summary table.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Overall Passing % (final grade)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={settings?.OVERALL_PASSING_PERCENT ?? ''}
              onChange={(e) => update('OVERALL_PASSING_PERCENT', e.target.value)}
              placeholder="50"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Stage 1 Passing (Midterm Coll. + Midterm Exam)</Label>
            <Input
              type="number"
              min="0"
              value={settings?.STAGE1_PASSING ?? ''}
              onChange={(e) => update('STAGE1_PASSING', e.target.value)}
              placeholder="e.g. 20"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Stage 2 Passing (+ Final Coll. Initial)</Label>
            <Input
              type="number"
              min="0"
              value={settings?.STAGE2_PASSING ?? ''}
              onChange={(e) => update('STAGE2_PASSING', e.target.value)}
              placeholder="e.g. 35"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Stage 3 Passing (+ Final Coll. Final)</Label>
            <Input
              type="number"
              min="0"
              value={settings?.STAGE3_PASSING ?? ''}
              onChange={(e) => update('STAGE3_PASSING', e.target.value)}
              placeholder="e.g. 45"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Stage 4 Passing (+ Final Exam / Overall)</Label>
            <Input
              type="number"
              min="0"
              value={settings?.STAGE4_PASSING ?? ''}
              onChange={(e) => update('STAGE4_PASSING', e.target.value)}
              placeholder="e.g. 50"
            />
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Print Template */}
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Printer className="w-4 h-4" />
          Print Report Card Template
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          <Label>Google Drive Template File ID</Label>
          <Input
            value={settings?.PRINT_TEMPLATE_ID || ''}
            onChange={(e) => update('PRINT_TEMPLATE_ID', e.target.value)}
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
          />
          <p className="text-xs text-gray-400">
            The ID portion of your Excel template's Google Drive URL.
            Found at: drive.google.com/file/d/<strong>[THIS_PART]</strong>/view
          </p>
        </div>
        <div className="mt-3">
          <Button onClick={onSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
);

// ─── Security Tab ─────────────────────────────────────────────────────────────
const SecurityTab = ({ pw, setPw, savingPw, onChangePassword, admins, admin,
  newAdmin, setNewAdmin, savingAdmin, onCreateAdmin, setToggleTarget }) => (
  <div className="space-y-4">
    {/* Change password */}
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="w-4 h-4" /> Change Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onChangePassword} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Current Passcode</Label>
            <Input type="password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>New Passcode</Label>
            <Input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm New Passcode</Label>
            <Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </div>
          <div className="md:col-span-3">
            <Button type="submit" disabled={savingPw}>
              {savingPw ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
              Change Password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    {/* Admin management */}
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="w-4 h-4" /> Administrators
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onCreateAdmin} className="flex flex-col md:flex-row gap-3 md:items-end mb-4">
          <div className="space-y-1.5 flex-1">
            <Label>Admin Name</Label>
            <Input
              value={newAdmin.name}
              onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
              placeholder="New administrator name"
            />
          </div>
          <div className="space-y-1.5 flex-1">
            <Label>Passcode</Label>
            <Input
              type="password"
              value={newAdmin.passcode}
              onChange={(e) => setNewAdmin({ ...newAdmin, passcode: e.target.value })}
              placeholder="Initial passcode"
            />
          </div>
          <Button type="submit" disabled={savingAdmin}>
            {savingAdmin ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Add Admin
          </Button>
        </form>

        {admins.length === 0 ? (
          <EmptyState icon={SettingsIcon} title="No administrators" />
        ) : (
          <div className="overflow-x-auto border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {a.name}
                      {a.id === admin?.id && (
                        <Badge variant="secondary" className="ml-2 text-xs">You</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={a.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                        {a.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={!!a.isActive}
                        disabled={a.id === admin?.id}
                        onCheckedChange={() => setToggleTarget(a)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  </div>
);

// ─── Main Settings Component ──────────────────────────────────────────────────
const Settings = () => {
  const { admin } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // password change
  const [pw, setPw] = useState({ old: '', next: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);

  // admin management
  const [admins, setAdmins] = useState([]);
  const [newAdmin, setNewAdmin] = useState({ name: '', passcode: '' });
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [toggling, setToggling] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    const res = await settingsAPI.getAll();
    if (res.success) setSettings(res.data || {});
    else toast.error(res.message || 'Failed to load settings');
    setLoading(false);
  };

  const loadAdmins = async () => {
    const res = await adminsAPI.getAll();
    if (res.success) setAdmins(res.data || []);
  };

  useEffect(() => {
    loadSettings();
    loadAdmins();
  }, []);

  const update = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  const handleSaveSettings = async () => {
    setSaving(true);
    const payload = { ...settings };
    NUMERIC_KEYS.forEach((k) => {
      if (payload[k] !== undefined) payload[k] = String(payload[k]);
    });
    const res = await settingsAPI.update(payload);
    setSaving(false);
    if (res.success) toast.success('Settings saved');
    else toast.error(res.message || 'Save failed');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!pw.old || !pw.next) { toast.error('Fill in all fields'); return; }
    if (pw.next !== pw.confirm) { toast.error('New passcodes do not match'); return; }
    setSavingPw(true);
    const res = await authAPI.changePassword(pw.old, pw.next);
    setSavingPw(false);
    if (res.success) { toast.success('Password changed'); setPw({ old: '', next: '', confirm: '' }); }
    else toast.error(res.message || 'Change failed');
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!newAdmin.name || !newAdmin.passcode) { toast.error('Name and passcode are required'); return; }
    setSavingAdmin(true);
    const res = await adminsAPI.create(newAdmin.name, newAdmin.passcode);
    setSavingAdmin(false);
    if (res.success) {
      toast.success('Admin created');
      setNewAdmin({ name: '', passcode: '' });
      loadAdmins();
    } else toast.error(res.message || 'Create failed');
  };

  const handleToggleAdmin = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    const res = await adminsAPI.update(toggleTarget.id, !toggleTarget.isActive);
    setToggling(false);
    if (res.success) {
      toast.success('Admin updated');
      setToggleTarget(null);
      loadAdmins();
    } else toast.error(res.message || 'Update failed');
  };

  if (loading) {
    return <div className="p-6"><Loading label="Loading settings…" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Settings"
        description="Configure school branding, grading rules, security and administrators"
      />

      <Tabs defaultValue="branding">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="branding">
            <Building2 className="w-4 h-4 mr-1.5" />
            School Branding
          </TabsTrigger>
          <TabsTrigger value="calculation">
            <Calculator className="w-4 h-4 mr-1.5" />
            Calculation
          </TabsTrigger>
          <TabsTrigger value="security">
            <KeyRound className="w-4 h-4 mr-1.5" />
            Security &amp; Admins
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-4">
          {!settings ? (
            <EmptyState
              icon={SettingsIcon}
              title="No settings found"
              description="Run initializeSystem() in Apps Script to create defaults."
            />
          ) : (
            <BrandingTab settings={settings} update={update} saving={saving} onSave={handleSaveSettings} />
          )}
        </TabsContent>

        <TabsContent value="calculation" className="mt-4">
          {!settings ? (
            <EmptyState icon={SettingsIcon} title="No settings found" />
          ) : (
            <CalculationTab settings={settings} update={update} saving={saving} onSave={handleSaveSettings} />
          )}
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <SecurityTab
            pw={pw} setPw={setPw} savingPw={savingPw} onChangePassword={handleChangePassword}
            admins={admins} admin={admin}
            newAdmin={newAdmin} setNewAdmin={setNewAdmin}
            savingAdmin={savingAdmin} onCreateAdmin={handleCreateAdmin}
            setToggleTarget={setToggleTarget}
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(o) => { if (!o) setToggleTarget(null); }}
        onConfirm={handleToggleAdmin}
        loading={toggling}
        title={toggleTarget?.isActive ? 'Disable admin?' : 'Enable admin?'}
        description={
          toggleTarget
            ? `${toggleTarget.isActive ? 'Disable' : 'Enable'} access for ${toggleTarget.name}?`
            : ''
        }
        confirmText={toggleTarget?.isActive ? 'Disable' : 'Enable'}
      />
    </div>
  );
};

export default Settings;
