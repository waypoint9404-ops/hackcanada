"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { VoiceRecorder } from "@/components/client/voice-recorder";
import { useRouter } from "next/navigation";

export function AddClientButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleIngestSuccess = (data: any) => {
    setOpen(false);
    if (data.clientId) {
      router.push(`/dashboard/${data.clientId}`);
    } else {
      router.refresh();
    }
  };

  return (
    <>
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        <span>+</span> <span className="ml-2">Add New Client</span>
      </Button>
      
      <VoiceRecorder 
        open={open} 
        onClose={() => setOpen(false)} 
        onIngestSuccess={handleIngestSuccess}
      />
    </>
  );
}
