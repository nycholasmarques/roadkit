"""How two copies of a file that both changed since the last sync become one.

Every rule is deterministic and symmetric: two devices merging the same three versions get the same bytes, so
they agree on the result without talking to each other.
"""
from .layout import canonical_json


def _newer(a, b):
    """The copy with the larger updatedAt; on a tie, the one with the larger bytes (any fixed rule works, it just
    has to be the same on every device)."""
    ta, tb = a.get("updatedAt", 0), b.get("updatedAt", 0)
    if ta != tb:
        return (a, b) if ta > tb else (b, a)
    return (a, b) if canonical_json(a) >= canonical_json(b) else (b, a)


def merge_state(base, local, remote):
    """Progress: the newer copy wins, as the server does with the browser (409). Parts of the progress that only
    the older copy has (a newer client stored more) stay, like in state_put."""
    win, lose = _newer(local, remote)
    kept = lose.get("state", {}) if isinstance(lose.get("state"), dict) else {}
    return {"updatedAt": win["updatedAt"], "state": {**kept, "nodes": {}, "tasks": {}, **win["state"]}}


def merge_newer(base, local, remote):
    """Notes and the spaced review: the newer copy wins, whole."""
    return _newer(local, remote)[0]


def _count(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else 0


def _sum3(b, l, r, first):
    """A counter both sides moved: what each side added, on top of the base. Without a base (the first sync),
    the larger value, since both copies may share the same history and adding would count it twice."""
    if first:
        return max(_count(l), _count(r))
    return max(0, _count(b) + (_count(l) - _count(b)) + (_count(r) - _count(b)))


def _totals3(b, l, r, first):
    out = {}
    for period in set(l) | set(r) | set(b):
        bp, lp, rp = b.get(period, {}), l.get(period, {}), r.get(period, {})
        merged = {}
        for k in set(bp) | set(lp) | set(rp):
            n = _sum3(bp.get(k), lp.get(k), rp.get(k), first)
            if n:
                merged[k] = n
        if merged:
            out[period] = merged
    return out


_MISSING = object()
_TOPIC_BOTH = {"touched": max, "finished": max, "started": min}


def _topic3(b, l, r, first):
    out = {}
    for k in set(b) | set(l) | set(r):
        bv, lv, rv = b.get(k, _MISSING), l.get(k, _MISSING), r.get(k, _MISSING)
        if k in ("focus", "sessions"):
            n = _sum3(None if bv is _MISSING else bv, None if lv is _MISSING else lv,
                      None if rv is _MISSING else rv, first)
            if n:
                out[k] = n
            continue
        if lv == rv:
            v = lv
        elif not first and lv == bv:
            v = rv
        elif not first and rv == bv:
            v = lv
        elif lv is _MISSING or rv is _MISSING:      # cleared on one side ("to do" again), set on the other
            v = rv if lv is _MISSING else lv
        else:
            pick = _TOPIC_BOTH.get(k, max)
            try:
                v = pick(lv, rv)
            except TypeError:
                v = lv
        if v is not _MISSING:
            out[k] = v
    return out


def merge_activity(base, local, remote, compact=None, today=None):
    """Activity: the counters of each day and month add what each side did since the last sync (an hour of focus at
    home and one at work, the same day, make two). Per topic: last touched and finished take the latest, started
    the earliest, focus and sessions add up."""
    first = base is None
    base = base or {}
    part = lambda d, k: d.get(k, {}) if isinstance(d.get(k), dict) else {}
    out = {"v": 1,
           "days": _totals3(part(base, "days"), part(local, "days"), part(remote, "days"), first),
           "months": _totals3(part(base, "months"), part(local, "months"), part(remote, "months"), first),
           "topics": {}}
    bt, lt, rt = part(base, "topics"), part(local, "topics"), part(remote, "topics")
    for key in set(bt) | set(lt) | set(rt):
        t = _topic3(bt.get(key, {}), lt.get(key, {}), rt.get(key, {}), first)
        if t:
            out["topics"][key] = t
    if compact and today and out["days"]:
        compact(out, today)
    return out


def merge_hidden(base, local, remote):
    """Hidden roadmaps: a set. An id hidden on either side is hidden; one shown again on either side is shown."""
    b, l, r = set(base or []), set(local), set(remote)
    return sorted((b & l & r) | (l - b) | (r - b))


def merge(kind, base, local, remote, compact=None, today=None):
    """The merged object for a file both sides changed, and whether it is a conflict that keeps the local copy
    (roadmaps made in the interface: merging their content is not worth it)."""
    if kind == "state":
        return merge_state(base, local, remote), False
    if kind in ("notes", "review"):
        return merge_newer(base, local, remote), False
    if kind == "activity":
        return merge_activity(base, local, remote, compact, today), False
    if kind == "hidden":
        return merge_hidden(base, local, remote), False
    return local, True                               # roadmap, section
