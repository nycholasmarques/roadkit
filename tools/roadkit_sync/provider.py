"""What a sync destination has to do. The engine only talks to this interface, so a new destination
(Google Drive, GitLab...) is a new class here and nothing else changes."""
from dataclasses import dataclass, field


@dataclass
class Remote:
    """What is in the synced folder now: a revision (None for an empty destination) and the hash of each file,
    with paths relative to the folder."""
    rev: str | None
    files: dict = field(default_factory=dict)


class Provider:
    name = "base"

    def check(self):
        """Who the token belongs to, whether the destination exists, can be written and is private, and when the
        token expires. Returns a dict; raises AuthError / NoAccess when it cannot be used."""
        raise NotImplementedError

    def read(self):
        """The current Remote. Contents are fetched separately, only for the files that changed."""
        raise NotImplementedError

    def fetch(self, path, sha):
        """The bytes of one file of the last read()."""
        raise NotImplementedError

    def write(self, rev, changes, message):
        """Writes every change at once ({path: bytes, or None to delete}) on top of `rev` and returns the new
        revision. Raises Conflict when the destination is no longer at `rev`."""
        raise NotImplementedError


PROVIDERS = {}


def register(cls):
    PROVIDERS[cls.name] = cls
    return cls
