import type { LegalSection } from "../content-types";
import {
  BRAND_NAME,
  CompanyEmailLink,
  CONTACT_PHONE_DISPLAY,
  LEGAL_COMPANY_NAME,
  LEGAL_COMPANY_NUMBER,
  LEGAL_REGISTERED_OFFICE,
  LEGAL_WEBSITE,
  LEGAL_WEBSITE_URL,
} from "./company-legal";

export const termsSections = [
  {
    id: "promotor",
    title: "1. THE PROMOTOR AND WHO WE ARE",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          We are {LEGAL_COMPANY_NAME}, a company incorporated in Scotland with company number{" "}
          {LEGAL_COMPANY_NUMBER}. Our registered office is at {LEGAL_REGISTERED_OFFICE}. We are the
          &ldquo;Promotor&rdquo; of the prize draw (&ldquo;Draw&rdquo;) operated at OC &ndash;
          Official Site {BRAND_NAME} &ndash; Donate and win cars, money, instant prizes (
          {LEGAL_WEBSITE}) (&ldquo;the Website&rdquo;) which means that we are responsible for making
          sure it runs properly and fairly.
        </p>
        <p>
          These Terms apply to you as the participant of the Draw and as our client ("you", "your")
          and govern how the Draw operates.
        </p>
      </div>
    ),
  },
  {
    id: "terms",
    title: "2. THESE TERMS AND CONDITIONS",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          2.1. These terms and conditions (the "Terms") let you know how we operate each Draw and
          the rules of entry.
        </p>
        <p>
          2.2. You should always read these Terms to make sure you understand them before you enter
          into any Draw.
        </p>
        <p>
          2.3. We may change these Terms from time to time so you should check this page each time
          you enter into a Draw. We will let you know on our Website if we have updated our Terms
          and any changes will apply from the date that they are published on our Website.
        </p>
        <p>
          2.4. By entering into any Draw you accept that you understand these Terms and our Privacy
          Policy and agree to be legally bound by them. Our Privacy Policy may be found here{" "}
          <a href="/privacy" className="text-gold hover:underline">
            {LEGAL_WEBSITE_URL}/privacy
          </a>
          .
        </p>
        <p>
          2.5. Should you have any queries, concerns or complaints about a Draw then please contact
          us at{" "}
          <CompanyEmailLink />{" "}
          or {CONTACT_PHONE_DISPLAY}.
        </p>
        <p>
          2.6. If you have any difficulty accessing or entering this promotion, please contact us at{" "}
          <CompanyEmailLink />{" "}
          or {CONTACT_PHONE_DISPLAY}.
        </p>
        <p>
          2.7. If you would like these terms and conditions in another format (for example: audio,
          large print, braille) please contact us and we will endeavour to provide it.
        </p>
      </div>
    ),
  },
  {
    id: "entry-rules",
    title: "3. ENTRY RULES",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>3.1.0 Only one Account per Household is allowed.</p>
        <p>
          3.1. Each Draw is open to all persons aged 18 years and over who are resident in England,
          Wales, and Scotland.
        </p>
        <p>3.2. By entering into a Draw you confirm that:</p>
        <p>3.2.1. you are at least 18 years of age;</p>
        <p>3.2.2. you have the legal capacity to enter into the Draw;</p>
        <p>
          3.2.3. You are complying with all legal requirements in your country of residence with
          regard to entering this prize competition and prize competitions generally and are
          lawfully able to enter the Draw (and we advise that you seek legal advice and/or check
          with the relevant authorities in this regard);
        </p>
        <p>3.2.4. You accept these Terms and other Draw requirements as detailed on our Website.</p>
        <p>3.3. The following persons are not eligible to enter:</p>
        <p>
          3.3.1. our employees or workers, or the employees or workers of any company in our group;
        </p>
        <p>
          3.3.2. employees or workers of any organisation involved in the operation or
          administration of the Draw including prize suppliers and advertising agencies; and
        </p>
        <p>3.3.3. members of their immediate families.</p>
        <p>3.4. Entries will be void if they:</p>
        <p>3.4.1. do not comply with these Terms;</p>
        <p>3.4.2. are incomplete or illegible;</p>
        <p>
          3.4.3. are postal entries that are sent with the incorrect postage or to the incorrect
          address;
        </p>
        <p>3.4.4. are received after the closing date and time of each Draw;</p>
        <p>
          3.4.5. are considered by the Promoter to be part of an attempt to manipulate or unfairly
          influence the outcome of the Draw.
        </p>
        <p>
          3.5. We may ask for proof of age, residence or eligibility. Delay or failure to provide
          the evidence to our reasonable satisfaction may result in an entry being void or a prize
          being forfeited.
        </p>
        <p>
          3.6. Our decision as to whether an entrant (or their entry) is eligible for the Draw is
          final and we are not obliged to provide any reasons for disqualification.
        </p>
      </div>
    ),
  },
  {
    id: "how-to-enter",
    title: "4. HOW TO ENTER",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>You can enter this promotion in any of the following ways:</p>
        <p>
          <strong>Online</strong> Complete the entry steps online on our Website at OC –
          Official Site Online Competitions – Donate and win cars, money, instant prizes
          ({LEGAL_WEBSITE}) The cost of entry shall be displayed on our Website.
        </p>
        <p>
          <strong>Post</strong> You can enter by post but you will first have to register an account
          with us (see clause 4.1 below).
        </p>
        <p>
          Please send a postcard with your name, Online Competitions account number, postal address, date of
          birth, email address and telephone number and the name of the competition you are entering
          to {LEGAL_REGISTERED_OFFICE}.
        </p>
        <p>Valid free entries will be found within the history of your account.</p>
        <p>One entry per postcard to each Draw.</p>
        <p>
          Postal entries must be received by the closing date and time shown on each Draw in order
          for it to be processed before the Draw. Postal entries received after the closing date and
          time will not be entered into the Draw.
        </p>
        <p>
          4.1. In order to enter a Draw you will need to create an account with us via our Website.
          Please follow the on-screen instructions. You must provide us with your name and contact
          details which must include your email and postal address. It is really important that
          these details are correct, accurate and up to date so that we can contact you about the
          Draw if we need to. We cannot be responsible or liable to you this regard if you have
          provided us with inaccurate information.
        </p>
        <p>
          4.2. You will create a user name and password for your account. It is your responsibility
          to keep these details safe and secure and to not choose a password which can be easily
          guessed, and we are neither responsible nor liable to you in this regard. If you believe
          that somebody else is using your account, please contact us.
        </p>
        <p>
          4.3. Once you have paid for each entry you will then receive an email to confirm your
          entry into the Draw together with your Draw numbers.
        </p>
        <p>
          4.4. If you are entering by Post, we will allocate a randomly selected available Draw
          number to you.
        </p>
        <p>4.1.5 Where the Prize is a vehicle:</p>
        <p>
          the Promoter will, unless otherwise stated, ensure it comes with a valid MOT (if
          required);
        </p>
        <p>
          no insurance is included with the Prize and it is the Winner's responsibility to ensure
          the vehicle is adequately insured prior to taking it on the public roads (if it is legal
          to do so);
        </p>
        <p>
          the Promoter has no responsibility for the Prize(s) once it has been delivered. The Winner
          is solely responsible for complying with all relevant laws and regulations relating to the
          vehicle, its operation and ensuring they operate it in a safe and responsible manner;
        </p>
        <p>no vehicle/road tax is included; and</p>
        <p>
          the Winner is solely responsible for ensuring they have all necessary safety equipment and
          clothing (for example, helmets, boots and gloves) and for wearing them whilst operating
          the vehicle.
        </p>
        <p>
          4.5. Please note that when entering the Draw either Online and/or by Post you will not
          have been deemed to have entered the Draw until we have confirmed your entry into the Draw
          by emailing you and by confirmation to your account by logging into your account and
          checking under the "My Account" section. You will then be asked to enter your date of
          birth to confirm that you are over 18 years of age and that you have read and understood
          these Terms and our Privacy Policy.
        </p>
        <p>
          4.6. We reserve the right to refuse or disqualify your entry if we have reasonable grounds
          to believe that you have acted in breach of these Terms and you shall be liable for the
          return and/or reimbursement of all and any prizes (as defined below) to us.
        </p>
        <p>
          4.7. We reserve the right to reject entries that are unlawful, indecent, racist,
          inflammatory, defamatory or which we consider to be otherwise harmful. We also have the
          right to suspend or cancel your account.
        </p>
        <p>
          4.8. We accept no responsibility for any late, lost or misdirected entries including but
          not limited to entries not received due to technical disruptions, network congestion, loss
          in service of online entry mechanisms, computer error in transit, delay in postal services
          or any other reason.
        </p>
        <p>4.9. There will only be one Draw operating at any one time for each competition.</p>
        <p>
          4.10. The draw will close when the closing date and countdown clock have ended, and at
          least 80% of tickets have been sold.
        </p>
        <p>4.11. The Prize for each Draw ("Prize") will be displayed on our Website.</p>
        <p>4.12. There will only be one winner for each Draw.</p>
        <p>
          4.13. You must create your online account and only enter the Draw on your own behalf. You
          are not allowed to enter a Draw on behalf of anyone else.
        </p>
        <p>
          4.14. You can enter a maximum number of times as displayed in the description section
          under the relevant competition.
        </p>
      </div>
    ),
  },
  {
    id: "the-draw",
    title: "5. THE DRAW",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          5.1. Draw numbers will be entered into using Google's random number generator or such
          other random number generator used from time to time. The Draw Number randomly selected
          will be deemed the winner of the Draw ("Winner").
        </p>
        <p>5.2. There will be one Winner per Draw unless otherwise stated on our Website.</p>
        <p>
          5.3. The Draw will be performed and streamed via Facebook live on our page "Online Competitions
          Competitions" and/or such other social media platform that we decide.
        </p>
        <p>
          5.4. The Winner will be notified as soon as possible. We shall initially attempt to
          contact the Winner using the email address and contact details you provided at the time of
          creating your account. It is your responsibility to make sure that the details provided to
          us are correct and up to date. It is also your responsibility to make sure that an email
          from us has not gone into your spam or junk email folders. We will not be responsible or
          liable if you have provided inaccurate details or if you have failed to contact us in
          response to one of our emails within 5 days from the date of our email to you.
        </p>
        <p>
          5.5. If we are unable to contact a Winner within 5 days (which we may extend at out
          absolute and sole discretion) from the Draw taking place, or the Winner fails to respond
          to us or the Winner has breached these Terms, the Winner will forfeit the Prize and the
          Draw will be drawn again from the remaining entries in accordance with clause 5.2 and 5.3
          above.
        </p>
        <p>
          5.6. The Winner shall provide us with two valid forms of identification (one of which must
          be photo identification) prior to receiving any Prize. Failure to provide identification
          which is acceptable to us shall mean that the Winner forfeits his entry and Prize, and the
          Draw will be redrawn in accordance with clause 5.1 and 5.2 above.
        </p>
        <p>
          5.7. Following our successful verification of the Winner (and we reserve the right to
          verify the Winner in our sole and absolute discretion) we will contact you to arrange the
          free delivery of your Prize to the address in Great Britain as stated on your account.
        </p>
        <p>
          5.8. We shall endeavour to transfer cash Prizes to the Winner within 30 days from the date
          of the Draw.
        </p>
        <p>
          5.9. In all other cases, we will provide the Winner with instructions on how to book or
          obtain their Prize.
        </p>
        <p>
          5.10. Some Prizes, including but not limited to bespoke and/or custom made Prizes are
          subject to availability.
        </p>
        <p>
          5.11. The Winner is responsible for any costs or expenses involved in claiming or using
          the Prize other than those that are expressly stated as being included as part of the
          Prize.
        </p>
        <p>
          5.12. We are not liable for any damage or loss to a Prize caused by any third party. If a
          Prize is damaged or fails to be delivered, we have no obligation to provide a replacement
          Prize.
        </p>
        <p>
          5.13. Winners shall be responsible for all tax and other such charges which could apply as
          a result of receiving a Prize and should seek independent financial advice. We shall have
          no responsibility or liability to you or any tax authority in this regard.
        </p>
        <p>
          5.14. The Prize may be subject to additional Terms imposed by the supplier or other
          organisation connected to this promotion.
        </p>
        <p>
          5.15. If necessary due to circumstances beyond our control, we may (at our option)
          substitute the Prize for:
        </p>
        <p>5.15.1. a reasonable equivalent of equal or higher value; or</p>
        <p>5.15.2. a Cash Alternative.</p>
        <p>
          5.16. The Prize is for the named winner only and cannot be given or transferred to any
          other person.
        </p>
        <p>
          5.17. Partial details of the Winner can be obtained by sending an email to us at{" "}
          <CompanyEmailLink />{" "}
          and will be published at OC – Official Site Online Competitions – Donate and win cars,
          money, instant prizes ({LEGAL_WEBSITE}) 6 months after the closing date and time.
        </p>
        <p>
          5.18. Entrants who do not want their details included on the list of Winners referred to
          above must notify us within a reasonable period of time before the closing date and time
          of this promotion.
        </p>
        <p>
          5.19. All Winners will be required for post Draw publicity which may include interviews
          with press, the provision or taking of photographs and/or videos for use in press and on
          social media platforms. Please see our Personal Information section below. Please note
          that your current social media profile picture may be displayed on our Website under the
          Winners section.
        </p>
      </div>
    ),
  },
  {
    id: "personal-information",
    title: "6. PERSONAL INFORMATION AND DATA PROTECTION",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          6.1. We collect and use personal information that you provide to us when entering a Draw
          and when you visit our Website in accordance with our Privacy Policy. This information
          will be used by us and our third parties who assist us with the operation and
          administration of the Draw.
        </p>
        <p>
          6.2. You should read our Privacy Policy carefully prior to entering into a Draw so that
          our use of your personal information is acceptable to you. We will only every use your
          personal information in accordance with our Privacy Policy.
        </p>
        <p>
          6.3. By entering into a Draw you agree and consent that we may use and/or publish your
          surname, county, occupation, character, appearance and likeness without any consideration
          or payment to you in accordance with our Privacy Policy.
        </p>
        <p>
          6.4. We shall ensure that we protect your personal information in accordance with the
          applicable data protection laws including but not limited to the Data Protection Act 2018
          and the UK GDPR.
        </p>
      </div>
    ),
  },
  {
    id: "intellectual-property",
    title: "7. YOUR INTELLECTUAL PROPERTY RIGHTS AND OUR USE OF YOUR ENTRY",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          7.1. You will retain ownership of all intellectual property rights (including copyright)
          in your entry, but you agree to grant us a licence to use it for any purpose connected to
          this promotion.
        </p>
        <p>
          7.2. The licence will last for the duration of the relevant intellectual property right
          and includes the right for us to:
        </p>
        <p>
          7.2.1. edit or modify your entry (including resizing, adjusting the colour and adding
          elements such as text);
        </p>
        <p>7.2.2. adapt it or incorporate it into other materials;</p>
        <p>
          7.2.3. sub-licence it to third parties or companies in our group to use for the purposes
          described in these Terms; and
        </p>
        <p>
          7.2.4. republish it (or any version modified in the way described above) on any media
          anywhere in the world.
        </p>
        <p>7.3. You confirm that your entry:</p>
        <p>
          7.3.1. is your own original work and does not breach any third party's intellectual
          property rights (for example, by including a company's trade mark without permission);
        </p>
        <p>
          7.3.2. is not defamatory, offensive, threatening, discriminatory, distasteful,
          pornographic or illegal;
        </p>
        <p>
          7.3.3. can be submitted to us and used without breaching any contractual obligation to any
          person; and
        </p>
        <p>7.3.4. does not contain anything which may be confidential or commercially sensitive.</p>
        <p>
          7.4. If your entry contains photographs or video images of people, you must ensure that
          you inform them that you intend to use the material for the purposes of this promotion and
          obtain their consent.
        </p>
        <p>
          7.5. We may ask you for evidence of any such consent and reserve the right to disqualify
          your entry if you are unable to provide it or if we have doubts about its adequacy.
        </p>
        <p>
          7.6. You are not entitled to any fees for granting the licence and you are not entitled to
          terminate it unless we agree in writing.
        </p>
      </div>
    ),
  },
  {
    id: "legal-information",
    title: "8. IMPORTANT LEGAL INFORMATION",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p className="font-medium">
          It is really important that you pay particular attention to this clause as it contains
          important legal information.
        </p>
        <p>8.1. Entry into a Draw is non-refundable.</p>
        <p>
          8.2. We accept no responsibility for liability to you for reasons outside of our control
          to include (but not limited to) technical failures, malfunctions, internet accessibility
          or availability, web congestion, acts or omissions of any service provider, unauthorised
          intervention, computer virus, tampering, fraud or any other reason which affects the
          running, integrity, fairness, or administration of the Draw in any way and no compensation
          or damages will be payable to you.
        </p>
        <p>
          8.3. We reserve the right in our absolute and sole discretion to suspend or cancel or
          terminate the Draw in exceptional circumstances and to disqualify any person from that
          Draw and from future Draws who has directly or indirectly caused or who causes the Draw to
          be terminated, cancelled, delayed or suspended.
        </p>
        <p>
          8.4. We may vary these Terms or terminate, cancel, delay or suspend a Draw at any time in
          our absolute and sole discretion if we feel that it is reasonable to do so. If we
          terminate, cancel delay, or suspend a Draw we shall not be liable to you and no
          compensation will be offered.
        </p>
        <p>8.5. Our decision in relation to any Draw is final.</p>
        <p>
          8.6. We give no warranty or guarantee as to the quality, suitability and/or fitness for
          any particular purpose of any Prize. To the maximum extent permitted by law, all
          conditions, warranties and representations expressed or implied by law are hereby
          expressly excluded.
        </p>
        <p>
          8.7. To the maximum extent permitted by law, we shall not have any liability to you or any
          Winner in connection with or arising from any Draw however caused, including costs,
          expenses, damages and any other liabilities, provided that nothing in this clause shall
          limit our liability for personal injury or death caused by our negligence.
        </p>
        <p>
          8.8. Our total maximum aggregate liability to each Winner shall be limited to the total
          value of any one Prize.
        </p>
        <p>
          8.9. Our total maximum aggregate liability for non-winners shall be limited to the amount
          paid to enter the Draw.
        </p>
        <p>
          8.10. Except for any legal responsibility that we cannot exclude in law (such as for death
          or personal injury) or arising under applicable laws relating to the protection of your
          personal information, we are not legally responsible for any:
        </p>
        <p>8.10.1. losses that were not foreseeable to you and us when these Terms were formed;</p>
        <p>8.10.2. losses that were not caused by any breach on our part;</p>
        <p>8.10.3. business losses; and</p>
        <p>8.10.4. losses to non-consumers.</p>
        <p>8.11. Nothing in these Terms shall affect your statutory rights.</p>
        <p>
          8.12. If any provision or part-provision of these Terms is or becomes invalid, illegal or
          unenforceable, it shall be deemed deleted, but that shall not affect the validity and
          enforceability of the rest of these Terms.
        </p>
        <p>
          8.13. If you want to contact us about this promotion or have a complaint, you can reach us
          by:
        </p>
        <p>8.13.1. Telephone: {CONTACT_PHONE_DISPLAY}</p>
        <p>
          8.13.2. email:{" "}
          <CompanyEmailLink />{" "}
          ; or
        </p>
        <p>8.13.3. {LEGAL_REGISTERED_OFFICE}</p>
        <p>
          8.14. These Terms and any dispute or claim (including non-contractual disputes or claims)
          arising out of or in connection with them or their subject matter or formation shall be
          governed by and construed in accordance with the laws of England and Wales and the court
          in the country where you reside within Great Britain shall have exclusive jurisdiction to
          settle any dispute or claim arising out of or in connection with these Terms.
        </p>
      </div>
    ),
  },
  {
    id: "website-terms",
    title: "9. ADDITIONAL INFORMATION ABOUT OUR WEBSITE TERMS",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>9.1. The following Terms explain how you may use this Website and any of its content.</p>
        <p>
          9.2. You should read these Terms carefully before using the Website. By using the Website
          or otherwise indicating your consent, you agree to be bound by these Terms. If you do not
          agree with any of these Terms, you should stop using the Website immediately.
        </p>
        <p>
          9.3. These Terms apply to any parts of the Website, its functionality and content provided
          to you free of charge for entertainment purposes only.
        </p>
      </div>
    ),
  },
  {
    id: "using-website",
    title: "10. USING THE WEBSITE",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>10.1. The Website is for your personal and non-commercial use only.</p>
        <p>
          10.2. You agree that you are solely responsible for all costs and expenses you may incur
          in relation to your use of the Website.
        </p>
        <p>
          10.3. We make no promise that the Website is appropriate or available for use in locations
          outside of Great Britain. If you choose to access the Website from locations outside Great
          Britain, you acknowledge you do so at your own initiative and are responsible for
          compliance with local laws where they apply.
        </p>
        <p>
          10.4. We try to make the Website as accessible as possible. If you have any difficulties
          using the Website, please contact us using the contact details at the top of this page.
        </p>
        <p>10.5. As a condition of your use of the Website, you agree not to:</p>
        <p>
          10.5.1. misuse or attack our Website by knowingly introducing viruses, trojans, worms,
          logic bombs or any other material which is malicious or technologically harmful (such as
          by way of a denial-of-service attack), or
        </p>
        <p>
          10.5.2. attempt to gain unauthorised access to our Website, the server on which our
          Website is stored or any server, computer or database connected to our Website.
        </p>
        <p>
          10.6. We may prevent or suspend your access to the Website if you do not comply with these
          Terms or any applicable law.
        </p>
      </div>
    ),
  },
  {
    id: "registration",
    title: "11. REGISTRATION AND PASSWORD SECURITY",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          11.1. Use of the Website requires registration, particularly in order to access your
          account area of the Website.
        </p>
        <p>
          11.2. We are not obliged to permit anyone to register with the Website and we may refuse,
          terminate or suspend registration to anyone at any time.
        </p>
        <p>
          11.3. You are responsible for making sure that your password and any other account details
          are kept secure and confidential.
        </p>
        <p>
          11.4. If we have reason to believe there is likely to be a breach of security or misuse of
          the Website through your account or the use of your password, we may notify you and
          require you to change your password, or we may suspend or terminate your account.
        </p>
      </div>
    ),
  },
  {
    id: "infringing-content",
    title: "12. INFRINGING CONTENT",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>12.1. We will use reasonable efforts to:</p>
        <p>
          12.1.1. delete accounts which are being used in an inappropriate manner or in breach of
          these Terms; and
        </p>
        <p>
          12.1.2. identify and remove any content that is inappropriate, defamatory, infringes
          intellectual property rights or is otherwise in our reasonable opinion unacceptable to us
        </p>
        <p>
          when we are notified, but we cannot be responsible if you have failed to provide us with
          the relevant information.
        </p>
        <p>
          12.2. If you believe that any content which is distributed or published by the Website is
          inappropriate, defamatory or infringing on intellectual property rights, you should
          contact us immediately using the contact details at the top of this page.
        </p>
      </div>
    ),
  },
  {
    id: "ownership",
    title: "13. OWNERSHIP, USE AND INTELLECTUAL PROPERTY RIGHTS IN THE WEBSITE",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          13.1. The intellectual property rights in the Website and in any text, images, video,
          audio or other multimedia content, software or other information or material submitted to
          or accessible from the Website (Content) are owned by us and our licensors.
        </p>
        <p>
          13.2. We and our licensors reserve all our intellectual property rights (including, but
          not limited to, all copyright, trade marks, domain names, design rights, database rights,
          patents and all other intellectual property rights of any kind) whether registered or
          unregistered anywhere in the world. This means, for example, that we remain owners of them
          and are free to use them as we see fit.
        </p>
        <p>
          13.3. Nothing in these Terms grants you any legal rights in the Website or the Content
          other than as necessary for you to access it. You agree not to adjust, try to circumvent
          or delete any notices contained on the Website or the Content (including any intellectual
          property notices) and in particular, in any digital rights or other security technology
          embedded or contained within the Website or the Content.
        </p>
        <p>
          13.4. Trade marks: Online Competitions is our trademark. Other trade marks and trade names may also be
          used on the Website or in the Content. Use by you of any trade marks on the Website or in
          the Content is strictly prohibited unless you have our prior written permission.
        </p>
      </div>
    ),
  },
  {
    id: "submitting-information",
    title: "14. SUBMITTING INFORMATION TO THE WEBSITE",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          14.1. While we try to make sure that the Website is secure, we do not actively monitor or
          check whether information supplied to us through the Website is confidential, commercially
          sensitive or valuable.
        </p>
        <p>
          14.2. Other than any personal information which will be dealt with in accordance with our
          Privacy Policy, we do not guarantee that information supplied to us through the Website
          will be kept confidential and we may use it on an unrestricted and free-of-charge basis as
          we reasonably see fit.
        </p>
      </div>
    ),
  },
  {
    id: "accuracy",
    title: "15. ACCURACY OF INFORMATION AND AVAILABILITY OF THE WEBSITE",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          15.1. We try to make sure that the Website is accurate, up-to-date and free from bugs, but
          we cannot promise that it will be. Furthermore, we cannot promise that the Website will be
          fit or suitable for any purpose. Any reliance that you may place on the information on the
          Website is at your own risk.
        </p>
        <p>
          15.2. We may suspend or terminate access or operation of the Website at any time as we see
          fit.
        </p>
        <p>
          15.3. Any Content is provided for your general information purposes only and to inform you
          about us and our products and news, features, services and other websites that may be of
          interest, but has not been tailored to your specific requirements or circumstances. It
          does not constitute technical, financial or legal advice or any other type of advice and
          should not be relied on for any purposes. You should always use your own independent
          judgment when using our Website and its Content.
        </p>
        <p>
          15.4. While we try to make sure that the Website is available for your use, we do not
          promise that the Website will be available at all times or that your use of the Website
          will be uninterrupted.
        </p>
      </div>
    ),
  },
  {
    id: "hyperlinks",
    title: "16. HYPERLINKS AND THIRD PARTY SITES",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          The Website may contain hyperlinks or references to third party advertising and websites
          other than the Website. Any such hyperlinks or references are provided for your
          convenience only. We have no control over third party advertising or websites and accept
          no legal responsibility for any content, material or information contained in them. The
          display of any hyperlink and reference to any third party advertising or website does not
          mean that we endorse that third party's website, products or services. Your use of a third
          party site may be governed by the Terms of that third-party site and is at your own risk.
        </p>
      </div>
    ),
  },
  {
    id: "events-beyond-control",
    title: "17. EVENTS BEYOND OUR CONTROL",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          We are not liable to you if we fail to comply with these Terms because of circumstances
          beyond our reasonable control, including, but not limited to, strikes, lock-outs or other
          industrial disputes; breakdown of systems or network access; flood, fire, explosion or
          accident; or epidemics or pandemics.
        </p>
      </div>
    ),
  },
  {
    id: "third-party-rights",
    title: "18. RIGHTS OF THIRD PARTIES",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>No one other than a party to these Terms has any right to enforce any of these Terms.</p>
      </div>
    ),
  },
  {
    id: "variation",
    title: "19. VARIATION",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          19.1. No changes to these Terms are valid or have any effect unless agreed by us in
          writing or made in accordance with this clause.
        </p>
        <p>
          19.2. We reserve the right to vary these Terms from time to time. Our updated Terms will
          be displayed on the Website and by continuing to use and access the Website following such
          changes, you agree to be bound by any variation made by us. It is your responsibility to
          check these Terms from time to time to verify such variations.
        </p>
      </div>
    ),
  },
  {
    id: "disputes",
    title: "20. DISPUTES",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          20.1. We will try to resolve any disputes with you quickly and efficiently. If you are
          unhappy with us, please contact us as soon as possible using the contact details set out
          at the top of this page.
        </p>
        <p>
          20.2. If a dispute cannot be resolved or you are unhappy with the outcome, you may want to
          use alternative dispute resolution ("ADR"). ADR is a process for resolving disputes
          between you and us that does not involve going to court.
        </p>
        <p>
          20.3. If you do not wish to use ADR or are unhappy with the outcome of ADR, you can still
          bring court proceedings.
        </p>
        <p>
          20.4. The laws of England and Wales will apply to these Terms. If you want to take court
          proceedings, the relevant courts of England and Wales will have exclusive jurisdiction in
          relation to these Terms.
        </p>
      </div>
    ),
  },
];

export type { LegalSection };
