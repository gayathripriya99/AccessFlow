# 12_GITHUB_DEPLOYMENT_MASTER_GUIDE.md

# Purpose

This document is the deployment and repository guide for **AccessFlow – Enterprise IAM Platform**.

It instructs an AI assistant (Claude/ChatGPT) to help publish the project safely and professionally.

---

# GitHub Account

Use this GitHub account for this project:

**Email:** gayathripriyacvg@gmail.com

> If another GitHub account already exists on this computer, DO NOT overwrite the existing configuration.

Instead:

- Configure this repository with a repository-specific Git identity.
- Create a dedicated SSH key for this account.
- Configure `~/.ssh/config` with a separate host.
- Push this repository using the dedicated SSH host.

Never modify global Git settings without confirmation.

---

# Repository

Create a **new Public GitHub repository**.

Recommended name:

**AccessFlow-IAM**

Alternative names:

- AccessFlow
- Enterprise-RBAC
- RBAC-Platform

Repository description:

Enterprise Identity & Access Management Platform demonstrating production-ready RBAC using React, Node.js, Express and MongoDB.

---

# Repository Structure

```text
AccessFlow/
├── backend/
├── frontend-react/
├── frontend-angular/
├── frontend-vue/
├── frontend-nextjs/
├── docs/
├── .github/
├── docker/
├── README.md
└── LICENSE
```

---

# Git Workflow

1. Initialize Git.
2. Create the GitHub repository.
3. Configure repository-specific username/email.
4. Generate a dedicated SSH key.
5. Add the public SSH key to this GitHub account.
6. Connect the repository using SSH.
7. Commit all source code and documentation.
8. Push the `main` branch.
9. Use feature branches for future work.

---

# Deployment

## Frontend

Deploy each frontend independently to **Vercel**.

Requirements:

- Production build
- Environment variables
- Responsive design
- Preview deployments
- Production deployments

---

## Backend

Deploy the Node.js + Express backend to **Render**.

Requirements:

- Root directory configured correctly
- Build command
- Start command
- Environment variables
- Health endpoint
- Auto deploy enabled

---

## Database

Use **MongoDB Atlas**.

Configure:

- Cluster
- Database user
- Network access
- Connection string
- Indexes
- Backups

Never commit secrets.

---

# CI/CD

Configure GitHub Actions to:

- Install dependencies
- Run linting
- Run tests
- Build applications
- Deploy frontend
- Deploy backend

---

# AI Instructions

The AI must:

- Build production-quality code.
- Explain every deployment step.
- Pause for confirmation before actions requiring my accounts or local machine.
- Never request or store passwords, private SSH keys, PATs, or other secrets.
- At the end of every chat, generate a new `Phase-XX.md` summarizing work completed, files created, APIs added, database changes, and remaining tasks.
