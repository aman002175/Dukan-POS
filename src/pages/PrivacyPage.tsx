// Privacy Policy — DPDP Act 2023 aligned, plain-English version for shopkeepers.
import { LegalPage, LegalSection, LegalList } from '@/components/LegalPage';

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="How Dukaan POS handles your data — and why it stays yours."
    >
      <LegalSection title="1. The short version">
        <p>
          Your shop's data (products, customers, bills, khata/udhaar records) belongs to you. We do
          not sell it, we do not share it with advertisers, and we only process it to run the app
          features you use.
        </p>
      </LegalSection>

      <LegalSection title="2. What data we collect">
        <LegalList
          items={[
            <><strong>Account data:</strong> your email address and password (passwords are stored only as salted hashes by our authentication provider) when you create an account.</>,
            <><strong>Shop data:</strong> the inventory, sales, bills, customer names, phone numbers and udhaar (credit ledger) entries you enter into the app. This is entered by you, for you.</>,
            <><strong>Local device data:</strong> in guest mode, all of the above stays in your browser's local storage on your device only.</>,
            <><strong>Technical logs:</strong> minimal rate-limit records (email/IP counters for OTP delivery) kept for security and abuse prevention.</>,
            <><strong>AI conversations:</strong> if you use the AI assistant, the messages you type and shop summary context needed to answer are processed to generate a response.</>,
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Guest mode and local storage">
        <p>
          You can use Dukaan POS without an account. In guest mode your entire shop lives in your
          browser's local storage on that device. It is never uploaded anywhere. Clearing your
          browser data, uninstalling the PWA, or using another device will not show guest data
          anywhere else — treat it like a paper notebook kept in the shop drawer.
        </p>
        <p>
          We use local storage (not cookies) for session and app data. No advertising or tracking
          cookies are used.
        </p>
      </LegalSection>

      <LegalSection title="4. Third-party services we use">
        <p>We deliberately keep this list tiny:</p>
        <LegalList
          items={[
            <><strong>Supabase</strong> — authentication, cloud database and email-OTP delivery infrastructure. Your shop data is stored in Supabase's hosted Postgres with row-level security so only your account can read its own row.</>,
            <><strong>Brevo</strong> — sends the one-time verification code email during signup. Receives your email address and the OTP email content; nothing else.</>,
            <><strong>Inception Labs</strong> — processes AI assistant requests (the text you send plus a short shop summary) to generate responses. AI use is optional (see section 6).</>,
            <><strong>Vercel</strong> — hosts the app itself.</>,
            <><strong>Upstash</strong> — rate limiting for the AI endpoint (stores anonymous request counters).</>,
          ]}
        />
        <p>None of these receive your data for advertising. None sell it onward.</p>
      </LegalSection>

      <LegalSection title="5. How your data is protected">
        <LegalList
          items={[
            <>Passwords are hashed by our auth provider; we never see them.</>,
            <>Row Level Security ensures a logged-in account can only read and write its own shop row.</>,
            <>Signup uses a one-time code sent to your email; codes are stored only as HMAC-SHA256 hashes and expire in 10 minutes.</>,
            <>All traffic runs over HTTPS. Security headers (CSP, frame protection) are enforced on the app.</>,
            <>AI endpoints are rate-limited and require a signed-in session.</>,
          ]}
        />
      </LegalSection>

      <LegalSection title="6. AI assistant disclosure">
        <p>
          The optional AI assistant ("Dukaan AI") processes the text you type and a limited summary
          of your shop data (like low-stock counts or a customer's balance) to answer questions and
          perform actions you ask for. This content is sent to our AI provider (Inception Labs) to
          generate the response.
        </p>
        <p>
          <strong>AI is completely optional.</strong> You can simply never open the AI tab, and no
          AI requests will ever be made with your data. The assistant may make mistakes — always
          double-check important figures in your reports before acting on them.
        </p>
      </LegalSection>

      <LegalSection title="7. Your rights (delete, export, correct)">
        <LegalList
          items={[
            <><strong>Access & export:</strong> your shop data is visible in the app and can be exported from Settings at any time.</>,
            <><strong>Delete:</strong> you can delete your shop's cloud row from within the app, ask us to delete your account and all associated data by emailing us, or simply clear local storage for guest data.</>,
            <><strong>Correct:</strong> edit any record directly in the app — changes sync to cloud automatically.</>,
            <><strong>Withdraw consent:</strong> stop using cloud features or the AI assistant at any time; guest mode keeps working.</>,
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Data retention">
        <p>
          Your shop data is kept as long as your account exists, because the product is your store's
          record-keeping. When you request deletion, we remove your cloud data and account. Rate-limit
          and security logs are deleted automatically within 30 days. Guest-mode data is deleted the
          moment you clear it from your device.
        </p>
      </LegalSection>

      <LegalSection title="9. Children's data">
        <p>
          Dukaan POS is a business tool for shopkeepers and is not directed at children under 18. We
          do not knowingly collect data from children.
        </p>
      </LegalSection>

      <LegalSection title="10. Your rights under India's DPDP Act, 2023">
        <p>
          If you are in India, the Digital Personal Data Protection Act, 2023 gives you the right to
          access a summary of your personal data, the right to correction and erasure, the right to
          nominate, and the right to grievance redressal. Exercising the rights in section 7
          satisfies these; for anything else, contact our Grievance Officer below and we will
          respond within the timeframe the Act prescribes.
        </p>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm">
          <p className="font-bold text-gray-900 mb-1">Grievance Officer</p>
          <p className="text-gray-600">
            29 Devs — Dukaan POS
            <br />
            Email: <a className="text-orange-600 hover:underline font-medium" href="mailto:29devs@proton.me">29devs@proton.me</a>
            <br />
            Response time: within 30 days of your request (usually much sooner).
          </p>
        </div>
      </LegalSection>

      <LegalSection title="11. Changes to this policy">
        <p>
          If we change this policy materially, we will update the date at the top and show a notice
          in the app. Continued use after a change means you accept the updated policy.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

export default PrivacyPage;
