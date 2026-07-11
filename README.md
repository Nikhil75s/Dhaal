# Karnataka State Police - Crime Analytics Dashboard

A high-density, dark-mode geospatial dashboard built for the Karnataka State Police. It provides a comprehensive view of crime analytics, seamlessly integrating a map engine with time-lapse playback, AI anomaly alerts, and socio-economic correlation views.

## Key Features
- **Geospatial Map Engine**: Highly performant map rendering using MapLibre.
- **Time-Lapse Playback**: View historical crime data dynamically over time.
- **AI Anomaly Alerts**: Intelligent alerting system for detecting irregular activity patterns.
- **Socio-Economic Correlation Views**: Cross-reference crime data with socio-economic layers for deeper insights.
- **Dark-Mode UI**: High-density interface optimized for dark environments and extended use.

## Technology Stack
- **Frontend**: React 19, TypeScript
- **Build Tool**: Vite
- **Map Engine**: MapLibre GL JS, React Map GL
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand
- **Icons**: Lucide React
- **Date Utilities**: date-fns

## Step-by-Step Guide to Run

Follow these steps to set up and run the project locally.

### Prerequisites
- Node.js (v18 or higher recommended)
- npm (Node Package Manager)

### Installation & Setup

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone <repository-url>
   cd dashboard-shell
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Access the application**:
   Open your browser and navigate to the URL provided in the terminal (usually `http://localhost:5173/`).

### Building for Production

To create a production-ready build:

```bash
npm run build
```

The output will be available in the `dist` directory. You can preview the production build locally using:

```bash
npm run preview
```

### Linting

To run the linter and check for code quality issues:

```bash
npm run lint
```
