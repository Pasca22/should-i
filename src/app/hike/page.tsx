import type { Metadata } from "next";
import HikeClient from "./HikeClient";

export const metadata: Metadata = { title: "Should I hike?" };

export default function HikePage() {
  return <HikeClient />;
}
