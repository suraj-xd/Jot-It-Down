import { Variants, Transition } from "motion/react"

export const transition: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 30,
}

export const reducedMotionTransition: Transition = {
  duration: 0,
}

export const fadeInOut: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export const fadeSlideUp: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

export const fadeSlideDown: Variants = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
}

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
}

export const listItem: Variants = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 8, transition: { duration: 0.15 } },
}

export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.03,
    },
  },
}
