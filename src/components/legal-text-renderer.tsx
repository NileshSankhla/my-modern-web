import React from "react";

export function LegalTextRenderer({ text }: { text: string }) {
  // 1. Clean the raw text (remove manual ASCII banners and metadata lines)
  const cleanText = text
    .replace(/={3,}[\s\S]*?={3,}/g, "")
    .replace(/Last Updated:.*?\n/g, "")
    .replace(/Effective Date:.*?\n/g, "")
    .replace(/END OF.*?/g, "");

  // 2. Split into distinct blocks/paragraphs
  const blocks = cleanText.split(/\n\s*\n/).filter(Boolean);

  return (
    <div className="space-y-6">
      {blocks.map((block, idx) => {
        const content = block.trim();
        if (!content || content.startsWith("---")) return null;

        // Automatically format ASCII tables
        if (content.includes("|") && content.includes("---")) {
          return (
            <div
              key={idx}
              className="my-8 overflow-hidden rounded-2xl border border-border/50 bg-muted/10 shadow-inner"
            >
              <div className="overflow-x-auto p-4 sm:p-6">
                <pre className="font-mono text-sm leading-loose text-muted-foreground">{content}</pre>
              </div>
            </div>
          );
        }

        // Main headers like: "1. INFORMATION WE COLLECT"
        const isMainHeader = /^\d+\.\s/.test(content) && content === content.toUpperCase();
        if (isMainHeader) {
          return (
            <h2
              key={idx}
              className="mt-16 mb-6 flex items-center border-b border-border/40 pb-4 text-2xl font-extrabold tracking-tight text-foreground"
            >
              <span className="mr-3 text-primary opacity-50">#</span> {content}
            </h2>
          );
        }

        // Subheaders like: "1.1 Personal Information..."
        if (/^\d+\.\d+\s/.test(content)) {
          return (
            <h3 key={idx} className="mt-10 mb-4 text-xl font-bold text-foreground">
              {content}
            </h3>
          );
        }

        // List-like blocks containing alphabetic points and bullet lines
        const lines = content
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        if (lines.length > 1 && (lines[0].match(/^[a-z]\)/) || lines.some((line) => line.startsWith("-")))) {
          return (
            <div
              key={idx}
              className="mb-6 rounded-2xl border border-border/30 bg-card/40 p-5 shadow-sm transition-colors hover:bg-card/60 sm:p-6"
            >
              {lines.map((line, i) => {
                if (line.match(/^[a-z]\)/)) {
                  return (
                    <h4 key={i} className="mt-4 mb-3 font-semibold text-primary first:mt-0">
                      {line}
                    </h4>
                  );
                }

                if (line.startsWith("-")) {
                  return (
                    <div key={i} className="mb-2.5 ml-2 flex items-start gap-3 text-muted-foreground sm:ml-4">
                      <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                      <span className="leading-relaxed">{line.substring(1).trim()}</span>
                    </div>
                  );
                }

                return (
                  <p key={i} className="mb-3 leading-relaxed text-muted-foreground">
                    {line}
                  </p>
                );
              })}
            </div>
          );
        }

        // Standard paragraph blocks
        const paragraphText = content.replace(/\n/g, " ");
        return (
          <p key={idx} className="text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            {paragraphText}
          </p>
        );
      })}
    </div>
  );
}
