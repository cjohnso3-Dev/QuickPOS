import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  Settings,
  LogOut,
  Users,
  Wifi,
  Clock,
  LayoutDashboard, // Import icon for Admin
  CalendarClock, // Import icon for Time Card
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { UserWithRoles } from "@shared/schema"; // Import UserWithRoles

// Helper function to check if a user has any of the required roles
const hasRequiredRole = (user: UserWithRoles | null, requiredRoles: string[]): boolean => {
  if (!user || !user.roles) {
    return false;
  }
  return user.roles.some(role => requiredRoles.includes(role.name));
};

// Helper Component: Renders the current time (always visible)
const CurrentTime = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
      <Clock className="h-4 w-4" />
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </div>
  );
};

// Helper Component: Renders network status (always visible)
const NetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <div className={`flex items-center gap-2 text-sm font-medium ${isOnline ? 'text-green-600' : 'text-red-500'}`}>
            <Wifi className="h-4 w-4" />
            <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
    );
}

export default function Navigation() { // Renamed from PosHeaderToggle to Navigation
  const [location, setLocation] = useLocation();
  const { currentUser, logout } = useAuth();
  const user = currentUser; // Define the user variable

  // Define roles that have admin access for navigation visibility
  const adminRoles = [
    'General Manager (GM) / Store Manager',
    'Assistant Manager',
    'Executive Chef / Head Chef',
    'Sous Chef',
    'Inventory Manager',
    'admin', // Add the "admin" role
    'General Manager (GM) / Store Manager', // Add GM role for admin access
    'Manager', // Add Manager role for admin access
  ];

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const getUserInitials = () => {
    if (currentUser?.firstName && currentUser?.lastName) {
      return `${currentUser.firstName[0]}${currentUser.lastName[0]}`.toUpperCase();
    }
    return currentUser?.firstName?.[0] || "U";
  };

  // Define roles that have access to the "Ordering" option
  const posRoles = [
    'Manager',
    'Cashier',
    'Server',
    'General Manager (GM) / Store Manager', // Add GM role for POS access
    'Assistant Manager', // Add Assistant Manager role for POS access
    'admin', // Add admin role for POS access
  ];

  const hasPosAccess = hasRequiredRole(currentUser, posRoles);

  if (!currentUser) {
    return (
      <header className="bg-slate-900 text-white">
        <div className="flex justify-between items-center px-4 py-3">
            <h1 className="text-xl font-bold">VendorPOS</h1>
            <Button onClick={() => setLocation("/login")}>Login</Button>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
      <div className="flex justify-between items-center px-4 h-16">

        {/* --- Left Side: Navigation Links --- */}
        <nav className="flex items-center gap-4">
           {/* My Time Card Link (Visible to all authenticated users) */}
           <Link href="/my-timecard">
              <Button variant="ghost" className="flex items-center gap-2">
                 <CalendarClock className="h-5 w-5" />
                 My Time Card
              </Button>
           </Link>

           {/* Admin Link (Conditionally visible) */}
           {hasRequiredRole(user, adminRoles) && (
              <Link href="/admin">
                 <Button variant="ghost" className="flex items-center gap-2">
                    <LayoutDashboard className="h-5 w-5" />
                    Admin
                 </Button>
              </Link>
           )}

            {/* Ordering Link (Visible to users with POS access) */}
            {hasPosAccess && !location.startsWith('/ordering') && (
               <Link href="/ordering">
                  <Button variant="ghost" className="flex items-center gap-2">
                     <ShoppingCart className="h-5 w-5" />
                     Ordering
                  </Button>
               </Link>
            )}

        </nav>

        {/* --- Right Side: Status Info & User Menu --- */}
        <div className="flex items-center gap-4 sm:gap-6">
          <NetworkStatus />
          <CurrentTime />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-12 w-12 rounded-full">
                <div className="w-11 h-11 bg-slate-200 text-slate-800 rounded-full flex items-center justify-center">
                  <span className="text-base font-bold">{getUserInitials()}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-base font-medium leading-none">
                    {currentUser.firstName} {currentUser.lastName}
                  </p>
                  <p className="text-sm leading-none text-muted-foreground">
                    {currentUser.email || `ID: ${currentUser.employeeCode}`}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="p-3 text-base cursor-pointer" onClick={handleLogout}>
                <Users className="mr-3 h-5 w-5" />
                <span>Switch User</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="p-3 text-base cursor-pointer" onClick={handleLogout}>
                <LogOut className="mr-3 h-5 w-5" />
                <span>Log Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}