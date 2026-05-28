# SmartSchedule Frontend

## Commands

```bash
npm run dev      # start dev server (http://localhost:5173)
npm run build    # production build
npm run preview  # preview production build
```

## Code Style

- **Components**: React functional components only, no class components
- **Styling**: Tailwind CSS utility classes only — no inline styles, no CSS modules
- **State**: Zustand stores in `src/store/` — one store per domain
- **Services**: All API calls go through `src/services/` — components never fetch directly
- **Files**: JSX for components, plain JS for services and stores

## Architecture Rules

### RTL / Hebrew
- `index.html` has `dir="rtl" lang="he"` — never remove these attributes
- Use `text-right` / `text-left` Tailwind classes deliberately; layout flows right-to-left by default

### State Management (Zustand)
- One store file per domain (e.g. `scheduleStore.js`)
- Stores expose data + simple setters only — no business logic inside stores
- Components read from store; services write to store via setters passed down from `useEffect`

### Service Layer
- Every service function returns `{ success: boolean, data: T | null, error?: string }`
- Mock implementations live alongside the real service shape — swap by changing the function body only
- Schedule block shape:
  ```js
  {
    id, course_code, course_name, group_number,
    lecturer, day, start_time, end_time, room, type
  }
  ```

## Folder Structure

```
src/
  components/   # presentational React components
  services/     # API / mock service functions
  store/        # Zustand stores
```
