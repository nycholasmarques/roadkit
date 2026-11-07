"""Everything that can stop a sync, from the network or from the data. Messages never carry a secret."""


class SyncError(Exception):
    """Base class. `pause` says whether automatic sync must stop until you act (and not just try again later)."""
    pause = False
    code = "error"


class Conflict(SyncError):
    """The remote moved between reading and writing (another device synced): read again and merge again."""
    code = "conflict"


class Stale(SyncError):
    """A local file changed while the sync ran (you marked a topic meanwhile): read again and merge again."""
    code = "stale"


class Busy(SyncError):
    """Gave up after a few rounds of Conflict / Stale."""
    code = "busy"


class NeedsChoice(SyncError):
    """First sync with data on both sides: you choose merge, keep the remote or keep this device."""
    pause = True
    code = "needs_choice"


class RemoteFormat(SyncError):
    """The folder was written by a newer Roadkit."""
    pause = True
    code = "remote_format"


class TooLarge(SyncError):
    """The folder or a response is over the limits."""
    pause = True
    code = "too_large"


class AuthError(SyncError):
    """The token is missing, wrong, expired or revoked."""
    pause = True
    code = "auth"


class NoAccess(SyncError):
    """The token works but cannot see or write the repository (or the branch does not exist)."""
    pause = True
    code = "no_access"


class PublicRepo(SyncError):
    """The repository is public and that was not confirmed for it."""
    pause = True
    code = "public"


class RateLimited(SyncError):
    """The provider asked to wait; retry_at is a unix time in seconds."""
    code = "rate_limited"

    def __init__(self, message, retry_at=None):
        super().__init__(message)
        self.retry_at = retry_at


class Network(SyncError):
    """No connection, a timeout, a refused redirect or an unexpected answer: try again later."""
    code = "network"
