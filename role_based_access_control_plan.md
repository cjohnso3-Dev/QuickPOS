# Role-Based Access Control (RBAC) and Time Clock Enhancement Plan

## 1. Define Application Roles in Database

**Action:** Ensure all 25 roles (as per the detailed list provided by the user, e.g., `Host / Hostess`, `Server / Waiter / Waitress`, `General Manager (GM) / Store Manager`, etc.) are accurately seeded into the `app_roles` table. This will likely be done via the [`scripts/seed.ts`](scripts/seed.ts) file.

**Reference Role List (Summary - full list provided by user):**
*   `Host / Hostess` (ID 1)
*   `Server / Waiter / Waitress` (ID 2)
*   `Bartender` (ID 3)
*   `Busser / Server Assistant` (ID 4)
*   `Food Runner` (ID 5)
*   `Sommelier` (ID 6)
*   `Sales Associate / Clerk` (ID 7)
*   `Cashier` (ID 8)
*   `Greeter` (ID 9)
*   `Customer Service Representative` (ID 10)
*   `Personal Shopper / Stylist` (ID 11)
*   `Department Specialist` (ID 12)
*   `Executive Chef / Head Chef` (ID 13)
*   `Sous Chef` (ID 14)
*   `Line Cook` (ID 15)
*   `Prep Cook` (ID 16)
*   `Dishwasher` (ID 17)
*   `Expeditor (Expo)` (ID 18)
*   `Stock Associate / Stocker` (ID 19)
*   `Inventory Manager` (ID 20)
*   `Receiving Clerk` (ID 21)
*   `Visual Merchandiser` (ID 22)
*   `Loss Prevention / Security` (ID 23)
*   `General Manager (GM) / Store Manager` (ID 24)
*   `Assistant Manager` (ID 25)

## 2. Server-Side Enhancements & Access Control

### A. New: Break Management Functionality

1.  **Schema Update (Conceptual):**
    *   Implement a mechanism to record active break start times and durations. This might involve a new table (e.g., `active_breaks` linked to `time_clocks.id`) or augmenting the existing `time_clocks` table.
2.  **New API Endpoints for Breaks (in [`server/routes.ts`](server/routes.ts)):**
    *   `POST /api/time-clocks/active/start-break`: Records break start. Protected: `isAuthenticated`.
    *   `POST /api/time-clocks/active/end-break`: Calculates duration, updates `time_clocks.breakDuration`, clears active break. Protected: `isAuthenticated`.
3.  **Storage Layer (`DbStorage` in [`server/storage.ts`](server/storage.ts)):**
    *   Implement methods: `startBreak`, `endBreak`.
    *   Modify `getCurrentTimeClock` to include break status.
    *   Ensure `clockOut` correctly handles active breaks.

### B. API Endpoint Protection (Role-Based Access Control in [`server/routes.ts`](server/routes.ts))

1.  **Core System & User Management APIs** (User CRUD, Role CRUD, User-Role Assignment, Settings):
    *   *Endpoints:* `GET /api/users`, `POST /api/users`, `GET /api/users/:id`, `PUT /api/users/:id`, `DELETE /api/users/:id`, `GET /api/roles`, `POST /api/roles`, `GET /api/roles/:id`, `PUT /api/roles/:id`, `DELETE /api/roles/:id`, `POST /api/users/:userId/roles`, `DELETE /api/users/:userId/roles/:roleId`, `GET /api/settings`, `GET /api/settings/:key`, `PUT /api/settings/:key`.
    *   *Protection:* `hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager'])`
2.  **Product & Menu Management APIs** (Category CUD, Product CUD, Discount CUD, Tax Rate CUD):
    *   *Endpoints:* `POST /api/categories`, `PUT /api/categories/:id`, `DELETE /api/categories/:id`, `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id`, `PATCH /api/products/:id/stock`, `POST /api/discounts`, etc.
    *   *Protection:* `hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager', 'Executive Chef / Head Chef', 'Sous Chef', 'Inventory Manager'])`
3.  **Reporting & Analytics APIs** (Financial, Employee, Sales Reports):
    *   *Endpoints:* `GET /api/stats/today`, `GET /api/reports/sales`, `GET /api/reports/employees`.
    *   *Protection:* `hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager'])`
4.  **Full POS Operation APIs** (Order creation/management, Payments, GET Products/Categories):
    *   *Endpoints:* `POST /api/orders`, `PUT /api/orders/:id`, `PATCH /api/orders/:id/status`, `POST /api/order-items`, `GET /api/categories`, `GET /api/products`, etc.
    *   *Protection:* `hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager', 'Executive Chef / Head Chef', 'Sous Chef', 'Inventory Manager', 'Host / Hostess', 'Server / Waiter / Waitress', 'Bartender', 'Sommelier', 'Sales Associate / Clerk', 'Cashier', 'Customer Service Representative', 'Personal Shopper / Stylist', 'Department Specialist'])`
5.  **Individual Time Clock APIs** (`/api/users/:id/clock-in`, `/api/users/:id/clock-out`, `GET /api/users/:id/time-clocks` for *own* data, new break APIs):
    *   *Protection:* `isAuthenticated`.
6.  **Admin View of Time Data** (e.g., `GET /api/reports/employees` or specific time card report APIs for *other* users):
    *   *Protection:* `hasRole(['General Manager (GM) / Store Manager', 'Assistant Manager'])`

## 3. Client-Side UI/UX and Access Control

### A. New: "My Time Card" Page (e.g., route `/my-timecard`)

1.  **Functionality:**
    *   Display current clock-in status (Clocked In/Out, On Break/Available).
    *   Buttons: "Clock In", "Clock Out".
    *   Buttons: "Start Break", "End Break" (conditionally visible).
    *   Display current day's summary: total hours, total break.
    *   Display current week's time entries (list from `GET /api/users/:id/time-clocks`).
2.  **Component Reuse:** Leverage and extend [`client/src/components/EmployeeTimeClock.tsx`](client/src/components/EmployeeTimeClock.tsx).
3.  **Data Fetching:** Use `useAuth()` for `currentUser.id` to fetch time data.

### B. Routing & Redirection (e.g., in [`client/src/App.tsx`](client/src/App.tsx) or dedicated routing files)

1.  **Login Page ([`client/src/pages/LoginPage.tsx`](client/src/pages/LoginPage.tsx)) Redirection:**
    *   **Time Clock Only Roles** (e.g., `Food Runner`, `Kitchen Staff`, `Busser`, `Dishwasher`): Redirect to `/my-timecard`.
    *   **Full POS Access Roles** (e.g., `Server`, `Bartender`, `Cashier`): Redirect to `/ordering`.
    *   **Admin Access Roles** (e.g., `General Manager`, `Assistant Manager`): Redirect to `/ordering` or `/admin` (configurable default).
2.  **Admin Area (`/admin` leading to [`client/src/pages/admin.tsx`](client/src/pages/admin.tsx)):**
    *   Protected route component. Accessible to: `General Manager (GM) / Store Manager`, `Assistant Manager`, `Executive Chef / Head Chef`, `Sous Chef`, `Inventory Manager`.
    *   *Internal Tabs/Sections:* Further conditional rendering based on more specific roles (e.g., User Management tab for GM/Asst.Mgr only).
3.  **POS Ordering Area (`/ordering` leading to [`client/src/pages/ordering.tsx`](client/src/pages/ordering.tsx)):**
    *   Protected route. Accessible to "Admin Access Roles" and "Full POS Access Roles".
    *   "Time Clock Only Roles" attempting direct access are redirected to `/my-timecard`.
4.  **My Time Card Page (`/my-timecard`):**
    *   Protected route, accessible to all `isAuthenticated` users.

### C. Conditional UI Rendering & Navigation

1.  **Navigation Menu (e.g., [`client/src/components/Navigation.tsx`](client/src/components/Navigation.tsx)):**
    *   Admin link: Visible only to roles with admin privileges.
    *   "My Time Card" link: Visible to all authenticated users.
2.  **Admin Dashboard ([`client/src/components/PosAdminDashboard.tsx`](client/src/components/PosAdminDashboard.tsx)):**
    *   Conditionally render management tabs/sections based on specific admin roles.
    *   Include a link/section for Admins to view employee time reports.

## 4. Workflow Summary Diagram

```mermaid
graph TD
    A[User visits App] --> B(Login Page);
    B -- Credentials --> C{Auth API};
    C -- Success --> D{User Object + Roles};

    subgraph Role-Based Experience
        D -- "Time Clock Only Roles" (Food Runner, etc.) --> TC_PAGE["My Time Card Page (/my-timecard)"];
        TC_PAGE --> TC_ACTIONS[Clock In/Out, Start/End Break, View Own Time];
        TC_PAGE --> TC_API[Use Own Time Clock & Break APIs];

        D -- "Full POS Access Roles" (Server, Bartender, etc.) --> POS_PAGE["POS Ordering Page (/ordering)"];
        POS_PAGE --> POS_ACTIONS[Create Orders, Payments, etc.];
        POS_PAGE --> POS_API[Use POS Operation APIs];
        POS_PAGE --> NAV_TO_TC1["Access My Time Card Page (menu)"];

        D -- "Admin Access Roles" (GM, Asst.Mgr, ExecChef, etc.) --> ADMIN_DEFAULT["Admin Default Page (e.g., /admin or /ordering)"];
        ADMIN_DEFAULT --> NAV_TO_ADMIN["Admin Dashboard (/admin)"];
        NAV_TO_ADMIN --> ADMIN_SECTIONS[Granular Admin Sections (User Mgmt, Product Mgmt, Reports)];
        ADMIN_SECTIONS --> ADMIN_API[Use Specific Admin APIs];
        ADMIN_DEFAULT --> NAV_TO_POS["Access POS Ordering Page"];
        ADMIN_DEFAULT --> NAV_TO_TC2["Access My Time Card Page (menu)"];
    end

    C -- Failure --> B;
```

This plan outlines the steps to implement robust role-based access control and enhance time clock functionality.