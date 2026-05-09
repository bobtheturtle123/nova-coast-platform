import LegalLayout, { Section, Sub, Ul, Callout } from "@/components/LegalLayout";

export const metadata = {
  title: "Terms of Service — KyoriaOS",
  description: "KyoriaOS Terms of Service for photographer business management software.",
};

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="Effective May 8, 2026. Last updated May 8, 2026."
    >
      <Callout>
        Please read these Terms carefully before using KyoriaOS. By creating an account or
        using any part of the platform, you agree to be bound by these Terms.
      </Callout>

      <div className="mt-8" />

      <Section title="1. About KyoriaOS">
        <p>
          KyoriaOS (&quot;KyoriaOS,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is a software-as-a-service (SaaS)
          platform designed to help real estate photography businesses manage bookings,
          deliver media, run client portals, process payments, and communicate with clients.
        </p>
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of the KyoriaOS
          platform, including all web applications, APIs, integrations, and related services
          accessible at <strong>app.kyoriaos.com</strong> and associated domains
          (collectively, the &quot;Service&quot;).
        </p>
        <p>
          By registering for an account, subscribing to a plan, or otherwise using the
          Service, you agree to these Terms on behalf of yourself and any business entity
          you represent (&quot;you&quot; or &quot;Subscriber&quot;).
        </p>
      </Section>

      <Section title="2. Eligibility & Account Registration">
        <p>
          You must be at least 18 years old and legally authorized to enter into contracts
          in your jurisdiction to use KyoriaOS. By using the Service, you represent that
          you meet these requirements.
        </p>
        <Sub title="Account Security">
          <p>
            You are solely responsible for maintaining the confidentiality of your login
            credentials and for all activity that occurs under your account. You agree to:
          </p>
          <Ul items={[
            "Use a strong, unique password and keep it confidential",
            "Not share account access with individuals outside your licensed team seats",
            "Notify us immediately at support@kyoriaos.com if you suspect unauthorized access",
            "Not use another subscriber's account without authorization",
          ]} />
          <p>
            KyoriaOS is not liable for any loss or damage arising from your failure to
            protect your account credentials.
          </p>
        </Sub>
        <Sub title="Account Accuracy">
          <p>
            You agree to provide accurate, current, and complete information when registering.
            You are responsible for keeping your account information up to date. We reserve
            the right to suspend accounts that contain materially false information.
          </p>
        </Sub>
      </Section>

      <Section title="3. Subscription Plans & Billing">
        <Sub title="Plans">
          <p>
            KyoriaOS offers multiple subscription tiers (Solo, Starter, Pro, Agency, and
            any future plans). Each plan includes different feature sets, team seat limits,
            and usage allowances, as described on our pricing page. You agree to use the
            Service within the limits of your selected plan.
          </p>
        </Sub>
        <Sub title="Billing">
          <p>
            Subscriptions are billed in advance on a monthly or annual basis, depending on
            the billing cycle you select. All fees are charged in USD via Stripe. By
            providing a payment method, you authorize KyoriaOS to charge the applicable
            subscription fee on each renewal date.
          </p>
        </Sub>
        <Sub title="Failed Payments">
          <p>
            If a payment fails, we will attempt to retry the charge. If the charge remains
            unpaid after reasonable retries, your account may be downgraded, restricted,
            or suspended. You remain responsible for any outstanding fees.
          </p>
        </Sub>
        <Sub title="Plan Changes">
          <p>
            You may upgrade or downgrade your plan at any time. Upgrades take effect
            immediately and are prorated. Downgrades take effect at the start of the next
            billing cycle. We reserve the right to modify pricing with at least 30 days&apos;
            advance notice to active subscribers.
          </p>
        </Sub>
        <Sub title="Cancellation">
          <p>
            You may cancel your subscription at any time from your account billing settings.
            Upon cancellation, your account remains active through the end of the current
            paid billing period. No partial refunds are issued for unused time within a
            billing period.
          </p>
        </Sub>
        <Sub title="Refunds">
          <p>
            All fees are generally non-refundable. We may, at our sole discretion, issue
            refunds or credits in cases of billing errors or service disruptions that
            materially impacted your use of the platform. Refund requests must be submitted
            within 14 days of the charge via support@kyoriaos.com.
          </p>
        </Sub>
        <Sub title="Stripe Connect (Photographer Payments)">
          <p>
            If you use Stripe Connect to accept payments from your clients, you agree to
            Stripe&apos;s Connected Account Agreement in addition to these Terms. KyoriaOS
            charges a platform fee on transactions processed through Stripe Connect, as
            disclosed in your account settings. KyoriaOS is not responsible for disputes,
            chargebacks, or payment failures between you and your clients.
          </p>
        </Sub>
      </Section>

      <Section title="4. Acceptable Use">
        <p>You agree to use KyoriaOS only for lawful purposes and in compliance with these Terms. You must not:</p>
        <Ul items={[
          "Upload content that infringes on the intellectual property rights of others",
          "Upload illegal, defamatory, obscene, or harmful material",
          "Attempt to reverse-engineer, decompile, or circumvent any part of the platform",
          "Use the platform to spam, phish, or send unsolicited commercial messages",
          "Share access credentials to circumvent per-seat licensing",
          "Attempt to access another subscriber&apos;s data or tenant environment",
          "Introduce malware, bots, scrapers, or other harmful code",
          "Use the platform in a manner that exceeds your plan limits to degrade service for others",
          "Resell or sublicense access to the Service without written authorization",
        ]} />
      </Section>

      <Section title="5. Media, Files & Storage">
        <Sub title="Your Content">
          <p>
            You retain full ownership of all media, documents, photos, videos, floor plans,
            and other files (&quot;Content&quot;) you upload to KyoriaOS. By uploading Content, you
            grant KyoriaOS a limited, non-exclusive, royalty-free license to store, process,
            transcode, and display your Content solely for the purpose of operating the
            Service on your behalf.
          </p>
        </Sub>
        <Sub title="Content Responsibility">
          <p>
            You are solely responsible for ensuring that all Content you upload complies
            with applicable law and does not infringe on any third-party rights, including
            copyright, privacy rights, and model/property release requirements. KyoriaOS
            does not review uploaded Content and assumes no liability for Content that
            violates laws or third-party rights.
          </p>
        </Sub>
        <Sub title="Storage Limits & Retention">
          <p>
            Storage is subject to the limits of your subscription plan. KyoriaOS does not
            guarantee permanent storage of your Content. You are responsible for maintaining
            independent backups of all important files. KyoriaOS may delete Content
            associated with accounts that have been inactive, suspended, or cancelled for
            more than 90 days following notice to your registered email address.
          </p>
        </Sub>
        <Sub title="File Loss Disclaimer">
          <p>
            KyoriaOS uses commercially reasonable measures to protect stored files but
            cannot guarantee against loss, corruption, or accidental deletion. We strongly
            recommend maintaining your own backup copies of all media. KyoriaOS is not
            liable for any loss of data or files under any circumstances.
          </p>
        </Sub>
      </Section>

      <Section title="6. Client Portals & Agent Access">
        <p>
          KyoriaOS enables you to invite real estate agents and clients to access secure
          portals for gallery viewing, media downloads, and revision requests. You are
          responsible for:
        </p>
        <Ul items={[
          "Ensuring portal invitations are sent only to authorized recipients",
          "Not sharing gallery access tokens beyond intended recipients",
          "Informing agents and clients of any applicable usage restrictions on delivered media",
          "Compliance with any privacy obligations to your clients under applicable law",
        ]} />
        <p>
          KyoriaOS&apos;s role is limited to providing the technical infrastructure for portal
          access. We do not assume any responsibility for how agents or clients use
          downloaded media.
        </p>
      </Section>

      <Section title="7. Third-Party Services & Integrations">
        <p>
          KyoriaOS integrates with third-party services to deliver core functionality.
          These services are operated independently of KyoriaOS and have their own terms
          and privacy policies. By using KyoriaOS, you acknowledge that:
        </p>
        <Ul items={[
          "Stripe — for payment processing and billing. Subject to Stripe&apos;s Terms of Service.",
          "Resend — for transactional email delivery (booking confirmations, gallery links, invoices).",
          "Google Calendar — for calendar synchronization and scheduling.",
          "Cloudflare R2 — for media file storage and delivery.",
          "Google Maps — for address autocomplete and travel distance calculations.",
          "Anthropic (Claude AI) — for AI-assisted chatbot features on property websites.",
          "Zapier, Dropbox, Google Drive — for optional workflow integrations.",
          "Open-Meteo & Nominatim — for weather forecast data.",
        ]} />
        <p>
          <strong>KyoriaOS is not responsible for outages, delivery failures, data loss,
          errors, or service interruptions caused by any third-party provider.</strong> This
          includes but is not limited to: email delivery failures via Resend, payment
          processing delays via Stripe, calendar sync failures via Google Calendar, or
          file storage issues via Cloudflare R2. We will make commercially reasonable
          efforts to notify subscribers of known service disruptions.
        </p>
      </Section>

      <Section title="8. Notifications, Emails & Scheduling">
        <p>
          KyoriaOS provides automated notification features including booking confirmations,
          gallery delivery emails, photographer assignment notifications, invoice reminders,
          and scheduling alerts. You acknowledge that:
        </p>
        <Ul items={[
          "Email and SMS delivery is subject to the reliability of third-party providers",
          "KyoriaOS cannot guarantee that notifications will be delivered or received",
          "Missed notifications, missed bookings, or scheduling errors may result from factors outside our control",
          "You are responsible for establishing independent confirmation of critical scheduling with your clients and photographers",
          "KyoriaOS is not liable for any business losses resulting from undelivered or delayed notifications",
        ]} />
        <p>
          KyoriaOS is a <strong>software assistance tool</strong>, not a guaranteed
          business operations system. Critical business decisions should not rely solely
          on automated platform notifications.
        </p>
      </Section>

      <Section title="9. Intellectual Property">
        <Sub title="KyoriaOS Platform">
          <p>
            KyoriaOS and its licensors own all rights to the platform software, including
            its design, code, trademarks, logos, and documentation. Nothing in these Terms
            transfers any intellectual property rights in the platform to you.
          </p>
        </Sub>
        <Sub title="Your Content">
          <p>
            You retain all rights in Content you upload. We claim no ownership over your
            photos, videos, client data, or business information.
          </p>
        </Sub>
        <Sub title="Feedback">
          <p>
            If you provide suggestions, feedback, or feature requests, you grant KyoriaOS
            a perpetual, irrevocable, royalty-free license to use such feedback for any
            purpose without compensation to you.
          </p>
        </Sub>
      </Section>

      <Section title="10. Limitation of Liability">
        <Callout>
          <strong>IMPORTANT — PLEASE READ CAREFULLY.</strong> These limitations apply to
          the maximum extent permitted by applicable law.
        </Callout>
        <Sub title="Disclaimer of Warranties">
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY
            KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND
            NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
            ERROR-FREE, OR SECURE.
          </p>
        </Sub>
        <Sub title="Limitation of Damages">
          <p>
            TO THE FULLEST EXTENT PERMITTED BY LAW, KYORIAOS AND ITS OFFICERS, DIRECTORS,
            EMPLOYEES, CONTRACTORS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY:
          </p>
          <Ul items={[
            "Indirect, incidental, special, consequential, or punitive damages",
            "Loss of profits, revenue, goodwill, or business opportunities",
            "Loss or corruption of data or files",
            "Missed bookings, scheduling errors, or appointment conflicts",
            "Failed or delayed email, SMS, or push notifications",
            "Interrupted calendar sync or scheduling integration failures",
            "Third-party service outages (Stripe, Resend, Google, Cloudflare, etc.)",
            "Gallery downtime, delivery failures, or delayed media access",
            "Upload failures, file loss, or storage interruptions",
            "Any damages arising from unauthorized access to your account",
          ]} />
          <p>
            IN NO EVENT SHALL KYORIAOS&apos;S TOTAL CUMULATIVE LIABILITY TO YOU FOR ALL CLAIMS
            ARISING FROM OR RELATED TO THESE TERMS OR THE SERVICE EXCEED THE GREATER OF:
            (A) THE TOTAL SUBSCRIPTION FEES YOU PAID TO KYORIAOS IN THE THREE (3) MONTHS
            IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED
            U.S. DOLLARS ($100).
          </p>
        </Sub>
        <Sub title="Essential Basis">
          <p>
            The limitations and disclaimers in this section are an essential element of
            the basis of the agreement between KyoriaOS and you. KyoriaOS could not
            provide the Service on an economically reasonable basis without these
            limitations.
          </p>
        </Sub>
      </Section>

      <Section title="11. Indemnification">
        <p>
          You agree to indemnify, defend, and hold harmless KyoriaOS and its affiliates,
          officers, directors, employees, and agents from and against any claims, damages,
          obligations, losses, liabilities, costs, and expenses (including reasonable
          attorneys&apos; fees) arising from:
        </p>
        <Ul items={[
          "Your use of the Service in violation of these Terms",
          "Content you upload that infringes on third-party rights",
          "Your breach of any applicable law or regulation",
          "Your negligence or willful misconduct",
          "Any claim by your clients or agents arising from your use of the platform",
        ]} />
      </Section>

      <Section title="12. Account Suspension & Termination">
        <p>
          KyoriaOS may suspend or terminate your account at any time, with or without
          notice, if we determine that:
        </p>
        <Ul items={[
          "You have violated these Terms or our Acceptable Use Policy",
          "Your account poses a security or legal risk to KyoriaOS or other users",
          "You have engaged in fraudulent activity",
          "Required by applicable law or legal process",
        ]} />
        <p>
          Upon termination, your right to access the Service ceases immediately. You may
          request an export of your data within 30 days of termination. After 30 days
          following termination, we may permanently delete your account and associated data.
        </p>
      </Section>

      <Section title="13. Privacy">
        <p>
          Your use of KyoriaOS is also governed by our{" "}
          <a href="/privacy" className="text-[#3486cf] underline underline-offset-2">Privacy Policy</a>,
          which is incorporated into these Terms by reference.
        </p>
      </Section>

      <Section title="14. Modifications to the Service or Terms">
        <p>
          KyoriaOS reserves the right to modify or discontinue the Service (or any part
          of it) at any time, with or without notice. We will make commercially reasonable
          efforts to notify active subscribers of material changes to the Service or these
          Terms at least 14 days in advance via email.
        </p>
        <p>
          Your continued use of the Service after any changes take effect constitutes
          acceptance of the revised Terms.
        </p>
      </Section>

      <Section title="15. Governing Law & Dispute Resolution">
        <p>
          These Terms are governed by the laws of the State of California, without regard
          to conflict of law principles. You agree to resolve any disputes with KyoriaOS
          through binding individual arbitration administered by the American Arbitration
          Association under its Commercial Arbitration Rules.
        </p>
        <p>
          <strong>Class Action Waiver:</strong> You waive any right to participate in a
          class action lawsuit or class-wide arbitration against KyoriaOS.
        </p>
      </Section>

      <Section title="16. Miscellaneous">
        <Ul items={[
          "Entire Agreement: These Terms, together with the Privacy Policy and Cookie Policy, constitute the entire agreement between you and KyoriaOS.",
          "Severability: If any provision is found unenforceable, the remaining provisions remain in full effect.",
          "No Waiver: Failure to enforce any provision does not constitute a waiver of that right.",
          "Assignment: You may not assign these Terms without our written consent. KyoriaOS may assign these Terms in connection with a merger or acquisition.",
        ]} />
      </Section>

      <Section title="17. Contact">
        <p>
          For questions about these Terms, contact us at:{" "}
          <a href="mailto:legal@kyoriaos.com" className="text-[#3486cf] underline underline-offset-2">legal@kyoriaos.com</a>
        </p>
        <p className="text-gray-400 text-xs mt-2">KyoriaOS · app.kyoriaos.com</p>
      </Section>
    </LegalLayout>
  );
}
