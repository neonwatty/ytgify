'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

interface GradientButtonProps {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary';
  className?: string;
  external?: boolean;
}

export default function GradientButton({
  href,
  onClick,
  children,
  size = 'md',
  variant = 'primary',
  className = '',
  external = false
}: GradientButtonProps) {
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const baseClasses = `
    relative inline-flex items-center justify-center
    font-semibold rounded-lg
    transition-all duration-300
    ${sizeClasses[size]}
    ${className}
  `;

  const primaryClasses = `
    bg-gradient-to-r from-ytg-red via-ytg-pink to-ytg-purple
    text-white shadow-glow-pink hover:shadow-glow-strong
    hover:scale-105 active:scale-100
  `;

  const secondaryClasses = `
    bg-ytg-dark border border-ytg-pink/20
    text-ytg-pink hover:bg-ytg-pink/10
    hover:border-ytg-pink/40
  `;

  const classes = `${baseClasses} ${variant === 'primary' ? primaryClasses : secondaryClasses}`;

  const MotionComponent = motion.div;

  const buttonContent = (
    <MotionComponent
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="w-full"
    >
      <span className="relative z-10">{children}</span>
    </MotionComponent>
  );

  if (href) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
          {buttonContent}
        </a>
      );
    }
    return (
      <Link href={href} className={classes}>
        {buttonContent}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={classes}>
      {buttonContent}
    </button>
  );
}