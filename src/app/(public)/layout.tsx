import { Suspense } from "react";

import Header from "@/components/Header";
import { HomeUiStateProvider } from "@/components/HomeUiState.client";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <HomeUiStateProvider>
      <Suspense fallback={<div className="h-14 border-b bg-background" />}>
        <Header />
      </Suspense>
      <main>{children}</main>
    </HomeUiStateProvider>
  );
}
