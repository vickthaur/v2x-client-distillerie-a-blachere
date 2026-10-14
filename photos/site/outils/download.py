"""Download every referenced image once, at the best available size, without recompression."""
import hashlib, json, os, re, sys, time
from urllib.parse import urlsplit, urlunsplit, quote, unquote
import requests

REFS, STORE = sys.argv[1], sys.argv[2]
os.makedirs(STORE, exist_ok=True)
refs = json.load(open(REFS))
HOST_OK = re.compile(r"(^|\.)distillerieablachere\.com$")
SIZE = re.compile(r"_(XS|S|M|L|XL)(\.[A-Za-z0-9]+)$")
DELAY = 1.2
S = requests.Session()
S.headers["User-Agent"] = "Mozilla/5.0 (compatible; V2X-Studio-maquette/1.0)"
S.cookies.set("cookiesagevalide", "1", domain="www.distillerieablachere.com", path="/")
last = [0.0]

def fetch(url):
    for attempt in range(6):
        w = DELAY - (time.time() - last[0])
        if w > 0: time.sleep(w)
        last[0] = time.time()
        try:
            r = S.get(url, timeout=60, allow_redirects=False)
            return r
        except requests.RequestException as e:
            print("  retry", attempt, url, type(e).__name__, flush=True)
            time.sleep(2 * (attempt + 1))
    return None

def canon(u):
    p = urlsplit(u)
    host = p.netloc.lower()
    path = unquote(p.path)
    if host.endswith("infomaniak.website"):  # preview host left in CMS content: same files live on the main domain
        host = "www.distillerieablachere.com"
    if not HOST_OK.search(host): return None
    return host, SIZE.sub(r"\2", path), SIZE.search(path) is not None

state_path = f"{STORE}/state.json"
state = json.load(open(state_path)) if os.path.exists(state_path) else {}
groups = {}
for r in refs:
    c = canon(r["url"])
    if not c:
        groups.setdefault(("EXTERNAL", r["url"]), None); continue
    host, base, sized = c
    g = groups.setdefault((host, base), {"sized": False, "orig": set()})
    g["sized"] |= sized
    g["orig"].add(r["url"])

for (host, base), g in sorted(groups.items(), key=lambda kv: str(kv[0])):
    key = f"{host}{base}"
    if host == "EXTERNAL":
        state.setdefault(key, {"status": "external"}); continue
    if key in state and state[key].get("file"): continue
    root, ext = os.path.splitext(base)
    cands = [base]
    if g["sized"] or "/uploads/" in base:
        cands += [f"{root}_XL{ext}", f"{root}_L{ext}", f"{root}_M{ext}"]
    # keep exact referenced urls as last resort (case differences etc.)
    for o in sorted(g["orig"]):
        pth = unquote(urlsplit(o).path)
        if pth not in cands: cands.append(pth)
    got = None
    tried = []
    for c in cands:
        url = urlunsplit(("https", host, quote(c), "", ""))
        r = fetch(url)
        code = r.status_code if r is not None else "err"
        tried.append([url, code])
        if r is not None and r.status_code == 200 and r.headers.get("content-type", "").startswith("image/") and len(r.content) > 0:
            got = (url, r)
            break
    if got:
        url, r = got
        fn = hashlib.md5(key.encode()).hexdigest()[:16] + (os.path.splitext(c)[1].lower() or ".bin")
        open(f"{STORE}/{fn}", "wb").write(r.content)
        state[key] = {"file": fn, "url": url, "ct": r.headers.get("content-type"), "bytes": len(r.content), "tried": tried}
        print("OK", len(r.content), url, flush=True)
    else:
        state[key] = {"status": "failed", "tried": tried}
        print("FAIL", key, tried, flush=True)
    json.dump(state, open(state_path, "w"), indent=1)
json.dump(state, open(state_path, "w"), indent=1)
print("DONE", sum(1 for v in state.values() if v.get("file")), "files")
