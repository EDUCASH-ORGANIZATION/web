import { SkipLink } from "./skip-link"
import { Sidebar } from "./sidebar"
import { TopBar } from "./top-bar"
import { MobileTop } from "./mobile-top"
import { BottomNav } from "./bottom-nav"
import { UnreadProvider } from "./unread-provider"

// Coquille connectée commune (client, puis étudiant et admin) : lien d'évitement, sidebar et barre du haut
// au bureau, en-tête mobile et barre du bas sous 1024. `nav` est la configuration de l'espace
// (voir client-space/shell/client-nav.js). Clés optionnelles : `mobileMore` (panneau « Plus »),
// `mobileHideBelow` (chemins dont les sous-pages masquent la barre du bas) et `mobileTop` ({ space, profileHref } :
// libellé d'espace et cible de l'avatar de l'en-tête mobile, au lieu de `space` et `profileHref`).
// `detail` (.shell--detail, barre du bas masquée) ne peut pas être fixé page par page : AppShell est rendu
// dans le layout, pas dans les pages. Les écrans de détail s'appuient donc sur la règle CSS `:has(.mbar2)`;
// la prop reste pour les usages directs.
// `main#contenu` est la cible du lien d'évitement et du focus après navigation (RouteScroll).
export function AppShell({ nav, user, unreadCount = 0, detail = false, children }) {
  return (
    <UnreadProvider userId={user.id} initialCount={unreadCount}>
      <div className={detail ? "shell shell--v2 shell--detail" : "shell shell--v2"}>
        <SkipLink />
        <div className="shell__frame">
          <Sidebar nav={nav} fullName={user.fullName} />
          <div className="shell__main">
            <TopBar search={nav.search} />
            <MobileTop nav={nav.mobileTop ? { ...nav, ...nav.mobileTop } : nav} fullName={user.fullName} />
            <main id="contenu" className="page2" tabIndex={-1}>
              {children}
            </main>
          </div>
        </div>
        <BottomNav items={nav.mobile} more={nav.mobileMore} hideBelow={nav.mobileHideBelow} />
      </div>
    </UnreadProvider>
  )
}
