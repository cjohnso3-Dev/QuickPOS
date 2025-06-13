import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock, Play, Square, User, Calendar, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient"; // Import getQueryFn
// Remove the conflicting import declaration
// import type { UserWithTimeClock, TimeClock } from "@shared/schema"; // Import TimeClock type

// Update the UserWithTimeClock type definition
interface UserWithTimeClock {
  firstName: string;
  lastName: string;
  roles: AppRole[]; // Use AppRole type instead of Role
  todayHours: number;
  todayBreakHours: number;
  hourlyRate: number;
  currentTimeClock?: TimeClock;
}

// Update the TimeClock type definition
interface TimeClock {
  id: string;
  clockIn: Date;
  clockOut?: Date;
  breakDuration?: number;
}

// Import the Role type from the @shared/schema module
// Import the Role type from the @shared/schema module
import type { AppRole } from "@shared/schema"; // Import AppRole type instead of Role

// Update the UserWithTimeClock type definition
interface UserWithTimeClock {
  firstName: string;
  lastName: string;
  roles: AppRole[]; // Use AppRole type instead of Role
  todayHours: number;
  todayBreakHours: number;
  hourlyRate: number;
  currentTimeClock?: TimeClock; // Add the missing property
}

// Update the TimeClock type definition
interface TimeClock {
  id: string;
  clockIn: Date;
  clockOut?: Date;
  breakDuration?: number;
  breakStartTime?: Date; // Add the missing property
}

// Add the missing property to the UserWithTimeClock type
interface UserWithTimeClock {
  currentTimeClock?: TimeClock;
}

// Define a type for weekly time entries based on the TimeClock schema
type WeeklyTimeEntry = TimeClock;


export default function EmployeeTimeClock({ userId }: { userId: number }) {
  const { toast } = useToast();
  const { logout } = useAuth();

  // Fetch time clock data for the specific user
  const { data: userTimeData, isLoading, error } = useQuery<UserWithTimeClock>({
    queryKey: ["/api/users", userId], // Corrected query key for fetching specific user data
    queryFn: getQueryFn({ on401: "throw" }), // Use getQueryFn
    enabled: !!userId, // Only fetch if userId is available
  });

  // Fetch weekly time entries for the specific user
  const { data: weeklyEntries = [], isLoading: isLoadingWeekly, error: errorWeekly } = useQuery<WeeklyTimeEntry[]>({ // Use WeeklyTimeEntry type
    queryKey: ["/api/users", userId, "time-clocks"], // Corrected query key for fetching time clock entries
    queryFn: getQueryFn({ on401: "throw" }), // Use getQueryFn
    enabled: !!userId, // Only fetch if userId is available
  });


  const clockInMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/users/${userId}/clock-in`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to clock in");
      return response.json();
    },
    onSuccess: async () => {
      const timestamp = () => `[${new Date().toISOString()}]`;
      console.log(`${timestamp()} CLOCK_IN_FIX: clockInMutation.onSuccess - START - User ID: ${userId}`);

      // Corrected query keys and awaiting invalidation
      console.log(`${timestamp()} CLOCK_IN_FIX: Awaiting invalidateQueries for userTimeData with key: ["/api/users", ${userId}]`);
      await queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      console.log(`${timestamp()} CLOCK_IN_FIX: invalidateQueries for userTimeData completed.`);

      console.log(`${timestamp()} CLOCK_IN_FIX: Awaiting invalidateQueries for weeklyEntries with key: ["/api/users", ${userId}, "time-clocks"]`);
      await queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "time-clocks"] });
      console.log(`${timestamp()} CLOCK_IN_FIX: invalidateQueries for weeklyEntries completed.`);

      console.log(`${timestamp()} CLOCK_IN_FIX: All invalidateQueries calls completed. Showing toast.`);
      toast({
        title: "Clocked In",
        description: "Successfully clocked in. Logging out...",
      });
      console.log(`${timestamp()} CLOCK_IN_FIX: Toast shown. Calling logout() for user ${userId}.`);
      await logout();
      console.log(`${timestamp()} CLOCK_IN_FIX: logout() completed for user ${userId}.`);
    },
    onError: (error) => {
      toast({
        title: "Clock In Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/users/${userId}/clock-out`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to clock out");
      return response.json();
    },
    onSuccess: async () => {
      // Invalidate user data to refetch currentTimeClock status
      await queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      // Invalidate weekly time entries
      await queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "time-clocks"] });
      toast({
        title: "Clocked Out",
        description: "Successfully clocked out. Logging out...",
      });
      await logout();
    },
    onError: (error) => {
      toast({
        title: "Clock Out Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const startBreakMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/time-clocks/active/start-break`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to start break");
      return response.json();
    },
     onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "time-clock"] });
      toast({
        title: "Break Started",
        description: "Successfully started break",
      });
    },
    onError: (error) => {
      toast({
        title: "Start Break Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const endBreakMutation = useMutation({
    mutationFn: async () => {
       const response = await fetch(`/api/time-clocks/active/end-break`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to end break");
      return response.json();
    },
     onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "time-clock"] });
      toast({
        title: "Break Ended",
        description: "Successfully ended break",
      });
    },
    onError: (error) => {
      toast({
        title: "End Break Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatHours = (hours: number) => {
    return `${hours.toFixed(2)} hrs`;
  };

  if (isLoading) {
    return <div>Loading time clock data...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error loading time clock data: {error.message}</div>;
  }

  const user = userTimeData; // Rename for clarity

  if (!user) {
      return <div>No time clock data found for this user.</div>;
  }


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            My Time Clock
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">{user.firstName} {user.lastName}</div>
                  <div className="text-sm text-muted-foreground">{user.roles && user.roles.length > 0 ? user.roles[0].name : 'No role'}</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {user.currentTimeClock ? (
                  <div className="text-right">
                    <Badge variant="default" className="mb-1">
                      Clocked In
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      Since {formatTime(user.currentTimeClock.clockIn)}
                    </div>
                    {user.currentTimeClock.breakStartTime ? (
                      <Badge variant="destructive">On Break</Badge>
                    ) : (
                      <Badge variant="secondary">Available</Badge>
                    )}
                  </div>
                ) : (
                  <Badge variant="secondary">Clocked Out</Badge>
                )}

                <div className="text-right">
                  <div className="text-sm font-medium">
                    Today: {formatHours(user.todayHours || 0)} {/* TODO: Fetch and display actual today hours for this user */}
                  </div>
                  {user.hourlyRate && (
                    <div className="text-xs text-muted-foreground">
                      ${user.hourlyRate}/hr
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {!user.currentTimeClock ? (
                <Button
                  onClick={() => clockInMutation.mutate()}
                  disabled={clockInMutation.isPending}
                  className="flex items-center gap-2"
                  size="lg"
                >
                  <Play className="h-5 w-5" /> {/* Adjusted icon size for larger button */}
                  Clock In
                </Button>
              ) : (
                <Button
                  onClick={() => clockOutMutation.mutate()}
                  disabled={clockOutMutation.isPending}
                  variant="outline"
                  className="flex items-center gap-2"
                  size="lg"
                >
                  <Square className="h-5 w-5" /> {/* Adjusted icon size for larger button */}
                  Clock Out
                </Button>
              )}

              {user.currentTimeClock && !user.currentTimeClock.breakStartTime && (
                 <Button
                  onClick={() => startBreakMutation.mutate()}
                  disabled={startBreakMutation.isPending}
                  variant="secondary"
                  className="flex items-center gap-2"
                  size="lg"
                >
                  <Clock className="h-5 w-5" /> {/* Adjusted icon size for larger button */}
                  Start Break
                </Button>
              )}
               {user.currentTimeClock && user.currentTimeClock.breakStartTime && (
                <Button
                 onClick={() => endBreakMutation.mutate()}
                 disabled={endBreakMutation.isPending}
                  variant="secondary"
                  className="flex items-center gap-2"
                  size="lg"
                >
                  <Clock className="h-5 w-5" /> {/* Adjusted icon size for larger button */}
                  End Break
                </Button>
              )}
              <Button
                onClick={logout}
                variant="destructive"
                size="lg"
                className="flex items-center gap-2"
              >
                <LogOut className="h-5 w-5" />
                Logout
              </Button>
            </div>

            {/* TODO: Add section for current day summary */}
            <Card>
              <CardHeader>
                <CardTitle>Today's Summary</CardTitle>
              </CardHeader>
              <CardContent>
                 <div>Total Hours: {formatHours(user.todayHours || 0)}</div>
                 <div>Total Break: {formatHours(user.todayBreakHours || 0)}</div>
              </CardContent>
            </Card>


            {/* TODO: Add section for weekly time entries */}
             <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                   <Calendar className="h-5 w-5" />
                  Weekly Entries
                </CardTitle>
              </CardHeader>
              <CardContent>
                 {isLoadingWeekly ? (
                    <div>Loading weekly entries...</div>
                 ) : errorWeekly ? (
                    <div className="text-red-500">Error loading weekly entries: {errorWeekly.message}</div>
                 ) : weeklyEntries.length === 0 ? (
                    <div>No weekly entries found.</div>
                 ) : (
                    <ul className="space-y-2">
                       {weeklyEntries.map((entry) => ( // Use WeeklyTimeEntry type, no need for any
                          <li key={entry.id} className="border-b pb-2">
                             <div className="font-medium">{new Date(entry.clockIn).toLocaleDateString()}</div>
                             <div className="text-sm text-muted-foreground">
                                Clock In: {formatTime(entry.clockIn)}
                                {entry.clockOut && <span> - Clock Out: {formatTime(entry.clockOut)}</span>}
                                {entry.breakDuration != null && entry.breakDuration > 0 && <span> (Break: {formatHours(entry.breakDuration / 3600000)})</span>} {/* Convert ms to hours */}
                             </div>
                          </li>
                       ))}
                    </ul>
                 )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}