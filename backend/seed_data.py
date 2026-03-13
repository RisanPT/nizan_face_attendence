import os
import django
from django.utils import timezone
from datetime import timedelta

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "smart_attendance.settings")
django.setup()

from django.contrib.auth import get_user_model
from api.models import Employee, AttendanceWindow

User = get_user_model()

# 1. Create Superuser
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin')
    print("Superuser 'admin' created with password 'admin'")
else:
    print("Superuser 'admin' already exists")

# 2. Create Test Employee
if not Employee.objects.filter(employee_id='123456').exists():
    # Note: We aren't setting a face encoding here, so face verification will fail safely 
    # (or you can manually add a photo via admin)
    Employee.objects.create(
        name='Test Employee',
        employee_id='123456'
    )
    print("Test Employee created (ID: 123456)")
else:
    print("Test Employee already exists")

# 3. Create or update Attendance Window with Nizan Makeovers location
NOW = timezone.now()
LAT = 11.2481   # Nizan Makeovers - Kozhikode, Kerala
LON = 75.8348
RADIUS = 10000  # 10 KM in meters

if AttendanceWindow.objects.exists():
    # Update existing windows with correct location
    AttendanceWindow.objects.update(
        latitude=LAT,
        longitude=LON,
        radius_meters=RADIUS
    )
    print(f"Attendance Window updated: ({LAT}, {LON}), radius={RADIUS}m (10 KM)")
else:
    AttendanceWindow.objects.create(
        class_name='Nizan Makeovers',
        start_time=NOW - timedelta(hours=12),
        end_time=NOW + timedelta(hours=12),
        latitude=LAT,
        longitude=LON,
        radius_meters=RADIUS
    )
    print(f"Attendance Window created: ({LAT}, {LON}), radius={RADIUS}m (10 KM)")
