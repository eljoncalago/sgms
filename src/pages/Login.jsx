import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

// FIX: removed erroneous backslash-escaping of quotes that caused JSX parse errors.

const Login = () => {
  const [adminName, setAdminName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(adminName, passcode);

      if (result.success) {
        toast.success('Login successful!');
        navigate('/dashboard');
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-600 rounded-full">
              <GraduationCap className="w-12 h-12 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">SGMS</CardTitle>
          <CardDescription className="text-lg">
            Student Grade Management System
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminName">Username</Label>
              <Input
                id="adminName"
                type="text"
                placeholder="Enter your username"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                required
                autoFocus
                data-testid="login-username-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passcode">Password</Label>
              <Input
                id="passcode"
                type="password"
                placeholder="Enter your password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                required
                data-testid="login-password-input"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="login-submit-button"
            >
              {loading ? 'Logging in…' : 'Login'}
            </Button>
          </form>

          <div className="mt-6 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800 text-center">
              <strong>Default Credentials:</strong><br />
              Username: admin | Password: admin123
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
