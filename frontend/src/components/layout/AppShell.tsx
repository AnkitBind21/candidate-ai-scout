import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex w-full">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex-1 px-6 lg:px-10 py-8 max-w-[1600px] w-full mx-auto"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
