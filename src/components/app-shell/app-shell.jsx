import { SkipLink } from "./skip-link"
import { Sidebar } from "./sidebar"
import { TopBar } from "./top-bar"
import { MobileTop } from "./mobile-top"
import { BottomNav } from "./bottom-nav"
import { UnreadProvider } from "./unread-provider"
import { NotificationsProvider } from "@/components/notifications/notifications-provider"

// Coquille connectée commune (client, puis étudiant et admin) : lien d'évitement, sidebar et barre du haut
// au bureau, en-tête mobile et barre du bas sous 1024. `nav` est la configuration de l'espace
// (voir client-space/shell/client-nav.js). Clés optionnelles : `mobileMore` (panneau « Plus »),
// `mobileHideBelow` (chemins dont les sous-pages masquent la barre du bas) et `mobileTop` ({ space, profileHref } :
// libellé d'espace et cible de l'avatar de l'en-tête mobile, au lieu de `space` et `profileHref`).
// `counts` : compteurs nommés de l'espace (ex. { verifications: 4 }) lus par `item.badge` ; `nav.realtime === false`
// (espace admin) pose un fournisseur sans abonnement aux messages.
// `detail` (.shell--detail, barre du bas masquée) ne peut pas être fixé page par page : AppShell est rendu
// dans le layout, pas dans les pages. Les écrans de détail s'appuient donc sur la règle CSS `:has(.mbar2)`;
// la prop reste pour les usages directs.
// `nav.notifications` ({ space, href }) et la prop `notifications` ({ count, actions } : compteur initial lu par le
// layout et actions serveur de l'espace) ensemble affichent la cloche (bureau : panneau, mobile : lien vers la page).
// Sans l'une ou l'autre, aucune cloche et aucun fournisseur : le rendu reste celui d'avant.
// `main#contenu` est la cible du lien d'évitement et du focus après navigation (RouteScroll).
export function AppShell({ nav, user, unreadCount = 0, counts, detail = false, notifications, children }) {
  const bell = nav.notifications && notifications ? nav.notifications : null
  const shell = (
    <UnreadProvider userId={user.id} initialCount={unreadCount} realtime={nav.realtime !== false}>
      <div className={detail ? "shell shell--v2 shell--detail" : "shell shell--v2"}>
        <SkipLink />
        <div className="shell__frame">
          <Sidebar nav={nav} fullName={user.fullName} counts={counts} />
          <div className="shell__main">
            <TopBar search={nav.search} notificationsHref={bell?.href} />
            <MobileTop
              nav={nav.mobileTop ? { ...nav, ...nav.mobileTop } : nav}
              fullName={user.fullName}
              notificationsHref={bell?.href}
            />
            <main id="contenu" className="page2" tabIndex={-1}>
              {children}
            </main>
          </div>
        </div>
        <BottomNav items={nav.mobile} more={nav.mobileMore} counts={counts} hideBelow={nav.mobileHideBelow} />
      </div>
    </UnreadProvider>
  )

  if (!bell) return shell
  return (
    <NotificationsProvider space={bell.space} initialCount={notifications.count} actions={notifications.actions}>
      {shell}
    </NotificationsProvider>
  )
}
