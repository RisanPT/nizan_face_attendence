from django.contrib import admin
from .models import Employee, AttendanceWindow, AttendanceLog

@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('name', 'employee_id')
    search_fields = ('name', 'employee_id')

@admin.register(AttendanceWindow)
class AttendanceWindowAdmin(admin.ModelAdmin):
    list_display = ('class_name', 'start_time', 'end_time', 'radius_meters')
    list_filter = ('class_name',)

@admin.register(AttendanceLog)
class AttendanceLogAdmin(admin.ModelAdmin):
    list_display = ('employee', 'window', 'status', 'timestamp')
    list_filter = ('status', 'window', 'timestamp')
    search_fields = ('employee__name', 'employee__employee_id')
