import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import * as React from "react";

interface WelcomeEmailProps {
  firstName?: string;
}

const DEFAULT_EMAIL_BASE_URL = "https://www.fareback.in";

const getEmailBaseUrl = () => {
  const configuredUrl =
    process.env.EMAIL_ASSET_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    DEFAULT_EMAIL_BASE_URL;

  try {
    const parsedUrl = new URL(configuredUrl);
    const host = parsedUrl.hostname.toLowerCase();

    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
      return DEFAULT_EMAIL_BASE_URL;
    }

    return `${parsedUrl.protocol}//${parsedUrl.host}`;
  } catch {
    return DEFAULT_EMAIL_BASE_URL;
  }
};

export const WelcomeEmail = ({ firstName = "there" }: WelcomeEmailProps) => {
  const previewText =
    "Welcome to Fareback! Get ready to earn cashback on your favorite brands.";
  const appUrl = getEmailBaseUrl();
  const darkLogoUrl = `${appUrl}/brand-name-dark.svg`; 
  const lightLogoUrl = `${appUrl}/brand-name-light.svg`; 

  return (
    <Html>
      <Tailwind>
        <Head>
          <meta name="color-scheme" content="light dark" />
          <meta name="supported-color-schemes" content="light dark" />
        </Head>
        <Preview>{previewText}</Preview>
        {/* Slightly darker gray outer background so the white card pops */}
        <Body className="mx-auto my-auto bg-[#f3f4f6] dark:bg-[#000000] px-2 font-sans text-[#111827] dark:text-[#ededed]">
          
          {/* Unified pure white card in light mode, unified #121212 in dark mode. 
              Added a premium 4px purple border to the top of the card. */}
          <Container className="mx-auto my-[40px] max-w-[600px] rounded-xl border border-solid border-[#e5e7eb] border-t-[4px] border-t-[#7c3aed] dark:border-[#262626] dark:border-t-[#7c3aed] bg-white dark:bg-[#121212] p-[20px] shadow-md">
            
            {/* Removed the #f8fafc background so it inherits pure white, preventing camouflage */}
            <Section className="overflow-hidden p-[24px] text-center">
              {/* Removed the purple pill line, as the top border now serves this brand purpose better */}
              <Img
                src={darkLogoUrl}
                alt="Fareback"
                width="164"
                height="56"
                className="mx-auto mb-[8px] h-auto w-[164px] block dark:hidden"
              />
              <Img
                src={lightLogoUrl}
                alt="Fareback"
                width="164"
                height="56"
                className="mx-auto mb-[8px] h-auto w-[164px] hidden dark:block"
              />
              <Text className="m-0 text-[13px] font-medium text-[#64748b] dark:text-[#a3a3a3]">
                India&apos;s trusted cashback platform
              </Text>
            </Section>

            <Section className="px-[20px]">
              <Text className="text-[16px] leading-[24px] text-[#111827] dark:text-[#ededed]">Hi {firstName},</Text>

              <Heading className="my-[20px] p-0 text-[22px] font-bold text-[#111827] dark:text-white">
                Welcome to Fareback! &#x1F680;
              </Heading>

              <Text className="text-[16px] leading-[24px] text-[#4b5563] dark:text-[#a3a3a3]">
                We&apos;re thrilled to have you on board. At Fareback, you can earn real,
                withdrawable cashback on every purchase from your favorite brands-all in just a
                few clicks. No hassle, no hidden steps.
              </Text>

              <Section className="my-[24px] rounded-r-lg border-l-[4px] border-solid border-[#eab308] dark:border-[#b45309] bg-[#fefce8] dark:bg-[#1c140a] p-[16px]">
                <Text className="m-0 text-center text-[15px] font-semibold text-[#854d0e] dark:text-[#fbbf24]">
                  &#x1F4A1; Pro-Tip for Guaranteed Tracking: Always ensure your retailer&apos;s
                  shopping cart is empty before clicking a Fareback link!
                </Text>
              </Section>

              <Text className="mt-[24px] mb-[12px] text-[16px] font-bold text-[#111827] dark:text-[#ededed]">
                &#x1F4B8; Here&apos;s what you can do now:
              </Text>

              <Text className="m-0 text-[15px] leading-[24px] text-[#4b5563] dark:text-[#a3a3a3]">
                &bull; Shop from top brands like Amazon, Flipkart, Myntra &amp; more
              </Text>
              <Text className="m-0 text-[15px] leading-[24px] text-[#4b5563] dark:text-[#a3a3a3]">
                &bull; Earn guaranteed cashback on every purchase
              </Text>
              <Text className="m-0 text-[15px] leading-[24px] text-[#4b5563] dark:text-[#a3a3a3]">
                &bull; Track your earnings seamlessly in your dashboard
              </Text>
              <Text className="m-0 text-[15px] leading-[24px] text-[#4b5563] dark:text-[#a3a3a3]">
                &bull; Withdraw your approved cashback securely via UPI
              </Text>

              <Section className="mt-[32px] mb-[32px] text-center">
                <Button
                  className="rounded-full bg-[#7c3aed] hover:bg-[#6d28d9] px-[32px] py-[14px] text-center text-[16px] font-semibold text-white no-underline"
                  href={appUrl}
                >
                  Start earning cashback now
                </Button>
              </Section>

              <Text className="text-[15px] leading-[24px] text-[#4b5563] dark:text-[#a3a3a3]">
                If you have any questions, feel free to reply directly to this email-our support
                team is here to help!
              </Text>

              <Text className="m-0 mt-[24px] text-[16px] font-bold text-[#111827] dark:text-[#ededed]">
                Happy Saving &#x1F49C;
                <br />
                <span className="text-[#7c3aed] dark:text-[#a78bfa]">Team Fareback</span>
              </Text>
            </Section>

            <Hr className="mx-0 my-[26px] w-full border border-solid border-[#eaeaea] dark:border-[#262626]" />

            {/* Removed the #f8fafc background here as well */}
            <Section className="py-[24px] text-center">
              <Text className="m-0 text-[13px] italic text-[#64748b] dark:text-[#737373]">
                &quot;Turn every purchase into savings.&quot;
              </Text>
            </Section>
          </Container>

          <Text className="mt-[20px] text-center text-[12px] text-[#94a3b8] dark:text-[#737373]">
            You are receiving this email because you recently signed up for Fareback.
          </Text>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default WelcomeEmail;