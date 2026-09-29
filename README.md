# LAB SAATHI

This repository is being set up in MVP-first order for a full-stack medical lab report understanding app.

## Project structure

- `apps/web` — Next.js 14+ frontend with App Router, Tailwind CSS, and API routes
- `apps/api` — FastAPI OCR/AI microservice
- `apps/worker` — optional background tasks for processing/report extraction
- `packages/shared` — shared TypeScript types and validation schemas
- `prisma` — Prisma schema and migrations
- `docs` — design and architecture notes

## MVP plan

### Phase 1 — Auth + secure upload
- Next.js auth flow using email/password and optional Google OAuth
- Upload PDFs/images up to 15MB
- Store files locally for MVP and associate them with the authenticated user
- Database schema for users, reports, files, family members, and chat history

### Phase 2 — OCR + extraction pipeline
- Use Tesseract OCR for PDFs/images as the lowest-cost reliable MVP option
- Implement extraction service to normalize messy lab-report text
- Parse into structured entries: test name, value, unit, reference range, flag
- Mark uncertain values as `unclear` instead of guessing
- Persist extracted report data in PostgreSQL via Prisma

### Phase 3 — AI explanation layer
- Send structured lab data to a Llama model through a provider such as Groq/Together AI
- Use the required system prompt for safe, educational-only explanations
- Enforce backend output filters for medical-treatment/drug-name restrictions
- Display explanations in plain language with disclaimers and abnormal-value warnings

### Phase 4 — Interactive chat
- Add a per-report chat interface grounded in the structured report data
- Store chat history and enforce the same safety rules for follow-up questions
- Restrict conversation to lab-report context only

### Phase 5 — Dashboard and trend tracking
- Show past reports and filter by family member
- Trend same tests across multiple reports with a basic graph
- Keep one account able to manage multiple family-member profiles

### Phase 6 — Safety / UX hardening
- Persistent disclaimer on every view
- Distinct visual treatment for abnormal/flagged values without alarmist styling
- Backend checks and logging for drug names, dosage instructions, and medical directives

## Immediate work order

We will build the project in this order:

1. Project structure + environment configuration
2. Auth + upload backend + file storage
3. OCR extraction pipeline + structured data parsing
4. AI explanation layer
5. Chat interface
6. Dashboard/trend tracking
7. Safety and polish

## Recommendation for extraction approach

For the MVP, Tesseract with `tesseract-ocr` + Python preprocessing is the most practical low-cost option for local OCR. It is free, reliable for text-heavy lab slips, and easier to deploy than a paid vision API. Later we can upgrade to a cloud OCR/vision service if needed.
