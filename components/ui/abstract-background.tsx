import React from "react";

export function AbstractBackground() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden"
      aria-hidden="true"
    >
      {/* 
        1. Base Texture / Grid 
        A very faint, rigorous grid to ground the application and give it that 
        archival, industrial feel. 
      */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm1 1h38v38H1V1z' fill='%231C1B1A' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
          backgroundSize: "40px 40px"
        }}
      />

      {/* 
        2. Soft Ambient Orbs
        These provide the "elegance" and break up the harshness of the grid. 
        Positioned asymmetrically. 
      */}
      
      {/* Top Left Orb - Muted primary accent */}
      <div 
        className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-[0.15] mix-blend-multiply"
        style={{
          background: "radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)",
          top: "-10%",
          left: "-10%",
        }}
      />

      {/* Bottom Right Orb - Muted AI accent */}
      <div 
        className="absolute w-[800px] h-[800px] rounded-full blur-[140px] opacity-[0.12] mix-blend-multiply"
        style={{
          background: "radial-gradient(circle, var(--accent-ai) 0%, transparent 70%)",
          bottom: "-20%",
          right: "-10%",
        }}
      />

      {/* Center Left Subtle Warmth */}
      <div 
        className="absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-[0.08] mix-blend-multiply"
        style={{
          background: "radial-gradient(circle, var(--status-med-text) 0%, transparent 70%)",
          top: "40%",
          left: "20%",
        }}
      />
    </div>
  );
}
