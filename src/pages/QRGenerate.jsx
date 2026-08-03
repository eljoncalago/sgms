/**
 * QRGenerate.jsx
 * THEME FIX: replaced hardcoded bg-blue-50 / text-blue-600 selection state
 * and bg-white QR card with CSS variable equivalents.
 * bg-gray-50 hover → bg-[var(--accent)] / bg-[var(--secondary)]
 * All logic is unchanged.
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { QrCode, Loader2, Download, RefreshCw, CheckCircle2 } from 'lucide-react';
import { studentsAPI, qrAPI } from '@/api/sgmsAPI';
import { PageHeader, Loading, EmptyState } from '@/components/PageState';
import { toast } from 'sonner';

const QRGenerate = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [qrData, setQrData] = useState(null); // { token, qrUrl }
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    studentsAPI.getAll({ status: 'Active' }).then((res) => {
      if (res.success) setStudents(res.data || []);
      else toast.error(res.message || 'Failed to load students');
      setLoading(false);
    });
  }, []);

  const filtered = students.filter((s) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      String(s.STUDENT_ID || '').toLowerCase().includes(term) ||
      String(s.ENGLISH_NAME || '').toLowerCase().includes(term) ||
      String(s.THAI_NAME || '').toLowerCase().includes(term)
    );
  });

  const generate = async (studentId) => {
    setGenerating(true);
    setQrData(null);
    const res = await qrAPI.generateStudentQR(studentId);
    setGenerating(false);
    if (res.success) {
      setQrData(res.data);
      setSelectedId(studentId);
      toast.success('QR code ready');
    } else {
      toast.error(res.message || 'Failed to generate QR');
    }
  };

  const selectedStudent = students.find((s) => s.STUDENT_ID === selectedId);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="Generate QR Codes" description="Create a permanent identity QR for each student" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Student picker */}
        <Card>
          <CardHeader>
            <CardTitle>Select Student</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search students…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3"
            />
            {loading ? (
              <Loading label="Loading students…" />
            ) : (
              <div className="max-h-[28rem] overflow-y-auto divide-y rounded-md border">
                {filtered.length === 0 ? (
                  <EmptyState icon={QrCode} title="No students" />
                ) : (
                  filtered.map((s) => (
                    <button
                      key={s.STUDENT_ID}
                      onClick={() => generate(s.STUDENT_ID)}
                      /* THEME FIX: selected uses accent var, hover uses secondary var */
                      className={`flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-[var(--secondary)] transition-colors ${
                        selectedId === s.STUDENT_ID ? 'bg-[var(--accent)]' : ''
                      }`}
                    >
                      <div>
                        <p className="font-medium text-sm">{s.ENGLISH_NAME}</p>
                        <p className="text-xs text-[var(--muted-foreground)] font-mono">{s.STUDENT_ID}</p>
                      </div>
                      {/* THEME FIX: checkmark uses primary var */}
                      {selectedId === s.STUDENT_ID && <CheckCircle2 className="w-4 h-4 text-[var(--primary)]" />}
                    </button>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* QR display */}
        <Card>
          <CardHeader>
            <CardTitle>QR Code</CardTitle>
          </CardHeader>
          <CardContent>
            {generating ? (
              <Loading label="Generating QR…" />
            ) : qrData ? (
              <div className="flex flex-col items-center text-center">
                {/* THEME FIX: QR card uses card CSS variable instead of hardcoded bg-white */}
                <div className="rounded-xl border p-4 bg-[var(--card)] shadow-sm">
                  <img src={qrData.qrUrl} alt="Student QR" className="w-64 h-64" />
                </div>
                <div className="mt-4 space-y-1">
                  <p className="font-semibold">{selectedStudent?.ENGLISH_NAME}</p>
                  <p className="text-xs text-[var(--muted-foreground)] font-mono">{selectedId}</p>
                  <Badge variant="secondary" className="mt-2 font-mono">{qrData.token}</Badge>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button asChild variant="outline">
                    <a href={qrData.qrUrl} download={`qr-${selectedId}.png`} target="_blank" rel="noreferrer">
                      <Download className="w-4 h-4 mr-2" /> Download
                    </a>
                  </Button>
                  <Button variant="outline" onClick={() => generate(selectedId)}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Regenerate
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState icon={QrCode} title="No QR generated" description="Select a student to generate their QR code." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QRGenerate;
