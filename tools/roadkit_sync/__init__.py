"""Sync the data/ folder with a folder somewhere else (a GitHub repository first).

Standard library only, and independent of roadkit.py: the server hands in its lock, its atomic write and its
validators, so this package can be tested on its own and never imports the server.

    layout     the folder layout, canonical JSON and Git blob hashes
    merge      how two changed copies of a file become one
    store      the local side (data/ and data/_sync/)
    engine     one sync, start to end
    provider   what a destination implements; PROVIDERS lists them
    net        the only way out to the network: a restricted HTTPS client
    github     GitHub, through the Git Data API
"""
from . import github  # noqa: F401  (registers the provider)
from .engine import Result, SyncEngine
from .errors import SyncError
from .provider import PROVIDERS, Provider, Remote
from .store import DataDirStore

__all__ = ["DataDirStore", "PROVIDERS", "Provider", "Remote", "Result", "SyncEngine", "SyncError"]
