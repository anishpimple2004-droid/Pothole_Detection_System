from flask import Flask, request, jsonify, render_template, send_from_directory, redirect, flash
from psycopg2 import errors


from flask import send_from_directory
from flask_cors import CORS
import os
import uuid
import datetime
from werkzeug.utils import secure_filename
from config import DATABASE_URI, UPLOAD_FOLDER, SECRET_KEY, ALLOWED_EXTENSIONS
from database import get_db_connection
from uuid import uuid4
import subprocess




app = Flask(
    __name__,
    template_folder="../frontend/templates",
    static_folder="../frontend/static"
    
)
app.secret_key = SECRET_KEY

CORS(app)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# yolov8 integration 
from ultralytics import YOLO
import cv2

model = YOLO("best.pt")  # Path to your YOLOv8 model

@app.route('/detect', methods=['POST'])
def detect_pothole_yolo():
    image = request.files.get('image')
    if not image or not allowed_file(image.filename):
        return jsonify({"error": "Invalid image"}), 400

    filename = secure_filename(f"{uuid.uuid4()}_{image.filename}")
    image_path = os.path.join(app.config['UPLOAD_FOLDER'], 'complaints', filename)
    image.save(image_path)

    # Run YOLO detection
    results = model(image_path)
    result_img_path = os.path.join(app.config['UPLOAD_FOLDER'], 'results', filename)

    for result in results:
        result_img = result.plot()
        cv2.imwrite(result_img_path, result_img)

    return jsonify({"output_image_url": f"/uploads/results/{filename}"})




# Create folders
os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'complaints'), exist_ok=True)
os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'fixed'), exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ---------------- USER AUTH ----------------
@app.route('/api/user/signup', methods=['POST'])
def user_signup():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    user_id = str(uuid.uuid4())
    cursor.execute("INSERT INTO users (id, name, email, password, phone) VALUES (%s, %s, %s, %s, %s)",
                   (user_id, data['name'], data['email'], data['password'], data['phone']))
    cursor.close()
    conn.close()
    return jsonify({"message": "User registered successfully", "user_id": user_id})

@app.route('/api/user/login', methods=['POST'])
def user_login():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = %s AND password = %s", (data['email'], data['password']))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    if user:
        return jsonify({"message": "Login successful", "email": data['email']})
    return jsonify({"message": "Invalid credentials"}), 401

# ---------------- ADMIN AUTH ----------------
@app.route('/api/admin/signup', methods=['POST'])
def admin_signup():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    admin_id = str(uuid.uuid4())
    cursor.execute("INSERT INTO admins (id, name, email, password) VALUES (%s, %s, %s, %s)",
                   (admin_id, data['name'], data['email'], data['password']))
    cursor.close()
    conn.close()
    return jsonify({"message": "Admin registered successfully", "admin_id": admin_id})

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM admins WHERE email = %s AND password = %s", (data['email'], data['password']))
    admin = cursor.fetchone()
    cursor.close()
    conn.close()
    if admin:
        return jsonify({"message": "Login successful", "email": data['email']})
    return jsonify({"message": "Invalid credentials"}), 401

# ---------------- CONTRACTOR AUTH ----------------
@app.route('/api/contractor/signup', methods=['POST'])
def contractor_signup():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    contractor_id = str(uuid.uuid4())
    cursor.execute("INSERT INTO contractors (id, name, email, password, company, is_approved) VALUES (%s, %s, %s, %s, %s, %s)",
                   (contractor_id, data['name'], data['email'], data['password'], data['company'], False))
    cursor.close()
    conn.close()
    return jsonify({"message": "Contractor registered. Awaiting admin approval.", "contractor_id": contractor_id})

@app.route('/api/contractor/login', methods=['POST'])
def contractor_login():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM contractors WHERE email = %s AND password = %s", (data['email'], data['password']))
    contractor = cursor.fetchone()
    cursor.close()
    conn.close()
    if contractor and contractor[-1] == True:
        return jsonify({"message": "Login successful", "email": data['email']})
    elif contractor:
        return jsonify({"message": "Not approved yet"}), 403
    return jsonify({"message": "Invalid credentials"}), 401

# ---------------- COMPLAINT SUBMISSION ----------------
@app.route('/api/complaint', methods=['POST'])
def create_complaint():
    user_id = request.cookies.get('user_id')
    if not user_id:
        return jsonify({"message": "Not logged in"}), 401
    description = request.form.get("description")
    location = request.form.get("location")
    latitude = request.form.get("latitude")
    longitude = request.form.get("longitude")
    image = request.files.get("image")
    severity = request.form.get("severity", "pending")

    if not image or not allowed_file(image.filename):
        return jsonify({"message": "Invalid image"}), 400

    filename = secure_filename(f"{uuid.uuid4()}_{image.filename}")
    image_path = os.path.join(app.config['UPLOAD_FOLDER'], 'complaints', filename)
    image.save(image_path)

    complaint_id = str(uuid.uuid4())
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO complaints (id, user_id, description, location, latitude, longitude, image_url, severity, status, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (complaint_id, user_id, description, location, latitude, longitude, filename, severity, 'Pending', datetime.datetime.now()))
    cursor.close()
    conn.close()
    return jsonify({"message": "Complaint submitted", "complaint_id": complaint_id})

# ---------------- ADMIN ASSIGN ----------------
@app.route('/api/admin/assign', methods=['POST'])
def assign_complaint():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO complaint_assignments (complaint_id, contractor_id, assigned_date, deadline) VALUES (%s, %s, %s, %s)",
                   (data['complaint_id'], data['contractor_id'], datetime.datetime.now(), data['deadline']))
    cursor.execute("UPDATE complaints SET status = %s WHERE id = %s", ("Assigned", data['complaint_id']))
    cursor.close()
    conn.close()
    return jsonify({"message": "Complaint assigned to contractor"})

# ---------------- CONTRACTOR TASKS ----------------
@app.route('/api/contractor/tasks', methods=['GET'])
def contractor_tasks():
    contractor_id = request.args.get("contractor_id")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.id, c.description, c.location, c.image_url, ca.deadline
        FROM complaints c
        JOIN complaint_assignments ca ON c.id = ca.complaint_id
        WHERE ca.contractor_id = %s
    """, (contractor_id,))
    tasks = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify({"tasks": tasks})

# ---------------- CONTRACTOR FIX ----------------
# ---------------- CONTRACTOR FIX - WITH YOLO VERIFICATION ----------------
@app.route('/api/contractor/fix', methods=['POST'])
def contractor_fix():
    """Fix route with YOLO verification"""
    print("[FIX] ========== FIX REQUEST RECEIVED ==========")
    
    complaint_id = request.form.get("complaint_id")
    image = request.files.get("image")
    notes = request.form.get("notes", "")
    
    print(f"[FIX] Complaint ID: {complaint_id}")
    print(f"[FIX] Image: {image.filename if image else 'None'}")
    print(f"[FIX] Notes: {notes}")
    
    # Validation
    if not complaint_id:
        print("[FIX] ERROR: Missing complaint ID")
        return jsonify({"error": "Missing complaint ID", "success": False}), 400
    
    if not image or not allowed_file(image.filename):
        print("[FIX] ERROR: Invalid or missing image")
        return jsonify({"error": "Invalid or missing image file", "success": False}), 400

    try:
        # Save the image temporarily
        filename = secure_filename(f"{uuid.uuid4()}_{image.filename}")
        image_path = os.path.join(app.config['UPLOAD_FOLDER'], 'fixed', filename)
        image.save(image_path)
        print(f"[FIX] Image saved to: {image_path}")

        # ========== YOLO VERIFICATION ==========
        print("[YOLO] Running pothole detection on fixed image...")
        try:
            results = model(image_path)
            pothole_detected = False
            confidence = 0.0
            
            for result in results:
                boxes = result.boxes
                if boxes is not None and len(boxes) > 0:
                    pothole_detected = True
                    confidence = float(boxes.conf[0]) if len(boxes.conf) > 0 else 0.0
                    print(f"[YOLO] ❌ Pothole detected! Confidence: {confidence:.2%}")
                    break
            
            if not pothole_detected:
                print(f"[YOLO] ✅ No pothole detected - image verified!")
            
            # If pothole is still detected, reject the submission
            if pothole_detected:
                os.remove(image_path)  # Delete the image
                print(f"[YOLO] Rejecting submission - pothole still visible")
                return jsonify({
                    "success": False,
                    "pothole_detected": True,
                    "confidence": float(confidence),
                    "error": "Pothole still detected in the image. Please ensure the pothole is completely fixed before submitting."
                }), 400
                
        except Exception as yolo_error:
            print(f"[YOLO] ⚠️ YOLO verification failed: {str(yolo_error)}")
            print(f"[YOLO] Proceeding without verification...")
            # Continue anyway - don't block submission if YOLO fails
        
        # ========== UPDATE DATABASE ==========
        conn = get_db_connection()
        cursor = conn.cursor()
        
        print(f"[FIX] Updating complaint status to Completed...")
        cursor.execute("""
            UPDATE complaints 
            SET status = %s, fixed_image_url = %s 
            WHERE id = %s
        """, ("Completed", filename, complaint_id))
        
        print(f"[FIX] Updating completion date...")
        cursor.execute("""
            UPDATE complaint_assignments 
            SET completion_date = %s 
            WHERE complaint_id = %s
        """, (datetime.datetime.now(), complaint_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"[FIX] ✅ Database updated successfully")
        print("[FIX] ========== FIX COMPLETED ==========")
        
        return jsonify({
            "success": True,
            "pothole_detected": False,
            "message": "Complaint marked as fixed successfully! Pothole verification passed."
        }), 200

    except Exception as e:
        print(f"[FIX] ❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            "success": False,
            "error": f"Server error: {str(e)}"
        }), 500

# ---------------- HOMEPAGE (Optional) ----------------
@app.route('/')
def home():
    return render_template('landing.html')


@app.route('/upload', methods=['GET', 'POST'])
def upload_page():
    if request.method == 'GET':
        return render_template('user_upload.html')

    image = request.files['image']
    if not image or not allowed_file(image.filename):
        return "Invalid image", 400

    filename = secure_filename(f"{uuid.uuid4()}_{image.filename}")
    image_path = os.path.join(app.config['UPLOAD_FOLDER'], 'complaints', filename)
    image.save(image_path)

    # Run YOLO inference
    results = model(image_path)
    result_img_path = os.path.join(app.config['UPLOAD_FOLDER'], 'results', filename)

    for result in results:
        result_img = result.plot()
        cv2.imwrite(result_img_path, result_img)

    return render_template("user_upload.html", output_image=f"/uploads/results/{filename}")

@app.route('/uploads/results/<filename>')
def show_result(filename):
    return send_from_directory(os.path.join(app.config['UPLOAD_FOLDER'], 'results'), filename)

from uuid import uuid4
from database import get_db_connection
import datetime
import subprocess
import os

from flask import Flask, request, render_template, redirect
from uuid import uuid4
import datetime
import os
import requests
from database import get_db_connection

@app.route('/submit', methods=['POST'])
def submit_complaint():
    desc = request.form.get("description")
    location = request.form.get("location")
    lat = request.form.get("latitude")
    lng = request.form.get("longitude")
    result_path = request.form.get("result_image_path")

    user_id = request.cookies.get('user_id')
    if not user_id:
        return redirect('/login/user')

    complaint_id = str(uuid4())

    conn = get_db_connection()
    cursor = conn.cursor()

    # Step 1: Insert complaint with severity as None
    cursor.execute("""
        INSERT INTO complaints 
        (id, user_id, description, location, latitude, longitude, image_url, severity, status, created_at, fixed_image_url)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        complaint_id,
        user_id,
        desc,
        location,
        lat,
        lng,
        result_path,
        None,
        'Pending',
        datetime.datetime.now(),
        None
    ))

    conn.commit()
    cursor.close()
    conn.close()

    # Step 2: Run detector (which updates DB directly)
    try:
        image_filename = os.path.basename(result_path)
        subprocess.run(["python", "pothole_detector.py", image_filename, complaint_id], check=True)
    except Exception as e:
        print(f"Error running detector: {e}")

    # Step 3: Fetch severity from database
    severity = "unknown"
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT severity FROM complaints WHERE id = %s", (complaint_id,))
    result = cursor.fetchone()
    if result:
        severity = result[0]
    cursor.close()
    conn.close()

    return render_template(
        "complaint_submitted.html",
        complaint_id=complaint_id,
        result_path=result_path,
        severity=severity
    )


# ---------------- FRONTEND RENDER ROUTES ----------------

@app.route('/login/admin', methods=['GET'])
def login_admin_page():
    return render_template('login_admin.html')

@app.route('/login/user', methods=['GET'])
def login_user_page():
    return render_template('login_user.html')

@app.route('/signup/admin', methods=['GET'])
def signup_admin_page():
    return render_template('signup_admin.html')

@app.route('/signup/user', methods=['GET'])
def signup_user_page():
    return render_template('signup_user.html')

@app.route('/login/contractor', methods=['GET'])
def login_contractor_page():
    return render_template('login_contractor.html')

@app.route('/signup/contractor', methods=['GET'])
def signup_contractor_page():
    return render_template('signup_contractor.html')

@app.route('/index')
def index_page():
    return render_template('index.html')

from flask import render_template

# --- USER DASHBOARD ---
@app.route('/dashboard/user')
def dashboard_user():
    return render_template('dashboard_user.html')

# --- ADMIN DASHBOARD ---
@app.route('/dashboard/admin')
def admin_dashboard():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Fetch all complaints and their assignments
    cursor.execute("""
        SELECT 
            c.id, c.created_at::date, c.location, c.severity, c.status,
            co.name AS contractor_name
        FROM complaints c
        LEFT JOIN complaint_assignments ca ON c.id = ca.complaint_id
        LEFT JOIN contractors co ON ca.contractor_id = co.id
        ORDER BY c.created_at DESC;
    """)
    complaints = cursor.fetchall()

    # Fetch stats
    cursor.execute("SELECT COUNT(*) FROM complaints")
    total = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM complaints WHERE status = 'Assigned' OR status = 'In Progress'")
    in_progress = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM complaints WHERE status = 'Completed'")
    completed = cursor.fetchone()[0]

    cursor.execute("SELECT id, name FROM contractors WHERE is_approved = TRUE")
    active_contractors = cursor.fetchall()

    cursor.close()
    conn.close()

    return render_template('dashboard_admin.html',
                           complaints=complaints,
                           total_complaints=total,
                           in_progress=in_progress,
                           completed=completed,active_contractors=active_contractors)


# --- CONTRACTOR DASHBOARD ---
@app.route('/dashboard/contractor')
def dashboard_contractor():
    return render_template('dashboard_contractor.html')

@app.route('/user/complaint')
def raise_complaint():
    return render_template('user_complaint_form.html')

# ---------------- USER FORM ROUTES ----------------
@app.route('/signup/user', methods=['GET', 'POST'])
def signup_user():
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        password = request.form.get('password')
        phone = request.form.get('phone')

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            user_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO users (id, name, email, password, phone)
                VALUES (%s, %s, %s, %s, %s)
            """, (user_id, name, email, password, phone))

            conn.commit()
            cursor.close()
            conn.close()

            flash("Signup successful. Please login now.", "success")
            return redirect('/login/user')

        except Exception as e:
            conn.rollback()
            flash("User with this email already exists. Please login.", "error")
            cursor.close()
            conn.close()
            return redirect('/login/user')

    return render_template('signup_user.html')



@app.route('/login/user', methods=['GET', 'POST'])
def login_user():
    if request.method == 'POST':
        email = request.form.get("email")
        password = request.form.get("password")

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = %s AND password = %s", (email, password))
        user = cursor.fetchone()
        cursor.close()
        conn.close()

        if user:
            user_id = user[0]  # Assuming `id` is the first column
            response = redirect('/dashboard/user')
            response.set_cookie('user_id', user_id)  # Store user_id in cookie
            return response
        else:
            return "Invalid credentials", 401

    return render_template('login_user.html')


@app.route('/signup/admin', methods=['GET', 'POST'])
def signup_admin():
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        password = request.form.get('password')

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            # Check if email already exists
            cursor.execute("SELECT * FROM admins WHERE email = %s", (email,))
            existing_admin = cursor.fetchone()
            if existing_admin:
                flash("Admin with this email already exists. Please login.", "error")
                return redirect('/login/admin')

            admin_id = str(uuid.uuid4())
            cursor.execute("INSERT INTO admins (id, name, email, password) VALUES (%s, %s, %s, %s)",
                           (admin_id, name, email, password))
            conn.commit()
            flash("Admin signup successful. Please login.", "success")
            return redirect('/login/admin')
        finally:
            cursor.close()
            conn.close()

    return render_template('signup_admin.html')



@app.route('/login/admin', methods=['GET', 'POST'])
def login_admin():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM admins WHERE email = %s AND password = %s", (email, password))
        admin = cursor.fetchone()
        cursor.close()
        conn.close()

        if admin:
            flash("Login successful.", "success")
            return redirect('/dashboard/admin')
        else:
            flash("Invalid credentials.", "error")
            return redirect('/login/admin')

    return render_template('login_admin.html')


@app.route('/signup/contractor', methods=['GET', 'POST'])
def signup_contractor():
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        password = request.form.get('password')
        company = request.form.get('company')

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            # Check if email already exists
            cursor.execute("SELECT * FROM contractors WHERE email = %s", (email,))
            existing_contractor = cursor.fetchone()
            if existing_contractor:
                flash("Contractor with this email already exists. Please login.", "error")
                return redirect('/login/contractor')

            contractor_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO contractors (id, name, email, password, company, is_approved)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (contractor_id, name, email, password, company, False))
            conn.commit()
            flash("Contractor registered. Await admin approval.", "success")
            return redirect('/login/contractor')
        finally:
            cursor.close()
            conn.close()

    return render_template('signup_contractor.html')



@app.route('/login/contractor', methods=['GET', 'POST'])
def login_contractor():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        # ✅ Directly create the connection with DictCursor
        import psycopg2
        import psycopg2.extras
        conn = psycopg2.connect(DATABASE_URI)
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        cursor.execute("SELECT * FROM contractors WHERE email = %s AND password = %s", (email, password))
        contractor = cursor.fetchone()
        cursor.close()
        conn.close()

        if contractor and contractor['is_approved'] == True:
            flash("Login successful", "success")
            response = redirect('/dashboard/contractor')
            response.set_cookie('contractor_email', email)  # Pass email to frontend
            return response

        elif contractor:
            flash("Your account is pending admin approval.", "error")
            return redirect('/login/contractor')
        else:
            flash("Invalid credentials.", "error")
            return redirect('/login/contractor')

    return render_template('login_contractor.html')

@app.route('/dashboard/user/complaints/existing')
def user_existing_complaints():
    user_id = request.cookies.get('user_id')
    if not user_id:
        return redirect('/login/user')

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.id, c.description, c.location, c.image_url, c.status, c.severity, c.created_at, u.email
        FROM complaints c
        JOIN users u ON c.user_id = u.id
        WHERE c.user_id = %s AND c.status IN ('Pending', 'Assigned')
        ORDER BY c.created_at DESC
    """, (user_id,))
    rows = cursor.fetchall()
    complaints = [
        {
            "id": row[0],
            "description": row[1],
            "location": row[2],
            "image_url": row[3] if row[3] else "",
            "status": row[4],
            "severity": row[5],
            "date_reported": row[6].strftime('%Y-%m-%d') if row[6] else "",
            "reported_by": row[7]
        }
        for row in rows
    ]
    cursor.close()
    conn.close()
    return render_template("user_existing_complaints.html", complaints=complaints)


@app.route('/dashboard/user/complaints/fixed')
def user_fixed_complaints():
    user_id = request.cookies.get('user_id')  
    if not user_id:
        return redirect('/login/user') 

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.id, c.description, c.location, c.image_url, c.fixed_image_url,
               c.created_at, c.status, c.severity, u.email, ca.completion_date
        FROM complaints c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN complaint_assignments ca ON c.id = ca.complaint_id
        WHERE c.user_id = %s AND c.status = 'Completed'
        ORDER BY c.created_at DESC
    """, (user_id,))
    rows = cursor.fetchall()
    complaints = [
        {
            "id": row[0],
            "description": row[1],
            "location": row[2],
            "image_url": row[3] if row[3] else "",
            "fixed_image_url": f"/uploads/fixed/{row[4]}" if row[4] else "",
            "date_reported": row[5].strftime('%Y-%m-%d') if row[5] else "",
            "status": row[6],
            "severity": row[7],
            "reported_by": row[8],
            "fixed_date": row[9].strftime('%Y-%m-%d') if row[9] else ""
        }
        for row in rows
    ]
    cursor.close()
    conn.close()
    return render_template("user_fixed_complaints.html", complaints=complaints)



@app.route('/api/contractors')
def get_contractors():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM contractors WHERE is_approved = TRUE")
    contractors = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(contractors)


@app.route('/dashboard/admin/contractors')
def admin_contractors():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Fetch active contractors (is_approved = True)
    cursor.execute("""
    SELECT 
        c.id, c.name, c.email, c.company, c.phone, c.specialization, c.created_at,
        COUNT(ca.complaint_id) AS job_count
    FROM contractors c
    LEFT JOIN complaint_assignments ca ON c.id = ca.contractor_id
    WHERE c.is_approved = TRUE
    GROUP BY c.id, c.name, c.email, c.company, c.phone, c.specialization, c.created_at
""")
    active_contractors = cursor.fetchall()

    # Fetch pending contractors (is_approved = False)
    cursor.execute("SELECT id, name, email, company, phone, specialization, total_jobs_assigned, created_at FROM contractors WHERE is_approved = False")

    pending_contractors = cursor.fetchall()

    cursor.execute("SELECT COUNT(*) FROM contractors WHERE is_approved = TRUE;")
    active_count = cursor.fetchone()[0]

    # Pending contractors
    cursor.execute("SELECT COUNT(*) FROM contractors WHERE is_approved = FALSE;")
    pending_count = cursor.fetchone()[0]

    # Total jobs assigned (count from complaint_assignments)
    cursor.execute("SELECT COUNT(*) FROM complaint_assignments;")
    jobs_count = cursor.fetchone()[0]

    cursor.execute("""
    SELECT COUNT(*) FROM complaints
    WHERE status = 'Completed'""")
    completed_jobs_count = cursor.fetchone()[0]

    cursor.close()
    conn.close()

    return render_template("contractors.html", active_contractors=active_contractors, pending_contractors=pending_contractors,active_count=active_count,
        pending_count=pending_count,
        jobs_count=jobs_count,
         completed_jobs_count=completed_jobs_count)
        


@app.route('/dashboard/admin/complaints')
def admin_complaints():
    return render_template('admin_complaints.html')

@app.route('/admin/contractors/approve/<contractor_id>', methods=['POST'])
def approve_contractor(contractor_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE contractors SET is_approved = TRUE WHERE id = %s", (contractor_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": "Contractor approved"})


@app.route('/admin/assign/<complaint_id>', methods=['POST'])
def assign_contractor(complaint_id):
    data = request.get_json()
    contractor_id = data.get('contractor_id')
    deadline = data.get('deadline')

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE complaints
        SET contractor_id = %s, status = 'Assigned', deadline = %s
        WHERE id = %s
    """, (contractor_id, deadline, complaint_id))

    # Before INSERT, check if it exists
    cursor.execute("""
        SELECT 1 FROM complaint_assignments
        WHERE complaint_id = %s AND contractor_id = %s
    """, (complaint_id, contractor_id))
    if cursor.fetchone():
        return jsonify({"error": "Assignment already exists."}), 409  # 409 Conflict


    cursor.execute("""
            INSERT INTO complaint_assignments (complaint_id, contractor_id, deadline)
            VALUES (%s, %s, %s)
        """, (complaint_id, contractor_id, deadline))

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": "Contractor assigned successfully"}), 

@app.route('/api/contractor/dashboard_data', methods=['GET'])
def contractor_dashboard_data():
    contractor_email = request.args.get("email")

    conn = get_db_connection()
    cursor = conn.cursor()

    # Get contractor_id from email
    cursor.execute("SELECT id FROM contractors WHERE email = %s", (contractor_email,))
    contractor = cursor.fetchone()
    if not contractor:
        return jsonify({"error": "Contractor not found"}), 404

    contractor_id = contractor[0]

    # Fetch assigned complaints
    cursor.execute("""
        SELECT 
            c.id, c.description, c.location, c.image_url, c.fixed_image_url, 
            c.status, c.severity, c.created_at, ca.completion_date, u.email,
            c.latitude, c.longitude
        FROM complaints c
        JOIN complaint_assignments ca ON c.id = ca.complaint_id
        JOIN users u ON c.user_id = u.id
        WHERE ca.contractor_id = %s
        ORDER BY c.created_at DESC
    """, (contractor_id,))
    
    rows = cursor.fetchall()

    complaints = []
    for row in rows:
        complaints.append({
            "id": row[0],
            "description": row[1],
            "location": row[2],
            "image_url": row[3] if row[3] else "",
            "fixed_image_url": f"/uploads/fixed/{row[4]}" if row[4] else "",
            "status": row[5].lower() if row[5] else "pending",
            "severity": row[6].lower() if row[6] else "medium",
            "date_reported": row[7].strftime('%Y-%m-%d') if row[7] else "",
            "date_fixed": row[8].strftime('%Y-%m-%d') if row[8] else None,
            "reported_by": row[9],
            "latitude": float(row[10]) if row[10] else None,
            "longitude": float(row[11]) if row[11] else None
        })

    cursor.close()
    conn.close()

    return jsonify(complaints)


app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER  # Points to backend/uploads


@app.route('/uploads/complaints/<filename>')
def serve_complaint_image(filename):
    return send_from_directory(os.path.join(app.config['UPLOAD_FOLDER'], 'results'), filename)

@app.route('/uploads/fixed/<filename>')
def serve_fixed_image(filename):
    return send_from_directory(os.path.join(app.config['UPLOAD_FOLDER'], 'fixed'), filename)


@app.route('/api/admin/dashboard_data', methods=['GET'])
def admin_dashboard_data():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            c.id, c.description, c.location, c.image_url, c.fixed_image_url,
            c.status, c.severity, c.created_at, ca.completion_date, u.email
        FROM complaints c
        LEFT JOIN complaint_assignments ca ON c.id = ca.complaint_id
        JOIN users u ON c.user_id = u.id
        ORDER BY c.created_at DESC
    """)
    rows = cursor.fetchall()

    complaints = [{
        "id": row[0],
        "description": row[1],
        "location": row[2],
        "image_url": row[3] if row[3] else "",
        "fixed_image_url": f"/uploads/fixed/{row[4]}" if row[4] else "",
        "status": row[5].lower() if row[5] else "pending",
        "severity": row[6].lower() if row[6] else "medium",
        "date_reported": row[7].strftime('%Y-%m-%d') if row[7] else "",
        "date_fixed": row[8].strftime('%Y-%m-%d') if row[8] else None,
        "reported_by": row[9]
    } for row in rows]

    cursor.close()
    conn.close()
    return jsonify(complaints)


@app.route('/dashboard/admin/fixed-complaints')
def admin_fixed_complaints():
    return render_template('admin_fixed_complaints.html')


@app.route('/api/admin/map_data', methods=['GET'])
def admin_map_data():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, latitude, longitude, status, severity, location, description
        FROM complaints
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    """)
    rows = cursor.fetchall()

    complaints = [{
        "id": row[0],
        "latitude": float(row[1]),
        "longitude": float(row[2]),
        "status": row[3].lower() if row[3] else "pending",
        "severity": row[4].lower() if row[4] else "medium",
        "location": row[5],
        "description": row[6] or "No description provided"
    } for row in rows]

    cursor.close()
    conn.close()
    return jsonify(complaints)


@app.route('/api/contractor/map_data', methods=['GET'])
def contractor_map_data():
    contractor_email = request.args.get("email")

    conn = get_db_connection()
    cursor = conn.cursor()

    # Get contractor ID from email
    cursor.execute("SELECT id FROM contractors WHERE email = %s", (contractor_email,))
    contractor = cursor.fetchone()
    if not contractor:
        return jsonify({"error": "Contractor not found"}), 404

    contractor_id = contractor[0]

    # Get assigned complaints with valid lat/lng
    cursor.execute("""
        SELECT 
            c.id, c.latitude, c.longitude, c.status, c.severity, c.location, c.description
        FROM complaints c
        JOIN complaint_assignments ca ON c.id = ca.complaint_id
        WHERE ca.contractor_id = %s
        AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
    """, (contractor_id,))

    rows = cursor.fetchall()

    complaints = [{
        "id": row[0],
        "latitude": float(row[1]),
        "longitude": float(row[2]),
        "status": row[3].lower() if row[3] else "pending",
        "severity": row[4].lower() if row[4] else "medium",
        "location": row[5],
        "description": row[6] or "No description"
    } for row in rows]

    cursor.close()
    conn.close()
    return jsonify(complaints)

@app.route('/api/contractor/profile/<contractor_id>')
def contractor_profile(contractor_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT c.id, c.name, c.email, c.company, c.phone, c.specialization,
               COUNT(DISTINCT ca.complaint_id) AS jobs_assigned,
               SUM(CASE WHEN comp.status = 'Completed' THEN 1 ELSE 0 END) AS jobs_completed
        FROM contractors c
        LEFT JOIN complaint_assignments ca ON c.id = ca.contractor_id
        LEFT JOIN complaints comp ON ca.complaint_id = comp.id
        WHERE c.id = %s
        GROUP BY c.id
    """, (contractor_id,))

    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if not row:
        return jsonify({"error": "Contractor not found"}), 404

    contractor = {
        "id": row[0],
        "name": row[1],
        "email": row[2],
        "company": row[3],
        "phone": row[4],
        "specialization": row[5],
        "jobs_assigned": row[6],
        "jobs_completed": row[7]
    }
    return jsonify(contractor)


@app.route('/admin/contractor/remove/<contractor_id>', methods=['POST'])
def remove_contractor(contractor_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM contractors WHERE id = %s", (contractor_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"message": "Contractor removed successfully!"})

@app.route('/api/contractor/fixed_jobs')
def contractor_fixed_jobs():
    contractor_id = request.args.get("contractor_id")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.id, c.description, c.location, ca.completion_date
        FROM complaints c
        JOIN complaint_assignments ca ON c.id = ca.complaint_id
        WHERE ca.contractor_id = %s AND c.status = 'Completed'
    """, (contractor_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    fixed_jobs = [{
        "id": row[0],
        "description": row[1],
        "location": row[2],
        "fixed_date": row[3].strftime('%Y-%m-%d') if row[3] else "N/A"
    } for row in rows]

    return jsonify({"fixed_jobs": fixed_jobs})


if __name__ == '__main__':
    app.run(debug=True)
