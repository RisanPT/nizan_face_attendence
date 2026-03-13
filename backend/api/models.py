from django.db import models
import face_recognition
import numpy as np
import json

class Employee(models.Model):
    name = models.CharField(max_length=100)
    employee_id = models.CharField(max_length=50, unique=True)
    profile_picture = models.ImageField(upload_to='employees/')
    face_encoding = models.TextField(blank=True, null=True) # Storing numpy array as list -> json string

    def save(self, *args, **kwargs):
        # Calculate face encoding on save if profile picture is provided
        if self.profile_picture and not self.face_encoding:
            try:
                image = face_recognition.load_image_file(self.profile_picture)
                encodings = face_recognition.face_encodings(image)
                if encodings:
                    self.face_encoding = json.dumps(encodings[0].tolist())
            except Exception as e:
                print(f"Error processing face encoding: {e}")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.employee_id})"

class AttendanceWindow(models.Model):
    class_name = models.CharField(max_length=100)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    latitude = models.FloatField()
    longitude = models.FloatField()
    radius_meters = models.FloatField(default=100.0)

    def __str__(self):
        return f"{self.class_name} ({self.start_time} - {self.end_time})"

class AttendanceLog(models.Model):
    STATUS_CHOICES = (
        ('PRESENT', 'Present'),
        ('CHECKOUT', 'Checked Out'),
        ('FAILED', 'Failed'),
    )
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE)
    window = models.ForeignKey(AttendanceWindow, on_delete=models.SET_NULL, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    failure_reason = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.employee.name} - {self.status} at {self.timestamp}"
