/**
 * QRPairing.jsx — Main device pairing page
 *
 * Flow:
 *  1. Admin taps "Create Session" → backend creates a session record
 *  2. This page displays a QR that encodes a FULL URL pointing to /scan-pair?session=SESSION_ID
 *     (the second device scans this and opens that URL in its browser)
 *  3. On the second device, the operator opens /scan-pair, enters (or scans) the student token
 *  4. /scan-pair calls qrAPI.updateSession — sets session STATUS → FOUND
 *  5. This page polls every 3 s; when FOUND it shows the paired student
 *
 * FIX (original): session QR encoded raw "SESSION:id" text — not a URL.
 *   The second device had no page to navigate to. Now the QR encodes the full
 *   app URL so scanning it opens the scan-pair page directly.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { QrCode, Loader2, Link2, RefreshCw, UserCheck, Copy } from 'lucide-react';
import { qrAPI } from '@/api/sgmsAPI';
import { PageHeader, EmptyState } from '@/components/PageState';
import { toast } from 'sonner';

const STATUS_STYLE = {
  WAITING: 'bg-amber-100 text-amber-800',
  FOUND: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-red-100 text-red-800',
};

/**
 * Build the URL the second device should open.
 * Uses the current page's origin + path so it works on any domain
 * (localhost in dev, GitHub Pages in production, etc.).
 */
function buildScanUrl(sessionId) {
  const base = window.location.href.split('#')[0];
  return `${base}#/scan-pair?session=${encodeURIComponent(sessionId)}`;
}

/**
 * Build a QR image URL that encodes the full scan-pair URL.
 */
function buildQRImageUrl(sessionId) {
  const scanUrl = buildScanUrl(sessionId);
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(scanUrl)}`;
}

const QRPairing = () => {
  const [session, setSession] = useState(null); // { sessionId, expiresAt }
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
    setTokenInput('');
    const res = await qrAPI.createSession('web');
    setCreating(false);
    if (res.success) {
      setSession(res.data);
      startPolling(res.data.sessionId);
      toast.success('Pairing session created — scan the QR with the second device');
    } else {
      toast.error(res.message || 'Failed to create session');
    }
  };

  const startPolling = (sessionId) => {
    clearPoll();
    pollRef.current = setInterval(async () => {
      const res = await qrAPI.getSession(sessionId);
      if (!res.success) {
        setStatus('EXPIRED');
        clearPoll();
        return;
      }
      const sess = res.data.session;
      setStatus(sess.STATUS || 'WAITING');
      if (sess.STATUS === 'FOUND' && res.data.student) {
        setStudent(res.data.student);
        clearPoll();
        toast.success('Student paired successfully!');
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

  const copyScanUrl = () => {
    if (!session) return;
    navigator.clipboard.writeText(buildScanUrl(session.sessionId));
    toast.success('Scan URL copied to clipboard');
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="QR Device Pairing"
        description="Generate a session QR — the second device scans it, then scans a student QR to pair"
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
              description="Create a pairing session. The QR code it generates links the second device directly to the scan page."
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
          {/* Session QR — encodes a full URL */}
          <Card>
            <CardHeader>
              <CardTitle>Session QR — Scan with Second Device</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center text-center space-y-4">
              <div className="rounded-xl border p-4 bg-white shadow-sm">
                <img
                  src={buildQRImageUrl(session.sessionId)}
                  alt="Session QR"
                  className="w-64 h-64"
                />
              </div>

              <Badge className={`font-mono ${STATUS_STYLE[status] || STATUS_STYLE.WAITING}`}>
                {status}
              </Badge>

              <p className="text-xs text-gray-500">
                Expires {new Date(session.expiresAt).toLocaleTimeString()}
              </p>

              {/* Show the actual URL so it can also be shared via link */}
              <div className="w-full rounded-md border bg-gray-50 p-2 text-left">
                <p className="text-xs text-gray-400 mb-1">Or share this link with the second device:</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-mono text-gray-600 truncate flex-1">
                    {buildScanUrl(session.sessionId)}
                  </p>
                  <button
                    onClick={copyScanUrl}
                    className="flex-shrink-0 text-gray-400 hover:text-gray-700"
                    title="Copy URL"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="text-sm text-gray-500 text-left w-full rounded-md border border-dashed p-3 space-y-1">
                <p className="font-medium text-gray-700">How it works:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-xs">
                  <li>Second device scans this QR (opens the scan page automatically)</li>
                  <li>On that page, enter or scan the student's personal QR token</li>
                  <li>This page updates automatically when the student is paired</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Manual fallback + result */}
          <Card>
            <CardHeader>
              <CardTitle>Manual Token Entry (Fallback)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">
                If the second device can't open the link, enter the student's QR token here directly.
                You can find the token on the student's QR code page.
              </p>
              <div className="space-y-1.5">
                <Label>Student Token</Label>
                <Input
                  placeholder="e.g. A7B9C2X4K1M0"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="font-mono"
                  disabled={status === 'FOUND'}
                />
              </div>
              <Button
                onClick={pairManually}
                disabled={pairing || status === 'FOUND'}
                className="w-full"
              >
                {pairing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                Pair Student
              </Button>

              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Paired Student</p>
                {student ? (
                  <div className="rounded-lg border bg-green-50 p-4 flex items-center gap-3">
                    <UserCheck className="w-8 h-8 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">{student.ENGLISH_NAME}</p>
                      <p className="text-xs text-gray-500 font-mono">{student.STUDENT_ID}</p>
                      <p className="text-xs text-gray-500">
                        Grade {student.GRADE_LEVEL} · Section {student.SECTION_NUMBER} · #{student.CLASS_NUMBER}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    {status === 'WAITING' ? 'Waiting for second device to scan…' : 'Session expired'}
                  </p>
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
