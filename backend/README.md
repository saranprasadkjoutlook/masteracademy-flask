# Flask API

## Run locally

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/Activate.ps1
pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
python backend/run.py
```

The API listens on `http://localhost:5000`. SQLite is used by default and the database file is created under `backend/instance/`. Demo accounts are `admin / admin35`, `student / student28`, and `student2 / student28`. Change the passwords and `SECRET_KEY` in environment settings before deploying.

For Azure App Service, configure `DATABASE_URL`, `SECRET_KEY`, `ADMIN_PASSWORD`, `STUDENT_PASSWORD`, and `CORS_ORIGINS` as application settings. Set `CORS_ORIGINS` to the frontend's exact origin. If the frontend and backend are on different sites, also set `SESSION_COOKIE_SAMESITE=None` and `SESSION_COOKIE_SECURE=true` so the browser can send the session cookie. Install Microsoft ODBC Driver 18 on the host and set `DATABASE_URL` to a URL-encoded `mssql+pyodbc` connection string. A Gunicorn startup command from the repository root is:

```text
gunicorn --chdir backend run:app
```

## API

All endpoints return JSON. Sign in first; the API uses an HTTP-only session cookie.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/login` | Public | Sign in with `{ "username": "admin", "password": "..." }` |
| `POST` | `/api/logout` | Signed in | End the session |
| `GET` | `/api/me` | Signed in | Return the current user |
| `GET` | `/api/courses` | Signed in | List courses; students can pass `?mine=true` |
| `POST` | `/api/courses` | Admin | Create a course with `title`, `description`, and optional `icon`/`tone` |
| `GET` | `/api/courses/{id}/lessons` | Signed in | List course lessons |
| `POST` | `/api/courses/{id}/lessons` | Admin | Add a lesson with `title`, `type`, `content`, and optional `fileName` |
| `POST` | `/api/courses/{id}/enrollments` | Signed in | Admin sends `{ "username": "student" }`; a student enrolls themself with `{}` |
| `GET` | `/api/health` | Public | Health check |

For non-text lessons, `content` must be a data URL with a matching image, audio, video, or PDF MIME type. Requests are limited to 3 MB. Configure `CORS_ORIGINS` to the exact frontend origin when the frontend and API use different hosts.

Set the frontend API base URL in the `api-base-url` meta tag in `frontend/index.html`; it defaults to `http://localhost:5000/api` for local development. The frontend sends session cookies with API requests.
