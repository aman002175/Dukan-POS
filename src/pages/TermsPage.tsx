// Terms of Service — plain-English rules for Dukaan POS. India governing law,
// worldwide launch note, user-owned data vs app-owned branding.
import { Link } from 'react-router-dom';
import { LegalPage, LegalSection, LegalList } from '@/components/LegalPage';

export function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      subtitle="The rules of using Dukaan POS. Short, honest, no small print games."
    >
      <LegalSection title="1. Accepting these terms">
        <p>
          By creating an account, ticking the agreement box, or using Dukaan POS as a guest, you
          agree to these Terms and to our{' '}
          <Link to="/privacy" className="text-orange-600 hover:underline font-medium">
            Privacy Policy
          </Link>
          . If you do not agree, please do not use the app.
        </p>
      </LegalSection>

      <LegalSection title="2. What Dukaan POS is">
        <p>
          Dukaan POS is a point-of-sale and shop-management tool for small shops: billing,
          inventory, customer khata (credit ledger), reports and an optional AI assistant. It is a
          tool — you remain responsible for your business records and compliance (GST, income-tax,
          local rules).
        </p>
      </LegalSection>

      <LegalSection title="3. Your account">
        <LegalList
          items={[
            <>You must provide a valid email address and keep your password safe. You are responsible for activity under your account.</>,
            <>One account per shop owner is the intent; do not share credentials across shops.</>,
            <>You must be at least 18 years old to create an account.</>,
            <>You can stop using the app and request deletion of your account and cloud data at any time (see Privacy Policy, section 7).</>,
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Your data vs our app">
        <LegalList
          items={[
            <><strong>You own your shop data.</strong> Products, customers, bills, khata entries — all of it is yours. We claim no ownership over it and will never sell it.</>,
            <><strong>We own the app.</strong> The Dukaan POS name, logo, design, code and branding belong to 29 Devs. You may not copy, resell, rebrand or create a competing product from our app.</>,
            <>You may not scrape, reverse-engineer, or access the service through unauthorized automated means.</>,
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Acceptable use">
        <p>You agree NOT to:</p>
        <LegalList
          items={[
            <>Use the app for illegal purposes, or to store/record unlawful content (e.g., unlicensed goods, evading taxes intentionally, harassment of customers).</>,
            <>Attempt to access other users' data, bypass security controls, or probe/attack the service (we log and act on abuse).</>,
            <>Abuse the AI or OTP systems (spamming verification emails, automated scraping, denial-of-wallet attacks).</>,
            <>Misrepresent the app as your own product, or remove branding from exports/bills where it appears.</>,
            <>Upload malicious code or use the app to distribute malware.</>,
          ]}
        />
        <p>
          Breaking these rules can lead to suspension or termination of your account (section 8).
        </p>
      </LegalSection>

      <LegalSection title="6. Backups are your responsibility">
        <p>
          <strong>Important:</strong> Dukaan POS provides cloud sync and local storage, but no
          backup service is guaranteed. You are responsible for periodically exporting your data
          (Reports/Settings) and keeping your own copies. Hardware loss, browser data clearing, or
          account loss can result in permanent data loss if no backup exists. Treat exports like a
          shopkeeper treats a backup ledger (bahut zaroori hai bhai).
        </p>
      </LegalSection>

      <LegalSection title={'7. No-liability / service "as is"'}>
        <p>
          The app is provided <strong>"as is" and "as available"</strong>, without warranties of any
          kind. To the maximum extent permitted by law:
        </p>
        <LegalList
          items={[
            <>We do not guarantee uninterrupted or error-free service (internet down, provider outage, phone full — things happen).</>,
            <>We are not liable for lost profits, lost data, or business losses arising from use of the app, including data loss where no backup was kept.</>,
            <>AI responses can be wrong — always verify important figures before acting.</>,
            <>Our total liability for any claim is limited to the amount you paid us in the 12 months before the claim (currently the app is free, so this is effectively zero).</>,
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Suspension and termination">
        <p>
          We may suspend or terminate accounts that break these Terms, abuse the service, attack
          other users, or create legal risk for us. Where practical, we will warn you first;
          serious abuse (security attacks, illegal content) may mean immediate suspension. You may
          stop using the app at any time and request your cloud data be deleted.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes to the service or terms">
        <p>
          We may update these Terms as the product evolves. Material changes will be reflected by
          the updated date at the top and, where significant, a notice in the app. Continuing to use
          Dukaan POS after a change means you accept the new Terms.
        </p>
      </LegalSection>

      <LegalSection title="10. Governing law and jurisdiction">
        <p>
          These Terms are governed by the laws of <strong>India</strong>, and disputes will be
          subject to the exclusive jurisdiction of the courts of India.
        </p>
        <p>
          <strong>Worldwide users:</strong> Dukaan POS is built in India and launched worldwide. If
          you use the app from outside India, you agree to this Indian governing law; local
          mandatory consumer-rights protections of your country (where applicable) remain yours.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          Questions about these Terms: <a className="text-orange-600 hover:underline font-medium" href="mailto:29devs@proton.me">29devs@proton.me</a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}

export default TermsPage;
