import "../../brand/index.css"
import "./index.css"
import { Title, Meta } from "@solidjs/meta"
import { Header } from "~/component/header"
import { Footer } from "~/component/footer"
import { Legal } from "~/component/legal"
import { LocaleLinks } from "~/component/locale-links"

export default function AcceptableUsePolicy() {
  return (
    <main data-page="legal">
      <Title>OpenSploit | Acceptable Use Policy</Title>
      <LocaleLinks path="/legal/acceptable-use" />
      <Meta name="description" content="OpenSploit acceptable use policy for authorized security testing" />
      <div data-component="container">
        <Header />

        <div data-component="content">
          <section data-component="brand-content">
            <article data-component="terms-of-service">
              <h1>Acceptable Use Policy</h1>
              <p class="effective-date">Effective date: April 18, 2026</p>

              <p>
                This Acceptable Use Policy ("AUP") governs your use of OpenSploit, a penetration testing
                platform operated by <strong>Silicon Works Ltd</strong> ("we", "us", "our"), a company
                registered in England and Wales.
              </p>

              <h2>1. Authorized Use Only</h2>
              <p>
                OpenSploit is designed exclusively for <strong>authorized security testing</strong>. By using
                OpenSploit, you represent and warrant that:
              </p>
              <ul>
                <li>You have explicit, written authorization to test every target you scan, probe, or exploit</li>
                <li>You are conducting testing as part of a legitimate security assessment, penetration test, bug bounty program, or authorized training exercise (e.g., HackTheBox, VulnHub, CTF competitions)</li>
                <li>You will comply with all applicable laws, including but not limited to the Computer Misuse Act 1990 (UK), the Computer Fraud and Abuse Act (US), and equivalent legislation in your jurisdiction</li>
              </ul>

              <h2>2. Prohibited Activities</h2>
              <p>You must not use OpenSploit to:</p>
              <ul>
                <li>Test, scan, or attack any system without explicit authorization from the system owner</li>
                <li>Target government, military, critical infrastructure, healthcare, or financial systems without proper authorization and scope documentation</li>
                <li>Conduct denial-of-service (DoS/DDoS) attacks</li>
                <li>Develop, distribute, or deploy malware, ransomware, or destructive payloads</li>
                <li>Exfiltrate personal data or sensitive information beyond what is necessary to demonstrate a vulnerability</li>
                <li>Engage in any activity that violates applicable law or regulations</li>
              </ul>

              <h2>3. Acknowledgment of Capabilities</h2>
              <p>
                <strong>YOU ACKNOWLEDGE THAT OPENSPLOIT CONTAINS FUNCTIONALITY THAT CAN BE USED TO
                SCAN, TEST, ATTACK, AND COMPROMISE COMPUTER SYSTEMS.</strong> This includes network
                scanning, vulnerability exploitation, password testing, and other offensive security
                techniques. These capabilities exist for legitimate, authorized security testing.
                You accept full responsibility for how you use these capabilities.
              </p>

              <h2>4. Your Responsibility</h2>
              <p>
                <strong>Usage of OpenSploit for attacking targets without prior mutual consent is
                illegal. It is the end user's responsibility to obey all applicable local, state,
                and federal laws. Silicon Works Ltd assumes no liability and is not responsible for
                any misuse or damage caused by this software.</strong>
              </p>
              <p>
                We do not verify whether you have authorization to test any particular target. You
                are solely and exclusively responsible for determining the appropriateness of your
                use and for ensuring you have proper authorization. You assume all risks associated
                with your use of the platform.
              </p>

              <h2>5. No Warranty</h2>
              <p>
                THE SOFTWARE AND SERVICES ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS,
                WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING
                WITHOUT LIMITATION ANY WARRANTIES OF TITLE, NON-INFRINGEMENT, MERCHANTABILITY, OR
                FITNESS FOR A PARTICULAR PURPOSE. Silicon Works Ltd does not warrant that the
                software will meet your requirements, operate error-free, detect all vulnerabilities,
                or produce accurate results.
              </p>
              <p>
                OpenSploit's built-in safeguards (target validation, scope warnings) are provided as
                convenience features, not legal protections. The presence or absence of a warning does
                not constitute legal advice or authorization to test any target.
              </p>

              <h2>6. Limitation of Liability</h2>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL SILICON WORKS
                LTD, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
                INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING BUT
                NOT LIMITED TO LOSS OF PROFITS, LOSS OF DATA, BUSINESS INTERRUPTION, OR DAMAGE TO
                COMPUTER SYSTEMS) ARISING OUT OF THE USE OR INABILITY TO USE THE SOFTWARE, EVEN IF
                ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>

              <h2>7. Account Termination</h2>
              <p>
                We reserve the right to suspend or terminate your account if we have reasonable grounds to
                believe you are using OpenSploit in violation of this AUP, without prior notice or liability.
              </p>

              <h2>8. Indemnification</h2>
              <p>
                You agree to indemnify and hold harmless Silicon Works Ltd, its officers, directors, and
                employees from any claims, damages, losses, or expenses (including legal fees) arising from
                your use of OpenSploit or violation of this AUP.
              </p>

              <h2>9. Law Enforcement</h2>
              <p>
                We will cooperate with law enforcement agencies in accordance with applicable UK law,
                including the Data Protection Act 2018 and the Regulation of Investigatory Powers Act 2000.
                We retain minimal user data — see our Privacy Policy for details.
              </p>

              <h2>10. Changes to This Policy</h2>
              <p>
                We may update this AUP from time to time. Material changes will be communicated via the
                platform. Continued use of OpenSploit after changes constitutes acceptance of the updated policy.
              </p>

              <h2>11. Contact</h2>
              <p>
                For questions about this policy, contact us at{" "}
                <a href="mailto:legal@opensploit.ai">legal@opensploit.ai</a>.
              </p>
            </article>
          </section>
        </div>

        <Legal />
        <Footer />
      </div>
    </main>
  )
}
