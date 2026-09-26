import { Link } from "react-router-dom"

import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_ENTITY_NAME,
  LegalLayout,
  LegalSection,
  Placeholder,
} from "./legal-layout"

export default function TermsOfService() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro={
        <p>
          These terms govern use of the Clientsforge client workspace, including the Instagram
          automation tools, provided by <Placeholder>{LEGAL_ENTITY_NAME}</Placeholder>{" "}
          ("Clientsforge", "we"). By signing in you agree to them.
        </p>
      }
    >
      <LegalSection title="Access">
        <p>
          The workspace is available only to Clientsforge clients, using a personal PIN we issue.
          Keep your PIN private. We may deactivate access at any time, including when an
          engagement ends.
        </p>
      </LegalSection>

      <LegalSection title="Your Instagram account">
        <p>
          You may only connect an Instagram professional account you own or are authorised to
          manage. You are responsible for the replies and messages your automations send, and for
          following Instagram's Terms of Use, Community Guidelines, and Platform Terms.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You agree not to use the automation tools to:</p>
        <ul>
          <li>send spam, or messages people have not invited by commenting;</li>
          <li>send misleading, harassing, unlawful, or harmful content;</li>
          <li>collect data about commenters for any purpose other than responding to them;</li>
          <li>interfere with the service or try to access other clients' data.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Instagram's limits">
        <p>
          Automations work within limits Instagram sets. For example, a private reply can only be
          sent once per comment and only within 7 days of it, and Instagram may throttle or block
          messages. We do not guarantee that every reply or message is delivered.
        </p>
      </LegalSection>

      <LegalSection title="Data">
        <p>
          How we handle data is described in our{" "}
          <Link className="text-gold-light underline" to="/privacy">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Availability and liability">
        <p>
          The service is provided as is. To the extent the law allows, we are not liable for
          indirect or consequential losses, or for outcomes caused by Instagram's platform,
          outages, or policy changes.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          We may update these terms and will revise the date at the top when we do. Questions:{" "}
          <Placeholder>{LEGAL_CONTACT_EMAIL}</Placeholder>.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
