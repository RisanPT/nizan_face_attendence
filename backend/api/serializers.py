from rest_framework import serializers
from .models import Employee, AttendanceWindow, AttendanceLog

class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = ['id', 'name', 'employee_id', 'profile_picture']

class AttendanceWindowSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceWindow
        fields = '__all__'

class AttendanceLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceLog
        fields = '__all__'
