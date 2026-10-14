"""Parse crawled pages: product catalogue, image references (with alt/page), page texts."""
import json, re, sys, unicodedata
from urllib.parse import urljoin, urlsplit, unquote
from bs4 import BeautifulSoup, NavigableString

CRAWL, OUT = sys.argv[1], sys.argv[2]
index = json.load(open(f"{CRAWL}/index.json"))
HOST = "www.distillerieablachere.com"

def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "x"

def soup_of(meta):
    return BeautifulSoup(open(f"{CRAWL}/html/{meta['file']}", "rb"), "html.parser")

PROD_RE = re.compile(r"/(fr|en)/boutique/(?!categories/|cart|shipping)(?:[^/]*/)?(?:[^/?]*_(\d+)$|(\d+)/[^/]*$)")
def prod_id(url):
    m = PROD_RE.search(urlsplit(url).path)
    if not m: return None, None
    return m.group(1), int(m.group(2) or m.group(3))

def text_block(el):
    """Readable text of an HTML block: one line per block element, inline text joined."""
    if el is None: return ""
    el = BeautifulSoup(str(el), "html.parser")
    for t in el(["script", "style", "svg", "noscript"]): t.decompose()
    for br in el.find_all("br"): br.replace_with("\n")
    for li in el.find_all("li"): li.insert(0, "- ")
    for b in el.find_all(["p", "div", "li", "h1", "h2", "h3", "h4", "h5", "ul", "ol", "tr"]):
        b.insert_after("\n")
    txt = el.get_text("")
    lines = [re.sub(r"[ \t ]+", " ", l).strip() for l in txt.split("\n")]
    out, blank = [], False
    for l in lines:
        if l in ("", "-"):
            if out and not blank: out.append(""); blank = True
        else:
            out.append(l); blank = False
    return "\n".join(out).strip()

# ---------- pages: collect html pages actually fetched (dedupe on final url) ----------
pages = {}
for url, meta in index.items():
    if not meta.get("file"): continue
    final = meta.get("final", url)
    key = unquote(final)
    if key not in pages: pages[key] = (url, meta)

# ---------- products ----------
products = {}  # id -> {fr:..., en:...}
for key, (url, meta) in pages.items():
    lang, pid = prod_id(key.split("?")[0])
    if pid is None: continue
    s = soup_of(meta)
    h1 = s.select_one("h1.bold span") or s.select_one("h1.bold")
    if not h1: continue
    d = {"url": key.split("?")[0], "nom": h1.get_text(" ", strip=True)}
    tot = s.select_one("#product_total")
    if tot:
        blk = tot.find_parent("div")
        bt = blk.get_text(" ", strip=True) if blk else ""
        vol = re.search(r"/\s*(.+)$", bt)
        d["contenances"] = [{"volume": vol.group(1).strip() if vol else None, "prix_ttc": tot.get_text(strip=True)}]
    # variant selector, if any
    opts = []
    for sel in s.select("form select"):
        if sel.get("name", "").startswith("countries"): continue
        for o in sel.find_all("option"):
            t = o.get_text(" ", strip=True)
            if t and not t.startswith("---"): opts.append(t)
    if opts: d["options_formulaire"] = opts
    sections = {}
    for li in s.select("ul.md-accordion > li"):
        title = li.select_one(".description_title")
        title = title.get_text(" ", strip=True) if title else li.get("id")
        content = li.select_one(".content")
        if li.get("id") == "description" and content:
            mains = content.select(".desc_main")
            if mains: sections["Description"] = text_block(mains[0])
            for m in mains[1:]:
                lab = m.find("div", class_="bold")
                lt = lab.get_text(" ", strip=True) if lab else "Infos"
                if lab: lab.decompose()
                sections[lt] = text_block(m)
        elif content:
            sections[title] = text_block(content)
    d["sections"] = sections
    for lab in s.select("div.bold.text-uppercase"):
        if lab.get_text(strip=True).lower().startswith(("degré", "alcohol", "degree")):
            nxt = lab.find_next_sibling()
            if nxt: d["degre"] = nxt.get_text(" ", strip=True)
            break
    bc = [a.get_text(" ", strip=True) for a in s.select(".content-breadcrumb a, .breadcrumb a, ol.breadcrumb li")]
    d["fil_ariane"] = [b for b in bc if b]
    ld = s.find("script", type="application/ld+json")
    if ld:
        m = re.search(r'"sku":\s*"([^"]*)"', ld.string or "")
        if m: d["sku"] = m.group(1)
    og = s.find("meta", property="og:description")
    if og: d["meta_description"] = og.get("content", "")
    products.setdefault(pid, {})[lang] = d

# ---------- category membership (listing pages) ----------
cats = {}  # pid -> set of category names (fr)
cat_pages = {}
for key, (url, meta) in pages.items():
    p = urlsplit(key)
    if not p.path.startswith("/fr/boutique"): continue
    if prod_id(p.path)[1] is not None: continue
    s = soup_of(meta)
    m = re.search(r"/categories/(?:(\d+)/[^/]+|[^/]+_(\d+))$", p.path)
    title = None
    h = s.select_one("h1")
    if h: title = h.get_text(" ", strip=True)
    if not m and p.path.rstrip("/") != "/fr/boutique": continue
    cid = int(m.group(1) or m.group(2)) if m else 0
    if "f[]" in p.query: continue
    found = set()
    for a in s.find_all("a", href=True):
        lang, pid = prod_id(urlsplit(urljoin(key, a["href"])).path)
        if pid and lang == "fr": found.add(pid)
    cat_pages[cid] = {"titre": title, "url": key, "produits": sorted(found)}
    for pid in found: cats.setdefault(pid, set()).add(cid)

# category names from the filter menu of the boutique page
catnames = {}
for key, (url, meta) in pages.items():
    if not key.startswith("https://" + HOST + "/fr/boutique"): continue
    s = soup_of(meta)
    for a in s.find_all("a", href=True):
        m = re.search(r"/fr/boutique/categories/(\d+)/", a["href"])
        t = a.get_text(" ", strip=True)
        if m and t: catnames.setdefault(int(m.group(1)), t)
    break_ok = len(catnames) > 10
    if break_ok: break

json.dump({"products": products, "cats": {k: sorted(v) for k, v in cats.items()}, "cat_pages": cat_pages,
           "catnames": catnames}, open(f"{OUT}/products_raw.json", "w"), ensure_ascii=False, indent=1)

# ---------- images ----------
IMG_EXT = re.compile(r"\.(jpe?g|png|webp|gif|svg|avif)$", re.I)
refs = []  # {url, page, alt, ctx}
def add(u, page, alt="", ctx=""):
    if not u: return
    u = u.strip().split(" ")[0]
    if u.startswith("data:"): return
    absu = urljoin(page, u)
    if not IMG_EXT.search(urlsplit(absu).path): return
    refs.append({"url": absu, "page": page, "alt": alt or "", "ctx": ctx})

for key, (url, meta) in pages.items():
    s = soup_of(meta)
    for m in s.find_all("meta"):
        if m.get("property", "").startswith("og:image") or m.get("name") == "twitter:image":
            add(m.get("content"), key, ctx="og")
    for l in s.find_all("link", href=True):
        if "icon" in " ".join(l.get("rel", [])): add(l["href"], key, ctx="icon")
    for img in s.find_all("img"):
        alt = img.get("alt") or img.get("title") or ""
        for att in ("data-source", "src", "data-src", "data-original", "data-lazy"):
            add(img.get(att), key, alt, "img")
        for att in ("srcset", "data-srcset"):
            for part in (img.get(att) or "").split(","): add(part, key, alt, "img")
    for ds in s.find_all(["data-src", "source"]):
        pic = ds.find_parent("picture")
        im = pic.find("img") if pic else None
        alt = (im.get("alt") or im.get("title") or "") if im else ""
        for att in ("data-srcset", "srcset", "src", "data-src"):
            for part in (ds.get(att) or "").split(","): add(part, key, alt, "picture")
    for el in s.find_all(style=True):
        for u in re.findall(r"url\(['\"]?([^'\")]+)", el["style"]): add(u, key, ctx="style")
    raw = open(f"{CRAWL}/html/{meta['file']}", encoding="utf-8", errors="ignore").read()
    for u in re.findall(r"https?://[^\s\"'<>()]+?\.(?:jpe?g|png|webp|gif|svg)", raw, re.I):
        add(u, key, ctx="raw")
json.dump(refs, open(f"{OUT}/image_refs.json", "w"), ensure_ascii=False, indent=0)

# ---------- page texts ----------
texts = {}
for key, (url, meta) in pages.items():
    if prod_id(key.split("?")[0])[1] is not None: continue
    s = soup_of(meta)
    for t in s(["script", "style", "svg", "noscript", "header", "footer", "nav", "form"]): t.decompose()
    for mod in s.select(".modal"): mod.decompose()
    main = s.find("main") or s.body
    texts[key] = {"title": meta.get("title", ""), "text": text_block(main)}
json.dump(texts, open(f"{OUT}/page_texts.json", "w"), ensure_ascii=False, indent=1)
home = "https://" + HOST + "/fr/"
if home in pages:
    s = soup_of(pages[home][1])
    mod = s.select_one("#horaireModal .modal-body") or s.select_one("#horaireModal")
    if mod:
        json.dump({"url": home, "text": text_block(mod)}, open(f"{OUT}/horaires.json", "w"), ensure_ascii=False)
print("pages", len(pages), "products", len(products), "refs", len(refs), "cats", len(cat_pages))
