"""Polite crawler for www.distillerieablachere.com (pages only, no forms/cart/account)."""
import hashlib, json, os, re, sys, time
from collections import deque
from urllib.parse import urljoin, urlsplit, urlunsplit
import requests
from bs4 import BeautifulSoup

OUT = sys.argv[1]
EXTRA = sys.argv[2:]  # extra seed URLs
os.makedirs(f"{OUT}/html", exist_ok=True)
BASE = "https://www.distillerieablachere.com"
DELAY = 1.5
MAX_PAGES = 2000
S = requests.Session()
S.cookies.set("cookiesagevalide","1",domain="www.distillerieablachere.com",path="/")
S.cookies.set("paysvalide","8",domain="www.distillerieablachere.com",path="/")
S.headers["User-Agent"] = "Mozilla/5.0 (compatible; V2X-Studio-maquette/1.0)"

BLOCK = re.compile(r"/(cart|account|favoris|login|logout|register|panier|mon-compte|connexion|inscription|password|checkout|commande|wishlist|affichage/redirect|search|recherche)(/|$|\?)|pdf=1|/assets/|/themes/|/uploads/|\.(css|js|svg|png|jpe?g|webp|gif|pdf|ico|xml|zip)(\?|$)", re.I)

last = [0.0]
def get(url):
    for attempt in range(6):
        wait = DELAY - (time.time() - last[0])
        if wait > 0: time.sleep(wait)
        last[0] = time.time()
        try:
            r = S.get(url, timeout=40, allow_redirects=True)
            return r
        except requests.RequestException as e:
            print("  retry", attempt, url, type(e).__name__, flush=True)
            time.sleep(2 * (attempt + 1))
    return None

def norm(u):
    p = urlsplit(u)
    if p.scheme not in ("http", "https"): return None
    host = p.netloc.lower()
    if not (host == "distillerieablachere.com" or host.endswith(".distillerieablachere.com")): return None
    path, query = p.path, p.query
    if re.match(r"^/pr(/|$)", path): return None  # Provencal duplicate of /fr
    if re.search(r"/boutique/.*_\d+$", path) and "/categories/" not in path: query = ""  # product page: filters are noise
    if query.count("f[]") + query.count("f%5B%5D") > 1: return None
    return urlunsplit(("https", host, path, query, ""))

seeds = [BASE + "/", BASE + "/fr/", BASE + "/en/", BASE + "/fr/avertissement", BASE + "/en/avertissement"] + EXTRA
idx_path = f"{OUT}/index.json"
index = json.load(open(idx_path)) if os.path.exists(idx_path) else {}
seen = set(index)
q = deque()
for s in seeds:
    n = norm(s)
    if n and n not in seen: q.append(n); seen.add(n)
# re-queue links from already-fetched pages
for u, meta in index.items():
    if meta.get("file"):
        for l in meta.get("links", []):
            if l not in seen: q.append(l); seen.add(l)

count = 0
while q and len(index) < MAX_PAGES:
    url = q.popleft()
    r = get(url)
    if r is None:
        index[url] = {"status": "error"}; continue
    final = norm(r.url) or r.url
    ct = r.headers.get("content-type", "")
    meta = {"status": r.status_code, "final": final, "ct": ct}
    if "html" in ct and r.status_code == 200:
        fn = hashlib.md5(url.encode()).hexdigest()[:16] + ".html"
        open(f"{OUT}/html/{fn}", "wb").write(r.content)
        meta["file"] = fn
        soup = BeautifulSoup(r.content, "html.parser")
        meta["title"] = soup.title.get_text(strip=True) if soup.title else ""
        links = []
        for a in soup.find_all("a", href=True):
            h = a["href"].strip()
            if h.startswith(("mailto:", "javascript:", "tel:", "#")): continue
            n = norm(urljoin(final, h))
            if not n or BLOCK.search(n): continue
            links.append(n)
            if n not in seen: seen.add(n); q.append(n)
        meta["links"] = sorted(set(links))
    index[url] = meta
    count += 1
    print(len(index), r.status_code, url, "->", final if final != url else "", flush=True)
    if count % 20 == 0: json.dump(index, open(idx_path, "w"), indent=1, ensure_ascii=False)
json.dump(index, open(idx_path, "w"), indent=1, ensure_ascii=False)
print("DONE pages", len(index), "queue left", len(q))
