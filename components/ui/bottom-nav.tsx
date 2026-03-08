"use client";

import { usePathname, useRouter } from "next/navigation";
import { Users, Calendar, UserCircle } from "lucide-react";
import Dock from "./Dock";

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isSchedule = pathname === "/schedule" || pathname.startsWith("/schedule/");
  const isProfile = pathname === "/profile";

  const tabs = [
    { 
      label: "Clients", 
      className: isDashboard ? "!bg-[#2A4B7C] !border-[#2A4B7C] shadow-md transition-all duration-300" : "transition-all duration-300 hover:!bg-black/5",
      icon: (
        <div className="flex flex-col items-center justify-center gap-1 mt-0.5">
          <Users size={20} className={isDashboard ? "text-white" : "text-text-secondary"} />
          <span className={`text-[10px] font-medium tracking-wide ${isDashboard ? "text-white" : "text-text-secondary"}`}>Clients</span>
        </div>
      ), 
      onClick: () => router.push("/dashboard") 
    },
    { 
      label: "Schedule", 
      className: isSchedule ? "!bg-[#2A4B7C] !border-[#2A4B7C] shadow-md transition-all duration-300" : "transition-all duration-300 hover:!bg-black/5",
      icon: (
        <div className="flex flex-col items-center justify-center gap-1 mt-0.5">
          <Calendar size={20} className={isSchedule ? "text-white" : "text-text-secondary"} />
          <span className={`text-[10px] font-medium tracking-wide ${isSchedule ? "text-white" : "text-text-secondary"}`}>Schedule</span>
        </div>
      ), 
      onClick: () => router.push("/schedule") 
    },
    { 
      label: "Profile", 
      className: isProfile ? "!bg-[#2A4B7C] !border-[#2A4B7C] shadow-md transition-all duration-300" : "transition-all duration-300 hover:!bg-black/5",
      icon: (
        <div className="flex flex-col items-center justify-center gap-1 mt-0.5">
          <UserCircle size={20} className={isProfile ? "text-white" : "text-text-secondary"} />
          <span className={`text-[10px] font-medium tracking-wide ${isProfile ? "text-white" : "text-text-secondary"}`}>Profile</span>
        </div>
      ), 
      onClick: () => router.push("/profile") 
    },
  ];

  return (
    <Dock 
      items={tabs}
      panelHeight={68}
      baseItemSize={56}
      magnification={56}
    />
  );
}
