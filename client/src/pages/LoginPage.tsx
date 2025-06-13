import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { User, ShieldQuestion } from 'lucide-react';
import Numpad from '@/components/ui/Numpad';
import PinInputDisplay from '@/components/ui/PinInputDisplay';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { TimeClockEvent, UserWithRoles } from '@shared/schema';

const fetchUserByCode = async (code: string): Promise<{ name: string; avatarUrl: string | null; requiresPin: boolean; code: string; id: number }> => {
  const response = await apiRequest('GET', `/api/users/lookup/${code}`);
  return response.json();
};

const LoginPage: React.FC = () => {
  const [step, setStep] = useState<'code' | 'pin'>('code');
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [shake, setShake] = useState(false);
  const [foundUser, setFoundUser] = useState<{ name: string; avatarUrl: string | null; requiresPin: boolean; code: string; id: number } | null>(null);
  const [showClockInModal, setShowClockInModal] = useState(false);
  
  const auth = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const maxCodeLength = 5;
  const maxPinLength = 4;

  const resetWithError = (message: string) => {
    setError(message);
    setShake(true);
    setTimeout(() => setShake(false), 500);
    setInputValue('');
    setStep('code');
    setFoundUser(null);
    setIsProcessing(false);
  };
  
  const handleRedirect = useCallback((user: UserWithRoles) => {
    const roleNames = user.roles.map(role => role.name);
    const timeClockOnlyRoles = [
      'Busser / Server Assistant', 'Food Runner', 'Greeter', 'Line Cook', 'Prep Cook',
      'Dishwasher', 'Expeditor (Expo)', 'Stock Associate / Stocker', 'Receiving Clerk',
      'Visual Merchandiser', 'Loss Prevention / Security',
    ];
    const isAdmin = roleNames.includes('General Manager (GM) / Store Manager') || roleNames.includes('Assistant Manager');
    const hasFullPosAccess = roleNames.some(roleName => !timeClockOnlyRoles.includes(roleName));
    const hasAnyTimeClockOnlyRole = roleNames.some(roleName => timeClockOnlyRoles.includes(roleName));

    if (hasAnyTimeClockOnlyRole && !isAdmin && !hasFullPosAccess) {
      navigate('/my-timecard');
    } else if (isAdmin || hasFullPosAccess) {
      navigate('/ordering');
    } else {
      navigate('/my-timecard');
    }
  }, [navigate]);

  const clockInMutation = useMutation({
    mutationFn: (userId: number) => apiRequest('POST', `/api/users/${userId}/clock-in`),
    onSuccess: () => {
      if (auth.currentUser) handleRedirect(auth.currentUser);
    },
  });

  const handleClockInConfirmation = async (shouldClockIn: boolean) => {
    setShowClockInModal(false);
    if (shouldClockIn && auth.currentUser) {
      clockInMutation.mutate(auth.currentUser.id);
    } else if (auth.currentUser) {
      handleRedirect(auth.currentUser);
    }
  };

  const handleLogin = async (code: string, pin?: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const user = await auth.login(code, pin);
      if (user) {
        const timeClockEvents = await queryClient.fetchQuery<TimeClockEvent[]>({
          queryKey: [`/api/time-clocks/user/${user.id}/today`],
        });
        const lastEvent = timeClockEvents?.[0];
        if (!lastEvent || lastEvent.eventType === 'clock-out') {
          setShowClockInModal(true);
        } else {
          handleRedirect(user);
        }
      }
    } catch (err: any) {
      resetWithError(err.message || "Login failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = useCallback((key: string) => {
    if (isProcessing) return;
    setError(null);

    if (key === 'backspace') {
      setInputValue((prev) => prev.slice(0, -1));
    } else {
      const newInputValue = inputValue + key;
      setInputValue(newInputValue);

      if (step === 'code' && newInputValue.length === maxCodeLength) {
        const processCode = async () => {
          setIsProcessing(true);
          try {
            const user = await fetchUserByCode(newInputValue);
            setFoundUser(user);
            if (user.requiresPin) {
              setStep('pin');
              setInputValue('');
              setIsProcessing(false);
            } else {
              await handleLogin(newInputValue);
            }
          } catch (err: any) {
            resetWithError(err.message || "Invalid employee code.");
          }
        };
        processCode();
      } else if (step === 'pin' && newInputValue.length === maxPinLength && foundUser) {
        handleLogin(foundUser.code, newInputValue);
      }
    }
  }, [inputValue, isProcessing, step, foundUser]);

  const renderHeader = () => {
    if (step === 'pin' && foundUser) {
      return (
        <>
          {foundUser.avatarUrl ? (
             <img src={foundUser.avatarUrl} alt={foundUser.name} className="w-24 h-24 rounded-full mx-auto" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mx-auto">
                <User className="w-12 h-12 text-gray-500" />
            </div>
          )}
          <CardTitle className="text-2xl text-center pt-4">{foundUser.name}</CardTitle>
          <CardDescription className="text-center">Enter your 4-digit PIN</CardDescription>
        </>
      );
    }
    return (
      <>
        <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mx-auto">
             <ShieldQuestion className="w-12 h-12 text-gray-500" />
        </div>
        <CardTitle className="text-2xl text-center pt-4">Employee Login</CardTitle>
        <CardDescription className="text-center">Enter your 5-digit employee code</CardDescription>
      </>
    );
  };

  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
      <Card className={cn("w-full max-w-sm border-0 shadow-xl", shake && "animate-shake")}>
        <CardHeader className="pt-8">
          {renderHeader()}
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
            <PinInputDisplay 
                length={step === 'code' ? maxCodeLength : maxPinLength} 
                filledCount={inputValue.length}
            />
            {error && <p className="text-sm text-center font-semibold text-red-500 h-5">{error}</p>}
            {!error && <div className="h-5" />}
            <Numpad onKeyPress={handleKeyPress} disabled={isProcessing} />
        </CardContent>
        <CardFooter className="flex-col gap-4 pb-8">
            <Button variant="link" className="text-gray-500 font-semibold" onClick={() => resetWithError('Please enter your employee code.')}>
                Not you? Start Over
            </Button>
        </CardFooter>
      </Card>
      {showClockInModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-center">Clock In</h3>
            <p className="text-center mb-6">You are not clocked in. Would you like to clock in now?</p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" variant="outline" onClick={() => handleClockInConfirmation(false)}>No</Button>
              <Button size="lg" onClick={() => handleClockInConfirmation(true)}>Yes</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;