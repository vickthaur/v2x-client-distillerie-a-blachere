// Messages : échanges avec la distillerie (ils arrivent dans les messages du CRM) ; liste des fils,
// conversation, réponse, nouveau message par sujet.
import { useEffect, useRef, useState } from 'preact/hooks';
import { pro, useDonnees } from '../donnees.js';
import { navigate } from '../router.js';
import { dateLongue, dateMois, heure, SUJETS, NB } from '../format.js';
import { Chargement, Erreur, Icone, Pastille, TitreVue, Vide } from '../ui.jsx';

const STATUTS = {
  nouveau: { libelle: 'Envoyé', ton: 'info' },
  'en-cours': { libelle: 'En cours', ton: 'warn' },
  traite: { libelle: 'Traité', ton: 'ok' },
  archive: { libelle: 'Archivé', ton: 'muet' },
};

export function Messages({ route, session, site }) {
  const { data, error, loading, reload, setData } = useDonnees('messages');
  const fils = (Array.isArray(data) ? data : data?.messages || data?.elements || []).slice().sort((a, b) => String(derniere(b)?.date || b.createdAt).localeCompare(String(derniere(a)?.date || a.createdAt)));
  const nouveau = route.query.has('nouveau');
  const large = useLarge();
  // Sur ordinateur, la conversation la plus récente s'ouvre d'elle-même ; sur téléphone, la liste d'abord.
  const selId = route.query.get('fil') || (large && !nouveau ? fils[0]?.id : null);
  const sel = fils.find((m) => m.id === selId);
  const ouvrir = (id) => navigate(`/espace-pro/messages?fil=${encodeURIComponent(id)}`);
  return (
    <>
      <TitreVue
        kicker="Échanges"
        titre="Messages"
        accent="avec la distillerie"
        actions={
          !nouveau && (
            <a class="btn btn--primary btn--sm" href="/espace-pro/messages?nouveau=1">
              <Icone n="plus" />
              Nouveau message
            </a>
          )
        }
      >
        <p class="pro-lead">Une question sur une commande, une livraison, vos conditions{NB}? Les bureaux et votre commercial vous répondent ici, du lundi au vendredi.</p>
      </TitreVue>
      {loading && !data ? (
        <Chargement lignes={4} />
      ) : error ? (
        <Erreur erreur={error} reessayer={reload} />
      ) : (
        <div class={`msg${sel || nouveau ? ' has-sel' : ''}`}>
          <div class="msg__list" aria-label="Conversations">
            {fils.length ? (
              <ul class="msg-list">
                {fils.map((m) => {
                  const d = derniere(m);
                  const s = STATUTS[m.statut] || STATUTS.nouveau;
                  const repondu = d?.de === 'equipe';
                  return (
                    <li key={m.id}>
                      <a class={`msg-item${m.id === selId ? ' is-on' : ''}`} href={`/espace-pro/messages?fil=${encodeURIComponent(m.id)}`} aria-current={m.id === selId ? 'true' : undefined}>
                        <span class="msg-item__top">
                          <strong>{m.objet || SUJETS[m.sujet] || 'Message'}</strong>
                          <span class="msg-item__date">{dateMois(d?.date || m.createdAt)}</span>
                        </span>
                        <span class="msg-item__txt">
                          {repondu ? `${d.par?.nom?.split(' ')[0] || 'La distillerie'}${NB}: ` : `Vous${NB}: `}
                          {d?.texte}
                        </span>
                        <span class="msg-item__meta">
                          {m.reference && <span>{m.reference}</span>}
                          {repondu ? <Pastille ton="ok" petit>Réponse reçue</Pastille> : <Pastille ton={s.ton} petit>{s.libelle}</Pastille>}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              !nouveau && (
                <Vide titre="Aucun message pour l’instant." icone="chat" action={<a class="btn btn--primary btn--sm" href="/espace-pro/messages?nouveau=1">Écrire à la distillerie</a>}>
                  Vos échanges avec la distillerie apparaîtront ici.
                </Vide>
              )
            )}
          </div>
          <div class="msg__pane">
            {nouveau ? (
              <Nouveau
                route={route}
                site={site}
                onEnvoye={(m) => {
                  setData((x) => {
                    const list = Array.isArray(x) ? x : x?.messages || x?.elements || [];
                    const next = [m, ...list.filter((y) => y.id !== m.id)];
                    return Array.isArray(x) ? next : { ...(x || {}), messages: next };
                  });
                  ouvrir(m.id);
                }}
              />
            ) : sel ? (
              <Fil m={sel} session={session} site={site} onMaj={(m) => setData((x) => majListe(x, m))} reload={reload} />
            ) : (
              fils.length > 0 && (
                <div class="msg-empty">
                  <Icone n="chat" />
                  <p>Choisissez une conversation, ou écrivez un nouveau message.</p>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}

const derniere = (m) => (m.fil || [])[m.fil?.length - 1] || null;

function useLarge() {
  const mq = typeof matchMedia === 'function' ? matchMedia('(min-width: 761px)') : null;
  const [large, setLarge] = useState(!!mq?.matches);
  useEffect(() => {
    if (!mq) return undefined;
    const on = () => setLarge(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return large;
}

function majListe(x, m) {
  const list = Array.isArray(x) ? x : x?.messages || x?.elements || [];
  const next = list.map((y) => (y.id === m.id ? { ...y, ...m } : y));
  return Array.isArray(x) ? next : { ...(x || {}), messages: next };
}

function Fil({ m, session, site, onMaj, reload }) {
  const fin = useRef(null);
  const [texte, setTexte] = useState('');
  const [err, setErr] = useState(null);
  const [occupe, setOccupe] = useState(false);
  useEffect(() => {
    fin.current?.scrollIntoView?.({ block: 'nearest' });
  }, [m.id, (m.fil || []).length]);
  const repondre = async (e) => {
    e.preventDefault();
    const t = texte.trim();
    if (t.length < 2) return setErr('Écrivez votre message.');
    setOccupe(true);
    setErr(null);
    try {
      const r = await pro('message', { method: 'POST', body: { id: m.id, texte: t } });
      const maj = r?.message || r;
      if (maj?.id === m.id && Array.isArray(maj.fil)) onMaj(maj);
      else reload();
      setTexte('');
      site?.toast('Message envoyé');
    } catch (x) {
      setErr(x?.message || 'Le message n’a pas pu être envoyé.');
    } finally {
      setOccupe(false);
    }
  };
  return (
    <section class="msg-thread" aria-labelledby="msg-t">
      <header class="msg-thread__head">
        <a class="msg-thread__back" href="/espace-pro/messages">
          <Icone n="back" />
          <span class="sr-only">Toutes les conversations</span>
        </a>
        <div>
          <h2 class="pro-h2" id="msg-t">
            {m.objet || SUJETS[m.sujet] || 'Message'}
          </h2>
          <p class="pro-muted">
            {m.reference ? `${m.reference} · ` : ''}commencé le {dateLongue(m.createdAt)}
          </p>
        </div>
      </header>
      <ol class="msg-bubbles" aria-label="Messages de la conversation">
        {(m.fil || []).map((x, i) => {
          const moi = x.de !== 'equipe';
          return (
            <li key={i} class={`bubble${moi ? ' bubble--moi' : ''}`}>
              <p class="bubble__who">
                {moi ? x.par?.nom || [session.utilisateur.prenom, session.utilisateur.nom].join(' ') : `${x.par?.nom || 'La distillerie'} · Distillerie A. Blachère`}
                <span>
                  {dateMois(x.date)} à {heure(x.date)}
                </span>
              </p>
              <p class="bubble__txt">{x.texte}</p>
            </li>
          );
        })}
      </ol>
      <div ref={fin} />
      <form class="msg-reply" onSubmit={repondre} noValidate>
        <label class="sr-only" for="msg-reply">
          Votre réponse
        </label>
        <textarea id="msg-reply" rows={3} maxLength={4000} value={texte} onInput={(e) => setTexte(e.currentTarget.value)} placeholder="Votre réponse…" aria-invalid={err ? 'true' : undefined} />
        {err && (
          <p class="form-msg is-error" role="alert">
            {err}
          </p>
        )}
        <button type="submit" class="btn btn--primary btn--sm" disabled={occupe}>
          <Icone n="send" />
          {occupe ? 'Envoi…' : 'Envoyer'}
        </button>
      </form>
    </section>
  );
}

function Nouveau({ route, site, onEnvoye }) {
  const q = route.query;
  const commande = q.get('commande');
  const [sujet, setSujet] = useState(SUJETS[q.get('sujet')] ? q.get('sujet') : 'commande');
  const [texte, setTexte] = useState(commande ? `Bonjour,\n\nÀ propos de la commande ${commande}${NB}: ` : '');
  const [err, setErr] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.focus();
    t.setSelectionRange(t.value.length, t.value.length);
  }, []);
  const envoyer = async (e) => {
    e.preventDefault();
    const t = texte.trim();
    if (t.length < 10) {
      setErr(`Votre message est un peu court${NB}: dites-nous en quelques mots ce qui vous amène.`);
      return ref.current?.focus();
    }
    setOccupe(true);
    setErr(null);
    try {
      const r = await pro('message', { method: 'POST', body: { sujet, texte: t } });
      site?.toast(`Message envoyé${r?.reference ? ` · ${r.reference}` : ''}`);
      onEnvoye(r?.message || r);
    } catch (x) {
      setErr(x?.message || 'Le message n’a pas pu être envoyé.');
      setOccupe(false);
    }
  };
  return (
    <section class="msg-thread msg-new" aria-labelledby="msg-new-t">
      <header class="msg-thread__head">
        <a class="msg-thread__back" href="/espace-pro/messages">
          <Icone n="back" />
          <span class="sr-only">Toutes les conversations</span>
        </a>
        <h2 class="pro-h2" id="msg-new-t">
          Nouveau message
        </h2>
      </header>
      <form class="pro-form" onSubmit={envoyer} noValidate>
        <label class="field">
          <span>Sujet</span>
          <select value={sujet} onChange={(e) => setSujet(e.currentTarget.value)}>
            <option value="commande">Une commande, une livraison</option>
            <option value="pro">Mon compte, mes conditions</option>
            <option value="visite">Une visite de la distillerie</option>
            <option value="autre">Autre chose</option>
          </select>
        </label>
        <label class="field">
          <span>Message</span>
          <textarea ref={ref} rows={7} maxLength={4000} value={texte} onInput={(e) => setTexte(e.currentTarget.value)} aria-invalid={err ? 'true' : undefined} />
        </label>
        {err && (
          <p class="form-msg is-error" role="alert">
            {err}
          </p>
        )}
        <div class="pro-form__actions">
          <button type="submit" class="btn btn--primary btn--sm" disabled={occupe}>
            <Icone n="send" />
            {occupe ? 'Envoi…' : 'Envoyer à la distillerie'}
          </button>
          <a class="btn btn--ghost btn--sm" href="/espace-pro/messages">
            Annuler
          </a>
        </div>
        <p class="pro-fine">Démonstration&nbsp;: le message arrive dans les messages du CRM de démonstration de ce navigateur&#8239;; rien n’est transmis à la distillerie.</p>
      </form>
    </section>
  );
}
