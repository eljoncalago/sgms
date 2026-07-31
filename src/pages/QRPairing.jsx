import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { QrCode, Loader2, Link2, RefreshCw, UserCheck } from 'lucide-react';
import { qrAPI } from '@/api/sgmsAPI';
import { PageHeader, EmptyState } from '@/components/PageState';
import { toast } from 'sonner';

const STATUS_STYLE = {
  WAITING: 'bg-amber-100 text-amber-800',
  FOUND: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-red-100 text-red-800',
};

const QRPairing = () => {
  const [session, setSession] = useState(null); // { sessionId, expiresAt, qrUrl }
  const [status, setStatus] = useState('WAITING');
  const [student, setStudent] = useState(null);
  const [tokenInput, setTokenInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [pairing, setPairing] = useState(false);
  const pollRef = useRef(null);

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => clearPoll(), []);

  const createSession = async () => {
    setCreating(true);
    setStudent(null);
    setStatus('WAITING');
    const res = await qrAPI.createSession('web');
    setCreating(false);
    if (res.success) {
      setSession(res.data);
      startPolling(res.data.sessionId);
      toast.success('Pairing session created');
    } else {
      toast.error(res.message || 'Failed to create session');
    }
  };

  const startPolling = (sessionId) => {
    clearPoll();
    pollRef.current = setInterval(async () => {
      const res = await qrAPI.getSession(sessionId);
      if (!res.success) {
        // expired or not found
        setStatus('EXPIRED');
        clearPoll();
        return;
      }
      const sess = res.data.session;
      setStatus(sess.STATUS || 'WAITING');
      if (sess.STATUS === 'FOUND' && res.data.student) {
        setStudent(res.data.student);
        clearPoll();
        toast.success('Student paired');
      }
    }, 3000);
  };

  const pairManually = async () => {
    if (!session || !tokenInput.trim()) {
      toast.error('Enter a student token');
      return;
    }
    setPairing(true);
    const res = await qrAPI.updateSession(session.sessionId, tokenInput.trim());
    setPairing(false);
    if (res.success) {
      setStudent(res.data.student);
      setStatus('FOUND');
      clearPoll();
      toast.success('Student paired');
    } else {
      toast.error(res.message || 'Invalid token');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="QR Device Pairing"
        description="Pair a student to a device session by scanning or entering their token"
        actions={
          <Button onClick={createSession} disabled={creating}>
            {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {session ? 'New Session' : 'Create Session'}
          </Button>
        }
      />

      {!session ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={QrCode}
              title="No active session"
              description="Create a pairing session to generate a scannable QR code."
              action={
                <Button onClick={createSession} disabled={creating}>
                  {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Session
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Session QR</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center text-center">
              <div className="rounded-xl border p-4 bg-white shadow-sm">
                <img src={session.qrUrl} alt="Session QR" className="w-64 h-64" />
              </div>
              <div className="mt-4 space-y-1">
                <Badge className={`font-mono ${STATUS_STYLE[status] || STATUS_STYLE.WAITING}`}>
                  {status}
                </Badge>
                <p className="text-xs text-gray-500 font-mono mt-2">{session.sessionId}</p>
                <p className="text-xs text-gray-400">Expires {new Date(session.expiresAt).toLocaleTimeString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pair Manually</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">
                If a device can't scan, enter the student's QR token here to pair them to this session.
              </p>
              <div className="space-y-1.5">
                <Label>Student Token</Label>
                <Input
                  placeholder="e.g. A7B9C2X4K1M0"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="font-mono"
                />
              </div>
              <Button onClick={pairManually} disabled={pairing || status === 'FOUND'} className="w-full">
                {pairing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                Pair Student
              </Button>

              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Paired Student</p>
                {student ? (
                  <div className="rounded-lg border bg-green-50 p-4 flex items-center gap-3">
                    <UserCheck className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="font-semibold">{student.ENGLISH_NAME}</p>
                      <p className="text-xs text-gray-500 font-mono">{student.STUDENT_ID}</p>
                      <p className="text-xs text-gray-500">
                        Grade {student.GRADE_LEVEL} · Section {student.SECTION_NUMBER} · #{student.CLASS_NUMBER}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Waiting for a student to pair…</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default QRPairing;