import { Link } from "react-router-dom"

import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_ENTITY_NAME,
  LegalLayout,
  LegalSection,
  Placeholder,
} from "./legal-layout"

export default function PrivacyPolicy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro={
        <p>
          This policy explains what Clientsforge (operated by{" "}
          <Placeholder>{LEGAL_ENTITY_NAME}</Placeholder>) collects when a client connects their
          Instagram account to the Clientsforge workspace, why we collect it, how long we keep it,
          and how to have it deleted.
        </p>
      }
    >
      <LegalSection title="Who this applies to">
        <p>
          It covers three groups: our clients, who sign in to the Clientsforge workspace and
          connect an Instagram professional account; people who comment on a client's Instagram
          posts, whose comments our automation reads and responds to on the client's behalf; and
          people who send a client a direct message, whose conversation metadata (not the message
          itself) we record for the client's analytics.
        </p>
      </LegalSection>

      <LegalSection title="Instagram data we collect">
        <p>When a client connects Instagram, we receive and store:</p>
        <ul>
          <li>
            <strong>Account details:</strong> the Instagram account ID, username, and profile
            picture URL.
          </li>
          <li>
            <strong>An access token</strong> that lets us act for the account. It is encrypted
            with AES-256-GCM before it is stored and is only decrypted on our servers at the moment
            it is used.
          </li>
          <li>
            <strong>Post details</strong> for posts a client sets an automation on: the post ID,
            thumbnail, link, and caption.
          </li>
        </ul>
        <p>When someone comments on a client's post, Instagram sends us, and we store:</p>
        <ul>
          <li>
            <strong>The comment:</strong> its ID, its text, and the post it was left on.
          </li>
          <li>
            <strong>The commenter:</strong> their Instagram username and Instagram scoped user ID.
          </li>
          <li>
            <strong>What we did:</strong> whether we replied publicly, whether a direct message
            was sent and when, and any error.
          </li>
        </ul>
        <p>For Content Analytics, with the client's permission, we receive and store:</p>
        <ul>
          <li>
            <strong>Account insights:</strong> daily totals Instagram reports for the account, such
            as views, reach, likes, comments, shares, saves, follows, contact button taps, and the
            follower count.
          </li>
          <li>
            <strong>Post insights:</strong> for the client's posts and reels, the post ID, type,
            caption, link, thumbnail, publish time, and totals such as views, reach, likes,
            comments, shares, saves, and average watch time.
          </li>
          <li>
            <strong>Direct message metadata:</strong> when someone messages the client, the
            sender's Instagram scoped user ID and the time of their first message, and whether an
            automation messaged them first. We do not store message text or attachments, and we do
            not read them.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Why we collect it">
        <ul>
          <li>To check whether a comment matches a client's automation rules.</li>
          <li>To post the client's public reply and send their direct message to the commenter.</li>
          <li>
            To show the client an activity log and totals, so they can see what their automation
            did.
          </li>
          <li>To prevent duplicate messages and to retry messages that failed.</li>
          <li>
            To show the client analytics about their own account: totals over time, their best
            performing reels, and how many new conversations their content started.
          </li>
        </ul>
        <p>
          We do not use Instagram data for advertising, we do not build profiles of commenters,
          and <strong>we do not sell Instagram data</strong> or share it with anyone except the
          service providers listed below.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <ul>
          <li>
            <strong>Comment records</strong> (comment text, commenter username and ID, and what
            happened) are deleted automatically after 90 days.
          </li>
          <li>
            <strong>Account details and the access token</strong> are kept while the account is
            connected. Disconnecting deletes the token immediately.
          </li>
          <li>
            <strong>Analytics</strong> (account and post insights, and direct message metadata)
            are kept so the client can see their history, until the client asks us to delete them
            or removes Clientsforge in Instagram, which deletes them.
          </li>
          <li>
            <strong>Workspace sign in sessions</strong> expire 180 days after sign in, or
            immediately on sign out.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Service providers">
        <p>We use these providers to run the service. They process data only on our behalf:</p>
        <ul>
          <li>Supabase, for the database.</li>
          <li>Netlify, for hosting and running our servers.</li>
          <li>
            Meta, whose Instagram API we use to read comments, send replies, and read insights.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How to delete your data">
        <p>
          <strong>If you connected an account:</strong> go to Instagram, then Settings, then
          Website permissions, then Apps and websites, and remove Clientsforge. Instagram notifies
          us, and we delete your account details, token, automations, comment records, and
          analytics. You
          receive a confirmation code to check the status at{" "}
          <Link className="text-gold-light underline" to="/data-deletion">
            clientsforge.com/data-deletion
          </Link>
          .
        </p>
        <p>
          <strong>If you commented on or messaged a client</strong>, or you want anything else
          deleted, email <Placeholder>{LEGAL_CONTACT_EMAIL}</Placeholder> from any address with
          your Instagram username. We delete matching records within 30 days and confirm by email.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Access tokens are encrypted at rest. Our database is not reachable with public keys; all
          access happens on our servers. Workspace access uses a private PIN, stored only as a
          bcrypt hash, with sign in attempts rate limited.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          We will update this page if our practices change, and revise the date at the top.
          Questions: <Placeholder>{LEGAL_CONTACT_EMAIL}</Placeholder>.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
