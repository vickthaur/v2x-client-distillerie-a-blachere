import json, sys, time, requests, re
from bs4 import BeautifulSoup
known = set(int(k) for k in json.load(open(sys.argv[1]))["products"])
S = requests.Session(); S.headers["User-Agent"]="Mozilla/5.0 (compatible; V2X-Studio-maquette/1.0)"
S.cookies.set("cookiesagevalide","1",domain="www.distillerieablachere.com",path="/"); S.cookies.set("paysvalide","8",domain="www.distillerieablachere.com",path="/")
found=[]
for i in range(1,181):
    if i in known: continue
    for a in range(5):
        time.sleep(1.3)
        try: r=S.get(f"https://www.distillerieablachere.com/fr/boutique//x_{i}",timeout=40); break
        except requests.RequestException: time.sleep(3); r=None
    if r is None: print(i,"ERR",flush=True); continue
    ok = r.url.rstrip("/").endswith(f"_{i}") and 'id="product_total"' in r.text
    h = re.search(r'<h1 class="bold"><span>([^<]*)', r.text)
    print(i, r.status_code, r.url, h.group(1) if h else "", "FOUND" if ok else "", flush=True)
    if ok: found.append(i)
print("FOUND", found)
