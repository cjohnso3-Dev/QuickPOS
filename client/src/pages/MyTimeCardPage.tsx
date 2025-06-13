import React, { useState, useEffect, useCallback } from 'react';
import './MyTimeCardPage.css';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, getQueryFn, apiRequest } from '../lib/queryClient';
import type { UserWithTimeClock, TimeClockEvent } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Coffee, LogOut, Play, Square, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addWeeks, subWeeks } from 'date-fns';

const formatTime = (dateString?: string | number | Date): string => {
  if (!dateString) return 'N/A';
  return format(new Date(dateString), 'h:mm:ss a');
};

const formatDuration = (milliseconds: number): string => {
  if (isNaN(milliseconds) || milliseconds < 0) return "0:00:00";
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(1, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const MyTimeCardPage: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { toast } = useToast();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [currentDuration, setCurrentDuration] = useState("0:00:00");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'clockIn' | 'clockOut' | 'startBreak' | 'endBreak' | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  const handleLogout = () => {
    logout();
    toast({ title: 'Logged Out', description: 'You have been logged out successfully.' });
  };

  const userId = currentUser?.id;

  const { data: timeClockEvents = [], isLoading: isLoadingEvents, error: errorEvents } = useQuery<TimeClockEvent[]>({
    queryKey: [`/api/time-clocks/user/${userId}/week`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!userId,
  });

  const { data: userData, isLoading: isLoadingUser, error: errorUser } = useQuery<UserWithTimeClock>({
    queryKey: [`/api/users/${userId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!userId,
  });

  const invalidateTimeData = async () => {
    await queryClient.invalidateQueries({ queryKey: [`/api/time-clocks/user/${userId}/week`] });
    await queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
  };

  const { isClockedIn, isOnBreak, lastClockInTime } = React.useMemo(() => {
    if (!timeClockEvents || timeClockEvents.length === 0) {
      return { isClockedIn: false, isOnBreak: false, lastClockInTime: null };
    }
    const sortedEvents = [...timeClockEvents].sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime());
    let clockedIn = false;
    let onBreak = false;
    let lastClockIn: Date | null = null;

    for (const event of sortedEvents) {
      switch (event.eventType) {
        case 'clock-in':
          clockedIn = true;
          onBreak = false;
          lastClockIn = new Date(event.eventTime);
          break;
        case 'clock-out':
          clockedIn = false;
          onBreak = false;
          lastClockIn = null;
          break;
        case 'break-start':
          onBreak = true;
          break;
        case 'break-end':
          onBreak = false;
          break;
      }
    }
    return { isClockedIn: clockedIn, isOnBreak: onBreak, lastClockInTime: lastClockIn };
  }, [timeClockEvents]);

  const calculateCurrentDuration = useCallback(() => {
    if (!isClockedIn || !lastClockInTime) return "0:00:00";
    
    const now = new Date().getTime();
    let durationMs = now - lastClockInTime.getTime();

    const sortedEvents = [...timeClockEvents].sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime());
    let breakDuration = 0;
    let breakStart: number | null = null;

    for (const event of sortedEvents) {
      if (new Date(event.eventTime) < lastClockInTime) continue;

      if (event.eventType === 'break-start') {
        breakStart = new Date(event.eventTime).getTime();
      } else if (event.eventType === 'break-end' && breakStart) {
        breakDuration += new Date(event.eventTime).getTime() - breakStart;
        breakStart = null;
      }
    }

    if (breakStart) {
      breakDuration += now - breakStart;
    }

    durationMs -= breakDuration;

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
    
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [isClockedIn, lastClockInTime, timeClockEvents]);

  useEffect(() => {
    if (isClockedIn && !isOnBreak) {
      const timer = setInterval(() => {
        setCurrentDuration(calculateCurrentDuration());
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setCurrentDuration(calculateCurrentDuration());
    }
  }, [isClockedIn, isOnBreak, calculateCurrentDuration]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const mutationOptions = {
    onSuccess: async () => {
      await invalidateTimeData();
    },
    onError: (error: Error) => toast({ title: 'Action Failed', description: error.message, variant: 'destructive' }),
  };

  const clockInMutation = useMutation({ mutationFn: () => apiRequest('POST', `/api/users/${userId}/clock-in`), ...mutationOptions });
  const clockOutMutation = useMutation({ mutationFn: () => apiRequest('POST', `/api/users/${userId}/clock-out`), ...mutationOptions });
  const startBreakMutation = useMutation({ mutationFn: () => apiRequest('POST', `/api/time-clocks/active/start-break`), ...mutationOptions });
  const endBreakMutation = useMutation({ mutationFn: () => apiRequest('POST', `/api/time-clocks/active/end-break`), ...mutationOptions });

  const handleClockOutAction = () => {
    if (isOnBreak) {
      setConfirmMessage('You are on break. This will also end your break and clock you out for the day. Continue?');
    } else {
      setConfirmMessage('Are you sure you want to clock out?');
    }
    setConfirmAction('clockOut');
    setShowConfirmModal(true);
  };

  const handleStartBreakAction = () => {
    setConfirmMessage('Are you sure you want to start your break?');
    setConfirmAction('startBreak');
    setShowConfirmModal(true);
  };

  const handleEndBreakAction = () => {
    setConfirmMessage('Are you sure you want to end your break?');
    setConfirmAction('endBreak');
    setShowConfirmModal(true);
  };

  const handleClockInAction = () => {
    setConfirmMessage('Are you sure you want to clock in?');
    setConfirmAction('clockIn');
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    setShowConfirmModal(false);
    switch (confirmAction) {
      case 'clockIn': clockInMutation.mutate(); break;
      case 'clockOut': clockOutMutation.mutate(); break;
      case 'startBreak': startBreakMutation.mutate(); break;
      case 'endBreak': endBreakMutation.mutate(); break;
    }
  };

  const getTodayTotalHours = () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const events = timeClockEvents
      .filter(e => new Date(e.eventTime) >= todayStart)
      .sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime());

    let totalWorkMs = 0;
    let shifts: { start: number; end: number | null }[] = [];
    let breaks: { start: number; end: number | null }[] = [];

    for (const event of events) {
      const eventTime = new Date(event.eventTime).getTime();
      if (event.eventType === 'clock-in') {
        shifts.push({ start: eventTime, end: null });
      } else if (event.eventType === 'clock-out') {
        const openShift = shifts.find(s => s.end === null);
        if (openShift) {
          openShift.end = eventTime;
        }
      } else if (event.eventType === 'break-start') {
        breaks.push({ start: eventTime, end: null });
      } else if (event.eventType === 'break-end') {
        const openBreak = breaks.find(b => b.end === null);
        if (openBreak) {
          openBreak.end = eventTime;
        }
      }
    }

    for (const shift of shifts) {
      const shiftEnd = shift.end ?? new Date().getTime();
      let shiftDuration = shiftEnd - shift.start;
      let totalBreakDurationInShift = 0;

      for (const br of breaks) {
        if (br.start >= shift.start && br.start < shiftEnd) {
          const breakEnd = br.end ?? shiftEnd;
          totalBreakDurationInShift += Math.min(breakEnd, shiftEnd) - br.start;
        }
      }
      
      shiftDuration -= totalBreakDurationInShift;
      totalWorkMs += shiftDuration;
    }

    return formatDuration(totalWorkMs);
  };

  const getDaysOfWeek = (date: Date) => {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const days = [];
    
    // Get the start of the week (Sunday)
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - dayOfWeek);
    
    // Generate array of dates for the week
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    
    return days;
  };
  
  const weekDays = getDaysOfWeek(currentWeek);

  const getEntryCountForDay = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return timeClockEvents.filter(e => format(new Date(e.eventTime), 'yyyy-MM-dd') === dateString).length;
  };

  const selectedDayEntries = timeClockEvents.filter(e => format(new Date(e.eventTime), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd'));

  if (isLoadingUser || isLoadingEvents) return <div>Loading...</div>;
  if (errorUser || errorEvents) return <div>Error loading data.</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white shadow-md p-4 flex justify-between items-center">
        <div>
          <h2 className="font-bold text-lg">{userData?.firstName} {userData?.lastName}</h2>
          <p className="text-sm text-gray-500">Westside Restaurant</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">{format(currentDateTime, "EEEE, d MMM")}</p>
          <p className="text-lg font-bold">{format(currentDateTime, "h:mmaa")}</p>
        </div>
      </div>

      <Card className="m-4 p-6 flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-1">{isClockedIn ? (isOnBreak ? 'On Break' : 'Clocked In') : 'Clocked Out'}</h2>
        {isClockedIn ? (
          <>
            <p className="text-3xl font-bold mb-4 text-blue-600">{currentDuration}</p>
            <p className="text-xs text-gray-500">
              {isOnBreak ? `Break started at ${formatTime(timeClockEvents.find(e => e.eventType === 'break-start')?.eventTime)}` : `Clocked in at ${lastClockInTime ? formatTime(lastClockInTime) : 'N/A'}`}
            </p>
          </>
        ) : (
          <p className="text-lg text-gray-600 mb-1">Today's Hours: {getTodayTotalHours()}</p>
        )}
      </Card>

      <div className="p-4 bg-white shadow-md mx-4 mb-4 flex flex-wrap justify-center gap-4 rounded-lg">
        {!isClockedIn ? (
          <Button size="lg" className="bg-green-500 hover:bg-green-600 text-white flex-1" onClick={handleClockInAction}>
            <Play className="mr-2" /> Clock In
          </Button>
        ) : isOnBreak ? (
          <Button size="lg" className="bg-green-500 hover:bg-green-600 text-white flex-1" onClick={handleEndBreakAction}>
            <Play className="mr-2" /> End Break
          </Button>
        ) : (
          <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white flex-1" onClick={handleStartBreakAction}>
            <Coffee className="mr-2" /> Start Break
          </Button>
        )}
        {isClockedIn && (
          <Button size="lg" className="bg-red-500 hover:bg-red-600 text-white flex-1" onClick={handleClockOutAction}>
            <Square className="mr-2" /> Clock Out
          </Button>
        )}
        <Button size="lg" variant="outline" onClick={handleLogout} className="text-red-500 border-red-200 hover:bg-red-50">
          <LogOut className="mr-2" /> Logout
        </Button>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-center">Confirmation</h3>
            <p className="text-center mb-6">{confirmMessage || `Are you sure you want to ${confirmAction}?`}</p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" variant="outline" onClick={() => setShowConfirmModal(false)}>Cancel</Button>
              <Button size="lg" onClick={handleConfirm}>Confirm</Button>
            </div>
          </div>
        </div>
      )}

      <Card className="bg-white shadow-md rounded-lg mx-4 mb-4 p-4">
        <CardHeader className="flex justify-between items-center">
          <Button variant="ghost" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <CardTitle>Weekly Schedule</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
            <ChevronRight className="h-6 w-6" />
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-7 gap-1">
          {weekDays.map((day, index) => {
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
            const entryCount = getEntryCountForDay(day);

            return (
              <div
                key={index}
                onClick={() => setSelectedDate(day)}
                className={`p-2 text-center rounded-lg cursor-pointer transition-colors ${
                  isSelected ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'
                } ${isToday ? 'font-bold' : ''}`}
              >
                <div className="text-xs">{format(day, 'EEE')}</div>
                <div className="text-lg">{format(day, 'd')}</div>
                {entryCount > 0 && (
                  <div className="text-xs text-gray-400">{entryCount} entries</div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="flex-grow bg-white shadow-md rounded-lg mx-4 mb-4 p-4 overflow-y-auto">
        <CardHeader>
          <CardTitle>{format(selectedDate, 'EEEE, MMMM d')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {selectedDayEntries.length > 0 ? (
              selectedDayEntries.map((event, index) => (
                <li key={index} className={`flex items-center justify-between p-2 rounded-md hover:bg-gray-50 ${event.eventType.includes('break') ? 'ml-8' : ''}`}>
                  <div className="flex items-center">
                    <div className="mr-3">
                      {event.eventType === 'clock-in' && <Play className="text-green-500" />}
                      {event.eventType === 'clock-out' && <Square className="text-red-500" />}
                      {event.eventType === 'break-start' && <Coffee className="text-orange-500" />}
                      {event.eventType === 'break-end' && <Coffee className="text-blue-500" />}
                    </div>
                    <div>
                      <p className="font-semibold">{event.eventType.replace('-', ' ')}</p>
                      <p className="text-sm text-gray-500">{formatTime(event.eventTime)}</p>
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li className="text-center text-gray-500 p-4">No activity recorded for this day.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default MyTimeCardPage;