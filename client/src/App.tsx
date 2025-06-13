// app.tsx

import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import OrderingPage from "@/pages/ordering";
import AdminPage from "@/pages/admin";
import LoginPage from "@/pages/LoginPage";
import MyTimeCardPage from "@/pages/MyTimeCardPage"; // Import the new page
import Navigation from "@/components/Navigation";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import React from "react";
import LoadingSpinner from "./components/LoadingSpinner";
import { UserWithRoles } from "@shared/schema"; // Import UserWithRoles

// Helper function to check if a user has any of the required roles
const hasRequiredRole = (user: UserWithRoles | null, requiredRoles: string[]): boolean => {
  if (!user || !user.roles) {
    return false;
  }
  return user.roles.some(role => requiredRoles.includes(role.name));
};

// RoleBasedProtectedRoute component
interface RoleBasedProtectedRouteProps {
  component: React.ComponentType<any>;
  path: string;
  allowedRoles?: string[]; // Optional array of role names
  redirectPath?: string; // Optional path to redirect if not allowed
}

const RoleBasedProtectedRoute: React.FC<RoleBasedProtectedRouteProps> = ({
  component: Component,
  path,
  allowedRoles,
  redirectPath = "/login", // Default redirect to login
  ...rest
}) => {
  const { currentUser, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!currentUser) {
    // Not authenticated, redirect to login with current location
    return <Redirect to={`/login?redirect=${encodeURIComponent(location)}`} />;
  }

  // If allowedRoles are specified, check if the user has any of them
  if (allowedRoles && allowedRoles.length > 0) {
    if (!hasRequiredRole(currentUser, allowedRoles)) {
      // User does not have the required role, redirect to specified path or login
      return <Redirect to={redirectPath} />;
    }
  }

  // Authenticated and has required role (if specified), render the component
  return <Route path={path} component={Component} {...rest} />;
};


function AppRouter() {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Your screenshot of OrderingPage shows a self-contained layout with its own sidebar navigation.
  // This global <Navigation /> component might be unnecessary or might conflict with the OrderingPage UI.
  // You may want to remove it or render it conditionally if it's not needed on the ordering screen.
  // For now, we'll leave it as is.
  return (
    <>
      {currentUser ? (<Navigation />) : (null)}
      <Switch>
        <Route path="/login" component={LoginPage} />

        {/* Protected route for My Time Card - accessible to all authenticated users */}
        <RoleBasedProtectedRoute path="/my-timecard" component={MyTimeCardPage} />

        {/* Protected route for Admin - accessible to specific admin roles */}
        <RoleBasedProtectedRoute
          path="/admin"
          component={AdminPage}
          allowedRoles={[
            'General Manager (GM) / Store Manager',
            'Assistant Manager',
            'Executive Chef / Head Chef',
            'Sous Chef',
            'Inventory Manager',
          ]}
          redirectPath="/my-timecard" // Redirect non-admins to time card page
        />

        {/* Protected route for Ordering - accessible to Admin and Full POS Access roles */}
        <RoleBasedProtectedRoute
          path="/ordering"
          component={OrderingPage}
          allowedRoles={[
            'General Manager (GM) / Store Manager',
            'Assistant Manager',
            'Executive Chef / Head Chef',
            'Sous Chef',
            'Inventory Manager',
            'Host / Hostess',
            'Server / Waiter / Waitress',
            'Bartender',
            'Sommelier',
            'Sales Associate / Clerk',
            'Cashier',
            'Customer Service Representative',
            'Personal Shopper / Stylist',
            'Department Specialist',
          ]}
          redirectPath="/my-timecard" // Redirect Time Clock Only roles to time card page
        />

        {/* Default route - protected and redirects based on roles */}
        <RoleBasedProtectedRoute
          path="/"
          component={OrderingPage} // Or a different default component if needed
          allowedRoles={[ // Require roles for Ordering page
            'General Manager (GM) / Store Manager',
            'Assistant Manager',
            'Executive Chef / Head Chef',
            'Sous Chef',
            'Inventory Manager',
            'Host / Hostess',
            'Server / Waiter / Waitress',
            'Bartender',
            'Sommelier',
            'Sales Associate / Clerk',
            'Cashier',
            'Customer Service Representative',
            'Personal Shopper / Stylist',
            'Department Specialist',
          ]}
          redirectPath="/my-timecard" // Redirect users without these roles to time card
        />

        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  // ---- START OF CHANGES ----

  // 1. Get the current location to decide which layout to use.
  const [location] = useLocation();

  // 2. Define which paths should use a full-width layout.
  //    The OrderingPage ('/') and AdminPage ('/admin') are application UIs
  //    and should take up the full screen.
  const fullWidthPaths = ['/', '/admin', '/ordering']; // Add /ordering to full width paths
  const isFullWidthPage = fullWidthPaths.includes(location);

  // 3. Conditionally set the className for the <main> element.
  //    If it's a full-width page, we apply no layout classes.
  //    Otherwise, we apply the constrained, centered layout classes.
  const mainContainerClasses = isFullWidthPage
    ? '' // Use full width for OrderingPage, AdminPage, etc.
    : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'; // Constrained layout for LoginPage, etc.

  // ---- END OF CHANGES ----

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          {/*
            The `div` below no longer needs to control padding,
            as that's now handled by the <main> element conditionally.
          */}
          <div className="min-h-screen bg-slate-50">
            {/* The className is now dynamic based on the current route */}
            <main className={mainContainerClasses}>
              <AppRouter />
            </main>
            <Toaster />
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;