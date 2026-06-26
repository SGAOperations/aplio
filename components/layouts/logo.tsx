import Image from 'next/image';

import { cn } from '@/lib/utils';

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export function Logo({ width = 32, height = 32, className }: LogoProps) {
  return (
    <>
      <Image
        src="/logo-light.svg"
        alt="Aplio"
        width={width}
        height={height}
        className={cn('dark:hidden', className)}
      />
      <Image
        src="/logo-dark.svg"
        alt="Aplio"
        width={width}
        height={height}
        className={cn('hidden dark:block', className)}
      />
    </>
  );
}
