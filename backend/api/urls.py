from django.urls import path
from .views import AttendanceSubmissionView, EmployeeListCreateView, EmployeeRetrieveUpdateDestroyView, AttendanceReportPDFView, AttendanceLogsJSONView, AttendanceEmployeePDFView

urlpatterns = [
    path('submit-attendance/', AttendanceSubmissionView.as_view(), name='submit-attendance'),
    path('employees/', EmployeeListCreateView.as_view(), name='employee-list'),
    path('employees/<int:pk>/', EmployeeRetrieveUpdateDestroyView.as_view(), name='employee-detail'),
    path('attendance-report/', AttendanceReportPDFView.as_view(), name='attendance-report'),
    path('attendance-logs/', AttendanceLogsJSONView.as_view(), name='attendance-logs'),
    path('attendance-employee-pdf/', AttendanceEmployeePDFView.as_view(), name='attendance-employee-pdf'),
]
