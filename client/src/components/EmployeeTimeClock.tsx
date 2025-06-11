import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock, Play, Square, User, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { UserWithTimeClock } from "@shared/schema";

export default function EmployeeTimeClock() {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: users = [] } = useQuery<UserWithTimeClock[]>({
    queryKey: ["/api/users"],
  });

  const clockInMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/users/${userId}/clock-in`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to clock in");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Clocked In",
        description: "Successfully clocked in",
      });
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
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/users/${userId}/clock-out`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to clock out");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Clocked Out",
        description: "Successfully clocked out",
      });
    },
    onError: (error) => {
      toast({
        title: "Clock Out Failed",
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Clock
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Employee</label>
              <Select 
                value={selectedUserId?.toString() || ""} 
                onValueChange={(value) => setSelectedUserId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose employee..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.firstName} {user.lastName} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedUserId && (
              <div className="flex gap-2">
                <Button
                  onClick={() => clockInMutation.mutate(selectedUserId)}
                  disabled={clockInMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Clock In
                </Button>
                <Button
                  onClick={() => clockOutMutation.mutate(selectedUserId)}
                  disabled={clockOutMutation.isPending}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Square className="h-4 w-4" />
                  Clock Out
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{user.firstName} {user.lastName}</div>
                    <div className="text-sm text-muted-foreground">{user.role}</div>
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
                    </div>
                  ) : (
                    <Badge variant="secondary">Clocked Out</Badge>
                  )}
                  
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      Today: {formatHours(user.todayHours || 0)}
                    </div>
                    {user.hourlyRate && (
                      <div className="text-xs text-muted-foreground">
                        ${user.hourlyRate}/hr
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}