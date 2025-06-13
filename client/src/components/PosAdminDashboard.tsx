import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  ShoppingBag,
  Users,
  Clock,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Settings,
  BarChart3,
  CalendarClock, // Import icon for Time Clock Reports
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import EmployeeTimeClock from "./EmployeeTimeClock";
import type { OrderWithDetails, UserWithTimeClock, UserWithRoles, TimeClockEvent } from "@shared/schema";
import UserManagementTab from "@/components/UserManagementTab";
import RoleManagementTab from "./RoleManagementTab";
import { useAuth } from "@/contexts/AuthContext"; // Import useAuth
import { hasRequiredRole } from "@/lib/utils"; // Assuming hasRequiredRole is in utils


export default function PosAdminDashboard() {
  const { currentUser } = useAuth(); // Get current user
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  interface TodayStats {
    todaySales: number;
    todayOrders: number;
    todayTips: number;
    averageOrderValue: number;
    lowStockCount: number;
  }

  const { data: todayStats } = useQuery<TodayStats>({
    queryKey: ["/api/stats/today"],
    queryFn: () => fetch("/api/stats/today").then(res => res.json()),
  });

  const { data: orders = [] } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders"],
  });

  // The /api/users endpoint now returns UserWithRoles[], but UserWithTimeClock might still be relevant for some displays.
  // For the activeEmployees list, we need time clock info.
  // For User Management tab, we'll use a separate query or ensure this one provides all needed data.
  const { data: usersWithTimeClockData = [] } = useQuery<UserWithTimeClock[]>({
    queryKey: ["/api/users"], // This key might need to be more specific if data shape changes significantly
                               // or use a different endpoint for just time clock relevant user list.
                               // For now, assuming /api/users returns data compatible with UserWithTimeClock structure
                               // (i.e., includes roles AND time clock info if DbStorage.getUsers is updated accordingly)
  });

  const { data: salesReport } = useQuery({
    queryKey: ["/api/reports/sales", dateRange],
    queryFn: () => fetch(`/api/reports/sales?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`).then(res => res.json()),
  });

  // Fetch employee time reports
  const { data: employeeTimeReports = [], isLoading: isLoadingEmployeeTimeReports } = useQuery<TimeClockEvent[]>({ // Use TimeClockEvent[] type
    queryKey: ["/api/reports/employees", dateRange],
    queryFn: () => fetch(`/api/reports/employees?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`).then(res => res.json()).then(data => data.timeClocks), // Extract timeClocks array
  });


  const recentOrders = orders.slice(0, 5);
  const pendingOrders = orders.filter(order => order.status === 'pending');
  
  const activeEmployees = usersWithTimeClockData.filter(user => {
    if (!user.timeClockEvents || user.timeClockEvents.length === 0) {
      return false;
    }
    const lastEvent = user.timeClockEvents.sort((a, b) => Number(b.eventTime) - Number(a.eventTime))[0];
    return lastEvent.eventType === 'clock-in' || lastEvent.eventType === 'break-end';
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatTime = (date: string | Date | number) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Define roles for conditional tab rendering
  const userRoleManagementRoles = ['General Manager (GM) / Store Manager', 'Assistant Manager'];
  const hasUserRoleManagementAccess = hasRequiredRole(currentUser, userRoleManagementRoles);

  const timeClockAdminRoles = ['General Manager (GM) / Store Manager', 'Assistant Manager']; // Roles that can view all time clock data
  const hasTimeClockAdminAccess = hasRequiredRole(currentUser, timeClockAdminRoles);


  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(todayStats?.todaySales || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {todayStats?.todayOrders || 0} orders today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tips Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(todayStats?.todayTips || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatCurrency(todayStats?.averageOrderValue || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeEmployees.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {usersWithTimeClockData.length} total employees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alert</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {todayStats?.lowStockCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Items need restocking
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          {hasUserRoleManagementAccess && (
             <>
               <TabsTrigger value="userManagement">User Management</TabsTrigger>
               <TabsTrigger value="roleManagement">Role Management</TabsTrigger>
             </>
          )}
          {hasTimeClockAdminAccess && (
             <TabsTrigger value="timeClockReports">Time Clock Reports</TabsTrigger> // New tab for time clock reports
          )}
          <TabsTrigger value="reports">Sales Reports</TabsTrigger> {/* Renamed Reports tab */}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Orders */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  Recent Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">#{order.orderNumber}</div>
                        <div className="text-sm text-muted-foreground">
                          {order.customerName} • {formatTime(order.createdAt!)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(parseFloat(order.total))}</div>
                        <Badge className={getOrderStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Active Employees */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Clocked In Staff
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeEmployees.map((employee) => {
                    const lastClockInEvent = employee.timeClockEvents
                      ?.filter(e => e.eventType === 'clock-in')
                      .sort((a, b) => Number(b.eventTime) - Number(a.eventTime))[0];

                    return (
                      <div key={employee.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{employee.firstName} {employee.lastName}</div>
                          <div className="text-sm text-muted-foreground">{employee.roles && employee.roles.length > 0 ? employee.roles[0].name : 'No role'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            Since {lastClockInEvent ? formatTime(lastClockInEvent.eventTime) : 'N/A'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Today: {(employee.todayHours || 0).toFixed(2)}h
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {activeEmployees.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      No employees currently clocked in
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {hasUserRoleManagementAccess && (
           <>
             <TabsContent value="userManagement" className="space-y-4">
               <UserManagementTab />
             </TabsContent>

             <TabsContent value="roleManagement" className="space-y-4">
               <RoleManagementTab />
             </TabsContent>
           </>
        )}

        {hasTimeClockAdminAccess && (
           <TabsContent value="timeClockReports" className="space-y-4">
              <Card>
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                       <CalendarClock className="h-5 w-5" />
                       Employee Time Reports
                    </CardTitle>
                 </CardHeader>
                 <CardContent>
                    <div className="space-y-4">
                       <div className="flex gap-4">
                          <input
                             type="date"
                             value={dateRange.startDate}
                             onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                             className="px-3 py-2 border rounded-md"
                          />
                          <input
                             type="date"
                             value={dateRange.endDate}
                             onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                             className="px-3 py-2 border rounded-md"
                          />
                       </div>

                       {isLoadingEmployeeTimeReports ? (
                          <div>Loading employee time reports...</div>
                       ) : employeeTimeReports.length === 0 ? (
                          <div>No employee time reports found for this date range.</div>
                       ) : (
                          <div className="space-y-4">
                             {employeeTimeReports.map((report: any) => ( // TODO: Define type for report
                                <Card key={report.userId}>
                                   <CardHeader>
                                      <CardTitle>{report.userName}</CardTitle>
                                   </CardHeader>
                                   <CardContent>
                                      <div className="space-y-2">
                                         <div>Total Hours: {report.totalHours.toFixed(2)}</div>
                                         <div>Total Break: {report.totalBreakHours.toFixed(2)}</div>
                                         {/* Display individual time entries if available */}
                                         {report.entries && report.entries.length > 0 && (
                                            <div>
                                               <h4 className="font-medium mt-2">Entries:</h4>
                                               <ul className="list-disc list-inside">
                                                  {report.entries.map((entry: any) => ( // TODO: Define type for entry
                                                     <li key={entry.id}>
                                                        {new Date(entry.clockIn).toLocaleString()} - {entry.clockOut ? new Date(entry.clockOut).toLocaleString() : 'Present'} (Break: {(entry.breakDuration / 3600000).toFixed(2)}h)
                                                     </li>
                                                  ))}
                                               </ul>
                                            </div>
                                         )}
                                      </div>
                                   </CardContent>
                                </Card>
                             ))}
                          </div>
                       )}
                    </div>
                 </CardContent>
              </Card>
           </TabsContent>
        )}


        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Sales Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="px-3 py-2 border rounded-md"
                  />
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="px-3 py-2 border rounded-md"
                  />
                </div>

                {salesReport && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">Total Sales</div>
                      <div className="text-2xl font-bold">
                        {formatCurrency(salesReport.totalSales || 0)}
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">Total Orders</div>
                      <div className="text-2xl font-bold">
                        {salesReport.totalOrders || 0}
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">Average Order</div>
                      <div className="text-2xl font-bold">
                        {formatCurrency(salesReport.averageOrderValue || 0)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}