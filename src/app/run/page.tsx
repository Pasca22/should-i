import type { Metadata } from "next";
import RunClient from "./RunClient";

export const metadata: Metadata = { title: "Should I run?" };

export default function RunPage() {
  return <RunClient />;
}
