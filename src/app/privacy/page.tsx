import type { Metadata } from "next";
import { PublicPageShell } from "@/components/PublicPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy — QuickShift",
  description: "How QuickCare Nursing Registry collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <PublicPageShell title="Privacy Policy" lastUpdated="May 7, 2026">
      <p>
        QuickCare Nursing Registry (&ldquo;<strong>QuickCare</strong>,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us&rdquo;) operates the QuickShift platform to dispatch nursing shifts between
        partner healthcare facilities and credentialed clinicians. This Privacy Policy explains
        what information we collect, how we use it, and the choices you have.
      </p>

      <h2>1. Information we collect</h2>
      <p>We collect only the information needed to run the registry and communicate with you:</p>
      <ul>
        <li>
          <strong>Clinician information</strong>: full name, mobile phone number, email address,
          professional role (RN, LPN, CNA, NP), license number and expiration, hourly rate,
          uploaded credentials (licenses, certifications, vaccination records), and shift history.
        </li>
        <li>
          <strong>Facility information</strong>: facility name, address, coordinator name,
          phone number, email, billing rate, and shift template configuration.
        </li>
        <li>
          <strong>Communications data</strong>: SMS messages exchanged through our Twilio-powered
          dispatch system, message delivery status, and timestamps.
        </li>
        <li>
          <strong>Operational records</strong>: timesheets (clock-in/out times, hours worked),
          shift assignments, and invoices.
        </li>
      </ul>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To match available shifts with qualified, compliant clinicians.</li>
        <li>
          To send operational SMS notifications, including shift-availability broadcasts, shift
          confirmations, clock-in/out reminders, and timekeeping prompts.
        </li>
        <li>To verify professional credentials and prevent expired-license assignments.</li>
        <li>To generate timesheets and invoices for shifts worked.</li>
        <li>To respond to your inquiries and provide support.</li>
      </ul>

      <h2>3. SMS messaging consent and use</h2>
      <p>
        SMS messaging is a core operational feature of QuickShift. By enrolling as a clinician or
        partner facility coordinator, you consent to receive operational SMS messages at the
        mobile number you provide. <strong>We do not share mobile numbers, opt-in data, or
        consent information with third parties or affiliates for their marketing purposes.</strong>{" "}
        Information collected for SMS consent is used solely to operate the QuickShift dispatch
        service.
      </p>
      <p>
        You may reply <strong>STOP</strong> at any time to opt out of all messages, or{" "}
        <strong>HELP</strong> for support. Message and data rates may apply. Message frequency
        varies based on shift demand.
      </p>

      <h2>4. How we share information</h2>
      <p>We share personal information only as needed to operate the registry:</p>
      <ul>
        <li>
          <strong>With matched parties</strong>: when a clinician claims a shift, the facility
          receives the clinician&rsquo;s name and phone number; the clinician receives the
          facility&rsquo;s name, location, and shift details. This is operationally required.
        </li>
        <li>
          <strong>With service providers</strong>: Google Firebase (data storage and
          authentication), Twilio (SMS delivery), Anthropic (parsing inbound facility messages),
          and Vercel (hosting). These providers process information solely to perform services
          for QuickCare and are bound by their own privacy obligations.
        </li>
        <li>
          <strong>For legal reasons</strong>: where required by law, subpoena, or to protect
          rights, safety, or property.
        </li>
      </ul>
      <p>
        <strong>
          We do not sell, rent, or share your information with third parties for their marketing
          purposes.
        </strong>
      </p>

      <h2>5. Data retention</h2>
      <p>
        We retain personal data for as long as you are an active member of the registry or
        facility partner, plus a reasonable period afterward to comply with legal, tax, and
        accounting requirements. Compliance documents are retained for the period required by
        applicable healthcare and labor regulations.
      </p>

      <h2>6. Security</h2>
      <p>
        Information is stored in Google Firebase (Firestore + Cloud Storage) with access limited
        to authenticated QuickCare staff. We use TLS for data in transit and rely on Google
        Cloud&rsquo;s encryption-at-rest. No system is perfectly secure; please use a unique,
        strong password and report any suspected unauthorized access immediately.
      </p>

      <h2>7. Your choices</h2>
      <ul>
        <li>You may opt out of SMS messages at any time by replying STOP.</li>
        <li>
          You may request access, correction, or deletion of your personal information by
          contacting us at <a href="mailto:support@quickcareregistry.com">support@quickcareregistry.com</a>.
          We will respond within 30 days.
        </li>
        <li>
          California, Virginia, Colorado, and other US-state residents have additional rights
          under their respective privacy laws. Contact us to exercise those rights.
        </li>
      </ul>

      <h2>8. Children</h2>
      <p>
        QuickShift is intended for use by licensed healthcare professionals and facility
        coordinators who are 18 years or older. We do not knowingly collect information from
        anyone under 18.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be
        communicated via email or SMS to active users at least 30 days before they take effect.
      </p>

      <h2>10. Contact</h2>
      <p>
        QuickCare Nursing Registry<br />
        Email: <a href="mailto:support@quickcareregistry.com">support@quickcareregistry.com</a>
      </p>
    </PublicPageShell>
  );
}
