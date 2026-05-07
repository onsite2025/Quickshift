import type { Metadata } from "next";
import { PublicPageShell } from "@/components/PublicPageShell";

export const metadata: Metadata = {
  title: "Terms & SMS Program — QuickShift",
  description: "Terms of service and SMS program details for QuickShift / QuickCare Nursing Registry.",
};

export default function TermsPage() {
  return (
    <PublicPageShell title="Terms of Service & SMS Program" lastUpdated="May 7, 2026">
      <p>
        These Terms govern your use of <strong>QuickShift</strong>, the staffing dispatch
        platform operated by <strong>QuickCare Nursing Registry</strong> (&ldquo;QuickCare&rdquo;).
        By enrolling as a clinician or facility coordinator, you agree to these Terms.
      </p>

      <h2>SMS Program Details</h2>
      <p>
        <strong>Program name:</strong> QuickShift Shift Dispatch (operated by QuickCare Nursing
        Registry).
      </p>
      <p>
        <strong>Program description:</strong> QuickShift sends operational SMS messages to
        credentialed nurses (RN, LPN, CNA, NP) and to authorized facility coordinators. Messages
        include shift-availability notifications, claim confirmations, clock-in and clock-out
        reminders, timekeeping prompts, and matched-nurse confirmations. Inbound texts from
        facilities are parsed automatically to create shift requests.
      </p>
      <p>
        <strong>Message frequency:</strong> Variable, based on shift demand. Most users receive
        between 0 and 15 messages per week.
      </p>
      <p>
        <strong>Message and data rates:</strong> Message and data rates may apply. Check with
        your mobile carrier.
      </p>
      <p>
        <strong>Opt-in:</strong> By signing the QuickCare onboarding agreement (clinicians) or
        the QuickCare service agreement (facility coordinators), you consent to receive
        operational SMS messages at the mobile number you provide. Consent is not a condition of
        registration.
      </p>
      <p>
        <strong>Opt-out:</strong> You may reply <strong>STOP</strong>, <strong>STOPALL</strong>,{" "}
        <strong>UNSUBSCRIBE</strong>, <strong>CANCEL</strong>, <strong>END</strong>, or{" "}
        <strong>QUIT</strong> at any time to a QuickShift SMS to be removed from all future
        messages. You will receive a one-time confirmation that you have been unsubscribed; no
        further messages will be sent.
      </p>
      <p>
        <strong>Help:</strong> Reply <strong>HELP</strong> at any time to receive contact
        information for QuickCare support, or email{" "}
        <a href="mailto:support@quickcareregistry.com">support@quickcareregistry.com</a>.
      </p>
      <p>
        <strong>Carriers:</strong> Carriers (including but not limited to AT&amp;T, T-Mobile,
        Verizon) are not liable for delayed or undelivered messages.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        QuickShift is intended for licensed healthcare professionals and authorized facility
        coordinators 18 years of age or older. By using QuickShift you represent that you meet
        these requirements and that all information you provide is accurate.
      </p>

      <h2>2. Use of the service</h2>
      <ul>
        <li>You agree to provide accurate professional and contact information.</li>
        <li>
          You will only claim shifts for which you are credentialed and currently authorized to
          perform.
        </li>
        <li>
          You will not impersonate another clinician, share your credentials, or attempt to
          bypass compliance checks.
        </li>
        <li>
          Facility coordinators will only request staffing for legitimate, lawful patient-care
          needs.
        </li>
      </ul>

      <h2>3. Compliance and credentialing</h2>
      <p>
        Clinicians must maintain current licenses, certifications, background checks, and
        vaccinations as required by law and facility policy. Documents with lapsed expiration
        will result in automatic suspension from the registry until updated.
      </p>

      <h2>4. Timekeeping and pay</h2>
      <p>
        Clock-in and clock-out events recorded via SMS or in-app constitute the official record
        of hours worked. Timesheets are reviewed and approved by QuickCare. Payment is processed
        according to the schedule communicated at onboarding.
      </p>

      <h2>5. Termination</h2>
      <p>
        QuickCare may suspend or remove any account for violations of these Terms, fraudulent
        activity, repeated no-shows, or expiration of required compliance documents. You may
        request removal at any time by contacting{" "}
        <a href="mailto:support@quickcareregistry.com">support@quickcareregistry.com</a>.
      </p>

      <h2>6. Privacy</h2>
      <p>
        Use of QuickShift is subject to the <a href="/privacy">Privacy Policy</a>. We do not
        share opt-in or mobile-number information with third parties or affiliates for marketing
        purposes.
      </p>

      <h2>7. Disclaimers and limitation of liability</h2>
      <p>
        QuickShift is provided &ldquo;as is&rdquo; without warranties of any kind. To the
        maximum extent permitted by law, QuickCare disclaims all warranties, express or
        implied. QuickCare is not liable for indirect, incidental, special, or consequential
        damages arising out of your use of the service.
      </p>

      <h2>8. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be communicated via
        email or SMS to active users.
      </p>

      <h2>9. Contact</h2>
      <p>
        QuickCare Nursing Registry<br />
        Email: <a href="mailto:support@quickcareregistry.com">support@quickcareregistry.com</a>
      </p>
    </PublicPageShell>
  );
}
