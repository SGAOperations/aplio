import Image from 'next/image';

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
        className={className ? `dark:hidden ${className}` : 'dark:hidden'}
      />
      <Image
        src="/logo-dark.svg"
        alt="Aplio"
        width={width}
        height={height}
        className={
          className ? `hidden dark:block ${className}` : 'hidden dark:block'
        }
      />
    </>
  );
}
