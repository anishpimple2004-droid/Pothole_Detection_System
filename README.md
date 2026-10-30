# 🕳️ AI-Powered Pothole Detection & Maintenance Management System

An end-to-end intelligent road maintenance and civic issue tracking platform powered by **YOLOv8** computer vision, **Flask**, and **PostgreSQL**. The system connects citizens, municipal administrators, and road contractors into a single transparent workflow, featuring automated pothole severity classification and AI-verified repair validation.

---

## 🌟 Key Features

### 1. 🤖 Deep Learning Pothole Detection
* **Automated Inference**: Leverages custom-trained **YOLOv8** to identify potholes from images uploaded by users.
* **Severity Assessment**: Analyzes pothole dimensions and visual characteristics to estimate damage severity.
* **Visual Bounding Boxes**: Automatically renders annotated output images highlighting detected defects.

### 2. 👥 Multi-Role Workflow Management
* **Citizen Portal**:
  * Report road defects with geo-coordinates (latitude/longitude), descriptions, and photo evidence.
  * Track real-time repair status from `Pending` to `Assigned` to `Completed`.
* **Municipal Admin Dashboard**:
  * Real-time metrics: Total complaints, in-progress tasks, completed repairs, and active contractors.
  * Contractor management (approval & assignment with completion deadlines).
* **Contractor Portal**:
  * View assigned repair tasks and location details.
  * Upload completion proof images with repair notes.

### 3. 🔍 Automated AI Repair Verification
* When a contractor submits a photo of a repaired road, the backend runs **YOLOv8 verification**.
* If a pothole is still detected, the submission is automatically rejected, ensuring road repairs meet quality standards before tickets are closed.

---

## 🏗️ System Architecture & Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Python, Flask, Flask-CORS, Psycopg2 |
| **Computer Vision / AI** | Ultralytics YOLOv8, PyTorch, OpenCV (`cv2`) |
| **Database** | PostgreSQL |
| **Frontend** | HTML5, CSS3, JavaScript, Jinja2 Templates |
| **Storage / Versioning** | Git LFS (for `.pt` model weights) |

---

## 📂 Project Structure

```text
pothole_system/
├── backend/
│   ├── app.py                 # Core Flask application & API routes
│   ├── config.py              # Configuration & database credentials
│   ├── database.py            # PostgreSQL database connection helper
│   ├── pothole_detector.py    # YOLOv8 inference & severity extraction script
│   └── uploads/               # Upload directory (complaints, results, fixed)
├── frontend/
│   ├── static/                # CSS styling, client-side JS, images
│   └── templates/             # Jinja2 HTML templates for all portals
├── best.pt                    # Trained YOLOv8 model weights
├── .gitattributes             # Git LFS tracking rules
├── .gitignore                 # Ignored files (virtualenvs, temporary uploads)
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
* Python 3.9+
* PostgreSQL database
* Git & Git LFS

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sampurnaprabhu3/Pothole_Detection_System.git
   cd Pothole_Detection_System
   ```

2. **Create and activate a virtual environment:**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Database:**
   Update your database credentials in `backend/config.py`:
   ```python
   DATABASE_URI = "postgresql://<user>:<password>@localhost:5432/pothole_db"
   SECRET_KEY = "your-secret-key"
   ```

5. **Run the Application:**
   ```bash
   cd backend
   python app.py
   ```
   Open `http://localhost:5000` in your browser.

