/**
 * QRScanPair.jsx — Public page opened on the SECOND device (the scanner).
 *
 * The second device scans the session QR shown by the main device. That QR
 * encodes: https://domain/#/scan-pair?session=SESSION_ID
 *
 * CONTINUOUS SCANNING (new)
 * -------------------------
 * This used to pair exactly one student and then stop. It is now a live
 * scanner for the Grades module:
 *
 *   • The camera starts once and KEEPS RUNNING between scans — it is never
 *     restarted after a successful read.
 *   • Every student QR read is sent to the session; the teacher's main screen
 *     immediately loads that student's full profile and grades.
 *   • A short cooldown prevents the same code being submitted dozens of times
 *     per second while it sits in front of the lens.
 *   • A heartbeat keeps the session alive while this page is open, and the
 *     session is closed when the page is closed — which ends the session on
 *     the main device too. The session also ends on its own when it expires.
 *
 * Manual token entry is kept as a fallback for devices without a camera.
 * This route stays PUBLIC — no auth token required.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  QrCode, Link2, Loader2, UserCheck, AlertCircle, GraduationCap,
  Camera, CameraOff, Keyboard,
} from 'lucide-react';
import { qrAPI } from '@/api/sgmsAPI';

const SCANNER_ELEMENT_ID = 'sgms-qr-reader';
const HEARTBEAT_MS = 20000;
// Ignore repeats of the same token for this long (camera reads ~10x/second).
const SAME_TOKEN_COOLDOWN_MS = 3000;

const QRScanPair = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [pairing, setPairing] = useState(false);
  const [sessionEnded, setSessionEnded] = useState('');
  const [lastResult, setLastResult] = useState(null); // { success, student, message }
  const [history, setHistory] = useState([]);         // recent successful scans
  const [scanCount, setScanCount] = useState(0);

  const scannerRef = useRef(null);
  const lastTokenRef = useRef({ token: '', at: 0 });
  const submittingRef = useRef(false);
  const endedRef = useRef(false);

  const sessionError = !sessionId
    ? 'No session ID found in URL. Please scan the QR code from the main device again.'
    : '';

  /** Send one token to the session. Shared by camera and manual entry. */
  const submitToken = useCallback(async (token, fromCamera) => {
    if (!sessionId || !token || endedRef.current) return;
    if (submittingRef.current) return;          // one in-flight request at a time
    submittingRef.current = true;
    if (!fromCamera) setPairing(true);

    const res = await qrAPI.updateSession(sessionId, token);

    submittingRef.current = false;
    if (!fromCamera) setPairing(false);

    if (res.success) {
      const student = res.data?.student;
      setScanCount(res.data?.scanCount ?? ((c) => c + 1));
      setLastResult({ success: true, student });
      setHistory((h) => [
        { id: student?.STUDENT_ID, name: student?.ENGLISH_NAME, at: new Date() },
        ...h,
      ].slice(0, 8));
      setTokenInput('');
      // NOTE: the camera is deliberately NOT stopped — the next student can be
      // scanned right away.
      if (navigator.vibrate) navigator.vibrate(60);
    } else {
      const msg = res.message || 'Invalid token or session expired';
      setLastResult({ success: false, message: msg });
      if (/expired|closed|not found/i.test(msg)) {
        endedRef.current = true;
        setSessionEnded(msg);
        stopCamera();
      }
    }
  }, [sessionId]);

  const stopCamera = useCallback(async () => {
    const inst = scannerRef.current;
    scannerRef.current = null;
    setCameraOn(false);
    if (inst) {
      try { await inst.stop(); } catch { /* already stopped */ }
      try { inst.clear(); } catch { /* noop */ }
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const instance = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false });
      scannerRef.current = instance;
      await instance.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          const token = String(decodedText || '').trim().toUpperCase();
          if (!token) return;
          const now = Date.now();
          const last = lastTokenRef.current;
          // Same code still in front of the camera → ignore until cooldown ends.
          if (last.token === token && now - last.at < SAME_TOKEN_COOLDOWN_MS) return;
          lastTokenRef.current = { token, at: now };
          submitToken(token, true);
        },
        () => { /* per-frame "no QR found" — normal, ignore */ }
      );
      setCameraOn(true);
    } catch (err) {
      scannerRef.current = null;
      setCameraOn(false);
      setCameraError(
        'Could not start the camera. Allow camera access (HTTPS is required), or use manual token entry.'
      );
      setManualMode(true);
      console.error(err);
    }
  }, [submitToken]);

  // Auto-start the camera once a session is present.
  useEffect(() => {
    if (!sessionId) return;
    startCamera();
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Heartbeat — tells the main device this scanner is still connected, and
  // detects a session that expired or was ended from the main device.
  useEffect(() => {
    if (!sessionId) return;
    const beat = async () => {
      if (endedRef.current) return;
      const res = await qrAPI.heartbeat(sessionId);
      if (!res.success) {
        endedRef.current = true;
        setSessionEnded(res.message || 'Session ended');
        stopCamera();
      }
    };
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Closing/leaving this page ends the session for everyone.
  useEffect(() => {
    if (!sessionId) return;
    const close = () => { if (!endedRef.current) qrAPI.closeSession(sessionId); };
    window.addEventListener('pagehide', close);
    return () => {
      window.removeEventListener('pagehide', close);
      close();
    };
  }, [sessionId]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const token = tokenInput.trim().toUpperCase();
    if (token) submitToken(token, false);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-start justify-center p-4">
      <div className="w-full max-w-sm space-y-4 py-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-[var(--primary)] rounded-xl">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--primary)]">SGMS</h1>
            <p className="text-xs text-[var(--muted-foreground)]">Student QR Scanner</p>
          </div>
        </div>

        {sessionError && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{sessionError}</AlertDescription>
          </Alert>
        )}

        {sessionEnded ? (
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <div className="mx-auto p-4 rounded-full bg-gray-100 w-fit">
                <CameraOff className="w-8 h-8 text-gray-500" />
              </div>
              <p className="font-semibold">Scanning session ended</p>
              <p className="text-sm text-gray-500">{sessionEnded}</p>
              <p className="text-xs text-gray-400">
                Ask the main device to start a new session, then scan its QR again.
              </p>
            </CardContent>
          </Card>
        ) : sessionId ? (
          <>
            {/* Live camera */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-[var(--primary)]" />
                    Scan Student QR
                  </span>
                  <span className={`text-xs font-normal ${cameraOn ? 'text-green-600' : 'text-gray-400'}`}>
                    {cameraOn ? '● Live' : 'Camera off'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  id={SCANNER_ELEMENT_ID}
                  className="w-full rounded-lg overflow-hidden bg-black/90 min-h-[240px]"
                />

                {cameraError && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription className="text-xs">{cameraError}</AlertDescription>
                  </Alert>
                )}

                <p className="text-xs text-gray-500">
                  Hold each student's QR code in front of the camera. The camera keeps running —
                  just move on to the next student after each beep. Scans this session:{' '}
                  <strong>{typeof scanCount === 'number' ? scanCount : history.length}</strong>
                </p>

                <div className="flex gap-2">
                  {cameraOn ? (
                    <Button variant="outline" size="sm" className="flex-1" onClick={stopCamera}>
                      <CameraOff className="w-4 h-4 mr-2" /> Pause Camera
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="flex-1" onClick={startCamera}>
                      <Camera className="w-4 h-4 mr-2" /> Start Camera
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setManualMode((m) => !m)}
                  >
                    <Keyboard className="w-4 h-4 mr-2" />
                    {manualMode ? 'Hide Manual' : 'Manual Entry'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Last scan feedback */}
            {lastResult?.success && lastResult.student && (
              <Card className="border-green-200">
                <CardContent className="pt-5 flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-100">
                    <UserCheck className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{lastResult.student.ENGLISH_NAME}</p>
                    <p className="text-xs text-gray-500 font-mono">{lastResult.student.STUDENT_ID}</p>
                    <p className="text-xs text-gray-500">
                      Grade {lastResult.student.GRADE_LEVEL} · Section {lastResult.student.SECTION_NUMBER} · #{lastResult.student.CLASS_NUMBER}
                    </p>
                    <p className="text-xs text-green-700 mt-1">Sent to the teacher's screen.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {lastResult?.success === false && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{lastResult.message}</AlertDescription>
              </Alert>
            )}

            {/* Manual fallback */}
            {manualMode && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Manual Token Entry</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleManualSubmit} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="token">Student Token</Label>
                      <Input
                        id="token"
                        placeholder="e.g. A7B9C2X4K1M0"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                        className="font-mono tracking-widest text-center text-lg h-12"
                        autoComplete="off"
                      />
                    </div>
                    <Button type="submit" className="w-full h-12 text-base" disabled={pairing || !tokenInput.trim()}>
                      {pairing
                        ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sending…</>
                        : <><Link2 className="w-5 h-5 mr-2" /> Send Student</>}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Recent scans */}
            {history.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Recent scans</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {history.map((h, i) => (
                    <div key={`${h.id}-${i}`} className="flex justify-between text-xs text-gray-600">
                      <span className="truncate">{h.name} <span className="font-mono text-gray-400">{h.id}</span></span>
                      <span className="text-gray-400">{h.at.toLocaleTimeString()}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-center text-gray-400">
              Session: <span className="font-mono">{sessionId.slice(0, 8)}…</span> — closing this
              page ends the session.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default QRScanPair;
