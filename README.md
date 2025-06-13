# QuickPOS

QuickPOS is a Point of Sale (POS) system designed to streamline the ordering and checkout process for businesses. It includes features such as role-based access control, employee time tracking, and a user-friendly interface for managing products and orders.

## Table of Contents
- [Project Setup](#project-setup)
- [Directory Structure](#directory-structure)
- [Dependencies](#dependencies)
- [Running the Project](#running-the-project)
- [Contributing](#contributing)

## Project Setup

To get started with QuickPOS, follow these steps:

1. Clone the repository:
   ```bash
   git clone [repository-url]
   ```

2. Navigate to the project directory:
   ```bash
   cd QuickPOS
   ```

3. Install the necessary dependencies:
   ```bash
   npm install
   ```

4. Set up the database:
   - Ensure you have a local database set up.
   - Run the database migrations:
     ```bash
     npm run db:migrate
     ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## Directory Structure

The project is organized into the following directories:

- `client/`: Contains the frontend code for the POS system.
  - `src/`: Source files for the React application.
    - `components/`: Reusable UI components.
    - `contexts/`: Context providers for state management.
    - `hooks/`: Custom React hooks.
    - `lib/`: Utility functions and libraries.
    - `pages/`: React pages for different routes.
  - `index.html`: Entry point for the React application.
- `server/`: Contains the backend code for the POS system.
  - `db.ts`: Database configuration and setup.
  - `index.ts`: Entry point for the server.
  - `routes.ts`: API routes for the server.
  - `storage.ts`: Data storage utilities.
- `migrations/`: Database migration files.
- `scripts/`: Scripts for various tasks such as seeding the database.
- `shared/`: Shared code between the frontend and backend.

## Dependencies

The project uses the following dependencies:

- React: For building the frontend UI.
- Node.js: For the backend server.
- Drizzle ORM: For database management.
- Tailwind CSS: For styling the application.

To install the dependencies, run:
```bash
npm install
```

## Running the Project

To run the project, use the following command:
```bash
npm run dev
```

This will start both the frontend and backend servers.

## Contributing

Contributions are welcome! If you find any issues or have suggestions for improvements, please open an issue or submit a pull request.

For more information, please contact the project maintainers.