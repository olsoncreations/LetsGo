"use client";

import { useRouter } from "next/navigation";

export default function TermsOfServicePage() {
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

        <h1 style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 40 }}>Effective Date: {effectiveDate}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 32, lineHeight: 1.7, fontSize: 14 }}>

          {/* ═══════════════════════════════════════════════════════
              PART I — GENERAL TERMS (ALL USERS)
              ═══════════════════════════════════════════════════════ */}

          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8 }}>
            Part I — General Terms
          </div>

          <Section title="1. Acceptance of Terms">
            <p>By creating an account, accessing, or using the LetsGo platform (&quot;Platform&quot;), including our website, mobile applications, application programming interfaces (APIs), and all related services (collectively, the &quot;Services&quot;), you (&quot;User,&quot; &quot;you,&quot; or &quot;your&quot;) agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms in their entirety, you must not create an account or use the Services.</p>
            <p>These Terms constitute a legally binding agreement between you and Olson Creations LLC, DBA &quot;LETS GO OUT,&quot; a Nebraska limited liability company (&quot;LetsGo,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). We reserve the right to update, modify, or replace any part of these Terms at any time by posting the revised Terms on the Platform. Your continued use of the Services after the posting of revised Terms constitutes your acceptance of those changes. It is your responsibility to review these Terms periodically.</p>
            <p>These Terms incorporate by reference our <a href="/privacy" style={{ color: "#00d4ff", textDecoration: "underline" }}>Privacy Policy</a>, which describes how we collect, use, and share your personal information. Together, these documents form the entire agreement between you and LetsGo regarding the Services.</p>
          </Section>

          <Section title="2. Eligibility">
            <p><strong style={{ color: "#fff" }}>2.1 Age Requirement.</strong> You must be at least eighteen (18) years of age to create an account and use the Services. By creating an account, you represent and warrant that you are at least 18 years old. If we learn that a user is under 18, we will immediately terminate the account and delete associated personal information.</p>
            <p><strong style={{ color: "#fff" }}>2.2 Legal Capacity.</strong> You represent that you are legally capable of entering into binding contracts under the laws of your jurisdiction and are not prohibited from using the Services under any applicable law, regulation, or court order.</p>
            <p><strong style={{ color: "#fff" }}>2.3 Business Account Authority.</strong> If you are creating a Business Account (as defined in Part III), you represent and warrant that you are authorized to bind the business entity to these Terms and that the business is a duly organized and validly existing entity under applicable law.</p>
            <p><strong style={{ color: "#fff" }}>2.4 Geographic Availability.</strong> The Services are currently available within the United States. You represent that you are located within the United States when using the Services. We make no representations that the Services are appropriate or available for use in other locations.</p>
          </Section>

          <Section title="3. Account Registration and Security">
            <p><strong style={{ color: "#fff" }}>3.1 Account Information.</strong> You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete. Providing false, misleading, or incomplete information is grounds for immediate account termination.</p>
            <p><strong style={{ color: "#fff" }}>3.2 Account Security.</strong> You are solely responsible for maintaining the confidentiality of your account credentials, including your password. You are responsible for all activity that occurs under your account, whether or not authorized by you. You agree to notify us immediately at security@useletsgo.com of any unauthorized access to or use of your account.</p>
            <p><strong style={{ color: "#fff" }}>3.3 One Account Per Person.</strong> Each individual may maintain only one User Account. Creating multiple accounts to circumvent rate limits, earn additional Payouts, evade fraud detection, or for any other purpose is strictly prohibited and may result in the termination of all associated accounts and forfeiture of all Payouts.</p>
            <p><strong style={{ color: "#fff" }}>3.4 Account Suspension.</strong> We reserve the right to suspend or terminate any account that we reasonably believe contains inaccurate information, is being used fraudulently, or is in violation of these Terms, without prior notice and without liability.</p>
          </Section>

          <Section title="4. Description of Services">
            <p><strong style={{ color: "#fff" }}>4.1 Platform Overview.</strong> LetsGo is a discovery and rewards platform that connects users with local restaurants, bars, entertainment venues, salons, and other businesses (&quot;Participating Businesses&quot;). Users discover businesses, visit them in person, upload receipts as proof of purchase, and earn progressive cash-back rewards (&quot;Payouts&quot;) based on their visit frequency to each business.</p>
            <p><strong style={{ color: "#fff" }}>4.2 Platform Features.</strong> The Services include, but are not limited to: business discovery and filtering; progressive cash-back rewards; receipt submission and verification; social features (friend connections, contact importing, invitations); interactive games (5v3v1, Group Vote, Date Night Generator); user-generated content (photos, videos, ratings); event discovery; messaging; and business management tools.</p>
            <p><strong style={{ color: "#fff" }}>4.3 Facilitator Role.</strong> LetsGo acts solely as a facilitator and technology platform connecting users with businesses. LetsGo is NOT a party to any transaction between you and any Participating Business. We do not own, operate, manage, or control any Participating Business. We do not guarantee the quality, safety, legality, or availability of any product, service, or experience offered by any Participating Business.</p>
            <p><strong style={{ color: "#fff" }}>4.4 No Agency Relationship.</strong> Nothing in these Terms creates an employer-employee, partnership, joint venture, agency, or franchise relationship between you and LetsGo, or between any Participating Business and LetsGo. Users are not employees, contractors, or agents of LetsGo.</p>
          </Section>

          {/* ═══════════════════════════════════════════════════════
              PART II — USER TERMS (EXPLORERS / CONSUMERS)
              ═══════════════════════════════════════════════════════ */}

          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8, marginTop: 16 }}>
            Part II — User Terms (Explorers)
          </div>

          <Section title="5. Payout Program and Cash-Back Rewards">
            <p><strong style={{ color: "#fff" }}>5.1 How Payouts Work.</strong> Users earn progressive cash-back rewards based on the number of verified visits to a Participating Business within a rolling 365-day window measured from the date of your first approved receipt at that business. Payout percentages increase with visit frequency according to each business&apos;s configured tier structure. Each user-business relationship is tracked independently.</p>
            <p><strong style={{ color: "#fff" }}>5.2 Payout Calculation.</strong> Payouts are calculated as a percentage of the receipt subtotal (before tax and tip). The percentage is determined by the business&apos;s payout tier structure and your current visit count within the 365-day rolling window. Only receipts with &quot;approved&quot; status count toward your visit total. The exact payout amount is: receipt subtotal multiplied by the applicable tier percentage (expressed in basis points, where 100 basis points equals 1.00%).</p>
            <p><strong style={{ color: "#fff" }}>5.3 No Guarantee of Payouts.</strong> Payouts are subject to receipt verification and approval by the Participating Business and/or LetsGo. We reserve the right to deny, adjust, reverse, or reclaim any Payout for any reason, including but not limited to: suspected fraud; receipt manipulation; system errors; violation of these Terms; business dispute; or at our sole discretion.</p>
            <p><strong style={{ color: "#fff" }}>5.4 Payout Amounts May Change.</strong> Participating Businesses may modify their payout tier structures at any time. LetsGo does not guarantee any specific payout rate, amount, or availability. Past payout rates do not guarantee future rates. The Platform merely facilitates rewards as configured by Participating Businesses.</p>
            <p><strong style={{ color: "#fff" }}>5.5 Minimum Payout Threshold.</strong> You must accumulate a minimum available balance of twenty dollars ($20.00) before you may request a cashout. Balances below this threshold remain in your account until the minimum is reached.</p>
            <p><strong style={{ color: "#fff" }}>5.6 Payout Methods.</strong> Available payout methods include Venmo, PayPal, and bank transfer (ACH). You are responsible for providing accurate payout account information. LetsGo is not responsible for Payouts sent to an incorrect account due to information you provided. Payout processing times vary and are typically 1 to 3 business days. We are not responsible for delays caused by third-party payment processors.</p>
            <p><strong style={{ color: "#fff" }}>5.7 Payouts Are Not Wages.</strong> Payouts are cash-back rewards, not wages, salary, or employment compensation. You are not an employee of LetsGo or any Participating Business by virtue of receiving Payouts. Payouts may constitute taxable income (see Section 6).</p>
            <p><strong style={{ color: "#fff" }}>5.8 Forfeiture.</strong> Payouts may be forfeited if: (a) your account is terminated for violation of these Terms; (b) Payouts were earned through fraudulent, deceptive, or manipulative activity; (c) your account remains inactive (no receipt submissions, logins, or cashouts) for twelve (12) consecutive months; or (d) you fail to provide required tax information when requested. Forfeited Payouts are non-recoverable.</p>
            <p><strong style={{ color: "#fff" }}>5.9 Reversal and Reclamation.</strong> If a Payout was issued in error, due to fraud, or based on a receipt that is subsequently disputed, reversed, or found to be invalid, LetsGo reserves the right to reverse the Payout and deduct the amount from your available balance. If your balance is insufficient, you agree to remit the overpayment amount to LetsGo within thirty (30) days of written notice.</p>
          </Section>

          <Section title="6. Tax Obligations">
            <p><strong style={{ color: "#fff" }}>6.1 User Responsibility.</strong> You are solely responsible for determining and fulfilling all tax obligations arising from Payouts received through the Platform, including all federal, state, and local income taxes, self-employment taxes (if applicable), and any other taxes that may apply. LetsGo does not withhold taxes from Payouts unless required by law.</p>
            <p><strong style={{ color: "#fff" }}>6.2 IRS 1099 Reporting.</strong> Under United States tax law (Internal Revenue Code Section 6050W and related provisions), if you receive six hundred dollars ($600.00) or more in Payouts within a calendar year, LetsGo is required to report these earnings to the Internal Revenue Service (IRS) and provide you with a Form 1099-NEC or Form 1099-MISC, as applicable. You will be required to provide your legal name, mailing address, and Social Security Number (SSN) or Taxpayer Identification Number (TIN) for tax reporting purposes. Failure to provide this information may result in the suspension of Payouts.</p>
            <p><strong style={{ color: "#fff" }}>6.3 Backup Withholding.</strong> If you fail to provide a valid SSN or TIN, or if the IRS notifies us that the information you provided is incorrect, LetsGo may be required to withhold twenty-four percent (24%) of your Payouts as backup withholding in accordance with IRS regulations. Any amounts withheld will be remitted to the IRS on your behalf.</p>
            <p><strong style={{ color: "#fff" }}>6.4 W-9 Certification.</strong> You may be required to complete and submit an IRS Form W-9 (Request for Taxpayer Identification Number and Certification) or equivalent form before receiving Payouts or when you approach the $600 annual reporting threshold.</p>
            <p><strong style={{ color: "#fff" }}>6.5 No Tax Advice.</strong> LetsGo does not provide tax, legal, or financial advice. We strongly recommend that you consult a qualified tax professional regarding your specific tax obligations related to Payouts received through the Platform.</p>
            <p><strong style={{ color: "#fff" }}>6.6 Record Retention.</strong> LetsGo retains Payout records, receipt data, and related financial information for a minimum of seven (7) years to comply with IRS recordkeeping requirements, even if you delete your account or request account deletion.</p>
          </Section>

          <Section title="7. Receipts and Verification">
            <p><strong style={{ color: "#fff" }}>7.1 Receipt Submission.</strong> To earn Payouts, you must submit valid, authentic receipts from Participating Businesses. Receipts must: (a) accurately reflect an actual in-person purchase made by you; (b) be submitted within seven (7) days of the transaction date; (c) clearly show the business name, date, and transaction amount; and (d) be legible and unaltered.</p>
            <p><strong style={{ color: "#fff" }}>7.2 Receipt Amount Limits.</strong> Individual receipt amounts must fall within the range of five dollars ($5.00) to five hundred dollars ($500.00). Receipts outside this range may be rejected or flagged for manual review. These limits are subject to change.</p>
            <p><strong style={{ color: "#fff" }}>7.3 Prohibited Conduct.</strong> The following actions are strictly prohibited and may result in immediate account termination, forfeiture of all Payouts, and referral to law enforcement:</p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Submitting fabricated, altered, digitally manipulated, duplicated, or forged receipts</li>
              <li>Submitting receipts for transactions not made by you personally</li>
              <li>Submitting the same receipt more than once, or submitting receipts that overlap with previously submitted transactions</li>
              <li>Colluding with business employees, owners, or other users to generate fraudulent or inflated receipts</li>
              <li>Using any automated system, bot, script, or program to submit receipts</li>
              <li>Manipulating receipt amounts, dates, business information, or any other receipt data</li>
              <li>Submitting receipts from a business you own, manage, or are employed by</li>
              <li>Splitting a single transaction into multiple receipts to inflate visit counts</li>
              <li>Making purchases solely to generate receipts with the intent to return the merchandise</li>
            </ul>
            <p><strong style={{ color: "#fff" }}>7.4 Verification Rights.</strong> LetsGo and Participating Businesses reserve the right to verify any receipt through manual review, automated fraud detection systems, image analysis, cross-referencing with business records, or by contacting the business directly. We may request additional documentation, including but not limited to bank or credit card statements, to verify the authenticity of a receipt.</p>
            <p><strong style={{ color: "#fff" }}>7.5 Receipt Rejection.</strong> We and/or the Participating Business may reject any receipt at our sole discretion. Rejected receipts do not count toward visit totals or Payouts. Decisions on receipt approval are final and not subject to appeal.</p>
            <p><strong style={{ color: "#fff" }}>7.6 Business Dispute Window.</strong> Participating Businesses have thirty (30) days from the date of approval to dispute a previously approved receipt. If a business successfully disputes a receipt, the associated Payout may be reversed, and the receipt will no longer count toward your visit total.</p>
            <p><strong style={{ color: "#fff" }}>7.7 Receipt Data as Evidence.</strong> You acknowledge and agree that receipt data, including photographs, amounts, dates, submission metadata, and associated account activity, may be used as evidence in legal proceedings, fraud investigations, law enforcement matters, tax audits, arbitration proceedings, or court proceedings. By submitting a receipt, you consent to LetsGo retaining and producing this data as required by law or legal process.</p>
            <p><strong style={{ color: "#fff" }}>7.8 Accuracy Attestation.</strong> By submitting a receipt, you attest under penalty of perjury (where applicable under state and federal law) that the receipt is genuine, unaltered, and accurately reflects a transaction that you personally made at the stated business on the stated date for the stated amount.</p>
          </Section>

          <Section title="8. Fraud Detection and Account Termination">
            <p><strong style={{ color: "#fff" }}>8.1 Fraud Detection.</strong> LetsGo employs automated and manual fraud detection systems, including but not limited to: pattern analysis, image verification, anomaly detection, IP address monitoring, device fingerprinting, cross-referencing of receipt data, and coordination with Participating Businesses. These systems operate continuously and may flag accounts for review without prior notice.</p>
            <p><strong style={{ color: "#fff" }}>8.2 Consequences of Fraud.</strong> If we determine, in our sole discretion, that you have engaged in fraudulent, deceptive, or manipulative activity, we may, without limitation: (a) immediately suspend or permanently terminate your account; (b) reverse, reclaim, or withhold any and all Payouts, including previously disbursed amounts; (c) report the activity to federal, state, and local law enforcement authorities; (d) cooperate with law enforcement investigations; (e) pursue all available civil and criminal legal remedies; and (f) share relevant account information with affected Participating Businesses.</p>
            <p><strong style={{ color: "#fff" }}>8.3 Criminal Liability.</strong> You acknowledge and agree that fraudulent receipt submission, payout manipulation, and related activities may constitute criminal offenses under federal and state law, including but not limited to: wire fraud (18 U.S.C. Section 1343), mail fraud (18 U.S.C. Section 1341), computer fraud (18 U.S.C. Section 1030), identity theft, and conspiracy to defraud. These offenses carry severe penalties, including imprisonment and substantial fines.</p>
            <p><strong style={{ color: "#fff" }}>8.4 Cooperation.</strong> You agree to cooperate with LetsGo and law enforcement in any fraud investigation related to your account. Refusal to cooperate may result in account termination.</p>
          </Section>

          <Section title="9. Social Features and Contact Importing">
            <p><strong style={{ color: "#fff" }}>9.1 Friend Connections.</strong> The Platform allows you to send and receive friend requests, view friends&apos; online status (online, away, offline), and interact socially through games and group activities. You may block other users at any time.</p>
            <p><strong style={{ color: "#fff" }}>9.2 Contact Importing.</strong> The Platform offers the ability to import contacts from your device to find friends who are already on LetsGo and to invite contacts who are not. Contact importing uses your device&apos;s native Contact Picker (where available) and requires your explicit permission via your device&apos;s operating system. We do not access your contacts without your affirmative consent. Imported contact data (names, email addresses, phone numbers) is used solely to match against existing users and to send invitation emails on your behalf. We do not sell, rent, or share imported contact data with third parties.</p>
            <p><strong style={{ color: "#fff" }}>9.3 Invitation Emails.</strong> When you choose to invite contacts, LetsGo sends invitation emails on your behalf using your name. You are responsible for ensuring that you have the right to share the contact information of the individuals you invite. Invitation sending is rate-limited to one hundred (100) per day per user to prevent abuse. Recipients may unsubscribe from future invitation emails.</p>
            <p><strong style={{ color: "#fff" }}>9.4 Online Status.</strong> When you use the Platform, your approximate online status may be visible to your friends. You understand and consent to this visibility as part of the social features of the Platform.</p>
          </Section>

          <Section title="10. Games and Interactive Features">
            <p><strong style={{ color: "#fff" }}>10.1 Game Features.</strong> The Platform offers interactive games and features including 5v3v1 (two-person voting game), Group Vote (multi-person voting), and Date Night Generator. These features are provided for entertainment and social purposes only.</p>
            <p><strong style={{ color: "#fff" }}>10.2 Not Gambling.</strong> No game or interactive feature on the Platform involves real money wagering, betting, or any form of gambling. Game outcomes are based on user preferences and selections, not chance. No money, Payouts, or anything of monetary value is won or lost through game participation.</p>
            <p><strong style={{ color: "#fff" }}>10.3 Recommendations Are Suggestions Only.</strong> Any recommendations, suggestions, curated lists, game results, date night selections, or other outputs from Platform features are for entertainment and informational purposes only. They do not constitute professional advice, endorsements, or guarantees of any kind. You are under no obligation to follow any recommendation. LetsGo is not liable for any outcome resulting from following or not following any recommendation.</p>
          </Section>

          <Section title="11. User-Generated Content">
            <p><strong style={{ color: "#fff" }}>11.1 License Grant.</strong> By submitting photos, videos, ratings, reviews, comments, or any other content (&quot;User Content&quot;) to the Platform, you grant LetsGo a worldwide, non-exclusive, royalty-free, perpetual, irrevocable, sublicensable, transferable license to use, reproduce, modify, adapt, publish, translate, display, distribute, and create derivative works from your User Content in connection with the Services, our marketing and promotional efforts, social media, and any other purpose related to the operation and promotion of the Platform.</p>
            <p><strong style={{ color: "#fff" }}>11.2 Content Moderation.</strong> User Content is subject to review and approval by Participating Businesses and/or LetsGo. We reserve the right to remove, edit, or refuse to display any User Content at our sole discretion, without notice or explanation. Participating Businesses may approve or reject User Content associated with their business.</p>
            <p><strong style={{ color: "#fff" }}>11.3 Your Representations.</strong> You represent and warrant that: (a) you own or have all necessary rights, licenses, and permissions to submit the User Content; (b) the User Content does not infringe, misappropriate, or violate any third-party intellectual property, privacy, publicity, or other rights; (c) the User Content does not contain any material that is defamatory, obscene, harassing, threatening, or otherwise unlawful; (d) no persons appearing in your User Content are under the age of 18; and (e) you have obtained the consent of any identifiable individuals depicted in your User Content.</p>
            <p><strong style={{ color: "#fff" }}>11.4 Prohibited Content.</strong> You may not submit User Content that: contains nudity, explicit sexual material, or gratuitous violence; promotes illegal activity; contains personal information of others without their consent; is spam or commercial advertising; impersonates another person or entity; or violates any applicable law or regulation.</p>
            <p><strong style={{ color: "#fff" }}>11.5 No Compensation.</strong> Unless otherwise agreed in writing, you will not receive compensation for User Content submitted to the Platform, and you waive any right to royalties or other payment.</p>
          </Section>

          <Section title="12. Ratings and Reviews">
            <p><strong style={{ color: "#fff" }}>12.1 Eligibility.</strong> You may rate a business only if you have at least one (1) approved receipt at that business. Ratings consist of a star rating (1 to 5 stars) and an optional &quot;Would Go Again&quot; indicator.</p>
            <p><strong style={{ color: "#fff" }}>12.2 Privacy of Ratings.</strong> Individual ratings and private notes are not shared publicly. Only aggregate ratings (average star rating and total count) are displayed to Participating Businesses with eligible subscriptions.</p>
            <p><strong style={{ color: "#fff" }}>12.3 Honest Reviews.</strong> You agree that any ratings or reviews you submit will be honest, accurate, and based on your genuine personal experience. Submitting false, misleading, or retaliatory ratings, or ratings influenced by compensation from any party, is prohibited.</p>
          </Section>

          {/* ═══════════════════════════════════════════════════════
              PART III — BUSINESS TERMS (PARTNERS)
              ═══════════════════════════════════════════════════════ */}

          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8, marginTop: 16 }}>
            Part III — Business Terms (Partners)
          </div>

          <Section title="13. Business Account Registration">
            <p><strong style={{ color: "#fff" }}>13.1 Authorized Representative.</strong> By creating a Business Account, the individual registering represents and warrants that they are an authorized representative of the business entity (owner, general manager, or other officer with binding authority) and that they have the legal authority to enter into this agreement on behalf of the business.</p>
            <p><strong style={{ color: "#fff" }}>13.2 Business Information.</strong> You agree to provide accurate, current, and complete information about your business during onboarding, including but not limited to: legal business name, public-facing business name (if different), business type, physical address, operating hours, contact information, age restrictions (if any), verification documents, and business logo. You agree to keep this information updated at all times.</p>
            <p><strong style={{ color: "#fff" }}>13.3 Verification.</strong> Businesses must submit verification documents during onboarding, which may include a business license, EIN certificate, or utility bill matching the business name and address. LetsGo reserves the right to request additional verification at any time and to deny or revoke Business Account status if verification is unsatisfactory.</p>
            <p><strong style={{ color: "#fff" }}>13.4 Account Roles.</strong> Business Accounts support multiple user roles (owner, manager, staff). The account owner is responsible for all actions taken by any user with access to the Business Account. You are responsible for managing access and removing unauthorized users promptly.</p>
          </Section>

          <Section title="14. Service Plans and Pricing">
            <p><strong style={{ color: "#fff" }}>14.1 Basic Package.</strong> The Basic Package has no monthly subscription fee. Businesses on the Basic Package are subject to a platform fee of ten percent (10%) of each approved receipt subtotal, capped at a maximum of five dollars ($5.00) per receipt (&quot;Platform Fee&quot;). The Basic Package includes access to the Discovery feed, 5v3v1 game inclusion, and Group Vote inclusion.</p>
            <p><strong style={{ color: "#fff" }}>14.2 Premium Package.</strong> The Premium Package requires a monthly subscription fee (currently one hundred dollars ($100.00) per month, subject to change with thirty (30) days advance notice). Businesses on the Premium Package are NOT charged the per-receipt Platform Fee. The Premium Package includes all Basic features plus: daily video uploads, live video capabilities, priority placement in the Discovery feed, detailed analytics dashboard, Events management, User Experiences integration, and Date Night Generator inclusion.</p>
            <p><strong style={{ color: "#fff" }}>14.3 Premium Add-Ons.</strong> Premium subscribers may purchase additional capabilities, including: Video Add-On (additional daily video uploads, currently fifty dollars ($50.00) per month); Live Add-On 15 (increased live video capacity, currently fifty dollars ($50.00) per month); and Live Add-On 30 (maximum live video capacity, currently one hundred dollars ($100.00) per month). Add-on pricing is subject to change with thirty (30) days advance notice.</p>
            <p><strong style={{ color: "#fff" }}>14.4 Total Profile Management Services (TPMS).</strong> Businesses may optionally subscribe to TPMS (currently two hundred dollars ($200.00) per month), which includes: receipt review and approval management, profile content management, and payout tier optimization. TPMS pricing and inclusions are subject to change with thirty (30) days advance notice.</p>
            <p><strong style={{ color: "#fff" }}>14.5 Pricing Changes.</strong> All pricing is subject to change. We will provide at least thirty (30) days advance notice of price increases for recurring subscriptions. Continued use after a price change constitutes acceptance of the new pricing. Your sole remedy for disagreeing with a price change is to cancel your subscription before the new pricing takes effect.</p>
          </Section>

          <Section title="15. Advertising and Promotions">
            <p><strong style={{ color: "#fff" }}>15.1 Advertising Campaigns.</strong> Premium subscribers may purchase advertising campaigns, including: 1-Day Spotlight (featured placement in Discovery for one day within a 20-mile radius); 7-Day Spotlight (featured placement for seven days within a 50-mile radius); 14-Day Spotlight (featured placement for fourteen days within a 50-mile radius); 100 Mile Wide Push (push notifications and top placement for seven days); and Tour Wide Push (push notifications for fourteen days spread across a 60-day range with seven days of priority placement).</p>
            <p><strong style={{ color: "#fff" }}>15.2 Campaign Pricing.</strong> Advertising campaign pricing is displayed at the time of purchase. Base rates are: 1-Day Spotlight ($99); 7-Day Spotlight ($599); 14-Day Spotlight ($999); 100 Mile Wide Push ($2,599); Tour Wide Push ($4,599). Custom advertising plans are available upon request.</p>
            <p><strong style={{ color: "#fff" }}>15.3 Hot Day Surge Pricing.</strong> Advertising campaigns scheduled during high-demand dates (&quot;Hot Days&quot;) may be subject to surge pricing. Surge fees, if applicable, will be clearly displayed before purchase and require your explicit confirmation. Hot Day pricing is determined by LetsGo in its sole discretion.</p>
            <p><strong style={{ color: "#fff" }}>15.4 No Performance Guarantee.</strong> LetsGo does not guarantee any specific results, impressions, clicks, visits, conversions, revenue, or return on investment from advertising campaigns. Advertising campaign fees are non-refundable once the campaign has commenced, except in cases of material platform failure as determined by LetsGo in its sole discretion.</p>
            <p><strong style={{ color: "#fff" }}>15.5 Ad Content.</strong> All advertising content must comply with applicable laws and regulations. LetsGo reserves the right to reject, modify, or remove any advertising content that violates these Terms, applicable law, or our content standards.</p>
          </Section>

          <Section title="16. Progressive Payout Obligations">
            <p><strong style={{ color: "#fff" }}>16.1 Payout Tier Configuration.</strong> Businesses configure their progressive payout tier structure during onboarding. Available presets include Standard, Conservative, and Aggressive, or businesses may create a custom tier structure. Each tier specifies a visit range and a payout percentage (expressed in basis points). Businesses may have up to seven (7) tiers.</p>
            <p><strong style={{ color: "#fff" }}>16.2 Obligation to Honor Tiers.</strong> Once configured, businesses are obligated to honor their payout tier structure for all approved receipts. Users rely on published payout tiers when deciding to visit your business. Retroactively reducing payout rates for visits already made is prohibited.</p>
            <p><strong style={{ color: "#fff" }}>16.3 Modifying Tiers.</strong> Businesses may modify their payout tier structure at any time, but changes apply only to future visits. Changes do not apply retroactively to previously approved receipts or visits already counted within a user&apos;s rolling 365-day window.</p>
            <p><strong style={{ color: "#fff" }}>16.4 Payout Calculation.</strong> User Payouts are calculated as: receipt subtotal (before tax and tip) multiplied by the applicable tier percentage. There is no per-receipt cap on user Payouts. Businesses are responsible for funding all Payouts generated by their configured tier structure.</p>
          </Section>

          <Section title="17. Platform Fees and Billing">
            <p><strong style={{ color: "#fff" }}>17.1 Platform Fee (Basic Package).</strong> Businesses on the Basic Package are charged a Platform Fee of ten percent (10%) of each approved receipt subtotal, capped at five dollars ($5.00) per receipt. Formula: min(receipt_subtotal x 0.10, $5.00). Platform Fees are calculated and billed monthly.</p>
            <p><strong style={{ color: "#fff" }}>17.2 Monthly Billing.</strong> All recurring charges (subscription fees, add-ons, TPMS) are billed monthly on or around the date of initial signup. Invoices detail all charges including: user Payouts, Platform Fees (if Basic), subscription fees (if Premium), add-on fees, advertising campaigns, and any applicable processing fees.</p>
            <p><strong style={{ color: "#fff" }}>17.3 Payment Methods.</strong> Businesses may pay via bank account (ACH) or credit/debit card. ACH payments incur no additional processing fee. Credit/debit card payments are subject to a processing fee of three and one-half percent (3.5%) of the total monthly charge. We strongly recommend ACH payment to avoid processing fees.</p>
            <p><strong style={{ color: "#fff" }}>17.4 Payment Authorization.</strong> By providing payment information and completing onboarding, you authorize LetsGo to charge your selected payment method for: all user Payouts generated by your configured tier structure; Platform Fees (Basic Package); monthly subscription and add-on fees (Premium Package); advertising campaign charges; credit card processing fees (if applicable); and any other charges incurred through your use of the Services.</p>
            <p><strong style={{ color: "#fff" }}>17.5 Late Payment.</strong> Failure to maintain a valid payment method or failure to pay charges when due may result in: suspension of your business listing from the Discovery feed; suspension of receipt processing; accrual of late fees; and/or termination of your Business Account. LetsGo reserves the right to charge interest on overdue amounts at the lesser of one and one-half percent (1.5%) per month or the maximum rate permitted by law.</p>
            <p><strong style={{ color: "#fff" }}>17.6 No Refunds.</strong> Subscription fees, advertising campaign fees, and Platform Fees are non-refundable. There is no proration for mid-cycle cancellations or plan downgrades. If you downgrade from Premium to Basic, the change takes effect at the end of the current billing cycle.</p>
            <p><strong style={{ color: "#fff" }}>17.7 Tax Reporting for Businesses.</strong> Businesses are responsible for all tax obligations related to their participation in the Platform, including reporting Payout expenses and Platform Fees. LetsGo may issue tax forms to businesses as required by law.</p>
          </Section>

          <Section title="18. Receipt Approval and Dispute">
            <p><strong style={{ color: "#fff" }}>18.1 Receipt Review.</strong> Businesses are responsible for reviewing and approving or rejecting receipt submissions associated with their business. Businesses may designate a verification contact to handle receipt reviews.</p>
            <p><strong style={{ color: "#fff" }}>18.2 Auto-Approval.</strong> Businesses may enable automatic receipt approval for receipts below a specified threshold amount. Businesses remain responsible for the accuracy and legitimacy of auto-approved receipts.</p>
            <p><strong style={{ color: "#fff" }}>18.3 Dispute Window.</strong> Businesses have thirty (30) calendar days from the date of receipt approval to dispute a previously approved receipt. After thirty (30) days, receipts are considered final and cannot be disputed. Disputes must be based on legitimate grounds (e.g., fraudulent receipt, duplicate submission, incorrect business attribution).</p>
            <p><strong style={{ color: "#fff" }}>18.4 Dispute Resolution.</strong> If a business disputes an approved receipt within the 30-day window, LetsGo will investigate and make a determination in its sole discretion. If the dispute is upheld, the user&apos;s Payout will be reversed and the receipt will be removed from the user&apos;s visit history.</p>
          </Section>

          <Section title="19. Business Content and Media">
            <p><strong style={{ color: "#fff" }}>19.1 Business Content.</strong> Businesses are responsible for the accuracy and legality of all content they provide, including business descriptions, hours, photos, videos, event listings, and any other information displayed on the Platform.</p>
            <p><strong style={{ color: "#fff" }}>19.2 UGC Moderation.</strong> Businesses are responsible for reviewing and moderating User Content submitted in connection with their business. Businesses may approve or reject User Content at their discretion, subject to applicable anti-discrimination laws.</p>
            <p><strong style={{ color: "#fff" }}>19.3 Marketing Permissions.</strong> During onboarding, businesses may opt into marketing permissions including: allowing users to post experiential content associated with the business; featuring the business in Discovery feeds; and allowing A/B testing to optimize business profile performance. These permissions may be modified at any time through the Business Dashboard.</p>
          </Section>

          <Section title="20. Business Independence and Compliance">
            <p><strong style={{ color: "#fff" }}>20.1 Independent Operation.</strong> Participating Businesses are independent entities. LetsGo does not exercise control over business operations, employment practices, products, services, pricing, health and safety compliance, or any other aspect of business operations. The relationship between LetsGo and Participating Businesses is that of independent contractors.</p>
            <p><strong style={{ color: "#fff" }}>20.2 Legal Compliance.</strong> Businesses are solely responsible for complying with all applicable federal, state, and local laws, regulations, and ordinances related to their business operations, including but not limited to: health and safety codes, food handling regulations, liquor licensing, employment law, tax law, accessibility requirements (ADA), anti-discrimination laws, and consumer protection laws.</p>
            <p><strong style={{ color: "#fff" }}>20.3 Indemnification by Business.</strong> Businesses agree to indemnify, defend, and hold harmless LetsGo from any claims, losses, or damages arising from: the business&apos;s products or services; the business&apos;s violation of any law; the business&apos;s interaction with users; and any injury, illness, or damage occurring on the business&apos;s premises.</p>
          </Section>

          {/* ═══════════════════════════════════════════════════════
              PART IV — GENERAL PROVISIONS (ALL PARTIES)
              ═══════════════════════════════════════════════════════ */}

          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8, marginTop: 16 }}>
            Part IV — General Provisions
          </div>

          <Section title="21. Assumption of Risk and Limitation of Liability">
            <p><strong style={{ color: "#fff" }}>21.1 Assumption of Risk.</strong> You acknowledge and agree that your use of the Services and any visits to businesses discovered through the Platform are entirely at your own risk. LetsGo is a technology platform only and does not own, operate, manage, inspect, or control any businesses listed on the Platform.</p>
            <p><strong style={{ color: "#fff" }}>21.2 Physical Safety.</strong> LetsGo is NOT responsible for any injury, illness, death, property damage, theft, assault, or any other harm that may occur during your visit to any business or location discovered through the Platform. This includes but is not limited to:</p>
            <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
              <li>Slip and fall injuries on business premises</li>
              <li>Foodborne illness, food poisoning, or allergic reactions from food or beverages consumed</li>
              <li>Injuries sustained at entertainment venues, bars, activity-based businesses, or outdoor recreation</li>
              <li>Vehicle accidents while traveling to or from businesses, including accidents caused by impaired driving</li>
              <li>Criminal activity occurring at, near, or in connection with business locations</li>
              <li>Personal property damage, loss, or theft at business premises</li>
              <li>Intoxication-related incidents, injuries, or consequences</li>
              <li>Interactions with business staff, employees, other patrons, or third parties</li>
              <li>Exposure to communicable diseases or environmental hazards</li>
              <li>Emotional distress or psychological harm arising from experiences at businesses</li>
            </ul>
            <p><strong style={{ color: "#fff" }}>21.3 Business Quality.</strong> LetsGo does NOT inspect, endorse, guarantee, or warrant the quality, safety, legality, cleanliness, or suitability of any business, its products, services, premises, health and safety compliance, food handling practices, employee conduct, or any other aspect of its operation. Business listings and information are provided &quot;as-is&quot; and may be inaccurate, incomplete, or outdated.</p>
            <p><strong style={{ color: "#fff" }}>21.4 Alcohol, Substances, and Impairment.</strong> If you choose to consume alcohol or any other substances at businesses discovered through the Platform, you do so entirely at your own risk and your own volition. LetsGo is NOT responsible for any consequences arising from alcohol or substance consumption, including but not limited to: impaired judgment; impaired driving; DUI, DWI, or other criminal charges; injuries sustained while impaired; injuries caused to others while impaired; or any other consequences. YOU ARE SOLELY RESPONSIBLE FOR ARRANGING SAFE TRANSPORTATION. LetsGo strongly encourages the use of designated drivers, ride-sharing services, or public transportation when consuming alcohol.</p>
            <p><strong style={{ color: "#fff" }}>21.5 Age-Restricted Venues.</strong> Some businesses listed on the Platform may have age restrictions (18+ or 21+). It is YOUR sole responsibility to verify that you meet any applicable age requirements before visiting a business. LetsGo does not verify your age at the point of entry to any business.</p>
            <p><strong style={{ color: "#fff" }}>21.6 Limitation of Liability.</strong> TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, LET&apos;S GO, ITS OFFICERS, DIRECTORS, MEMBERS, MANAGERS, EMPLOYEES, AGENTS, LICENSORS, AND AFFILIATES (COLLECTIVELY, THE &quot;LET&apos;S GO PARTIES&quot;) SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, REVENUE, BUSINESS OPPORTUNITY, OR OTHER INTANGIBLE LOSSES, REGARDLESS OF THE CAUSE OF ACTION OR THE THEORY OF LIABILITY (WHETHER IN CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY, PRODUCT LIABILITY, OR OTHERWISE), EVEN IF THE LET&apos;S GO PARTIES HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
            <p><strong style={{ color: "#fff" }}>21.7 Maximum Aggregate Liability.</strong> IN NO EVENT SHALL THE TOTAL AGGREGATE LIABILITY OF THE LET&apos;S GO PARTIES TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS, THE SERVICES, OR YOUR USE THEREOF EXCEED THE GREATER OF: (A) THE TOTAL AMOUNT OF PAYOUTS ACTUALLY RECEIVED BY YOU IN THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM; OR (B) ONE HUNDRED DOLLARS ($100.00).</p>
          </Section>

          <Section title="22. Indemnification">
            <p>You agree to indemnify, defend, and hold harmless the LetsGo Parties from and against any and all claims, actions, suits, proceedings, liabilities, damages, losses, costs, and expenses (including reasonable attorneys&apos; fees and court costs) arising out of or in any way connected with: (a) your access to or use of the Services; (b) your violation of these Terms or any applicable law; (c) your violation of any rights of any third party; (d) your visit to any business listed on the Platform; (e) any receipt you submit, including fraudulent or inaccurate receipts; (f) any tax obligations arising from Payouts you receive; (g) any User Content you submit, post, or share through the Platform; (h) your consumption of alcohol or other substances at or in connection with businesses discovered through the Platform; (i) any personal injury or property damage occurring during or in connection with your use of the Services; (j) your importation of contacts or sending of invitation emails through the Platform; or (k) any other action or omission related to your use of the Services.</p>
          </Section>

          <Section title="23. Intellectual Property">
            <p><strong style={{ color: "#fff" }}>23.1 Platform IP.</strong> All content, features, and functionality of the Platform, including but not limited to: text, graphics, logos (including the LetsGo name and logo), icons, images, audio, video, software, code, algorithms, databases, the overall design and &quot;look-and-feel,&quot; and all related intellectual property rights, are owned by Olson Creations LLC or its licensors and are protected by United States and international copyright, trademark, patent, trade secret, and other intellectual property laws.</p>
            <p><strong style={{ color: "#fff" }}>23.2 Limited License.</strong> Subject to your compliance with these Terms, LetsGo grants you a limited, non-exclusive, non-transferable, non-sublicensable, revocable license to access and use the Services for your personal, non-commercial use (or for internal business use if you have a Business Account). This license does not include the right to: copy, modify, distribute, sell, lease, or create derivative works from any part of the Platform; reverse-engineer, decompile, or disassemble the Platform; use automated systems to access the Platform; or use the Platform for any unlawful purpose.</p>
            <p><strong style={{ color: "#fff" }}>23.3 Trademarks.</strong> &quot;LetsGo,&quot; the LetsGo logo, and all related names, logos, product and service names, designs, and slogans are trademarks of Olson Creations LLC. You may not use these marks without our prior written permission.</p>
          </Section>

          <Section title="24. Communications and Notifications">
            <p><strong style={{ color: "#fff" }}>24.1 Consent to Electronic Communications.</strong> By creating an account, you consent to receive electronic communications from LetsGo, including emails, push notifications, in-app notifications, and SMS messages. You agree that all agreements, notices, disclosures, and other communications we provide electronically satisfy any legal requirement that such communications be in writing.</p>
            <p><strong style={{ color: "#fff" }}>24.2 Transactional Communications.</strong> Certain communications are required for the operation of the Services and cannot be opted out of, including: receipt approval/rejection notifications, Payout processing notifications, tier level changes, account security alerts, and legal notices. These are sent regardless of your notification preferences.</p>
            <p><strong style={{ color: "#fff" }}>24.3 Promotional Communications.</strong> You may opt out of promotional and marketing communications at any time through your notification settings or by clicking the unsubscribe link in any marketing email. Opting out of promotional communications does not affect transactional communications.</p>
            <p><strong style={{ color: "#fff" }}>24.4 Push Notifications.</strong> If you enable push notifications, you consent to receiving push notifications on your device. You may disable push notifications through your device settings or in-app notification preferences at any time.</p>
            <p><strong style={{ color: "#fff" }}>24.5 SMS / Text Messaging Terms.</strong> By providing your mobile phone number and opting in, you agree to receive SMS / text messages from LetsGo (Olson Creations LLC, DBA &quot;LETS GO OUT&quot;) at the number you provided, sent through our messaging service provider, Twilio. SMS messages may include: (a) friend invitations that you initiate; (b) receipt approval, rejection, and Payout notifications; (c) account security alerts; and (d) other transactional notifications related to your account. Consent to receive SMS messages is <strong style={{ color: "#fff" }}>not</strong> a condition of using the Services or making any purchase. <strong style={{ color: "#fff" }}>Message and data rates may apply.</strong> Message frequency varies. You may opt out at any time by replying <strong style={{ color: "#fff" }}>STOP</strong> to any message; reply <strong style={{ color: "#fff" }}>HELP</strong> for help, or contact support@useletsgo.com. <strong style={{ color: "#fff" }}>Mobile phone numbers and SMS opt-in consent are not shared with third parties or affiliates for marketing or promotional purposes.</strong> Mobile information is used solely to deliver the messages you have requested or that are required for the operation of your account. Carriers are not liable for delayed or undelivered messages. For details on how mobile information is handled, see Section 5 of our <a href="/privacy" style={{ color: "#00d4ff", textDecoration: "underline" }}>Privacy Policy</a>.</p>
          </Section>

          <Section title="25. Privacy">
            <p>Your use of the Services is subject to our <a href="/privacy" style={{ color: "#00d4ff", textDecoration: "underline" }}>Privacy Policy</a>, which is incorporated into these Terms by reference. By using the Services, you consent to the collection, use, storage, and sharing of your information as described in the Privacy Policy. Please review the Privacy Policy carefully, as it describes what information we collect, how we use it, and under what circumstances we may share it.</p>
          </Section>

          <Section title="26. Dispute Resolution and Arbitration">
            <p><strong style={{ color: "#fff" }}>26.1 Informal Resolution.</strong> Before initiating any formal dispute resolution proceeding, you agree to first contact LetsGo at legal@useletsgo.com to attempt to resolve the dispute informally. The parties shall make a good-faith effort to resolve any dispute within thirty (30) days of the initial notice.</p>
            <p><strong style={{ color: "#fff" }}>26.2 Mandatory Binding Arbitration.</strong> If the dispute is not resolved informally within thirty (30) days, any dispute, claim, or controversy arising out of or relating to these Terms, the Services, or the relationship between you and LetsGo (including the validity, enforceability, or scope of this arbitration provision) shall be resolved exclusively through binding individual arbitration administered by the American Arbitration Association (&quot;AAA&quot;) under its Consumer Arbitration Rules (or its Commercial Arbitration Rules for Business Accounts). The arbitration shall take place in Douglas County, Nebraska, or at a location mutually agreed upon by the parties. The arbitrator&apos;s decision shall be final and binding and may be entered as a judgment in any court of competent jurisdiction.</p>
            <p><strong style={{ color: "#fff" }}>26.3 Class Action Waiver.</strong> YOU AND LET&apos;S GO AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, CONSOLIDATED, MULTI-DISTRICT, OR REPRESENTATIVE ACTION OR PROCEEDING. THE ARBITRATOR MAY NOT CONSOLIDATE MORE THAN ONE PERSON&apos;S CLAIMS AND MAY NOT OTHERWISE PRESIDE OVER ANY FORM OF A CLASS, REPRESENTATIVE, OR CONSOLIDATED PROCEEDING. IF THIS SPECIFIC PROVISION IS FOUND TO BE UNENFORCEABLE, THEN THE ENTIRETY OF THIS ARBITRATION SECTION SHALL BE NULL AND VOID.</p>
            <p><strong style={{ color: "#fff" }}>26.4 Exceptions.</strong> Notwithstanding the above, either party may: (a) bring an individual action in small claims court if the claim qualifies; (b) seek injunctive or other equitable relief in any court of competent jurisdiction to prevent the actual or threatened infringement, misappropriation, or violation of intellectual property rights, or for unauthorized access to or use of the Services; or (c) assert claims that are expressly exempted from arbitration by applicable law.</p>
            <p><strong style={{ color: "#fff" }}>26.5 Arbitration Costs.</strong> Payment of arbitration fees shall be governed by the AAA&apos;s rules. If the arbitrator finds that either the substance of your claim or the relief sought is frivolous or brought for an improper purpose, the parties agree that the AAA&apos;s fee-shifting provisions shall apply.</p>
            <p><strong style={{ color: "#fff" }}>26.6 Statute of Limitations.</strong> Any claim arising out of or relating to these Terms or the Services must be filed within one (1) year after the date the cause of action accrued. Claims filed after this period are permanently barred.</p>
          </Section>

          <Section title="27. Governing Law">
            <p>These Terms shall be governed by and construed in accordance with the laws of the State of Nebraska, United States of America, without regard to its conflict of laws principles. To the extent that arbitration is not applicable, you consent to the exclusive jurisdiction and venue of the state and federal courts located in Douglas County, Nebraska for any legal proceedings.</p>
          </Section>

          <Section title="28. Disclaimers">
            <p>THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, AND ANY WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE. LET&apos;S GO DOES NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS, OR THAT DEFECTS WILL BE CORRECTED.</p>
            <p>LET&apos;S GO DOES NOT GUARANTEE THE ACCURACY, COMPLETENESS, TIMELINESS, RELIABILITY, OR AVAILABILITY OF ANY BUSINESS INFORMATION, INCLUDING HOURS OF OPERATION, MENUS, PRICING, AVAILABILITY, LOCATION DATA, RATINGS, OR USER CONTENT. BUSINESS INFORMATION MAY BE OUTDATED, INACCURATE, OR INCOMPLETE.</p>
            <p>LET&apos;S GO DOES NOT ENDORSE, RECOMMEND, OR GUARANTEE ANY PARTICIPATING BUSINESS AND MAKES NO REPRESENTATIONS REGARDING THE QUALITY, SAFETY, LEGALITY, OR SUITABILITY OF ANY BUSINESS, PRODUCT, OR SERVICE.</p>
          </Section>

          <Section title="29. Termination">
            <p><strong style={{ color: "#fff" }}>29.1 Termination by LetsGo.</strong> We may suspend or terminate your access to the Services at any time, with or without cause, and with or without notice, at our sole discretion. Grounds for termination include but are not limited to: violation of these Terms; fraudulent activity; non-payment of charges; inactivity; or any conduct that we determine, in our sole discretion, is harmful to other users, Participating Businesses, or LetsGo.</p>
            <p><strong style={{ color: "#fff" }}>29.2 Effect of Termination.</strong> Upon termination: (a) your right to use the Services immediately ceases; (b) any pending Payouts may be forfeited if termination is due to a violation of these Terms or fraudulent activity; (c) you remain liable for all charges incurred prior to termination (for Business Accounts); (d) provisions that by their nature should survive termination shall survive, including: Sections 6 (Tax Obligations), 7.7-7.8 (Receipt Evidence), 8 (Fraud), 10 (Indemnification), 11 (UGC License), 21 (Liability), 22 (Indemnification), 23 (IP), 26 (Arbitration), 27 (Governing Law), and this Section 29.</p>
            <p><strong style={{ color: "#fff" }}>29.3 Termination by You.</strong> You may terminate your account at any time by contacting us at support@useletsgo.com. Termination does not relieve you of any obligations incurred prior to termination, including tax obligations on previously received Payouts and any outstanding charges for Business Accounts. Certain data (including receipt records, Payout records, and tax information) will be retained as required by law (see Section 6.6).</p>
          </Section>

          <Section title="30. Modifications to the Service">
            <p>LetsGo reserves the right to modify, update, suspend, or discontinue any aspect of the Services at any time, including the availability of features, Payout programs, business listings, games, social features, or any other functionality. We shall not be liable to you or any third party for any modification, suspension, or discontinuation of the Services. If a material change significantly affects your rights or obligations, we will make reasonable efforts to provide advance notice.</p>
          </Section>

          <Section title="31. Third-Party Services">
            <p>The Services may integrate with or contain links to third-party websites, applications, or services, including but not limited to: payment processors, email delivery services, mapping services, cloud hosting providers, and analytics tools. LetsGo does not control and is not responsible for the content, privacy policies, security practices, or availability of these third-party services. Your use of third-party services is governed by their respective terms and policies. We encourage you to review the terms and privacy policies of any third-party services you access through the Platform.</p>
          </Section>

          <Section title="32. Force Majeure">
            <p>LetsGo shall not be liable for any failure or delay in performance resulting from causes beyond its reasonable control, including but not limited to: acts of God, natural disasters, epidemics, pandemics, war, terrorism, riots, government actions, power failures, internet disruptions, telecommunications failures, cyberattacks, or other events beyond our reasonable control.</p>
          </Section>

          <Section title="33. Severability">
            <p>If any provision of these Terms is held to be invalid, illegal, or unenforceable by a court or arbitrator of competent jurisdiction, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions of these Terms shall remain in full force and effect. The invalidity or unenforceability of any provision shall not affect the validity or enforceability of any other provision.</p>
          </Section>

          <Section title="34. Waiver">
            <p>The failure of LetsGo to enforce any right or provision of these Terms shall not constitute a waiver of that right or provision. Any waiver of any provision shall be effective only if in writing and signed by an authorized representative of LetsGo. A waiver of any right or provision on one occasion shall not be deemed a waiver of that right or provision on any subsequent occasion.</p>
          </Section>

          <Section title="35. Assignment">
            <p>You may not assign, transfer, or delegate your rights or obligations under these Terms without LetsGo&apos;s prior written consent. LetsGo may freely assign, transfer, or delegate its rights and obligations under these Terms without restriction, including in connection with a merger, acquisition, reorganization, or sale of assets.</p>
          </Section>

          <Section title="36. Entire Agreement">
            <p>These Terms, together with the Privacy Policy and any additional terms you agree to when using specific features of the Services (including the Business Billing Policy, Content Policy, and Fraud Acknowledgment accepted during business onboarding), constitute the entire agreement between you and LetsGo regarding the Services and supersede all prior and contemporaneous agreements, proposals, negotiations, representations, and understandings, whether written or oral.</p>
          </Section>

          <Section title="37. Contact Information">
            <p>If you have questions, concerns, or complaints about these Terms, please contact us at:</p>
            <p style={{ color: "rgba(255,255,255,0.6)" }}>
              Olson Creations LLC, DBA &quot;LETS GO OUT&quot;<br />
              Email: legal@useletsgo.com<br />
              Support: support@useletsgo.com<br />
              Security: security@useletsgo.com<br />
              Omaha, Nebraska, United States
            </p>
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
