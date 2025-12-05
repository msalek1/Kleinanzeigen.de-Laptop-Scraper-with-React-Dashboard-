import { MotionValue, motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

type AnimatedNumberProps = {
  value: number;
  className?: string;
  springOptions?: {
    bounce?: number;
    duration?: number;
    damping?: number;
    stiffness?: number;
  };
};

export function AnimatedNumber({
  value,
  className,
  springOptions,
}: AnimatedNumberProps) {
  const spring = useSpring(value, springOptions);
  const display: MotionValue<string> = useTransform(spring, (current) =>
    Math.round(current).toLocaleString()
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span className={className}>{display}</motion.span>;
}
