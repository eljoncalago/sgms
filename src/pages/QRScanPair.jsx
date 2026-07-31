/**
 * QRScanPair.jsx — Public page opened on the SECOND device
 *
 * The second device scans the session QR from QRPairing.jsx.
 * That QR encodes a URL like: https://domain/#/scan-pair?session=SESSION_ID
 * This page reads the session ID from the URL, then lets the operator
 * enter (or type) the student's QR token to complete the pairing.
 *
 * This route is PUBLIC — no auth token required.
 * The qrAPI.updateSession call on the backend requires only a valid
 * session ID and a valid student token (both are server-validated).
 */
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QrCode, Link2, Loader2, UserCheck, AlertCircle, CheckCircle2, GraduationCap } from 'lucide-react';
import { qrAPI } from '@/api/sgmsAPI';

const QRScanPair = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');

  const [tokenInput, setTokenInput] = useState('');
  const [pairing, setPairing] = useState(false);
  const [result, setResult] = useState(null); // { success, student, message }
  const [sessionError, setSessionError] = useState('');

  // Validate session on mount
  useEffect(() => {
    if (!sessionId) {
      setSessionError('No session ID found in URL. Please scan the QR code from the main device again.');
    }
  }, [sessionId]);

  const handlePair = async (e) => {
    e.preventDefault();
    const token = tokenInput.trim();
    if (!token) return;

    setPairing(true);
    setResult(null);

    // qrAPI.updateSession sends { sessionId, studentToken } to the backend
    const res = await qrAPI.updateSession(sessionId, token);
    setPairing(false);

    if (res.success) {
      setResult({ success: true, student: res.data?.student });
    } else {
      setResult({ success: false, message: res.message || 'Invalid token or session expired' });
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-[var(--primary)] rounded-xl">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--primary)]">SGMS</h1>
            <p className="text-xs text-[var(--muted-foreground)]">Device Pairing</p>
          </div>
        </div>

        {/* Session error */}
        {sessionError && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{sessionError}</AlertDescription>
          </Alert>
        )}

        {/* Already paired */}
        {result?.success ? (
          <Card>
            <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
              <div className="p-4 rounded-full bg-green-100">
                <UserCheck className="w-10 h-10 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-green-700">Student Paired!</p>
                <p className="text-base font-semibold mt-1">{result.student?.ENGLISH_NAME}</p>
                <p className="text-sm text-gray-500 font-mono">{result.student?.STUDENT_ID}</p>
                {result.student && (
                  <p className="text-sm text-gray-500 mt-1">
                    Grade {result.student.GRADE_LEVEL} · Section {result.student.SECTION_NUMBER} · #{result.student.CLASS_NUMBER}
                  </p>
                )}
              </div>
              <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700 w-full">
                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                The main device has been updated. You can close this page.
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[var(--primary)]" />
                Enter Student Token
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!sessionId ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Missing session — please rescan the QR from the main device.
                </p>
              ) : (
                <>
                  <div className="rounded-md bg-[var(--secondary)] p-3 text-xs text-[var(--secondary-foreground)] space-y-1">
                    <p className="font-semibold">How to pair:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>Open the student's personal QR code (from QR Codes page)</li>
                      <li>The token is shown below the QR image (e.g. A7B9C2X4K1M0)</li>
                      <li>Type it here and tap Pair</li>
                    </ol>
                  </div>

                  <form onSubmit={handlePair} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="token">Student Token</Label>
                      <Input
                        id="token"
                        placeholder="e.g. A7B9C2X4K1M0"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                        className="font-mono tracking-widest text-center text-lg h-12"
                        autoComplete="off"
                        autoFocus
                      />
                    </div>

                    {result?.success === false && (
                      <Alert variant="destructive">
                        <AlertCircle className="w-4 h-4" />
                        <AlertDescription>{result.message}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-12 text-base"
                      disabled={pairing || !tokenInput.trim()}
                    >
                      {pairing
                        ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Pairing…</>
                        : <><Link2 className="w-5 h-5 mr-2" /> Pair Student</>
                      }
                    </Button>
                  </form>

                  <p className="text-xs text-center text-gray-400">
                    Session ID: <span className="font-mono">{sessionId?.slice(0, 8)}…</span>
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default QRScanPair;
