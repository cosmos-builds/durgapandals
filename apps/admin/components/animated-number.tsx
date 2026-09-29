"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";

export interface AnimatedNumberProps {
  value: number;
  className?: string;
}

// Dashboard stat tiles used to just snap to a new number on every refetch —
// this counts up/down from the previous value instead, which reads as "the
// data moved" rather than "the page re-rendered". Passing the MotionValue
// straight through as children (rather than useState) skips a React
// re-render on every animation frame.
export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.7, ease: "easeOut" });
    return controls.stop;
  }, [value, motionValue]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
