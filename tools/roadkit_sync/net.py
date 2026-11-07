"""The only way the sync talks to the network: a small HTTPS client that does as little as possible.

- HTTPS only, certificate always verified (there is no switch to turn that off).
- Never follows a redirect: any 3xx is an error, so an answer can never send the token somewhere else.
- A timeout on every request and a cap on how much of an answer is read.
- The token only goes in the Authorization header, and no error message ever carries it.
- The base address is fixed by the provider; it is a constructor argument only so tests can run a local fake.
"""
import json
import socket
import ssl
import urllib.error
import urllib.request

from .errors import Network, TooLarge

TIMEOUT = 15
MAX_RESPONSE = 5 * 1024 * 1024


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise Network(f"the server answered with a redirect ({code}); redirects are never followed")


class Response:
    def __init__(self, status, headers, body):
        self.status, self.headers, self.body = status, headers, body

    def header(self, name):
        return self.headers.get(name) if self.headers else None

    def json(self):
        try:
            return json.loads(self.body.decode("utf-8")) if self.body else None
        except (UnicodeDecodeError, ValueError):
            raise Network("the server sent an answer that is not JSON")


class SafeClient:
    def __init__(self, token, base, user_agent="roadkit", ssl_context=None, timeout=TIMEOUT, max_bytes=MAX_RESPONSE,
                 extra_headers=None):
        if not isinstance(base, str) or not base.startswith("https://"):
            raise ValueError("the sync only talks over https")
        self.base = base.rstrip("/")
        self._token = token or ""
        self.timeout, self.max_bytes = timeout, max_bytes
        self.headers = {"User-Agent": user_agent, **(extra_headers or {})}
        context = ssl_context or ssl.create_default_context()
        self._opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=context), _NoRedirect())

    def redact(self, text):
        text = str(text)
        return text.replace(self._token, "[token]") if self._token else text

    def _read(self, fp):
        body = fp.read(self.max_bytes + 1) if fp else b""
        if len(body) > self.max_bytes:
            raise TooLarge(f"an answer was larger than {self.max_bytes // 1024 // 1024} MB")
        return body

    def request(self, method, path, body=None, headers=None):
        """Any status comes back as a Response (the caller decides what it means); only a failure to talk at all
        raises Network."""
        if not path.startswith("/") or "://" in path:
            raise ValueError("path must be relative to the base")
        data = None if body is None else json.dumps(body).encode("utf-8")
        req = urllib.request.Request(self.base + path, data=data, method=method)
        for k, v in {**self.headers, **(headers or {})}.items():
            req.add_header(k, v)
        if data is not None:
            req.add_header("Content-Type", "application/json")
        if self._token:
            req.add_header("Authorization", f"Bearer {self._token}")
        try:
            with self._opener.open(req, timeout=self.timeout) as r:
                return Response(r.status, r.headers, self._read(r))
        except urllib.error.HTTPError as e:
            try:
                return Response(e.code, e.headers, self._read(e))
            finally:
                e.close()
        except (Network, TooLarge):
            raise
        except ssl.SSLError as e:
            raise Network(self.redact(f"secure connection failed: {e.reason or e}")) from None
        except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError, OSError) as e:
            reason = getattr(e, "reason", e)
            if isinstance(reason, ssl.SSLError):
                raise Network(self.redact(f"secure connection failed: {reason.reason or reason}")) from None
            raise Network(self.redact(f"could not reach the server: {reason}")) from None
