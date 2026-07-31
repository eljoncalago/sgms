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
import { History, Loader2, Filter } from 'lucide-react';
import { auditAPI } from '@/api/sgmsAPI';
import { PageHeader, Loading, EmptyState } from '@/components/PageState';
import { toast } from 'sonner';

const ACTION_VARIANT = {
  LOGIN: 'bg-blue-100 text-blue-800',
  ADD_STUDENT: 'bg-green-100 text-green-800',
  CREATE_ACTIVITY: 'bg-green-100 text-green-800',
  SAVE_SCORE: 'bg-green-100 text-green-800',
  UPDATE_SCORE: 'bg-amber-100 text-amber-800',
  UPDATE_TERM: 'bg-amber-100 text-amber-800',
  UPDATE_ACTIVITY: 'bg-amber-100 text-amber-800',
  UPDATE_SETTINGS: 'bg-amber-100 text-amber-800',
  DELETE_STUDENT: 'bg-red-100 text-red-800',
  DELETE_ACTIVITY: 'bg-red-100 text-red-800',
  CHANGE_PASSWORD: 'bg-purple-100 text-purple-800',
  GENERATE_QR: 'bg-indigo-100 text-indigo-800',
};

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', startDate: '', endDate: '', limit: '100' });

  const load = async () => {
    setLoading(true);
    const params = {};
    if (filters.action.trim()) params.action = filters.action.trim();
    if (filters.startDate) params.startDate = new Date(filters.startDate).toISOString();
    if (filters.endDate) params.endDate = new Date(filters.endDate + 'T23:59:59').toISOString();
    params.limit = Number(filters.limit) || 100;

    const res = await auditAPI.getLog(params);
    if (res.success) setLogs(res.data || []);
    else toast.error(res.message || 'Failed to load audit log');
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="Audit Log" description="Track every action performed in the system" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>Action</Label>
              <Input
                placeholder="e.g. ADD_STUDENT"
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Limit</Label>
              <Input
                type="number"
                value={filters.limit}
                onChange={(e) => setFilters({ ...filters, limit: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={load} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Filter className="w-4 h-4 mr-2" />}
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <Loading label="Loading audit log…" />
          ) : logs.length === 0 ? (
            <EmptyState icon={History} title="No log entries" description="No activity matches your filters." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.LOG_ID}>
                      <TableCell className="whitespace-nowrap text-xs text-gray-500">
                        {l.TIMESTAMP ? new Date(l.TIMESTAMP).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{l.ADMIN_ID}</TableCell>
                      <TableCell>
                        <Badge className={ACTION_VARIANT[l.ACTION] || 'bg-gray-100 text-gray-700'}>
                          {l.ACTION}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm" title={l.DETAILS}>
                        {l.DETAILS || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{l.SOURCE}</Badge>
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
};

export default AuditLog;