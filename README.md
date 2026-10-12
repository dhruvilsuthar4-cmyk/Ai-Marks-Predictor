# AI Student Marks Predictor

A complete React and Vite student performance dashboard that runs entirely in the browser. Student profiles, prediction history, and dashboard settings are persisted in `localStorage`; no server, database, Python environment, external API, or account is needed to use the app.

## Run the application

Requirements: Node.js 20+ and npm.

From the project root:

```powershell
npm install --prefix frontend
npm run dev
```

Open the local URL printed by Vite. To create a production build:

```powershell
npm run build
```

The generated static site is in `frontend/dist`. It can be served by any static-file host; the predictor itself makes no API requests.

## Features

- Dashboard with student and prediction totals, average marks, at-risk students, and Recharts performance/category charts.
- Marks estimator with input validation, score visualization, factor breakdown, and a deterministic JavaScript calculation.
- Student record create, view, edit, delete, search, category filter, and sorting.
- Prediction history with detail views, search, category filter, sorting, and clear-history confirmation.
- Browser-local settings, including the at-risk score threshold.
- Responsive layout for desktop, tablet, and mobile screens.

## Prediction calculation

The predicted score is a weighted demonstration heuristic, not a trained machine-learning model and not a guarantee of a student's exam result. Study hours are first converted to a 0–100 score using `min(study hours / 8, 1) × 100`. The app then calculates:

```text
study score        × 0.20
+ attendance       × 0.25
+ previous marks   × 0.30
+ assignment marks × 0.25
```

The result is clamped to the 0–100 range and rounded to two decimal places. Categories are Excellent (85–100), Good (70–84.99), Average (50–69.99), and Needs Improvement (below 50).

## Browser data

The app stores records using these keys:

- `ai_predictor_students`
- `ai_predictor_history`
- `ai_predictor_settings`

Data belongs to the current browser profile and device. Clearing site data or using another browser/profile will not carry records over. The app does not transmit student information to a server.
