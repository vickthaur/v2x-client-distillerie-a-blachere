// Coque du CRM : barre latérale (ordinateur), barre du haut, barre d'onglets (téléphone),
// notifications, menu de la démo, menu du compte, recherche globale (⌘K).
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './ui/icons.jsx';
import { Avatar, Badge, Button, Notice, cx } from './ui/base.jsx';
import { Dialog, Menu, MenuItem, MenuLabel, MenuSep, Portal, confirmer, toast } from './ui/overlay.jsx';
import { Input } from './ui/form.jsx';
import { Link, estActif, navigate, useLocation } from './lib/router.jsx';
import { useSession, useFilCourant } from './lib/session.jsx';
import { GROUPES, RUBRIQUES, accessible, onglets, rubriqueDe } from './nav.js';
import { ROLES, roleNom } from './lib/droits.js';
import { crm, session as sessionApi } from './lib/data.js';
import { date, dateHeure, nomComplet, plier, pluriel } from './lib/format.js';
import { QrCode } from './ui/qr.jsx';

const PROFILS = ['direction', 'commercial', 'logistique', 'boutique'];
const NOMS_DEMO = { direction: 'Hélène Garnier', commercial: 'Thomas Roux', logistique: 'Karim Benali', boutique: 'Léa Fabre' };

// ---------- Barre latérale ----------
export function Sidebar({ notifs, onRecherche }) {
  const { path } = useLocation();
  const s = useSession();
  return (
    <aside class="side" aria-label="Barre latérale">
      <Link class="side__brand" href="/crm" aria-label="CRM de la Distillerie A. Blachère, tableau de bord">
        <img class="side__logo" src="/logos/logo-blanc.svg" alt="" width="138" height="34" />
        <span class="side__crm">CRM</span>
      </Link>
      <button type="button" class="side__search" onClick={onRecherche} aria-keyshortcuts="Control+K Meta+K">
        <Icon name="recherche" size="s" />
        <span>Rechercher</span>
        <kbd>{/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl'}</kbd>
        <kbd>K</kbd>
      </button>
      <nav class="side__nav" aria-label="Navigation principale">
        {GROUPES.map((g) => {
          const items = g.items.filter((i) => accessible(i, s.peut));
          if (!items.length) return null;
          return (
            <div class="side__group" key={g.id} role="group" aria-labelledby={`grp-${g.id}`}>
              <p class="side__label" id={`grp-${g.id}`}>
                {g.nom}
              </p>
              {items.map((i) => {
                const n = i.notif ? notifs?.[i.notif] : 0;
                return (
                  <Link key={i.id} class="side__link" href={i.href} aria-current={estActif(i.href, path) ? 'page' : undefined}>
                    <Icon name={i.icone} />
                    <span>{i.nom}</span>
                    {n > 0 && <Badge n={n} ton={i.notifTon} label={`${n} à voir`} />}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div class="side__foot">
        <MenuCompte haut>
          {(props) => (
            <button type="button" class="side__me" {...props}>
              <Avatar nom={nomComplet(s.moi)} cle={s.moi.id} />
              <span class="side__me-txt">
                <span class="side__me-name">{nomComplet(s.moi)}</span>
                <span class="side__me-role">{roleNom(s.moi.role)}</span>
              </span>
              <Icon name="points" />
            </button>
          )}
        </MenuCompte>
      </div>
    </aside>
  );
}

// ---------- Barre du haut ----------
export function Topbar({ notifs, onRecherche, marquerVu }) {
  const { path } = useLocation();
  const s = useSession();
  const fil = useFilCourant();
  const r = rubriqueDe(path);
  const [defile, setDefile] = useState(false);
  useEffect(() => {
    const f = () => setDefile(window.scrollY > 4);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  const racine = r.href === path || (r.id === 'tableau' && (path === '/crm' || path === '/crm/tableau'));
  return (
    <header class="top" data-scrolled={defile ? '' : undefined}>
      <Link class="top__brand" href="/crm" aria-label="Tableau de bord">
        <img class="top__blason" src="/logos/logo.svg" alt="" width="30" height="30" />
        <span class="top__crm">CRM</span>
      </Link>
      <nav class="top__crumbs" aria-label="Fil d’Ariane">
        {racine && !fil ? (
          <span aria-current="page">{r.nom}</span>
        ) : (
          <>
            <Link href={r.href}>{r.nom}</Link>
            <Icon name="droite" />
            <span aria-current="page">{fil || '…'}</span>
          </>
        )}
      </nav>
      <div class="top__tools">
        {s.demo?.active && <MenuDemo />}
        <button type="button" class="tool top__search-mob" onClick={onRecherche} aria-label="Rechercher">
          <Icon name="recherche" />
        </button>
        <Cloche notifs={notifs} marquerVu={marquerVu} />
        <MenuCompte>
          {(props) => (
            <button type="button" class="tool top__me" {...props} aria-label={`Compte de ${nomComplet(s.moi)}`}>
              <Avatar nom={nomComplet(s.moi)} cle={s.moi.id} size="s" />
            </button>
          )}
        </MenuCompte>
      </div>
    </header>
  );
}

// ---------- Barre d'onglets (téléphone) ----------
export function TabBar({ notifs }) {
  const { path } = useLocation();
  const s = useSession();
  const items = onglets(s.peut);
  const plusActif = !items.some((i) => estActif(i.href, path));
  return (
    <nav class="tabbar" aria-label="Navigation principale">
      {items.map((i) => {
        const n = i.notif && i.notifTon !== 'mute' ? notifs?.[i.notif] : 0;
        return (
          <Link key={i.id} class="tabbar__link" href={i.href} aria-current={estActif(i.href, path) ? 'page' : undefined}>
            <Icon name={i.icone} />
            <span>{i.court || i.nom}</span>
            {n > 0 && <Badge n={n} label={`${n} à voir`} />}
          </Link>
        );
      })}
      <Link class="tabbar__link" href="/crm/plus" aria-current={plusActif ? 'page' : undefined}>
        <Icon name="menu" />
        <span>Plus</span>
      </Link>
    </nav>
  );
}

// ---------- Notifications ----------
function Cloche({ notifs, marquerVu }) {
  const n = notifs || {};
  const total = (n.commandes || 0) + (n.demandes || 0) + (n.messages || 0);
  const s = useSession();
  const lignes = [
    { cle: 'commandes', icone: 'commandes', ton: 'new', href: '/crm/commandes?statut=nouvelle', txt: (k) => pluriel(k, 'nouvelle commande', 'nouvelles commandes'), vide: 'Aucune nouvelle commande', droit: ['commandes', 'commandes-pro'] },
    { cle: 'demandes', icone: 'briefcase', ton: 'new', href: '/crm/demandes?statut=nouvelle', txt: (k) => pluriel(k, 'demande de compte pro', 'demandes de compte pro'), vide: 'Aucune nouvelle demande pro', droit: ['demandes', 'comptes'] },
    { cle: 'messages', icone: 'message', ton: 'info', href: '/crm/messages?statut=nouveau', txt: (k) => pluriel(k, 'message non lu', 'messages non lus'), vide: 'Aucun message non lu', droit: ['messages'] },
    { cle: 'stocksBas', icone: 'bouteille', ton: 'warn', href: '/crm/produits?stock=bas', txt: (k) => pluriel(k, 'stock bas', 'stocks bas'), vide: 'Aucun stock bas', droit: ['produits', 'stocks'] },
  ].filter((l) => l.droit.some((d) => s.peut(d)));
  return (
    <Menu
      label={total ? `Notifications : ${total} nouvelles` : 'Notifications'}
      largeur={320}
      bouton={(props) => (
        <button type="button" class="tool" {...props}>
          <Icon name="cloche" />
          {total > 0 && (
            <span class="tool__dot" aria-hidden="true">
              {total > 99 ? '99+' : total}
            </span>
          )}
        </button>
      )}
    >
      {(fermer) => (
        <>
          <div class="menu__head row row--between">
            <strong>Notifications</strong>
            {total > 0 && (
              <button
                type="button"
                class="more"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  marquerVu();
                  fermer();
                }}
              >
                <Icon name="check" />
                Marquer comme vu
              </button>
            )}
          </div>
          {lignes.map((l) => {
            const k = n[l.cle] || 0;
            return (
              <MenuItem key={l.cle} href={l.href} fermer={fermer} avatar={<span class={`list__ico list__ico--${k ? l.ton : 'mute'}`} style="width:30px;height:30px;border-radius:9px"><Icon name={l.icone} size="s" /></span>}>
                <span class={k ? 'strong' : 'muted'}>{k ? l.txt(k) : l.vide}</span>
              </MenuItem>
            );
          })}
          <p class="small muted" style="padding:8px 10px 4px">Mise à jour automatique toutes les 30 secondes.</p>
        </>
      )}
    </Menu>
  );
}

// ---------- Menu du compte ----------
function MenuCompte({ children, haut }) {
  const s = useSession();
  const [mdp, setMdp] = useState(false);
  return (
    <>
      <Menu label="Mon compte" haut={haut} align={haut ? 'gauche' : 'droite'} largeur={260} bouton={children}>
        {(fermer) => (
          <>
            <div class="menu__head">
              <div class="row" style="gap:10px">
                <Avatar nom={nomComplet(s.moi)} cle={s.moi.id} />
                <div style="min-width:0">
                  <div class="strong ellipsis">{nomComplet(s.moi)}</div>
                  <div class="small muted ellipsis">{s.moi.email}</div>
                </div>
              </div>
              <div style="margin-top:8px">
                <span class="tag tag--soft">{roleNom(s.moi.role)}</span>
              </div>
            </div>
            <MenuItem icone="cle" fermer={fermer} onSelect={() => setMdp(true)}>
              Changer le mot de passe
            </MenuItem>
            <MenuItem icone="externe" href="/" target="_blank" fermer={fermer}>
              Voir le site
            </MenuItem>
            <MenuSep />
            <MenuItem icone="sortie" fermer={fermer} onSelect={() => s.deconnecter()}>
              Se déconnecter
            </MenuItem>
          </>
        )}
      </Menu>
      {mdp && <DialogMotDePasse onClose={() => setMdp(false)} />}
    </>
  );
}

export function DialogMotDePasse({ onClose }) {
  const [f, setF] = useState({ actuel: '', nouveau: '', confirmation: '' });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const envoyer = async () => {
    const e = {};
    if (!f.actuel) e.actuel = 'Saisissez votre mot de passe actuel.';
    if (f.nouveau.length < 10) e.nouveau = '10 caractères au moins.';
    else if (f.nouveau === f.actuel) e.nouveau = 'Choisissez un mot de passe différent de l’actuel.';
    if (f.confirmation !== f.nouveau) e.confirmation = 'Les deux saisies ne correspondent pas.';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await sessionApi('mot-de-passe', { method: 'POST', body: { espace: 'crm', actuel: f.actuel, nouveau: f.nouveau } });
      toast('Mot de passe modifié', { detail: 'Vos autres appareils devront se reconnecter.' });
      onClose();
    } catch (x) {
      setErr({ [x.champ === 'nouveau' ? 'nouveau' : x.champ === 'actuel' || x.status === 401 || x.status === 400 ? 'actuel' : 'general']: x.message });
    } finally {
      setBusy(false);
    }
  };
  const maj = (k) => (e) => setF({ ...f, [k]: e.currentTarget.value });
  return (
    <Dialog
      titre="Changer le mot de passe"
      sous="10 caractères au moins. Vos autres sessions seront déconnectées."
      icone="cle"
      taille="s"
      onClose={onClose}
      onSubmit={envoyer}
      pied={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" busy={busy}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div class="form">
        <Input label="Mot de passe actuel" type="password" autoComplete="current-password" value={f.actuel} onInput={maj('actuel')} error={err.actuel} />
        <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" value={f.nouveau} onInput={maj('nouveau')} error={err.nouveau} help="10 caractères au moins." />
        <Input label="Confirmation" type="password" autoComplete="new-password" value={f.confirmation} onInput={maj('confirmation')} error={err.confirmation} />
        {err.general && <Notice ton="err">{err.general}</Notice>}
      </div>
    </Dialog>
  );
}

// ---------- Menu de la démo ----------
function actionsDemo(s, ouvrirPartage) {
  const role = s.moi.role;
  return {
    profils: PROFILS.map((p) => ({ id: p, label: ROLES[p].nom, desc: `${NOMS_DEMO[p]} · ${ROLES[p].desc}`, actif: p === role, faire: () => p !== role && s.changerProfil(p) })),
    autres: [
      { id: 'pro', icone: 'store', label: 'Ouvrir l’espace pro (démo)', desc: 'Café des Platanes, dans un nouvel onglet', faire: () => s.ouvrirEspacePro() },
      { id: 'partager', icone: 'mobile', label: 'Partager la démo', desc: 'Sur votre téléphone ou un autre ordinateur', faire: ouvrirPartage },
      { id: 'reinit', icone: 'recharger', label: 'Réinitialiser la démo', faire: () => s.reinitialiserDemo() },
      { id: 'quitter', icone: 'sortie', label: 'Quitter la démo', danger: true, faire: () => s.quitterDemo() },
    ],
  };
}

export function MenuDemo({ plein }) {
  const s = useSession();
  const [partage, setPartage] = useState(false);
  const a = actionsDemo(s, () => setPartage(true));
  const dialog = partage && <DialogPartage onClose={() => setPartage(false)} />;
  if (plein) {
    return (
      <>
        <p class="small muted" style="padding:0 16px 8px">
          Données fictives, rien n’est envoyé. Changez de profil pour voir le CRM avec les yeux de chaque métier.
        </p>
        <div class="list" role="radiogroup" aria-label="Profil de démonstration">
          {a.profils.map((p) => (
            <button key={p.id} type="button" class="list__item" role="radio" aria-checked={p.actif ? 'true' : 'false'} onClick={p.faire}>
              <Avatar nom={NOMS_DEMO[p.id]} cle={p.id} />
              <span class="list__main">
                <span class="list__title">{p.label}</span>
                <span class="list__meta">{p.desc}</span>
              </span>
              {p.actif && <Icon name="check" style="color:var(--ok)" />}
            </button>
          ))}
        </div>
        <div class="list" style="border-top:1px solid var(--line-3)">
          {a.autres.map((x) => (
            <button key={x.id} type="button" class="list__item" onClick={x.faire} style={x.danger ? 'color:var(--err)' : undefined}>
              <span class={cx('list__ico', x.danger && 'list__ico--err')}>
                <Icon name={x.icone} />
              </span>
              <span class="list__main">
                <span class="list__title">{x.label}</span>
                {x.desc && <span class="list__meta">{x.desc}</span>}
              </span>
            </button>
          ))}
        </div>
        {dialog}
      </>
    );
  }
  return (
    <>
      <Menu
        label="Démonstration"
        largeur={330}
        bouton={(props) => (
          <button type="button" class="demo-btn" {...props}>
            <span class="demo-btn__dot" aria-hidden="true" />
            <span>Démo</span>
            <span class="demo-btn__role">· {ROLES[s.moi.role]?.court || s.moi.role}</span>
            <Icon name="bas" />
          </button>
        )}
      >
        {(fermer) => (
          <>
            <div class="menu__head">
              <div class="row" style="gap:8px">
                <span class="demo-btn__dot" aria-hidden="true" />
                <strong>Démonstration privée</strong>
              </div>
              <p class="small muted" style="margin-top:4px">
                Données fictives, rien n’est envoyé.{s.demo?.expireLe ? ` Effacée le ${date(s.demo.expireLe)} si elle n’est plus utilisée.` : ''}
              </p>
            </div>
            <MenuLabel>Changer de profil</MenuLabel>
            {a.profils.map((p) => (
              <MenuItem key={p.id} fermer={fermer} checked={p.actif} onSelect={p.faire} desc={p.desc}>
                {p.label}
              </MenuItem>
            ))}
            <MenuSep />
            {a.autres.map((x) => (
              <MenuItem key={x.id} icone={x.icone} danger={x.danger} fermer={fermer} onSelect={x.faire} desc={x.desc}>
                {x.label}
              </MenuItem>
            ))}
          </>
        )}
      </Menu>
      {dialog}
    </>
  );
}

// Lien de partage de la démo : lien, bouton copier, QR code
export function DialogPartage({ onClose }) {
  const [etat, setEtat] = useState({ chargement: true });
  const [copie, setCopie] = useState(false);
  const champ = useRef(null);
  useEffect(() => {
    sessionApi('partager', { method: 'POST', body: {} })
      .then((d) => setEtat({ lien: new URL(d.lien, location.origin).href, expireLe: d.expireLe }))
      .catch((e) => setEtat({ erreur: e }));
  }, []);
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(etat.lien);
    } catch {
      champ.current?.select();
      document.execCommand?.('copy');
    }
    setCopie(true);
    setTimeout(() => setCopie(false), 2400);
  };
  return (
    <Dialog titre="Partager la démo" sous="Ouvrez ce lien sur votre téléphone : vous retrouverez la même démo, avec les mêmes données." icone="mobile" iconeTon="pac" onClose={onClose} pied={<Button onClick={onClose}>Fermer</Button>}>
      {etat.chargement && <div class="skel skel--block" style="height:180px" />}
      {etat.erreur && <Notice ton="err">{etat.erreur.message}</Notice>}
      {etat.lien && (
        <div class="share">
          <div class="share__qr">
            <QrCode texte={etat.lien} label="QR code du lien de la démo" />
            <p class="small muted">Visez ce code avec l’appareil photo du téléphone.</p>
          </div>
          <div class="share__lien stack stack--s">
            <label class="field__label" for="lien-demo">
              Lien de la démo
            </label>
            <div class="row" style="gap:8px">
              <input id="lien-demo" ref={champ} class="input mono" readOnly value={etat.lien} onFocus={(e) => e.currentTarget.select()} />
              <Button icon={copie ? 'check' : 'copier'} onClick={copier} variant={copie ? 'primary' : undefined}>
                {copie ? 'Copié' : 'Copier'}
              </Button>
            </div>
            <p class="small muted" aria-live="polite">
              {copie ? 'Lien copié dans le presse-papiers.' : `Valable jusqu’au ${dateHeure(etat.expireLe)}.`} Toute personne qui l’ouvre rejoint cette démo et voit ses données fictives.
            </p>
          </div>
        </div>
      )}
    </Dialog>
  );
}

// ---------- Recherche globale ----------
const TYPES = {
  commande: { icone: 'commandes', nom: 'Commandes' },
  client: { icone: 'client', nom: 'Clients' },
  compte: { icone: 'store', nom: 'Comptes pro' },
  message: { icone: 'message', nom: 'Messages' },
  reservation: { icone: 'calendrier', nom: 'Réservations' },
  produit: { icone: 'bouteille', nom: 'Produits' },
  demande: { icone: 'briefcase', nom: 'Demandes pro' },
  rubrique: { icone: 'droite', nom: 'Aller à' },
};

export function Palette({ onClose }) {
  const s = useSession();
  const [q, setQ] = useState('');
  const [res, setRes] = useState({ liste: [], chargement: false, erreur: null });
  const [sel, setSel] = useState(0);
  const listeRef = useRef(null);
  const t = useRef(null);
  const ctrl = useRef(null);

  const rubriques = RUBRIQUES.filter((r) => accessible(r, s.peut)).map((r) => ({ type: 'rubrique', id: r.id, titre: r.nom, sousTitre: r.groupe, url: r.href, icone: r.icone }));

  useEffect(() => {
    clearTimeout(t.current);
    const terme = q.trim();
    if (terme.length < 2) {
      ctrl.current?.abort();
      setRes({ liste: [], chargement: false, erreur: null });
      return undefined;
    }
    setRes((r) => ({ ...r, chargement: true }));
    t.current = setTimeout(async () => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      try {
        const d = await crm('recherche', { query: { q: terme }, signal: c.signal });
        setRes({ liste: d?.resultats || [], chargement: false, erreur: null });
        setSel(0);
      } catch (e) {
        if (e?.name !== 'AbortError') setRes({ liste: [], chargement: false, erreur: e });
      }
    }, 180);
    return () => clearTimeout(t.current);
  }, [q]);

  const filtreRub = q.trim() ? rubriques.filter((r) => plier(r.titre).includes(plier(q.trim()))) : rubriques;
  const tous = [...res.liste, ...filtreRub];
  const groupes = [];
  for (const r of tous) {
    const g = groupes.find((x) => x.type === r.type);
    if (g) g.items.push(r);
    else groupes.push({ type: r.type, items: [r] });
  }
  const aplati = groupes.flatMap((g) => g.items);

  const aller = (r) => {
    onClose();
    if (r?.url) navigate(r.url);
  };
  const surTouche = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((i) => Math.min(aplati.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      aller(aplati[sel]);
    }
  };
  useEffect(() => {
    listeRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  let k = -1;
  return (
    <Dialog titre="Recherche" onClose={onClose} class="palette" taille="l" focusInitial="input">
      <div class="palette__in">
        <Icon name="recherche" />
        <input
          type="search"
          placeholder="Commande, client, compte, produit, réservation…"
          value={q}
          onInput={(e) => {
            setQ(e.currentTarget.value);
            setSel(0);
          }}
          onKeyDown={surTouche}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-res"
          aria-activedescendant={aplati[sel] ? `pal-${sel}` : undefined}
          aria-label="Rechercher dans le CRM"
          autoComplete="off"
          spellcheck={false}
        />
        {res.chargement && <span class="spinner" aria-hidden="true" />}
        <button type="button" class="tool" aria-label="Fermer la recherche" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <div class="palette__res" id="palette-res" role="listbox" ref={listeRef} aria-label="Résultats">
        {res.erreur && <Notice ton="err">{res.erreur.message}</Notice>}
        {q.trim().length >= 2 && !res.chargement && !res.liste.length && !res.erreur && (
          <p class="muted" style="padding:14px 10px">
            Aucun résultat pour « {q.trim()} ».
          </p>
        )}
        {groupes.map((g) => (
          <div key={g.type} role="group" aria-label={TYPES[g.type]?.nom || g.type}>
            <p class="palette__group">{TYPES[g.type]?.nom || g.type}</p>
            {g.items.map((r) => {
              k += 1;
              const i = k;
              return (
                <a
                  key={`${r.type}-${r.id}`}
                  id={`pal-${i}`}
                  role="option"
                  aria-selected={i === sel ? 'true' : 'false'}
                  class="palette__item"
                  href={r.url}
                  onMouseMove={() => setSel(i)}
                  onClick={(e) => {
                    e.preventDefault();
                    aller(r);
                  }}
                >
                  <span class="list__ico">
                    <Icon name={r.icone || TYPES[r.type]?.icone || 'droite'} size="s" />
                  </span>
                  <span class="palette__txt">
                    <span class="palette__title">{r.titre}</span>
                    {r.sousTitre && <span class="palette__sub">{r.sousTitre}</span>}
                  </span>
                  <Icon name="fleche-d" class="palette__enter" size="s" />
                </a>
              );
            })}
          </div>
        ))}
      </div>
      <div class="palette__foot">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> naviguer
        </span>
        <span>
          <kbd>↵</kbd> ouvrir
        </span>
        <span>
          <kbd>Échap</kbd> fermer
        </span>
      </div>
    </Dialog>
  );
}

// Écran « Plus » du téléphone : toutes les rubriques, la démo et le compte
export function Plus() {
  const s = useSession();
  return (
    <div class="page page--narrow">
      <header class="page__head">
        <div class="page__titles">
          <h1 class="page__title" tabIndex={-1}>
            Plus
          </h1>
        </div>
      </header>
      <div class="stack">
        {GROUPES.map((g) => {
          const items = g.items.filter((i) => accessible(i, s.peut));
          if (!items.length) return null;
          return (
            <section class="card" key={g.id} aria-labelledby={`plus-${g.id}`}>
              <h2 class="eyebrow" id={`plus-${g.id}`} style="padding:14px 16px 4px">
                {g.nom}
              </h2>
              <div class="list">
                {items.map((i) => (
                  <Link key={i.id} class="list__item" href={i.href}>
                    <span class="list__ico">
                      <Icon name={i.icone} />
                    </span>
                    <span class="list__main">
                      <span class="list__title">{i.nom}</span>
                    </span>
                    <Icon name="droite" class="list__chev" />
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
        {s.demo?.active && (
          <section class="card" aria-labelledby="plus-demo">
            <h2 class="eyebrow" id="plus-demo" style="padding:14px 16px 4px">
              Démonstration · {roleNom(s.moi.role)}
            </h2>
            <MenuDemo plein />
          </section>
        )}
      </div>
    </div>
  );
}

export { PROFILS, NOMS_DEMO };
