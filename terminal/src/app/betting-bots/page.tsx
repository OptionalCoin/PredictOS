"use client";

import BettingBotTerminal from "@/components/BettingBotTerminal";
import Sidebar from "@/components/Sidebar";

export default function BettingBotsPage() {
  return (
    <div className="flex h-screen">
      {/* Sidebar Navigation */}
      <div className="relative z-10 overflow-visible">
        <Sidebar activeTab="betting-bots" />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <BettingBotTerminal />
      </main>
    </div>
  );
}

