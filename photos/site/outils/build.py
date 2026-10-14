"""Assemble photos/site/: named image files, manifest.json, catalogue-site.json, pages/*.md."""
import json, os, re, shutil, sys, unicodedata
from urllib.parse import urlsplit, unquote
from PIL import Image

EX, STORE, CRAWL, DEST = sys.argv[1:5]
raw = json.load(open(f"{EX}/products_raw.json"))
refs = json.load(open(f"{EX}/image_refs.json")) + json.load(open(f"{EX}/css_refs.json"))
texts = json.load(open(f"{EX}/page_texts.json"))
state = json.load(open(f"{STORE}/state.json"))
SIZE = re.compile(r"_(XS|S|M|L|XL)(\.[A-Za-z0-9]+)$")

def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower() or "x"

def key_of(u):
    p = urlsplit(u)
    host = p.netloc.lower()
    if host.endswith("infomaniak.website"): host = "www.distillerieablachere.com"
    if not re.search(r"(^|\.)distillerieablachere\.com$", host): return "EXTERNAL" + u
    return host + SIZE.sub(r"\2", unquote(p.path))

products = {int(k): v for k, v in raw["products"].items()}
pname = {pid: v["fr"]["nom"] for pid, v in products.items() if "fr" in v}
pslug = {pid: slugify(re.sub(r"[®«»\"“”]", "", n)) for pid, n in pname.items()}
fr_url = {pid: v["fr"]["url"] for pid, v in products.items() if "fr" in v}

# gather per-image info in first-seen order
info = {}
order = []
def page_rank(p):  # most specific page first: product page of the image, then others
    return 0
for r in refs:
    k = key_of(r["url"])
    if k not in info:
        info[k] = {"pages": [], "alts": [], "refs": []}
        order.append(k)
    i = info[k]
    if r["page"] not in i["pages"]: i["pages"].append(r["page"])
    if r["alt"] and r["alt"] not in i["alts"]: i["alts"].append(r["alt"])

def is_product_page(u):
    return re.search(r"/boutique/.*_(\d+)$", urlsplit(u).path)

def product_of_page(u):
    m = is_product_page(u)
    return int(m.group(1)) if m else None

# image order on each product's own page
prod_imgs = {}
for r in refs:
    pid = product_of_page(r["page"])
    m = re.search(r"/uploads/shops/products/(\d+)/", r["url"])
    if m and pid == int(m.group(1)) and "/fr/" in r["page"]:
        k = key_of(r["url"])
        lst = prod_imgs.setdefault(pid, [])
        if k not in lst: lst.append(k)

OVERRIDES = {  # checked visually: images inlined in the Histoire page
    "8631b1a97ad292949fa17e63ec99acfb": ("autre", "autres/histoire", "histoire-vers-manuscrits-mistral"),
    "1be125206184e87ce28100719ad82be7": ("affiche", "affiches", "affiche-ancienne-la-magistrale"),
    "1646c29ab77f361523170f9bb756fbdb": ("affiche", "affiches", "etiquette-ancienne-pac-citron"),
    "50887482830c1b1bc6e397d507205d7c": ("lieu", "lieux", "stand-exposition-palais-des-papes-archive"),
    "7d8f4f212929f583719db42298473785": ("affiche", "affiches", "etiquette-ancienne-mauresque-le-camarguais"),
    "e4656abeb86e5897947b317de5a319b9": ("lieu", "lieux", "boutique-de-la-distillerie"),
}
def classify(k, i):
    for h, (t, f, b) in OVERRIDES.items():
        if h in k: return t, f, b, None
    path = k.split("/", 1)[1] if "/" in k else k
    path = "/" + path
    fname = os.path.basename(path)
    m = re.search(r"/uploads/shops/products/(\d+)/", path)
    if m:
        pid = int(m.group(1))
        return "produit", "produits", pslug.get(pid, f"produit-{pid}"), pname.get(pid)
    if re.search(r"/(logo|favicon|icon-)", path) or "logo" in fname:
        return "logo", "logos", slugify(re.sub(r"_[0-9a-f]{32}$", "", os.path.splitext(fname)[0])), None
    if "/uploads/advertisings/" in path:
        alt = (i["alts"] or ["affiche"])[0]
        return "bandeau", "bandeaux", "bandeau-" + slugify(alt), None
    if re.search(r"/uploads/pages/\d+/", path):
        alt = (i["alts"] or ["page"])[0]
        return "bandeau", "bandeaux", "bandeau-" + slugify(alt), None
    if "/uploads/pages/" in path:
        # images embedded in CMS text: product stories ("Le saviez-vous ?") or Histoire page
        pids = [product_of_page(p) for p in i["pages"] if product_of_page(p)]
        if pids:
            pid = pids[0]
            return "autre", "autres/fiches-produits", pslug.get(pid, f"produit-{pid}") + "-illustration", pname.get(pid)
        art = [p for p in i["pages"] if "/actualites/" in p]
        if art:
            nm = re.sub(r"(\?page=2)?_\d+$", "", urlsplit(art[0]).path.rstrip("/").split("/")[-1])
            return "autre", "autres/presse", "presse-" + slugify(nm), None
        pg = slugify(urlsplit(i["pages"][0]).path.strip("/").split("/")[-1] or "accueil")
        return "lieu" if "histo" in pg else "autre", "lieux" if "histo" in pg else "autres", pg, None
    if "/uploads/recettes/" in path:
        rp = [p for p in i["pages"] if re.search(r"/recettes/\d+/", p)]
        nm = urlsplit(rp[0]).path.rstrip("/").split("/")[-1] if rp else (i["alts"] or ["recette"])[0]
        return "autre", "autres/recettes", "recette-" + slugify(nm), None
    if "/uploads/blogs/" in path:
        nm = re.sub(r"_distillerie_blachere_\d+$", "", os.path.splitext(fname)[0])
        return "autre", "autres/presse", "presse-" + slugify(nm), None
    if "/flags/" in path:
        return "autre", "autres/drapeaux", "drapeau-" + slugify(os.path.splitext(fname)[0]), None
    if "/uploads/atouts/" in path:
        return "autre", "autres/pictos", "picto-atout", None
    if "/themes/public/img/" in path and not "/flags/" in path:
        return "autre", "autres/textures-theme", slugify(os.path.splitext(fname)[0]), None
    if "img_seo" in fname:
        return "autre", "autres", "image-partage-reseaux", None
    return "autre", "autres", slugify(os.path.splitext(fname)[0]), None

def dims(fp):
    if fp.endswith(".svg"):
        t = open(fp, encoding="utf-8", errors="ignore").read(4000)
        w = re.search(r'<svg[^>]*\swidth="([\d.]+)(px)?"', t); h = re.search(r'<svg[^>]*\sheight="([\d.]+)(px)?"', t)
        if w and h: return round(float(w.group(1))), round(float(h.group(1)))
        vb = re.search(r'viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"', t)
        if vb: return round(float(vb.group(1))), round(float(vb.group(2)))
        return None, None
    try:
        with Image.open(fp) as im: return im.size
    except Exception:
        return None, None

if os.path.exists(DEST):
    for sub in ("produits", "lieux", "bandeaux", "logos", "autres", "affiches"):
        shutil.rmtree(f"{DEST}/{sub}", ignore_errors=True)
os.makedirs(DEST, exist_ok=True)

used = {}
manifest, missing = [], []
file_of = {}
# products first, in their page order, so numbering follows the product gallery
ordered = []
for pid in sorted(prod_imgs):
    ordered += [k for k in prod_imgs[pid] if k not in ordered]
ordered += [k for k in order if k not in ordered]
for k in ordered:
    st = state.get(k)
    i = info[k]
    if not st or not st.get("file"):
        missing.append({"image": k, "pages": i["pages"][:3], "raison": (st or {}).get("status", "non téléchargée"),
                        "essais": (st or {}).get("tried", [])})
        continue
    typ, folder, base, prod = classify(k, i)
    ext = os.path.splitext(st["file"])[1]
    if ext == ".jpeg": ext = ".jpg"
    n = used.get((folder, base), 0) + 1
    used[(folder, base)] = n
    rel = f"{folder}/{base}-{n}{ext}"
    os.makedirs(f"{DEST}/{folder}", exist_ok=True)
    shutil.copyfile(f"{STORE}/{st['file']}", f"{DEST}/{rel}")
    w, h = dims(f"{DEST}/{rel}")
    pages = i["pages"]
    if typ == "produit":
        m = re.search(r"/uploads/shops/products/(\d+)/", k)
        own = [p for p in pages if product_of_page(p) == int(m.group(1)) and "/fr/" in p]
        page_src = own[0] if own else pages[0]
    else:
        page_src = sorted(pages, key=lambda p: ("/fr/" not in p, len(p)))[0]
    manifest.append({"fichier": rel, "url_source": st["url"], "page_source": page_src, "alt": i["alts"][0] if i["alts"] else "",
                     "produit": prod, "largeur": w, "hauteur": h, "type": typ, "octets": st["bytes"],
                     "autres_pages": len(pages) - 1})
    file_of[k] = rel
json.dump(manifest, open(f"{DEST}/manifest.json", "w"), ensure_ascii=False, indent=2)

# ---------- catalogue ----------
def parse_opt(o):
    m = re.match(r"\s*([\d\s.,]+€)\s*/\s*(.+)$", o)
    return {"volume": m.group(2).strip(), "prix_ttc": m.group(1).strip()} if m else {"volume": o, "prix_ttc": None}

cat = []
for pid in sorted(products):
    v = products[pid]
    f, e = v.get("fr"), v.get("en", {})
    if not f: continue
    fa = f.get("fil_ariane", [])
    fa = fa[1:] if fa and fa[0] == "Produits" else fa
    cont = [parse_opt(o) for o in f["options_formulaire"]] if f.get("options_formulaire") else f.get("contenances", [])
    sec = dict(f["sections"])
    desc = sec.pop("Description", "")
    ingr = sec.pop("Ingrédients", None)
    imgs = [file_of[k] for k in prod_imgs.get(pid, []) if k in file_of]
    imgs += [m["fichier"] for m in manifest if m["produit"] == pname.get(pid) and m["fichier"] not in imgs]
    cat.append({
        "id_site": pid, "nom": f["nom"], "categorie": fa[0] if fa else None,
        "gamme": " > ".join(fa[1:]) if len(fa) > 1 else None,
        "contenances": cont, "degre": f.get("degre"), "description": desc, "ingredients": ingr,
        "autres_rubriques": sec, "reference": f.get("sku"), "url": f["url"],
        "url_en": e.get("url"), "nom_en": e.get("nom"), "images": imgs})
json.dump(cat, open(f"{DEST}/catalogue-site.json", "w"), ensure_ascii=False, indent=2)

# ---------- pages ----------
pd = f"{DEST}/pages"
shutil.rmtree(pd, ignore_errors=True)
os.makedirs(pd)
WANT = [
    (r"/fr/histoire$", "histoire"), (r"/en/history$", "en-history"),
    (r"/fr/contact$", "contact-acces"), (r"/en/contact$", "en-contact"),
    (r"/fr/mentions-legales$", "mentions-legales"), (r"/en/terms-of-use$", "en-terms-of-use"),
    (r"/fr/confidentialite$", "confidentialite"), (r"/en/privacy$", "en-privacy"),
    (r"/fr/cgv$", "cgv"), (r"/en/cgv$", "en-cgv"), (r"/fr/boutique/shipping$", "livraison"),
    (r"/fr/avertissement$", "avertissement"), (r"/fr/recettes$", "recettes-index"),
    (r"/fr/actualites$", "on-parle-de-nous-index"), (r"/fr/actualites\?page=2$", "on-parle-de-nous-index-page-2"),
    (r"/fr/$", "accueil"), (r"/en/$", "en-home"),
]
written = []
def write_md(name, url, t):
    body = f"# {t['title']}\n\nSource : {url}\n\n---\n\n{t['text']}\n"
    open(f"{pd}/{name}.md", "w").write(body)
    written.append(f"pages/{name}.md")
for pat, name in WANT:
    for u, t in texts.items():
        if re.search(pat, u): write_md(name, u, t); break
for u, t in sorted(texts.items()):
    m = re.search(r"/fr/recettes/(\d+)/([^/?]+)$", u)
    if m:
        os.makedirs(f"{pd}/recettes", exist_ok=True)
        write_md(f"recettes/{m.group(1)}-{m.group(2)}", u, t)
    m = re.search(r"/fr/actualites/([^/]+)/([^/?]+?)(\?page=2)?_(\d+)$", u)
    if m:
        os.makedirs(f"{pd}/on-parle-de-nous", exist_ok=True)
        write_md(f"on-parle-de-nous/{m.group(1)}-{m.group(2)}", u, t)
# shop opening hours (header modal, removed from page text)
hor = json.load(open(f"{EX}/horaires.json")) if os.path.exists(f"{EX}/horaires.json") else None
if hor:
    open(f"{pd}/horaires-boutique.md", "w").write(f"# Horaires boutique\n\nSource : {hor['url']} (fenêtre « Horaires boutique » de l’en-tête)\n\n---\n\n{hor['text']}\n")
    written.append("pages/horaires-boutique.md")
json.dump({"missing": missing, "pages_md": written}, open(f"{EX}/build_report.json", "w"), ensure_ascii=False, indent=1)
from collections import Counter
print("images", len(manifest), Counter(m["type"] for m in manifest), "missing", len(missing), "products", len(cat), "pages", len(written))
