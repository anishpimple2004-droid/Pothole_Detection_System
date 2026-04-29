# pothole_detector_text_only.py
import os
import cv2
import numpy as np
import torch
from tkinter import Tk, filedialog

def load_model(model_path):
    """
    Load the pothole severity model (.pt file)
    """
    try:
        # Try loading with the Ultralytics YOLO class first (most reliable for YOLOv5/v8)
        try:
            from ultralytics import YOLO
            model = YOLO(model_path)
            print(f"Model loaded successfully using Ultralytics YOLO from {model_path}")
            return model, True  # Second return value indicates it's an Ultralytics model
        except Exception as e:
            print(f"Failed to load with Ultralytics: {e}")
            print("Trying standard PyTorch loading...")
            
            # Try standard PyTorch loading with weights_only=False for PyTorch 2.6+
            model = torch.load(model_path, map_location=torch.device('cpu'), weights_only=False)
            
            # If model is a state dict
            if isinstance(model, dict) and 'model' in model:
                model = model['model']
                
            # Set to evaluation mode
            if hasattr(model, 'eval'):
                model.eval()
                
            print(f"Model loaded successfully using PyTorch from {model_path}")
            return model, False
    except Exception as e:
        print(f"Error loading model: {e}")
        print("\nPlease install ultralytics package with: pip install ultralytics")
        return None, False

def extract_severity_ultralytics(results):
    """
    Extract severity information from Ultralytics results
    """
    severities = []
    
    try:
        # Get the names from the model
        names = results[0].names
        print(f"Model class names: {names}")  # Debug: print all class names
        
        # Get the detected classes and their confidences
        boxes = results[0].boxes
        for box in boxes:
            class_id = int(box.cls.item())
            conf = float(box.conf.item())
            
            # Get the class name
            class_name = names[class_id].lower()
            print(f"Detected class: {class_name} (ID: {class_id}) with confidence: {conf:.2f}")  # Debug
            
            # Determine severity based on class name or ID
            # Method 1: Look for specific keywords in class name
            severity_type = None
            for severity in ['major', 'medium', 'minor']:
                if severity in class_name:
                    severity_type = severity
                    break
            
            # Method 2: Use class ID to map to severity if keywords not found
            # Customize these mappings based on your model's class indices
            if severity_type is None:
                severity_map = {
                    0: "major",
                    1: "medium",
                    2: "minor"
                }
                if class_id in severity_map:
                    severity_type = severity_map[class_id]
            
            # Method 3: If no mapping found, check specific class names like "pothole"
            # and assign a default severity
            if severity_type is None and "pothole" in class_name:
                # You can set a default severity or let the user know detection is generic
                severity_type = "unknown"
            
            # If we have a severity, add it to results
            if severity_type:
                severities.append((severity_type, conf, class_name))
    except Exception as e:
        print(f"Error extracting from Ultralytics results: {e}")
        import traceback
        traceback.print_exc()
    
    return severities

def extract_severity_pytorch(detection_results, conf_threshold=0.25):
    """
    Extract severity from standard PyTorch model results
    """
    severities = []
    
    try:
        # For YOLOv5 standard output format
        if isinstance(detection_results, torch.Tensor) and detection_results.dim() >= 2:
            # Get the first element if it's a list or tuple
            if isinstance(detection_results, (list, tuple)):
                detection_results = detection_results[0]
            
            # Handle different output shapes
            if detection_results.dim() == 3:
                detections = detection_results[0]  # First batch
            else:
                detections = detection_results
            
            # Filter by confidence
            if detections.shape[1] > 4:  # Make sure we have confidence values
                conf_mask = detections[:, 4] > conf_threshold
                detections = detections[conf_mask]
                
                # Get class indices with highest probability
                if detections.shape[0] > 0 and detections.shape[1] > 5:
                    # For each detection
                    for det in detections:
                        # Get confidence
                        conf = float(det[4].item())
                        
                        # Get class index
                        class_probs = det[5:]
                        class_idx = int(class_probs.argmax().item())
                        class_conf = float(class_probs[class_idx].item())
                        
                        # Combine confidence scores
                        total_conf = conf * class_conf
                        
                        # Map class indices to severity labels
                        # IMPORTANT: Modify these mappings based on your model's class structure
                        class_map = {
                            0: "major",
                            1: "medium", 
                            2: "minor",
                            3: "major",  # Some models use different indices
                            4: "medium",
                            5: "minor"
                        }
                        
                        if class_idx in class_map:
                            severity = class_map[class_idx]
                            severities.append((severity, total_conf, f"class_{class_idx}"))
                        else:
                            # Default "unknown" severity if class mapping not found
                            severities.append(("unknown", total_conf, f"class_{class_idx}"))
    except Exception as e:
        print(f"Error processing PyTorch detections: {e}")
        import traceback
        traceback.print_exc()
    
    return severities

def select_file(title, filetypes):
    """
    Open a file dialog
    """
    root = Tk()
    root.withdraw()
    
    file_path = filedialog.askopenfilename(
        title=title,
        filetypes=filetypes
    )
    
    return file_path

def manually_assign_severity():
    """
    Allow user to manually assign severity mappings for classes
    """
    print("\nIt seems your model uses different class mappings.")
    print("Let's manually assign severity levels to class indices:")
    
    severity_map = {}
    class_count = int(input("How many classes does your model have? "))
    
    for i in range(class_count):
        print(f"\nFor class index {i}:")
        class_name = input("What is the class name? (e.g., 'pothole', 'major_pothole'): ")
        severity = input("What severity should this be? (major, medium, minor): ").lower()
        
        if severity not in ['major', 'medium', 'minor']:
            severity = "unknown"
            
        severity_map[i] = (severity, class_name)
    
    return severity_map

def main():
    import sys
    import psycopg2
    from database import get_db_connection

    if len(sys.argv) != 3:
        print("Usage: python pothole_detector.py <filename> <complaint_id>")
        return

    filename = sys.argv[1]
    complaint_id = sys.argv[2]

    model_path = r"C:\Users\91835\Desktop\pothole_system\backend\best.pt"
    image_dir = r"C:\Users\91835\Desktop\pothole_system\backend\uploads\complaints"
    image_path = os.path.join(image_dir, filename)

    if not os.path.exists(image_path):
        print("Image not found:", image_path)
        return

    model, is_ultralytics = load_model(model_path)
    if model is None:
        return

    try:
        if is_ultralytics:
            results = model(image_path)
            severities = extract_severity_ultralytics(results)
        else:
            img = cv2.imread(image_path)
            img_resized = cv2.resize(img, (640, 640))
            img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
            img_normalized = img_rgb / 255.0
            img_chw = img_normalized.transpose(2, 0, 1)
            img_tensor = torch.from_numpy(img_chw).float().unsqueeze(0)

            with torch.no_grad():
                detection_results = model(img_tensor)
            severities = extract_severity_pytorch(detection_results)

        if not severities:
            print("No pothole detected.")
            return

        top_severity = max(severities, key=lambda x: x[1])[0]
        print(f"Detected severity: {top_severity}")

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE complaints SET severity = %s WHERE id = %s", (top_severity, complaint_id))
        conn.commit()
        cursor.close()
        conn.close()

        print("Severity updated in database.")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()




if __name__ == "__main__":
    main()