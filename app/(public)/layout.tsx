import type { ReactNode } from "react";
import { PublicCitizenShell } from "../components/public-citizen-shell";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicCitizenShell>{children}</PublicCitizenShell>;
}
