import React from "react";
import { BeaconRenderProps } from "react-joyride";

export function TourBeacon(props: BeaconRenderProps) {
  return (
    <button
      {...props}
      className="relative flex items-center justify-center w-6 h-6"
    >
      <span className="absolute inline-flex h-full w-full rounded-full bg-[#4F46E5] opacity-50 animate-ping"></span>
      <span className="relative inline-flex rounded-full h-3 w-3 bg-[#4F46E5]"></span>
    </button>
  );
}
