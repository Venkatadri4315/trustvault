# 🔐 TrustVault
### Secure Document Management with Authentication, Access Control and Audit Logging

**TrustVault** is a full-stack document management application designed to help users securely upload, organize, preview, download, and manage documents. It combines a React frontend, Node.js and Express backend, and PostgreSQL database, with a focus on authentication, document-level authorization, and auditability.

## ✨ Features

- **User Authentication:** Authentication flows and protected routes.
- **Password Recovery:** Forgot-password and reset-password interfaces.
- **Document Management:** A dashboard for managing documents.
- **Document Upload and Download:** Backend document routes and upload middleware.
- **Access Control:** Document access checks before protected operations.
- **Audit Logging:** Backend audit functionality for recording relevant events.
- **Email Services:** Backend email service for supported authentication and notification workflows.
- **PostgreSQL Database:** Relational database schema and database connection.
- **Responsive Frontend:** React pages, reusable components, context, and hooks.
- **API Integration:** Frontend services communicate with the backend API.

*Only claim a feature is fully operational if you have tested it in the current application.*

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Database schema | SQL |
| Authentication | Authentication modules and middleware |
| File handling | Upload middleware and document routes |
| Version control | Git and GitHub |
| Development environment | Windows, Visual Studio Code |

## 📁 Project Structure

```text
trustvault/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ForgotPassword.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── ResetPassword.jsx
│   │   ├── routes/
│   │   │   └── ProtectedRoute.jsx
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   └── authService.js
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── database/
│   └── schema.sql
├── docs/
├── server/
│   ├── src/
│   │   ├── app.js
│   │   ├── audit.js
│   │   ├── auth.js
│   │   ├── auth.middleware.js
│   │   ├── db.js
│   │   ├── document-access.js
│   │   ├── document.routes.js
│   │   ├── email.service.js
│   │   ├── server.js
│   │   └── upload.middleware.js
│   ├── uploads/
│   └── package.json
├── .gitignore
├── PROJECT_REPORT.md
├── PROMPTS.md
├── THREATS.md
└── README.md
```

## ⚙️ Development Environment

- **Operating System:** Windows
- **Code Editor:** Visual Studio Code
- **Frontend:** React
- **Backend:** Node.js and Express
- **Database:** PostgreSQL
- **Local API Port:** 3000
- **Database Name:** `trustvault`

## 🚀 Getting Started

### Prerequisites

Install Node.js, npm, Git, and PostgreSQL. Ensure the PostgreSQL service is running.

### 1. Clone the repository

```bash
git clone https://github.com/Venkatadri4315/trustvault.git
cd trustvault
```

### 2. Set up the database

Create the `trustvault` database and apply the schema from `database/schema.sql` using your PostgreSQL client.

Review the schema and confirm that the database connection settings match the backend configuration.

### 3. Configure the backend

```bash
cd server
npm install
```

Create the backend `.env` file with the variable names expected by the application. For example:

```env
PORT=3000
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_long_random_secret
```

These names are examples; use the actual environment variable names required by the source code.

### 4. Start the backend

Run the development command configured in `server/package.json`. For example:

```bash
npm run dev
```

### 5. Set up the frontend

Open another terminal:

```bash
cd client
npm install
```

Configure the frontend API URL according to the variables expected by `client/src/services/api.js`.

Start the frontend using the script defined in `client/package.json`, for example:

```bash
npm run dev
```

Open the local URL printed by Vite.

## 🔒 Security Considerations

TrustVault's security depends on enforcing authentication and authorization on the server.

Important checks include:

- Reject unauthenticated requests to protected endpoints.
- Verify document ownership or active sharing permissions before access.
- Prevent users from accessing other users' documents by changing document IDs.
- Validate uploaded file types and file sizes.
- Use parameterized database queries.
- Keep credentials and secrets out of source control.
- Restrict access to sensitive audit information.
- Verify that revoked permissions no longer permit access.

## 🧪 Testing

The repository includes supporting test files and documentation. Before submission, test the actual application for:

1. Registration, login, and password recovery.
2. Protected route enforcement.
3. Document upload, preview, and download.
4. Unauthorized access to another user's documents.
5. File-type and file-size validation.
6. Permission revocation, where implemented.
7. Audit-log access restrictions.
8. Database connectivity and error handling.

Record actual results in the project documentation. Do not claim all security tests pass unless they have been run successfully.

## 📚 Project Documentation

- **[Project Report](PROJECT_REPORT.md):** Project overview and implementation details.
- **[Threat Model](THREATS.md):** Threat analysis and security test mapping.
- **[AI Development Log](PROMPTS.md):** AI-assisted development prompts and engineering decisions.

## 🌐 Project Links

- **GitHub Repository:** https://github.com/Venkatadri4315/trustvault
- **GitHub Profile:** https://github.com/Venkatadri4315

Add the verified production website URL here.

## ⚠️ Known Reliability Consideration

Local files stored on an ephemeral hosting filesystem may disappear after a restart or redeployment. Persistent document storage should be implemented and verified before relying on the application for important files.

## 👨‍💻 Author

**Paluri Venkatadri**

GitHub: https://github.com/Venkatadri4315

## 🎯 Project Objective

TrustVault demonstrates full-stack development through a document management application that combines a React interface, REST API, PostgreSQL persistence, authentication, access control, and audit logging. Its goal is to make document operations easier to manage while emphasizing server-side security and reliable handling of sensitive files.
