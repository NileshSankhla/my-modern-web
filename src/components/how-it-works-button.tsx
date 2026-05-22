"use client";

export default function HowItWorksButton() {
  const handleClick = () => {
    const element = document.getElementById("how-it-works");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex w-full items-center justify-center rounded-xl border-2 border-border bg-background/50 px-8 py-4 text-base font-semibold backdrop-blur-sm transition-all hover:scale-105 hover:bg-accent hover:text-accent-foreground sm:w-auto"
    >
      See How It Works
    </button>
  );
}
