// Équipe (direction) : membres, rôles, invitations, désactivation.
import { useState } from 'preact/hooks';
import { crm, elements, invalider, mapElements, useCrm } from '../lib/data.js';
import { useSession } from '../lib/session.jsx';
import { Avatar, Button, Card, Empty, Erreur, Notice, PageHead, Pill, SkeletonRows, useTitre } from '../ui/base.jsx';
import { Choices, Input, erreurDe } from '../ui/form.jsx';
import { Dialog, Menu, MenuItem, MenuLabel, MenuSep, confirmer, toast } from '../ui/overlay.jsx';
import { ROLES, roleNom } from '../lib/droits.js';
import { date, nomComplet, relatif } from '../lib/format.js';

const ROLES_EQUIPE = ['direction', 'commercial', 'logistique', 'boutique'];

function statutMembre(u) {
  if (u.actif === false || u.statut === 'desactive') return { label: 'Désactivé', ton: 'mute' };
  if (u.statut === 'invitation' || u.invitation || u.invite) return { label: 'Invitation envoyée', ton: 'info' };
  return { label: 'Actif', ton: 'ok' };
}

export function Equipe() {
  useTitre('Équipe');
  const s = useSession();
  const r = useCrm('equipe', {});
  const membres = elements(r.data, 'membres', 'equipe', 'utilisateurs').filter((u) => u.role !== 'pro');
  const [inviter, setInviter] = useState(false);
  const [coordonnees, setCoordonnees] = useState(null);
  const peutModifier = s.peut('equipe', 'ecriture');

  const patch = async (u, body, message) => {
    r.mutate((d) => mapElements(d, (x) => (x.id === u.id ? { ...x, ...body } : x), 'membres', 'equipe', 'utilisateurs'));
    try {
      await crm('membre', { method: 'PATCH', query: { id: u.id }, body });
      toast(message);
      invalider('journal');
    } catch (e) {
      r.reload({ silencieux: true });
      toast.erreur(e);
    }
  };
  const desactiver = async (u) => {
    const actif = u.actif === false;
    await confirmer({
      titre: actif ? `Réactiver ${nomComplet(u)} ?` : `Désactiver ${nomComplet(u)} ?`,
      message: actif ? 'Cette personne pourra de nouveau se connecter au CRM.' : 'Ses sessions sont fermées et elle ne peut plus se connecter. Son historique reste dans le journal.',
      confirmer: actif ? 'Réactiver' : 'Désactiver',
      danger: !actif,
      icone: actif ? 'lecture' : 'interdit',
      action: () => patch(u, { actif }, actif ? `${nomComplet(u)} réactivé` : `${nomComplet(u)} désactivé`),
    });
  };

  return (
    <div class="page page--narrow">
      <PageHead
        titre="Équipe"
        sous="Les personnes de la distillerie qui utilisent le CRM et ce que chacune peut faire."
        actions={
          peutModifier && (
            <Button variant="primary" icon="user-plus" onClick={() => setInviter(true)}>
              Inviter
            </Button>
          )
        }
      />
      {r.error && !r.data && <Erreur erreur={r.error} onRetry={r.reload} />}
      {!r.data && !r.error && (
        <div class="card">
          <SkeletonRows n={5} cols={3} />
        </div>
      )}
      {r.data && membres.length === 0 && <Empty icone="equipe" titre="Personne pour l’instant" />}
      {membres.length > 0 && (
        <Card titre="Membres" corps={false} sous={`${membres.filter((u) => u.actif !== false).length} actifs`}>
          <ul class="membres">
            {membres.map((u) => {
              const st = statutMembre(u);
              const moi = u.id === s.moi.id;
              return (
                <li key={u.id} class="membre">
                  <Avatar nom={nomComplet(u)} cle={u.id} size="l" />
                  <div class="membre__main">
                    <div class="membre__nom">
                      <span class="strong">{nomComplet(u)}</span>
                      {moi && <span class="tag tag--soft">vous</span>}
                      {u.demo && !moi && (
                        <span class="tag tag--soft" title="Profil d’une entrée de démonstration : changer son rôle change ce que montre cette entrée.">
                          profil de démo
                        </span>
                      )}
                    </div>
                    <div class="small muted ellipsis">
                      {u.email}
                      {u.poste ? ` · ${u.poste}` : ''}
                    </div>
                  </div>
                  <div class="membre__role">
                    <span class="strong small">{roleNom(u.role)}</span>
                    <span class="small muted">
                      {u.statut === 'invitation' && u.invitationExpireLe
                        ? `invitation valable jusqu’au ${date(u.invitationExpireLe)}`
                        : u.derniereConnexion
                          ? `connexion ${relatif(u.derniereConnexion)}`
                          : u.createdAt
                            ? `depuis le ${date(u.createdAt)}`
                            : 'jamais connecté'}
                    </span>
                  </div>
                  <Pill ton={st.ton}>{st.label}</Pill>
                  {peutModifier && !moi ? (
                    <Menu label={`Gérer ${nomComplet(u)}`} bouton={(p) => <Button size="sm" variant="ghost" icon="points" aria-label={`Gérer ${nomComplet(u)}`} {...p} />}>
                      {(fermer) => (
                        <>
                          <MenuLabel>Rôle</MenuLabel>
                          {ROLES_EQUIPE.map((ro) => (
                            <MenuItem key={ro} fermer={fermer} checked={u.role === ro} desc={ROLES[ro].desc} onSelect={() => u.role !== ro && patch(u, { role: ro }, `${nomComplet(u)} : ${roleNom(ro).toLowerCase()}`)}>
                              {roleNom(ro)}
                            </MenuItem>
                          ))}
                          <MenuSep />
                          <MenuItem icone="crayon" fermer={fermer} onSelect={() => setCoordonnees(u)}>
                            Poste et téléphone…
                          </MenuItem>
                          <MenuItem icone={u.actif === false ? 'lecture' : 'interdit'} danger={u.actif !== false} fermer={fermer} onSelect={() => desactiver(u)}>
                            {u.actif === false ? 'Réactiver' : 'Désactiver'}
                          </MenuItem>
                        </>
                      )}
                    </Menu>
                  ) : (
                    <span class="membre__vide" />
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <Card titre="Ce que voit chaque rôle" class="card--paper mt" icone="cadenas">
        <ul class="roles">
          {ROLES_EQUIPE.map((ro) => (
            <li key={ro}>
              <strong>{roleNom(ro)}</strong>
              <span class="muted">{ROLES[ro].desc}</span>
            </li>
          ))}
        </ul>
        <p class="small muted" style="margin-top:12px">Le serveur vérifie les droits à chaque action ; l’interface masque simplement ce qu’un rôle ne peut pas faire.</p>
      </Card>
      {inviter && <DialogInviterMembre onClose={() => setInviter(false)} onFait={() => r.reload({ silencieux: true })} />}
      {coordonnees && <DialogCoordonnees u={coordonnees} onClose={() => setCoordonnees(null)} onFait={() => r.reload({ silencieux: true })} />}
    </div>
  );
}

// Poste et téléphone d'un membre (vidés : effacés)
function DialogCoordonnees({ u, onClose, onFait }) {
  const [f, setF] = useState({ poste: u.poste || '', telephone: u.telephone || '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const maj = (k) => (e) => { const cible = e.currentTarget; setF((prec) => ({ ...prec, [k]: cible.value })); };
  const envoyer = async () => {
    setBusy(true);
    setErr(null);
    try {
      await crm('membre', { method: 'PATCH', query: { id: u.id }, body: { poste: f.poste.trim() || null, telephone: f.telephone.trim() || null } });
      toast(`Coordonnées de ${nomComplet(u)} enregistrées`);
      onFait();
      onClose();
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };
  return (
    <Dialog
      titre={nomComplet(u)}
      sous="Poste et téléphone affichés dans l’équipe et sur les fiches des comptes pro."
      icone="equipe"
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
        <Input label="Poste" opt value={f.poste} onInput={maj('poste')} error={erreurDe(err, 'poste')} placeholder="Ex. : commercial Vaucluse et Gard" />
        <Input label="Téléphone" opt type="tel" value={f.telephone} onInput={maj('telephone')} error={erreurDe(err, 'telephone')} />
        {err && !erreurDe(err, 'poste', 'telephone') && <Notice ton="err">{err.message}</Notice>}
      </div>
    </Dialog>
  );
}

function DialogInviterMembre({ onClose, onFait }) {
  const [f, setF] = useState({ prenom: '', nom: '', email: '', role: 'boutique', poste: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const maj = (k) => (e) => { const cible = e.currentTarget; setF((prec) => ({ ...prec, [k]: cible.value })); };
  const envoyer = async () => {
    setBusy(true);
    setErr(null);
    try {
      const d = await crm('membre', { method: 'POST', body: { prenom: f.prenom.trim(), nom: f.nom.trim(), email: f.email.trim(), role: f.role, poste: f.poste.trim() || undefined } });
      toast(`Invitation envoyée à ${f.email.trim()}`, {
        detail: 'Démonstration : rien ne part vraiment. Le lien est valable 7 jours.',
        action: d?.lienDemo ? { label: 'Lien d’activation', href: d.lienDemo, target: '_blank' } : { label: 'Voir le courriel', href: '/crm/courriels' },
        duree: 12000,
      });
      invalider('courriels');
      onFait();
      onClose();
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };
  return (
    <Dialog
      titre="Inviter un membre de l’équipe"
      sous="La personne reçoit un lien pour choisir son mot de passe."
      icone="user-plus"
      taille="l"
      onClose={onClose}
      onSubmit={envoyer}
      pied={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" icon="send" busy={busy}>
            Envoyer l’invitation
          </Button>
        </>
      }
    >
      <div class="form">
        <div class="form-grid">
          <Input label="Prénom" value={f.prenom} onInput={maj('prenom')} error={erreurDe(err, 'prenom')} />
          <Input label="Nom" value={f.nom} onInput={maj('nom')} error={erreurDe(err, 'nom')} />
          <Input label="E-mail" type="email" value={f.email} onInput={maj('email')} error={erreurDe(err, 'email')} />
          <Input label="Poste" opt value={f.poste} onInput={maj('poste')} error={erreurDe(err, 'poste')} placeholder="Ex. : vendeuse en boutique" />
        </div>
        <Choices name="role" label="Rôle" value={f.role} onChange={(v) => setF((prec) => ({ ...prec, role: v }))} items={ROLES_EQUIPE.map((ro) => ({ value: ro, titre: roleNom(ro), desc: ROLES[ro].desc }))} />
        {err && !erreurDe(err, 'prenom', 'nom', 'email', 'role') && <Notice ton="err">{err.message}</Notice>}
      </div>
    </Dialog>
  );
}
