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
  BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import EmployeeTimeClock from "./EmployeeTimeClock";
import type { OrderWithDetails, UserWithTimeClock } from "@shared/schema";

export default function PosAdminDashboard() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const { data: todayStats } = useQuery({
    queryKey: ["/api/stats/today"],
  });

  const { data: orders = [] } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders"],
  });

  const { data: users = [] } = useQuery<UserWithTimeClock[]>({
    queryKey: ["/api/users"],
  });

  const { data: salesReport } = useQuery({
    queryKey: ["/api/reports/sales", dateRange],
    queryFn: () => fetch(`/api/reports/sales?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`).then(res => res.json()),
  });

  const recentOrders = orders.slice(0, 5);
  const pendingOrders = orders.filter(order => order.status === 'pending');
  const activeEmployees = users.filter(user => user.currentTimeClock);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatTime = (date: string | Date) => {
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
              {users.length} total employees
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
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
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
                  {activeEmployees.map((employee) => (
                    <div key={employee.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{employee.firstName} {employee.lastName}</div>
                        <div className="text-sm text-muted-foreground">{employee.role}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          Since {formatTime(employee.currentTimeClock!.clockIn)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Today: {(employee.todayHours || 0).toFixed(2)}h
                        </div>
                      </div>
                    </div>
                  ))}
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

        <TabsContent value="orders" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Orders ({pendingOrders.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendingOrders.map((order) => (
                    <div key={order.id} className="p-2 border rounded">
                      <div className="font-medium">#{order.orderNumber}</div>
                      <div className="text-sm text-muted-foreground">
                        {order.customerName} • {formatCurrency(parseFloat(order.total))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>All Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {orders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">#{order.orderNumber}</div>
                        <div className="text-sm text-muted-foreground">
                          {order.customerName} • {formatTime(order.createdAt!)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {order.items.length} items • {order.orderType}
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
          </div>
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          <EmployeeTimeClock />
        </TabsContent>

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