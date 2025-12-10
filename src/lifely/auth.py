"""Google Calendar OAuth authentication.

Handles the OAuth 2.0 flow for desktop applications to access
the Google Calendar API with read-only permissions.

Usage:
    service = get_calendar_service()
    events = service.events().list(calendarId='primary').execute()
"""

from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import Resource, build

# Read-only access to calendar events
SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

# Default paths relative to project root
DEFAULT_CREDENTIALS_PATH = Path("credentials/credentials.json")
DEFAULT_TOKEN_PATH = Path("credentials/token.json")


def get_calendar_service(
    credentials_path: Path = DEFAULT_CREDENTIALS_PATH,
    token_path: Path = DEFAULT_TOKEN_PATH,
) -> Resource:
    """Get an authenticated Google Calendar API service.

    On first run, opens a browser for OAuth consent. Subsequent runs use
    the cached token (refreshing if expired).

    Args:
        credentials_path: Path to OAuth client credentials JSON (from GCP console).
        token_path: Path to store/load the user's access token.

    Returns:
        Authenticated Google Calendar API service resource.

    Raises:
        FileNotFoundError: If credentials_path doesn't exist.
    """
    creds: Credentials | None = None

    # Load existing token if available
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    # Refresh or create new credentials
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not credentials_path.exists():
                raise FileNotFoundError(
                    f"OAuth credentials not found at {credentials_path}. "
                    "Download from Google Cloud Console and place in credentials/ directory."
                )
            flow = InstalledAppFlow.from_client_secrets_file(str(credentials_path), SCOPES)
            creds = flow.run_local_server(port=0)

        # Save token for future runs
        token_path.parent.mkdir(parents=True, exist_ok=True)
        with open(token_path, "w") as token_file:
            token_file.write(creds.to_json())

    return build("calendar", "v3", credentials=creds)


def get_user_email(service: Resource) -> str:
    """Get the authenticated user's email address.

    Args:
        service: Authenticated Calendar API service.

    Returns:
        The user's primary email address.
    """
    calendar = service.calendarList().get(calendarId="primary").execute()
    return calendar["id"]
