from django.contrib import admin
from .models import UserMemory


@admin.register(UserMemory)
class UserMemoryAdmin(admin.ModelAdmin):
    list_display = ("id", "user_identifier", "memory_type", "key", "value_preview", "updated_at")
    list_filter = ("memory_type", "user_identifier")
    search_fields = ("key", "value", "user_identifier")
    ordering = ("-updated_at",)

    def value_preview(self, obj):
        return obj.value[:50] + ("..." if len(obj.value) > 50 else "")
    value_preview.short_description = "Value"
