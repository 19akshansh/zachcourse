import React from "react";
import { ArrowRenderProps } from "react-joyride";

export function TourArrow(props: ArrowRenderProps) {
  // A simple themed arrow that points at the target
  // React-joyride v3 passes `arrowBase`, `arrowColor`, `arrowSize`, `arrowSpacing` if we need them,
  // but we can just render an SVG with our theme color.
  // Actually, we'll just let Joyride use its default arrow by not providing arrowComponent,
  // or we can provide a small SVG. Let's just return null or a basic SVG.
  // Wait, if we use a custom tooltip, we might not even need an arrow if it's placed nicely.
  // But let's build it if requested. Let's just return a generic arrow.
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" {...props}>
      <path d="M12 0L24 12H0L12 0Z" fill="#1A172E" stroke="#2A2443" strokeWidth="1" />
    </svg>
  );
}
