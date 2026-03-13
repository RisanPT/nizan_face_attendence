import base64
import face_recognition
import numpy as np
import cv2
from geopy.distance import geodesic
import json
from io import BytesIO
from PIL import Image

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate distance between two points in meters.
    """
    coords_1 = (lat1, lon1)
    coords_2 = (lat2, lon2)
    return geodesic(coords_1, coords_2).meters

def decode_image(base64_string):
    """
    Decode base64 string to numpy array (OpenCV format)
    """
    try:
        # Remove header if present (e.g., "data:image/jpeg;base64,")
        if "base64," in base64_string:
            base64_string = base64_string.split("base64,")[1]
        
        image_data = base64.b64decode(base64_string)
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        print(f"Error decoding image: {e}")
        return None

def check_liveness(image):
    """
    Basic liveness check using face landmarks to detect eyes.
    This is a simplistic check ensuring face structure exists and is roughly frontal.
    For production, this needs video stream analysis (blinking) or depth sensors.
    """
    try:
        # Convert to RGB for face_recognition
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        face_landmarks_list = face_recognition.face_landmarks(rgb_image)
        
        if not face_landmarks_list:
            return False, "No face landmarks detected"
        
        # Check if both eyes are present (basic structural check)
        for landmarks in face_landmarks_list:
            if 'left_eye' in landmarks and 'right_eye' in landmarks:
                return True, "Passed"
        
        return False, "Face structure incomplete"
    except Exception as e:
        return False, str(e)

def verify_face(uploded_image_cv2, stored_encoding_json):
    """
    Compare uploaded image with stored face encoding
    """
    try:
        rgb_image = cv2.cvtColor(uploded_image_cv2, cv2.COLOR_BGR2RGB)
        
        # Get encoding of uploaded image
        # Assume usually one face per verification attempt
        uploaded_encodings = face_recognition.face_encodings(rgb_image)
        
        if not uploaded_encodings:
            return False, "No face found in uploaded image"
        
        uploaded_encoding = uploaded_encodings[0]
        stored_encoding = np.array(json.loads(stored_encoding_json))
        
        # Compare
        results = face_recognition.compare_faces([stored_encoding], uploaded_encoding, tolerance=0.5) # strict tolerance
        
        if results[0]:
            return True, "Match found"
        else:
            return False, "Face does not match"
            
    except Exception as e:
        return False, f"Verification error: {e}"
