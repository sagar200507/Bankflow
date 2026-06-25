# 🏦 BankFlow — Banking & Transaction Management System

<div align="center">

**Production-grade fintech application built with PostgreSQL, Redis, Express, and React.**

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)

</div>

---

## ✨ Features

| Category | Highlights |
|---|---|
| **Banking Core** | Deposits, Withdrawals, Transfers with ACID guarantees |
| **Authentication** | JWT access/refresh tokens, bcrypt, RBAC |
| **Fraud Detection** | Velocity checks, anomaly detection, geographic inconsistency |
| **Caching** | Redis cache-aside pattern with TTL invalidation |
| **Analytics** | Spending trends, transaction volume, top recipients |
| **Performance** | Connection pooling, indexed queries, `EXPLAIN ANALYZE` benchmarks |

## 🏗 Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   React +    │────▶│  Express.js  │────▶│ PostgreSQL   │
│   Vite       │     │  REST API    │     │  (Primary)   │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────▼───────┐
                     │    Redis     │
                     │  (Cache)     │
                     └──────────────┘
```

## 📂 Project Structure

```
bankflow/
├── client/                     # React frontend (Vite)
│   ├── public/                 # Static assets
│   └── src/
│       ├── assets/             # Images, icons
│       ├── components/         # Reusable UI components
│       │   ├── analytics/      # Charts & analytics widgets
│       │   ├── auth/           # Login, Register forms
│       │   ├── common/         # Shared components (Navbar, Sidebar, etc.)
│       │   ├── dashboard/      # Dashboard KPIs, cards
│       │   ├── fraud/          # Fraud alert components
│       │   ├── history/        # Transaction history tables
│       │   ├── landing/        # Landing page sections
│       │   └── transfer/       # Transfer money form
│       ├── context/            # React Context providers
│       ├── hooks/              # Custom React hooks
│       ├── pages/              # Page-level components (routed)
│       ├── services/           # API client (Axios/fetch)
│       ├── styles/             # Global CSS & design tokens
│       └── utils/              # Frontend utilities
│
├── server/                     # Express backend
│   ├── src/
│   │   ├── config/             # Environment, DB pool, Redis client
│   │   ├── controllers/        # Route handlers (thin layer)
│   │   ├── db/
│   │   │   ├── migrations/     # Schema creation scripts
│   │   │   ├── seeds/          # Sample data for development
│   │   │   └── procedures/     # PostgreSQL stored procedures
│   │   ├── middleware/         # Auth, validation, error handling
│   │   ├── models/             # Data access layer (SQL queries)
│   │   ├── routes/             # Express router definitions
│   │   ├── services/           # Business logic layer
│   │   └── utils/              # Logger, ApiError, constants
│   └── tests/
│       ├── unit/               # Jest unit tests
│       ├── integration/        # Supertest API tests
│       └── load/               # k6 stress tests
│
├── docs/                       # Architecture diagrams, ERD
├── docker-compose.yml          # PostgreSQL + Redis containers
├── .env.example                # Environment variable template
└── .gitignore
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **Docker** (for PostgreSQL & Redis) — or install them locally
- **npm** ≥ 9

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd bankflow

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Start Infrastructure

```bash
# From project root
docker compose up -d
```

### 3. Configure Environment

```bash
# Server
cp server/.env.example server/.env
# Edit server/.env with your credentials

# Client
cp client/.env.example client/.env
```

### 4. Run Migrations & Seed

```bash
cd server
npm run db:migrate
npm run db:seed
npm run db:procedures
```

### 5. Start Development

```bash
# Terminal 1 — Backend
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev
```

Visit **http://localhost:5173** 🎉

## 🧪 Testing

```bash
# Unit tests
cd server && npm run test:unit

# Integration tests
cd server && npm run test:integration

# Load tests (requires k6)
cd server && npm run test:load
```

## 🔒 Security

- All secrets stored in `.env` (git-ignored)
- Passwords hashed with bcrypt (12 salt rounds)
- JWT access + refresh token pattern
- Parameterized SQL queries (no SQL injection)
- Helmet, CORS, rate limiting enabled
- Input validation via express-validator

## 📄 License

MIT
