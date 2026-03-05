"use client";

import { useRouter } from "next/navigation";

export default function PrivacyPolicyPage() {
  const router = useRouter();
  const effectiveDate = "March 3, 2026";

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #0a0a14 0%, #0f0f1a 100%)",
      color: "rgba(255,255,255,0.85)",
      fontFamily: "'DM Sans', Inter, system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px 80px" }}>
        {/* Back button */}
        <button
          onClick={() => router.back()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "none", border: "none", color: "rgba(255,255,255,0.5)",
            fontSize: 13, cursor: "pointer", marginBottom: 32,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>

        <h1 style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 40 }}>Effective Date: {effectiveDate}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 32, lineHeight: 1.7, fontSize: 14 }}>

          <Section title="1. Introduction">
            <p>Let&apos;s Go, LLC (&quot;Let&apos;s Go,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy and the security of your personal information. This Privacy Policy explains in detail how we collect, use, disclose, store, and safeguard your information when you use our website, mobile applications, APIs, and all related services (collectively, the &quot;Services&quot;).</p>
            <p>By creating an account or using the Services, you consent to the data practices described in this Privacy Policy. If you do not agree with any part of this Privacy Policy, please do not create an account or use the Services. This Privacy Policy is incorporated by reference into our <a href="/terms" style={{ color: "#00d4ff", textDecoration: "underline" }}>Terms of Service</a>.</p>
          </Section>

          {/* ════════════════════════════════════════════════
              SECTION 2: DATA COLLECTION
              ════════════════════════════════════════════════ */}

          <Section title="2. Information We Collect">
            <p>We collect information in three ways: information you provide directly, information collected automatically, and information from third-party sources.</p>

            <p><strong style={{ color: "#fff" }}>2.1 Information You Provide Directly</strong></p>

            <p><strong style={{ color: "#fff" }}>Account Registration:</strong></p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Full name (first name, last name)</li>
              <li>Email address</li>
              <li>Password (encrypted, never stored in plaintext)</li>
              <li>Phone number (optional)</li>
              <li>ZIP code (used for location-based discovery)</li>
            </ul>

            <p><strong style={{ color: "#fff" }}>Profile Information:</strong></p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Username (optional, publicly visible)</li>
              <li>Profile photo / avatar</li>
              <li>Bio (optional)</li>
              <li>Location preferences</li>
            </ul>

            <p><strong style={{ color: "#fff" }}>Financial and Tax Information:</strong></p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Payout method preference (Venmo, PayPal, or bank transfer)</li>
              <li>Payout account identifier (account handle, email, or account number)</li>
              <li>Social Security Number (SSN) or Taxpayer Identification Number (TIN) — collected only if you reach the $600 IRS reporting threshold per calendar year</li>
              <li>W-9 form information (when required for tax compliance)</li>
            </ul>

            <p><strong style={{ color: "#fff" }}>Receipt Data:</strong></p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Photographs of receipts</li>
              <li>Transaction amounts (subtotal)</li>
              <li>Transaction dates</li>
              <li>Associated business identification</li>
              <li>Submission metadata (timestamp, device information)</li>
            </ul>

            <p><strong style={{ color: "#fff" }}>User-Generated Content:</strong></p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Photos and videos submitted to the Experiences feed</li>
              <li>Captions, tags, and descriptions</li>
              <li>Comments on other users&apos; content</li>
              <li>Ratings and reviews (star ratings, &quot;Would Go Again&quot; indicators, private notes)</li>
            </ul>

            <p><strong style={{ color: "#fff" }}>Social and Contact Data:</strong></p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Friend requests and friend list</li>
              <li>Device contacts — only when you explicitly grant permission via your device&apos;s native Contact Picker interface (names, email addresses, phone numbers). We do NOT access your contacts automatically or in the background</li>
              <li>Email addresses entered manually for invitation purposes</li>
              <li>Referral codes shared with invitees</li>
            </ul>

            <p><strong style={{ color: "#fff" }}>Game and Interaction Data:</strong></p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Game session data (5v3v1, Group Vote, Date Night Generator)</li>
              <li>Voting selections and preferences</li>
              <li>Game outcomes and history</li>
            </ul>

            <p><strong style={{ color: "#fff" }}>Communications:</strong></p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Messages sent through our in-app messaging/support system</li>
              <li>Support ticket content</li>
              <li>Emails and other correspondence with Let&apos;s Go</li>
            </ul>

            <p><strong style={{ color: "#fff" }}>Business Account Information (for Partners):</strong></p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Legal business name and public-facing business name</li>
              <li>Business type and category</li>
              <li>Physical address, phone number, and customer-facing email</li>
              <li>Operating hours and age restrictions</li>
              <li>Verification documents (business license, EIN certificate, or utility bill)</li>
              <li>Business logo and promotional images</li>
              <li>Bank account information (bank name, routing number, account number, account type) or credit/debit card information for billing</li>
              <li>Billing address</li>
              <li>Authorized representative information (name, role/title, contact details)</li>
              <li>Payout tier configuration</li>
              <li>Digital signature and legal acknowledgment records</li>
              <li>Marketing and advertising permissions</li>
            </ul>

            <p><strong style={{ color: "#fff" }}>2.2 Information Collected Automatically</strong></p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li><strong>Device Information:</strong> Device type, operating system, browser type and version, screen resolution, unique device identifiers, and mobile carrier</li>
              <li><strong>Usage Data:</strong> Pages visited, features used, buttons clicked, search queries, filter selections, swipe interactions, time spent on pages, and navigation patterns</li>
              <li><strong>Location Data:</strong> Approximate location derived from your IP address and the ZIP code you provide during registration. We do NOT use GPS or precise geolocation tracking</li>
              <li><strong>Activity Data:</strong> Last active timestamp (updated periodically when you use the app, used to derive online/away/offline status visible to your friends)</li>
              <li><strong>Log Data:</strong> IP address, access timestamps, referring URLs, error logs, and server response times</li>
              <li><strong>Session Data:</strong> Authentication tokens stored in your browser&apos;s local storage (key: &quot;letsgo-auth&quot;) to maintain your login session</li>
              <li><strong>Push Subscription Data:</strong> If you enable push notifications, we store your browser push subscription endpoint, encryption keys (p256dh and auth), and user agent string</li>
            </ul>

            <p><strong style={{ color: "#fff" }}>2.3 Information from Third-Party Sources</strong></p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li><strong>OAuth Providers:</strong> If you sign in using a third-party provider (e.g., Google), we may receive your name, email address, and profile photo from that provider, subject to your authorization and their privacy policy</li>
              <li><strong>Participating Businesses:</strong> Businesses may provide information relevant to receipt verification, dispute resolution, or fraud investigation</li>
            </ul>
          </Section>

          {/* ════════════════════════════════════════════════
              SECTION 3: HOW WE USE DATA
              ════════════════════════════════════════════════ */}

          <Section title="3. How We Use Your Information">
            <p>We use the information we collect for the following purposes:</p>

            <p><strong style={{ color: "#fff" }}>3.1 Providing and Operating the Services:</strong></p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Create, maintain, and manage your account</li>
              <li>Process receipt submissions and calculate Payouts</li>
              <li>Facilitate progressive cash-back rewards and visit tracking</li>
              <li>Display business listings and personalize discovery recommendations based on your location, preferences, and interaction history</li>
              <li>Facilitate social features (friend connections, contact matching, invitations)</li>
              <li>Operate interactive games and group activities</li>
              <li>Process Payout cashout requests and deliver payments</li>
              <li>Display User-Generated Content on the Experiences feed</li>
            </ul>

            <p><strong style={{ color: "#fff" }}>3.2 Verification and Fraud Prevention:</strong></p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Verify receipt authenticity through manual and automated systems</li>
              <li>Detect, investigate, and prevent fraudulent, unauthorized, or suspicious activity</li>
              <li>Monitor account activity patterns for anomalies</li>
              <li>Verify business identities and documentation</li>
              <li>Enforce our Terms of Service</li>
            </ul>

            <p><strong style={{ color: "#fff" }}>3.3 Legal and Tax Compliance:</strong></p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Comply with IRS reporting requirements (Form 1099)</li>
              <li>Respond to subpoenas, court orders, and legal process</li>
              <li>Maintain records as required by applicable tax and financial regulations</li>
              <li>Cooperate with law enforcement investigations when legally required</li>
            </ul>

            <p><strong style={{ color: "#fff" }}>3.4 Communications:</strong></p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Send transactional notifications (receipt status, Payout processing, tier changes, account security)</li>
              <li>Send invitation emails on your behalf (only when you initiate contact imports or manual invitations)</li>
              <li>Respond to your support inquiries and feedback</li>
              <li>Send marketing and promotional communications (with your consent, where required by law)</li>
            </ul>

            <p><strong style={{ color: "#fff" }}>3.5 Improvement and Analytics:</strong></p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Analyze usage patterns, trends, and aggregated statistics to improve the Services</li>
              <li>Test new features and optimize user experience</li>
              <li>Monitor Platform performance and diagnose technical issues</li>
              <li>Generate aggregated, anonymized business analytics for Participating Businesses (Premium feature)</li>
            </ul>
          </Section>

          {/* ════════════════════════════════════════════════
              SECTION 4: DATA SHARING
              ════════════════════════════════════════════════ */}

          <Section title="4. How We Share Your Information">
            <p><strong style={{ color: "#fff" }}>We do NOT sell your personal information.</strong> We do not sell, rent, or trade your personal data to third parties for their marketing purposes. We may share your information only in the following limited circumstances:</p>

            <p><strong style={{ color: "#fff" }}>4.1 With Participating Businesses:</strong> We share limited information with businesses to facilitate the rewards program. Specifically: (a) your receipt submission data (amount, date, approval status) for their business only; (b) your aggregate visit count at their business; and (c) your first name and profile photo (if you submit User Content associated with their business). Businesses do NOT receive your full profile, financial information, tax information, data from other businesses, friend list, or contact information.</p>

            <p><strong style={{ color: "#fff" }}>4.2 With Your Friends:</strong> If you connect with other users as friends, they may see: your name, username, profile photo, online status (online/away/offline), and your activity within shared games. Friends do NOT see your financial information, receipt details, Payout amounts, or contact list.</p>

            <p><strong style={{ color: "#fff" }}>4.3 Service Providers:</strong> We share information with third-party service providers who perform services on our behalf. These providers include:</p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li><strong>Supabase:</strong> Cloud database hosting, user authentication, and file storage (your data is stored on Supabase&apos;s infrastructure with encryption at rest and in transit)</li>
              <li><strong>Resend:</strong> Transactional and invitation email delivery (receives recipient email addresses and email content)</li>
              <li><strong>Google Maps Platform:</strong> Address autocomplete and geolocation for business onboarding (receives address queries during business registration; does NOT track individual user locations)</li>
              <li><strong>Payment Processors:</strong> Payout delivery and business billing (receives necessary financial information to process payments)</li>
              <li><strong>Vercel:</strong> Web application hosting and content delivery</li>
            </ul>
            <p>All service providers are contractually obligated to use your information only for the specific purposes we direct and to maintain appropriate security measures. We require service providers to comply with applicable data protection laws.</p>

            <p><strong style={{ color: "#fff" }}>4.4 Tax Authorities:</strong> We are legally required to report Payout information to the Internal Revenue Service (IRS) and applicable state tax authorities when you meet the $600 annual reporting threshold. Information shared includes your legal name, address, SSN/TIN, and total Payout amounts.</p>

            <p><strong style={{ color: "#fff" }}>4.5 Legal Compliance and Safety:</strong> We may disclose your information if we believe, in good faith, that disclosure is: (a) required by applicable law, regulation, legal process, or governmental request (including subpoenas and court orders); (b) necessary to protect the rights, property, or safety of Let&apos;s Go, our users, or the public; (c) necessary to investigate or prevent fraud, security breaches, or other harmful activity; (d) necessary to enforce our Terms of Service; or (e) required to cooperate with law enforcement investigations.</p>

            <p><strong style={{ color: "#fff" }}>4.6 Business Transfers:</strong> In the event of a merger, acquisition, bankruptcy, dissolution, reorganization, asset sale, or similar corporate transaction, your information may be transferred to the successor entity as part of that transaction. We will notify you via email and/or prominent notice on the Platform of any change in ownership or use of your personal information.</p>

            <p><strong style={{ color: "#fff" }}>4.7 Aggregated and De-Identified Data:</strong> We may share aggregated, anonymized, or de-identified data that cannot reasonably be used to identify you. For example, we may share aggregate statistics about Platform usage, visit trends, or geographic activity patterns with Participating Businesses or for marketing purposes.</p>

            <p><strong style={{ color: "#fff" }}>4.8 With Your Consent:</strong> We may share your information for other purposes with your explicit, informed consent.</p>
          </Section>

          {/* ════════════════════════════════════════════════
              SECTION 5: CONTACT DATA
              ════════════════════════════════════════════════ */}

          <Section title="5. Contact Data and Invitations">
            <p><strong style={{ color: "#fff" }}>5.1 How Contact Data Is Collected.</strong> The Platform offers a &quot;Find Your Friends&quot; feature that allows you to check if people you know are already on Let&apos;s Go. This feature uses the Contact Picker API — a browser-level interface that shows your device&apos;s native contact selection dialog. You choose which specific contacts to share. We NEVER access your full address book automatically or in the background. On devices where the Contact Picker API is not available (e.g., iOS Safari), we offer manual email entry and share-link alternatives instead.</p>
            <p><strong style={{ color: "#fff" }}>5.2 How Contact Data Is Used.</strong> Imported contact information (names, email addresses, phone numbers) is used solely to: (a) match email addresses against existing Let&apos;s Go user accounts so you can send friend requests; and (b) send invitation emails to non-users, only when you explicitly request it. Contact data is NOT used for any other purpose, including advertising, profiling, or marketing by Let&apos;s Go or any third party.</p>
            <p><strong style={{ color: "#fff" }}>5.3 Invitation Emails.</strong> When you invite contacts, Let&apos;s Go sends a single invitation email on your behalf. The email identifies you by name as the sender. Recipients are not added to any mailing list and will not receive further emails unless they create their own account. Invitations are rate-limited (maximum 100 per day) to prevent abuse.</p>
            <p><strong style={{ color: "#fff" }}>5.4 Contact Data Storage.</strong> Contact invitation records (inviter ID, contact name, contact email, and invitation status) are stored in our database to: prevent duplicate invitations to the same person; enforce daily rate limits; and track invitation acceptance. We do NOT store your full contact list — only the contacts you explicitly selected for matching or invitation.</p>
          </Section>

          {/* ════════════════════════════════════════════════
              SECTION 6: DATA SECURITY
              ════════════════════════════════════════════════ */}

          <Section title="6. Data Security">
            <p>We implement commercially reasonable technical, administrative, and organizational security measures designed to protect your information from unauthorized access, use, alteration, disclosure, or destruction. These measures include:</p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li><strong>Encryption in Transit:</strong> All data transmitted between your device and our servers is encrypted using TLS/SSL (HTTPS)</li>
              <li><strong>Encryption at Rest:</strong> Sensitive data stored in our databases is encrypted at rest</li>
              <li><strong>Access Controls:</strong> Role-based access controls limit who within our organization can access personal data</li>
              <li><strong>Authentication Security:</strong> Passwords are hashed using industry-standard algorithms; authentication tokens are securely generated and managed</li>
              <li><strong>Row-Level Security:</strong> Database-level security policies ensure users can only access their own data</li>
              <li><strong>Regular Security Reviews:</strong> We conduct periodic reviews of our security practices and infrastructure</li>
              <li><strong>Service Role Separation:</strong> Server-side operations use isolated service credentials with elevated privileges; client-side operations use restricted credentials that enforce access policies</li>
            </ul>
            <p>However, no method of electronic transmission or storage is 100% secure. While we strive to use commercially reasonable means to protect your personal information, we cannot guarantee absolute security. You are responsible for maintaining the security of your account credentials and for any activity under your account. If you believe your account has been compromised, contact us immediately at security@letsgolive.app.</p>
          </Section>

          {/* ════════════════════════════════════════════════
              SECTION 7: DATA RETENTION
              ════════════════════════════════════════════════ */}

          <Section title="7. Data Retention">
            <p>We retain your personal information for as long as reasonably necessary to fulfill the purposes described in this Privacy Policy. Specific retention periods include:</p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li><strong>Account Data:</strong> Retained as long as your account is active. Upon account deletion request, account data is deleted or anonymized within thirty (30) days, except for data we are required to retain by law</li>
              <li><strong>Receipt Data and Payout Records:</strong> Retained for a minimum of seven (7) years from the date of the transaction to comply with IRS recordkeeping requirements and applicable tax laws, even if you delete your account</li>
              <li><strong>Tax Information (SSN/TIN, W-9):</strong> Retained for a minimum of seven (7) years after the last tax year for which the information was used for reporting</li>
              <li><strong>Business Verification Documents:</strong> Retained for the duration of the Business Account plus three (3) years after account closure</li>
              <li><strong>User-Generated Content:</strong> Retained as long as the content is published on the Platform. You may request removal, subject to the license granted in the Terms of Service</li>
              <li><strong>Contact Invitation Records:</strong> Retained for one (1) year from the date of invitation, then automatically purged</li>
              <li><strong>Fraud Investigation Records:</strong> Retained indefinitely to support ongoing fraud prevention and law enforcement cooperation</li>
              <li><strong>Server Logs:</strong> Retained for ninety (90) days for debugging and security purposes</li>
              <li><strong>Activity Data:</strong> Online status data (last_seen_at) is retained for ninety (90) days</li>
            </ul>
            <p>When data is no longer needed for the purposes described above and is not subject to legal retention requirements, it is securely deleted or anonymized.</p>
          </Section>

          {/* ════════════════════════════════════════════════
              SECTION 8: YOUR RIGHTS
              ════════════════════════════════════════════════ */}

          <Section title="8. Your Rights and Choices">
            <p><strong style={{ color: "#fff" }}>8.1 Access and Correction.</strong> You can access and update most of your personal information directly through your profile settings in the app. If you need to access or correct information that is not editable through the app, contact us at privacy@letsgolive.app.</p>

            <p><strong style={{ color: "#fff" }}>8.2 Account Deletion.</strong> You may request the deletion of your account by contacting us at support@letsgolive.app. Upon receiving your request, we will: delete or anonymize your account data within thirty (30) days; retain receipt, Payout, and tax records as required by law (minimum 7 years); delete your User-Generated Content from the Platform (though cached copies may persist temporarily); and remove your data from active databases (backup copies may be retained per our backup retention schedule). Please note that account deletion is permanent and cannot be reversed.</p>

            <p><strong style={{ color: "#fff" }}>8.3 Data Portability.</strong> You may request a copy of your personal data in a commonly used, machine-readable format by contacting us at privacy@letsgolive.app. We will provide the data within thirty (30) days of your request.</p>

            <p><strong style={{ color: "#fff" }}>8.4 Marketing Communications.</strong> You may opt out of marketing and promotional emails at any time by: clicking the &quot;unsubscribe&quot; link at the bottom of any marketing email; adjusting your email notification preferences in the app; or contacting us at privacy@letsgolive.app. Opting out of marketing communications does NOT affect transactional communications (receipt notifications, Payout alerts, security notices), which are required for the operation of the Services.</p>

            <p><strong style={{ color: "#fff" }}>8.5 Push Notifications.</strong> You can disable push notifications at any time through: your device&apos;s system settings; your browser&apos;s notification settings; or the in-app notification preferences panel.</p>

            <p><strong style={{ color: "#fff" }}>8.6 Cookies and Local Storage.</strong> You can control cookies and local storage through your browser settings. Note that clearing local storage will log you out of the app (our session is stored under the &quot;letsgo-auth&quot; key). Disabling cookies or local storage may impair the functionality of the Services.</p>

            <p><strong style={{ color: "#fff" }}>8.7 Contact Data.</strong> Contact data imported via the Contact Picker is processed at the time of import and stored only as invitation records. You can request deletion of your invitation records by contacting privacy@letsgolive.app.</p>
          </Section>

          {/* ════════════════════════════════════════════════
              SECTION 9: CCPA/CPRA
              ════════════════════════════════════════════════ */}

          <Section title="9. California Privacy Rights (CCPA/CPRA)">
            <p>If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA):</p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li><strong>Right to Know:</strong> You have the right to request that we disclose the categories and specific pieces of personal information we have collected about you, the categories of sources from which we collected it, the business or commercial purposes for collection, and the categories of third parties with whom we share it</li>
              <li><strong>Right to Delete:</strong> You have the right to request that we delete personal information we have collected from you, subject to certain exceptions (including legal retention requirements for tax records)</li>
              <li><strong>Right to Correct:</strong> You have the right to request correction of inaccurate personal information</li>
              <li><strong>Right to Opt Out of Sale or Sharing:</strong> We do NOT sell or share your personal information for cross-context behavioral advertising. Therefore, there is no need to opt out of such practices</li>
              <li><strong>Right to Limit Use of Sensitive Personal Information:</strong> We only use sensitive personal information (such as SSN) for the specific purposes described in this Privacy Policy (tax compliance). We do not use it for profiling or advertising</li>
              <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your CCPA/CPRA rights. You will not receive different pricing, service quality, or access to features based on exercising these rights</li>
            </ul>
            <p><strong style={{ color: "#fff" }}>How to Exercise Your Rights:</strong> To submit a CCPA/CPRA request, email us at privacy@letsgolive.app with the subject line &quot;CCPA Request.&quot; We will verify your identity before processing your request. You may also designate an authorized agent to submit requests on your behalf. We will respond to verified requests within forty-five (45) days, with the possibility of a forty-five (45) day extension if reasonably necessary (we will notify you of any extension).</p>
            <p><strong style={{ color: "#fff" }}>Categories of Personal Information Collected (last 12 months):</strong></p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Identifiers (name, email, phone, username, IP address)</li>
              <li>Financial information (bank account details, payment methods, Payout records)</li>
              <li>Commercial information (receipt data, transaction history, subscription status)</li>
              <li>Internet/electronic activity (usage data, device info, log data)</li>
              <li>Geolocation data (approximate, from IP address and ZIP code)</li>
              <li>Audio/visual information (photos, videos submitted as User Content)</li>
              <li>Professional/employment information (for business account representatives)</li>
              <li>Sensitive personal information (SSN/TIN, for tax compliance only)</li>
              <li>Inferences (derived data such as payout tier eligibility and visit patterns)</li>
            </ul>
          </Section>

          {/* ════════════════════════════════════════════════
              SECTION 10: OTHER STATE PRIVACY RIGHTS
              ════════════════════════════════════════════════ */}

          <Section title="10. Other State Privacy Rights">
            <p>Residents of Virginia (VCDPA), Colorado (CPA), Connecticut (CTDPA), Utah (UCPA), and other states with comprehensive privacy laws may have similar rights to those described in Section 9, including the right to access, correct, delete, and port personal data, and the right to opt out of targeted advertising (which we do not engage in). To exercise these rights, contact us at privacy@letsgolive.app. We will verify your identity and respond within the timeframe required by your state&apos;s law.</p>
            <p>If you are not satisfied with our response to your privacy request, you may have the right to appeal our decision. To submit an appeal, email us at privacy@letsgolive.app with the subject line &quot;Privacy Appeal.&quot;</p>
          </Section>

          {/* ════════════════════════════════════════════════
              SECTION 11: CHILDREN
              ════════════════════════════════════════════════ */}

          <Section title="11. Children&apos;s Privacy">
            <p>The Services are not directed to and are not intended for individuals under the age of eighteen (18). We do not knowingly collect, use, or disclose personal information from anyone under 18 years of age. If we learn or have reason to believe that we have collected information from a child under 18, we will promptly take steps to delete that information and terminate the associated account.</p>
            <p>If you are a parent or guardian and believe that your child has provided us with personal information without your consent, please contact us immediately at privacy@letsgolive.app so that we can take appropriate action.</p>
          </Section>

          {/* ════════════════════════════════════════════════
              SECTION 12: BIOMETRIC DATA
              ════════════════════════════════════════════════ */}

          <Section title="12. Biometric Data">
            <p>Let&apos;s Go does NOT collect, store, or process biometric data (such as fingerprints, facial recognition data, voiceprints, or retinal scans). Receipt verification is performed through image analysis of receipt documents, not biometric identification of individuals.</p>
          </Section>

          {/* ════════════════════════════════════════════════
              SECTION 13: DO NOT TRACK
              ════════════════════════════════════════════════ */}

          <Section title="13. Do Not Track Signals">
            <p>Some web browsers transmit &quot;Do Not Track&quot; (DNT) signals to websites. Because there is no universally accepted standard for how to respond to DNT signals, we do not currently respond to DNT signals. However, we do not engage in cross-site tracking or targeted advertising based on your browsing activity across other websites.</p>
          </Section>

          {/* ════════════════════════════════════════════════
              SECTION 14: INTERNATIONAL
              ════════════════════════════════════════════════ */}

          <Section title="14. International Users">
            <p>The Services are operated from and hosted in the United States. If you access the Services from outside the United States, you understand and agree that your information may be transferred to, stored, and processed in the United States, where data protection laws may differ from those in your country. By using the Services, you consent to such transfer, storage, and processing.</p>
          </Section>

          {/* ════════════════════════════════════════════════
              SECTION 15: THIRD-PARTY LINKS
              ════════════════════════════════════════════════ */}

          <Section title="15. Third-Party Links and Services">
            <p>The Platform may contain links to third-party websites, applications, or services that are not operated or controlled by Let&apos;s Go. This Privacy Policy does not apply to those third-party services. We are not responsible for the privacy practices, content, or security of any third-party website or service. We encourage you to review the privacy policies of any third-party service you access through or in connection with the Platform.</p>
            <p>Specifically, our Services integrate with the following third-party providers, each with their own privacy policies: Supabase (database and authentication), Resend (email delivery), Google (maps and address services), and payment processors (for Payout delivery and business billing).</p>
          </Section>

          {/* ════════════════════════════════════════════════
              SECTION 16: CHANGES
              ════════════════════════════════════════════════ */}

          <Section title="16. Changes to This Privacy Policy">
            <p>We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. When we make material changes, we will: (a) post the updated Privacy Policy on the Platform with a new effective date; (b) send you an email notification (for material changes that significantly affect how we use your data); and/or (c) display a prominent notice within the app.</p>
            <p>Your continued use of the Services after the effective date of an updated Privacy Policy constitutes your acceptance of the updated practices. If you do not agree with a material change, you should stop using the Services and request account deletion.</p>
          </Section>

          {/* ════════════════════════════════════════════════
              SECTION 17: CONTACT
              ════════════════════════════════════════════════ */}

          <Section title="17. Contact Us">
            <p>If you have questions, concerns, or complaints about this Privacy Policy, our data practices, or your personal information, please contact us at:</p>
            <p style={{ color: "rgba(255,255,255,0.6)" }}>
              Let&apos;s Go, LLC<br />
              Email: privacy@letsgolive.app<br />
              General Support: support@letsgolive.app<br />
              Security Issues: security@letsgolive.app<br />
              Legal Inquiries: legal@letsgolive.app<br />
              Omaha, Nebraska, United States
            </p>
            <p>We will respond to privacy inquiries within thirty (30) days. For CCPA/CPRA and state privacy law requests, we will respond within the timeframe required by applicable law.</p>
          </Section>

        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 12 }}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, color: "rgba(255,255,255,0.7)" }}>
        {children}
      </div>
    </div>
  );
}
