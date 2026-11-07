"""Who may change where your data goes.

Changing the destination or the token needs proof that you control the server: a six-digit code the server writes
only to its own log (`docker compose logs`). A correct code is traded for a short ticket that the settings screen
sends with the setup calls. With ROADKIT_TOKEN on, the API token already proves that and no pairing is needed.
"""
import hmac
import secrets
import threading
import time

CODE_TTL = 600            # a code is good for 10 minutes...
CODE_TRIES = 5            # ...and 5 wrong guesses
CODE_GAP = 30             # at most one new code every 30 seconds
TICKET_TTL = 900          # a ticket keeps the setup screen unlocked for 15 minutes


class Pairing:
    def __init__(self, out=print, clock=time.monotonic):
        self.out, self.clock = out, clock
        self._lock = threading.Lock()
        self._code = None
        self._tickets = {}
        self._last_new = None

    def new_code(self):
        """Writes a fresh code to the server log. False when asked again too soon."""
        with self._lock:
            now = self.clock()
            if self._last_new is not None and now - self._last_new < CODE_GAP:
                return False
            code = f"{secrets.randbelow(1_000_000):06d}"
            self._code = {"code": code, "until": now + CODE_TTL, "tries": 0}
            self._last_new = now
        self.out(f"roadkit: sync pairing code {code} (valid for 10 minutes, one use)", flush=True)
        return True

    def unlock(self, code):
        """A ticket for a correct, fresh code; None otherwise. The code is spent either way after CODE_TRIES."""
        with self._lock:
            c, now = self._code, self.clock()
            if not c or now > c["until"] or not isinstance(code, str):
                return None
            if not hmac.compare_digest(code.strip().encode(), c["code"].encode()):
                c["tries"] += 1
                if c["tries"] >= CODE_TRIES:
                    self._code = None
                return None
            self._code = None
            ticket = secrets.token_urlsafe(32)
            self._tickets = {t: until for t, until in self._tickets.items() if until > now}
            self._tickets[ticket] = now + TICKET_TTL
            return ticket, TICKET_TTL

    def allowed(self, ticket):
        with self._lock:
            if not isinstance(ticket, str) or not ticket:
                return False
            now = self.clock()
            for t, until in list(self._tickets.items()):
                if until <= now:
                    del self._tickets[t]
                elif hmac.compare_digest(t.encode(), ticket.encode()):
                    return True
            return False

    def forget(self):
        with self._lock:
            self._code, self._tickets = None, {}
