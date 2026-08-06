import { LegalPage, LegalSection } from "@/components/attribut/legal-page"

export default function AttributTerms() {
  return (
    <LegalPage title="Terms and Conditions" lastUpdated="6 August 2026">
      <LegalSection title="1. Acceptance">
        <p>
          By joining the Attribut waitlist or using Attribut, you agree to these
          terms. If you do not agree, please do not use the service.
        </p>
      </LegalSection>

      <LegalSection title="2. Invite only beta">
        <p>
          Attribut is currently an invite only private beta. Joining the
          waitlist does not guarantee access. We open seats in small batches and
          we may decline or delay access for any reason.
        </p>
      </LegalSection>

      <LegalSection title="3. Acceptable use">
        <p>
          Use Attribut only for accounts and content you own or are authorised
          to manage. Do not attempt to break, overload, reverse engineer, or
          gain unauthorised access to the service, and do not use it to break
          the law or the terms of any connected platform.
        </p>
      </LegalSection>

      <LegalSection title="4. Ownership">
        <p>
          Attribut, the Clientsforge name, and all related content, software,
          and marks belong to Clientsforge. You keep ownership of your own
          content and data.
        </p>
      </LegalSection>

      <LegalSection title="5. Beta disclaimer">
        <p>
          Attribut is provided as is and as available. Beta software can change,
          break, or lose data. Attribution figures are estimates and should not
          be treated as accounting or financial advice. We make no warranty that
          the service will be uninterrupted or error free.
        </p>
      </LegalSection>

      <LegalSection title="6. Limitation of liability">
        <p>
          To the fullest extent permitted by law, Clientsforge is not liable for
          any indirect, incidental, or consequential losses, including lost
          profits or lost data, arising from your use of Attribut.
        </p>
      </LegalSection>

      <LegalSection title="7. Changes to these terms">
        <p>
          We may update these terms as the product develops. We will update the
          date at the top of this page. Continued use after a change means you
          accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection title="8. Contact">
        <p>
          Questions about these terms can go to{" "}
          <a
            href="mailto:hello@clientsforge.com"
            className="text-ember-light underline underline-offset-2"
          >
            hello@clientsforge.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}
