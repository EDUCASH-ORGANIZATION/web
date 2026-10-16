// Mention permanente de la messagerie : information sur l'analyse automatique des messages, avec un lien
// vers la politique de confidentialité. Vue pure.

import Link from "next/link"
import { Icon } from "@/components/design/icon"
import { ANALYSIS_NOTICE_COPY, ANALYSIS_NOTICE_LINK_LABEL, PRIVACY_MESSAGES_HREF } from "@/lib/messaging/contact-copy"

export function MessagingNotice() {
  return (
    <p className="caption">
      <Icon name="i-shield" />
      {ANALYSIS_NOTICE_COPY}{" "}
      <Link href={PRIVACY_MESSAGES_HREF} className="link">
        {ANALYSIS_NOTICE_LINK_LABEL}
      </Link>
    </p>
  )
}

export default MessagingNotice
