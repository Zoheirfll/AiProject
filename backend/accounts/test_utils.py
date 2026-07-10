from django.contrib.auth import get_user_model


def make_user(role="DRH", username="test_user"):
    """Create a test user with the given role — for force_authenticate() in API tests."""
    User = get_user_model()
    return User.objects.create_user(
        username=username, email=f"{username}@test.local", password="testpass123", role=role
    )
