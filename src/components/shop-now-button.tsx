"use client";

import { usePathname, useRouter } from "next/navigation";

interface ShopNowButtonProps {
  className: string;
}

const ShopNowButton = ({ className }: ShopNowButtonProps) => {
  const pathname = usePathname();
  const router = useRouter();

  const handleClick = () => {
    if (pathname === "/") {
      const offersSection = document.getElementById("offers");
      if (offersSection) {
        offersSection.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", "/#offers");
        return;
      }
    }

    router.push("/#offers");
  };

  return (
    <button type="button" onClick={handleClick} className={className}>
      Shop Now
    </button>
  );
};

export default ShopNowButton;
