/**
 * QRScanLookupPanel.jsx — QR quick student lookup for the Grades module.
 *
 * NEW FEATURE (nothing else in Score Entry changes):
 *  1. The teacher presses "Start Scanning Session" on the main screen.
 *  2. A pairing QR appears; the second device opens /scan-pair?session=… and
 *     becomes a continuous scanner (its camera never stops between scans).
 *  3. This panel polls the session. Every time SCAN_COUNT increases, a new
 *     student QR was read — the panel reports that student upward so the
 *     Grades module makes them the active record and pops their profile +
 *     grades open.
 *  4. The session keeps running — scan, edit, save, scan the next student —
 *     until it EXPIRES or the scanner device closes its page (STATUS CLOSED),
 *     which ends the session here as well.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QrCode, Loader2, StopCircle, Copy, ScanLine } from 'lucide-react';
import { qrAPI } from '@/api/sgmsAPI';
import { toast } from 'sonner';

const POLL_MS = 2500;

const buildScanUrl = (sessionId) => {
  const base = window.location.href.split('#')[0];
  return `${base}#/scan-pair?session=${encodeURIComponent(sessionId)}`;
};

const buildQRImage = (sessionId) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
    buildScanUrl(sessionId)
  )}`;

const QRScanLookupPanel = ({ onStudentScanned }) => {
  const [session, setSession] = useState(null);   // { sessionId, expiresAt }
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState('');
  const [scanCount, setScanCount] = useState(0);
  const [lastStudent, setLastStudent] = useState(null);
  const [scannerSeen, setScannerSeen] = useState('');
  const lastHandled = useRef(0);
  const pollRef = useRef(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const endSession = useCallback(async (notify = true) => {
    stopPolling();
    const id = session?.sessionId;
    setSession(null);
    setStatus('');
    setScanCount(0);
    setLastStudent(null);
    lastHandled.current = 0;
    if (id) {
      await qrAPI.closeSession(id);
      if (notify) toast.info('Scanning session ended');
    }
  }, [session]);

  const handleStart = async () => {
    setStarting(true);
    const res = await qrAPI.createSession('grades-main');
    setStarting(false);
    if (!res.success) {
      toast.error(res.message || 'Could not start a scanning session');
      return;
    }
    lastHandled.current = 0;
    setScanCount(0);
    setLastStudent(null);
    setSession({ sessionId: res.data.sessionId, expiresAt: res.data.expiresAt });
    setStatus('WAITING');
    toast.success('Scanning session started — pair your scanner device');
  };

  // Poll the session for new scans.
  useEffect(() => {
    if (!session?.sessionId) return;
    let cancelled = false;

    const tick = async () => {
      const res = await qrAPI.getSession(session.sessionId);
      if (cancelled) return;

      if (!res.success) {
        // Expired / closed / missing — the session is over.
        setStatus(res.data?.session?.STATUS || 'ENDED');
        stopPolling();
        toast.warning(res.message || 'Scanning session ended');
        setSession(null);
        return;
      }

      const data = res.data || {};
      const sess = data.session || {};
      setStatus(data.status || sess.STATUS || '');
      setScannerSeen(sess.SCANNER_LAST_SEEN || '');

      if (sess.STATUS === 'CLOSED' || sess.STATUS === 'EXPIRED') {
        stopPolling();
        setSession(null);
        toast.info(
          sess.STATUS === 'CLOSED'
            ? 'The scanner device closed the session'
            : 'The scanning session expired'
        );
        return;
      }

      const count = Number(data.scanCount || 0);
      setScanCount(count);

      // A higher scan count always means "a new scan happened" — even when the
      // same student is scanned twice in a row.
      if (count > lastHandled.current && data.student) {
        lastHandled.current = count;
        setLastStudent(data.student);
        onStudentScanned(data.student.STUDENT_ID, data.student);
      }
    };

    tick();
    pollRef.current = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId]);

  const scanUrl = session ? buildScanUrl(session.sessionId) : '';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanLine className="w-4 h-4" />
          QR Student Lookup
        </CardTitle>
        {session ? (
          <div className="flex items-center gap-2">
            <Badge className={status === 'FOUND' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
              {status === 'FOUND' ? 'Scanner connected' : 'Waiting for scanner'}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => endSession(true)}>
              <StopCircle className="w-4 h-4 mr-2" />
              End Session
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={handleStart} disabled={starting}>
            {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
            Start Scanning Session
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!session ? (
          <p className="text-sm text-gray-500">
            Start a session, then open the link on a phone or tablet to use it as a continuous
            scanner. Every student QR it reads instantly opens that student's full profile and
            grades here — no searching. The session stays open until you end it, it expires, or
            the scanner device closes its page.
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-5">
            <img
              src={buildQRImage(session.sessionId)}
              alt="Pair scanner device"
              className="w-40 h-40 border rounded-lg bg-white self-start"
            />
            <div className="flex-1 space-y-3 text-sm">
              <p className="text-gray-600">
                Scan this QR with the second device (or open the link below) to turn it into a
                continuous student scanner.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] bg-gray-50 border rounded px-2 py-1 break-all">
                  {scanUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(scanUrl);
                    toast.success('Link copied');
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
                <p>Scans this session: <strong className="text-gray-800">{scanCount}</strong></p>
                <p>
                  Expires:{' '}
                  <strong className="text-gray-800">
                    {session.expiresAt ? new Date(session.expiresAt).toLocaleTimeString() : '—'}
                  </strong>
                </p>
                <p className="col-span-2">
                  Scanner last seen:{' '}
                  <strong className="text-gray-800">
                    {scannerSeen ? new Date(scannerSeen).toLocaleTimeString() : 'not connected yet'}
                  </strong>
                </p>
              </div>
              {lastStudent && (
                <p className="text-xs text-green-700">
                  Last scanned: <strong>{lastStudent.ENGLISH_NAME}</strong> ({lastStudent.STUDENT_ID}) —
                  Grade {lastStudent.GRADE_LEVEL}/{lastStudent.SECTION_NUMBER}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QRScanLookupPanel;
