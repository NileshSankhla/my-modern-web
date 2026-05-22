"use client";

import { MouseEvent, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

interface FooterNavLinkProps {
  href: string;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}

const FooterNavLink = ({ href, className, ariaLabel, children }: FooterNavLinkProps) => {
  const pathname = usePathname();
  const router = useRouter();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Keep browser-native behavior for modified clicks (new tab/window).
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (href.startsWith("/#")) {
      event.preventDefault();
      const sectionId = href.slice(2);

      if (pathname === "/") {
        const section = document.getElementById(sectionId);
        if (section) {
          section.scrollIntoView({ behavior: "smooth", block: "start" });
          window.history.replaceState(null, "", href);
          return;
        }
      }

      router.push(href);
      return;
    }

    if (pathname === href) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    event.preventDefault();
    router.push(href);
  };

  return (
    <a href={href} onClick={handleClick} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  );
};

export default FooterNavLink;
