from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from django.utils import timezone
from .models import Employee, AttendanceWindow, AttendanceLog
from .serializers import AttendanceLogSerializer, EmployeeSerializer
from .utils import calculate_distance, verify_face, check_liveness, decode_image
import datetime
from django.http import HttpResponse
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter


class AttendanceSubmissionView(APIView):
    def post(self, request):
        data = request.data
        employee_id = str(data.get('employee_id')).strip() if data.get('employee_id') else None
        image_base64 = data.get('image')
        lat = data.get('latitude')
        lon = data.get('longitude')
        action = data.get('action', 'checkin')  # 'checkin' or 'checkout'

        # 1. Validate Input
        if not all([employee_id, image_base64, lat, lon]):
            return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            employee = Employee.objects.get(employee_id=employee_id)
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found'}, status=status.HTTP_404_NOT_FOUND)

        # 2. Once-per-day check (using IST date)
        now_ist = timezone.localtime(timezone.now())
        today_ist = now_ist.date()
        today_start = timezone.make_aware(
            datetime.datetime.combine(today_ist, datetime.time.min),
            timezone.get_current_timezone()
        )
        today_end = timezone.make_aware(
            datetime.datetime.combine(today_ist, datetime.time.max),
            timezone.get_current_timezone()
        )

        if action == 'checkin':
            already_checked_in = AttendanceLog.objects.filter(
                employee=employee,
                status='PRESENT',
                timestamp__range=(today_start, today_end)
            ).exists()
            if already_checked_in:
                return Response({'error': 'Already checked in today'}, status=status.HTTP_400_BAD_REQUEST)
        elif action == 'checkout':
            # Must have checked in first
            has_checkin = AttendanceLog.objects.filter(
                employee=employee,
                status='PRESENT',
                timestamp__range=(today_start, today_end)
            ).exists()
            if not has_checkin:
                return Response({'error': 'Cannot check out without checking in first'}, status=status.HTTP_400_BAD_REQUEST)

            already_checked_out = AttendanceLog.objects.filter(
                employee=employee,
                status='CHECKOUT',
                timestamp__range=(today_start, today_end)
            ).exists()
            if already_checked_out:
                return Response({'error': 'Already checked out today'}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Decode Image
        image_cv2 = decode_image(image_base64)
        if image_cv2 is None:
            return Response({'error': 'Invalid image format'}, status=status.HTTP_400_BAD_REQUEST)

        # 4. Liveness Check
        is_live, liveness_msg = check_liveness(image_cv2)
        if not is_live:
            AttendanceLog.objects.create(
                employee=employee,
                status='FAILED',
                failure_reason=f"Liveness Check Failed: {liveness_msg}"
            )
            return Response({'error': f"Liveness check failed: {liveness_msg}"}, status=status.HTTP_400_BAD_REQUEST)

        # 5. Face Verification
        if employee.face_encoding:
            is_match, match_msg = verify_face(image_cv2, employee.face_encoding)
            if not is_match:
                AttendanceLog.objects.create(
                    employee=employee,
                    status='FAILED',
                    failure_reason=f"Face Verification Failed: {match_msg}"
                )
                return Response({'error': "Face verification failed"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'error': "Employee has no registered face data"}, status=status.HTTP_400_BAD_REQUEST)

        # 6. For check-in: verify active window & geofence
        if action == 'checkin':
            now = timezone.now()
            active_windows = AttendanceWindow.objects.filter(start_time__lte=now, end_time__gte=now)

            if not active_windows.exists():
                AttendanceLog.objects.create(
                    employee=employee,
                    status='FAILED',
                    failure_reason="No active attendance window"
                )
                return Response({'error': "No active attendance window"}, status=status.HTTP_400_BAD_REQUEST)

            valid_window = None
            for window in active_windows:
                distance = calculate_distance(lat, lon, window.latitude, window.longitude)
                if distance <= window.radius_meters:
                    valid_window = window
                    break

            if not valid_window:
                AttendanceLog.objects.create(
                    employee=employee,
                    status='FAILED',
                    failure_reason="Location validation failed (Geo-fencing)"
                )
                return Response({'error': "You are not within the attendance range"}, status=status.HTTP_400_BAD_REQUEST)

            log = AttendanceLog.objects.create(
                employee=employee,
                window=valid_window,
                status='PRESENT'
            )
            return Response({
                'message': 'Check-In successful',
                'employee': employee.name,
                'time': timezone.localtime(log.timestamp).strftime('%Y-%m-%d %H:%M:%S IST')
            }, status=status.HTTP_200_OK)

        elif action == 'checkout':
            log = AttendanceLog.objects.create(
                employee=employee,
                status='CHECKOUT'
            )
            return Response({
                'message': 'Check-Out successful',
                'employee': employee.name,
                'time': timezone.localtime(log.timestamp).strftime('%Y-%m-%d %H:%M:%S IST')
            }, status=status.HTTP_200_OK)

        return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)


class EmployeeListCreateView(generics.ListCreateAPIView):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer


class EmployeeRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer


class AttendanceReportPDFView(APIView):
    def get(self, request):
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        if not start_date_str or not end_date_str:
            return Response({'error': 'Please provide start_date and end_date'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            start_date = datetime.datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

        tz = timezone.get_current_timezone()
        start_dt = timezone.make_aware(datetime.datetime.combine(start_date, datetime.time.min), tz)
        end_dt = timezone.make_aware(datetime.datetime.combine(end_date, datetime.time.max), tz)

        logs = AttendanceLog.objects.filter(
            timestamp__range=(start_dt, end_dt)
        ).order_by('timestamp')

        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="attendance_{start_date_str}_to_{end_date_str}.pdf"'

        p = canvas.Canvas(response, pagesize=letter)
        y = 750

        p.setFont("Helvetica-Bold", 16)
        p.drawString(100, y, f"Attendance Report - Nizan Makeovers")
        y -= 25
        p.setFont("Helvetica", 12)
        p.drawString(100, y, f"Period: {start_date_str} to {end_date_str} (IST)")
        y -= 30

        if not logs.exists():
            p.drawString(100, y, "No attendance records found for this period.")
        else:
            p.setFont("Helvetica-Bold", 11)
            p.drawString(60, y, "Name")
            p.drawString(180, y, "Employee ID")
            p.drawString(290, y, "Status")
            p.drawString(380, y, "Timestamp (IST)")
            y -= 5
            p.line(60, y, 560, y)
            y -= 15
            p.setFont("Helvetica", 10)
            for log in logs:
                timestamp_str = timezone.localtime(log.timestamp).strftime('%Y-%m-%d %H:%M:%S')
                p.drawString(60, y, log.employee.name[:20])
                p.drawString(180, y, log.employee.employee_id)
                p.drawString(290, y, log.status)
                p.drawString(380, y, timestamp_str)
                y -= 18
                if y < 50:
                    p.showPage()
                    y = 750
                    p.setFont("Helvetica", 10)

        p.showPage()
        p.save()
        return response


class AttendanceLogsJSONView(APIView):
    """Returns attendance logs as JSON, filtered by date range (for table display)."""
    def get(self, request):
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        employee_id = request.query_params.get('employee_id')  # optional filter

        if not start_date_str or not end_date_str:
            return Response({'error': 'Please provide start_date and end_date'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            start_date = datetime.datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

        tz = timezone.get_current_timezone()
        start_dt = timezone.make_aware(datetime.datetime.combine(start_date, datetime.time.min), tz)
        end_dt = timezone.make_aware(datetime.datetime.combine(end_date, datetime.time.max), tz)

        logs = AttendanceLog.objects.filter(
            timestamp__range=(start_dt, end_dt)
        ).order_by('-timestamp')

        if employee_id:
            logs = logs.filter(employee__employee_id=employee_id)

        data = []
        for log in logs:
            data.append({
                'id': log.id,
                'employee_name': log.employee.name,
                'employee_id': log.employee.employee_id,
                'status': log.status,
                'timestamp': timezone.localtime(log.timestamp).strftime('%Y-%m-%d %H:%M:%S'),
                'failure_reason': log.failure_reason or '',
            })

        return Response(data, status=status.HTTP_200_OK)


class AttendanceEmployeePDFView(APIView):
    """Downloads attendance PDF for a specific employee over a date range."""
    def get(self, request):
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        emp_id = request.query_params.get('employee_id')

        if not all([start_date_str, end_date_str, emp_id]):
            return Response({'error': 'Provide start_date, end_date, and employee_id'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            employee = Employee.objects.get(employee_id=emp_id)
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            start_date = datetime.datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

        tz = timezone.get_current_timezone()
        start_dt = timezone.make_aware(datetime.datetime.combine(start_date, datetime.time.min), tz)
        end_dt = timezone.make_aware(datetime.datetime.combine(end_date, datetime.time.max), tz)

        logs = AttendanceLog.objects.filter(
            employee=employee,
            timestamp__range=(start_dt, end_dt)
        ).order_by('timestamp')

        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{employee.name}_{start_date_str}_to_{end_date_str}.pdf"'

        p = canvas.Canvas(response, pagesize=letter)
        y = 750

        p.setFont("Helvetica-Bold", 16)
        p.drawString(100, y, f"Attendance Report - {employee.name}")
        y -= 22
        p.setFont("Helvetica", 12)
        p.drawString(100, y, f"Employee ID: {employee.employee_id}")
        y -= 18
        p.drawString(100, y, f"Period: {start_date_str} to {end_date_str} (IST)")
        y -= 30

        if not logs.exists():
            p.drawString(100, y, "No attendance records found.")
        else:
            p.setFont("Helvetica-Bold", 11)
            p.drawString(60, y, "Date")
            p.drawString(200, y, "Status")
            p.drawString(310, y, "Timestamp (IST)")
            y -= 5
            p.line(60, y, 530, y)
            y -= 15
            p.setFont("Helvetica", 10)
            for log in logs:
                ts = timezone.localtime(log.timestamp)
                p.drawString(60, y, ts.strftime('%Y-%m-%d'))
                p.drawString(200, y, log.status)
                p.drawString(310, y, ts.strftime('%H:%M:%S'))
                y -= 18
                if y < 60:
                    p.showPage()
                    y = 750
                    p.setFont("Helvetica", 10)

        p.showPage()
        p.save()
        return response
