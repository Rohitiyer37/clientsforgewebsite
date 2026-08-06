import { LegalPage, LegalSection } from "@/components/attribut/legal-page"

export default function AttributPrivacy() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="6 August 2026">
      <LegalSection title="1. What we collect">
        <p>
          Right now we collect the email address you submit to join the
          waitlist. Once the product is live and you connect an account, we also
          collect connected account details and attribution data such as link
          clicks, referral sources, booked calls, and payment events.
        </p>
      </LegalSection>

      <LegalSection title="2. How we use it">
        <p>
          We use your email to tell you about your invite and product updates.
          We use attribution data to build your reports and to operate and
          improve the service.
        </p>
      </LegalSection>

      <LegalSection title="3. We do not sell your data">
        <p>
          We do not sell or rent your personal information to anyone.
        </p>
      </LegalSection>

      <LegalSection title="4. Third parties">
        <p>
          We rely on trusted providers for hosting, email delivery, and
          analytics. They process data only to provide those services to us.
        </p>
      </LegalSection>

      <LegalSection title="5. Cookies">
        <p>
          We use a small number of cookies and similar technologies for basic
          analytics and to make attribution links work.
        </p>
      </LegalSection>

      <LegalSection title="6. Deleting your data">
        <p>
          You can ask us to delete your data at any time by emailing us. We will
          remove it from our active systems within a reasonable period.
        </p>
      </LegalSection>

      <LegalSection title="7. Contact">
        <p>
          Privacy questions and deletion requests can go to{" "}
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
