# TrekPulse V2 - Trekking Management Application (TMA)

TrekPulse V2 is a responsive, feature-rich Trekking Management Application designed for administrators, trek guides (staff), and trek participants (trekkers). The application helps manage trek approvals, slot availability, registrations, booking tracking, and background jobs.

---

## 🛠️ Technology Stack
* **Backend**: Flask API
* **Frontend**: Vue 3 (CDN), Vue Router 4 (CDN)
* **Database**: SQLite (SQLAlchemy ORM)
* **Styling**: Bootstrap 5.3.3 & Bootstrap Icons (Emerald nature theme + custom glassmorphism)
* **Caching**: Redis Cache (via Flask-Caching)
* **Task Queues**: Redis & Celery (with Eventlet for Windows execution)
* **Charts**: Chart.js

---

## 📁 Project Structure
```
TrekPulse-V2/
├── app/
│   ├── __init__.py          # Flask App Factory and extensions initialization
│   ├── models.py            # SQLite database models
│   ├── commands.py          # Database seeding command (seed-db)
│   ├── tasks.py             # Celery background tasks (reminders, exports, reports)
│   ├── routes/              # Blueprint routes
│   │   ├── auth.py          # Authentication (Registration & Login)
│   │   ├── admin.py         # Admin Dashboard and management endpoints
│   │   ├── staff.py         # Guide Dashboard and assigned treks management
│   │   ├── trekker.py       # Trekker bookings, exports, profile management
│   │   └── main.py          # Main entry route (serves Vue frontend)
│   ├── static/              # Frontend files
│   │   ├── css/
│   │   │   └── style.css    # Premium Emerald & Glassmorphic theme styles
│   │   ├── js/
│   │   │   ├── store.js     # Shared reactive state store
│   │   │   └── app.js       # Vue SPA logic, routing, and UI views
│   │   ├── exports/         # Temporary CSV export folder
│   │   └── reports/         # Monthly activity report logs
│   └── templates/
│       └── index.html       # Base Jinja2 HTML entry template
├── tests/                   # Automated Pytest Suite
├── run.py                   # Application entrypoint
├── celery_worker.py         # Celery worker bridge
├── config.py                # Environment configuration variables
├── requirements.txt         # Project dependencies
└── package_submission.py    # Packaging helper for submissions
```

---

## ⚙️ Installation & Setup

### 1. Create Virtual Environment & Install Dependencies
Ensure you have Python 3.10+ installed.
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

### 2. Configure and Run Redis
Ensure Redis is running locally on port `6379`.
* Windows users: You can run Redis via WSL (`sudo service redis-server start`) or install the native Windows Redis port.
* macOS: `brew services start redis`

### 3. Initialize and Seed the Database
TrekPulse has a CLI command to initialize database tables and seed sample data matching the wireframe structure:
```bash
flask --app run.py seed-db
```
* **Admin Login**: `admin@trekking.com` / `admin123`
* **Trekker Login**: `amit@mail.com` / `Password123!`
* **Guide Login**: `vikas@mail.com` / `Password123!`

### 4. Start the Celery Worker
Since Windows lacks standard fork support, we run Celery with the `eventlet` pool:
```bash
# On Windows:
celery -A celery_worker.celery worker --loglevel=info -P eventlet
# On macOS/Linux:
celery -A celery_worker.celery worker --loglevel=info
```

### 5. Start the Celery Beat Scheduler (Optional for Scheduled Tasks)
To trigger the scheduled daily reminders and monthly reports:
```bash
celery -A celery_worker.celery beat --loglevel=info
```

### 6. Run the Flask Web Application
Start the development server:
```bash
python run.py
```
The application will run on `http://127.0.0.1:5000/`.

---

## 🧪 Running Automated Tests
The application includes a comprehensive test suite covering authentication, admin operations, guide operations, booking rules, and Celery task execution:
```bash
python -m pytest
```

---

## 📦 Packaging and Submitting

The course has a strict validation process for submissions. The root level of your uploaded ZIP file must contain **only** the project directory, and no loose files or folders.

To automate this and ensure your submission is 100% valid:
1. Run the packaging helper script:
   ```bash
   python package_submission.py
   ```
2. A `submission.zip` will be generated in your project directory.
3. This ZIP is pre-checked to contain exactly one root directory (`TrekPulse-V2/`) and automatically excludes virtual environments (`venv`), git history (`.git`), temporary caches, and package logs.
4. Upload `submission.zip` directly to the project portal.
