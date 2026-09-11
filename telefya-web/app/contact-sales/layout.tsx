import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Contact Sales",
  description:
    "Talk with Telefya’s team about secure enterprise video meetings, live events, deployment requirements, collaboration, and custom workspace plans.",
  path: "/contact-sales",
});

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How fast will someone respond?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Our sales team replies within one business day.",
      },
    },
    {
      "@type": "Question",
      name: "Do you support custom contracts and invoicing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Enterprise and Platform plans support annual contracts, custom invoicing, and procurement paperwork.",
      },
    },
    {
      "@type": "Question",
      name: "Can we get a private deployment?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Platform customers can request a dedicated or on-premise Mediasoup deployment.",
      },
    },
  ],
};

export default function ContactSalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />
    </>
  );
}