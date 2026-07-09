import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Deck Builder",
};

export default function DeckBuilderLayout({ children }: { children: ReactNode }) {
  return children;
}
