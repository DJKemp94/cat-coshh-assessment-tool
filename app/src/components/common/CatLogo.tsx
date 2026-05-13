import clsx from 'clsx';
import catHead from '@/assets/logo/cat-head.png';
import catSitting from '@/assets/logo/cat-sitting.png';
import pawPng from '@/assets/logo/paw.png';

interface LogoProps {
  size?: number;
  className?: string;
}

export function CatLogo({ size = 28, className }: LogoProps) {
  return (
    <img
      src={catHead}
      width={size}
      height={size}
      alt="CAT logo"
      draggable={false}
      className={clsx('select-none', className)}
    />
  );
}

export function CatSitting({ className }: { className?: string }) {
  return (
    <img
      src={catSitting}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={clsx('select-none', className)}
    />
  );
}

export function PawMark({ className }: { className?: string }) {
  return (
    <img
      src={pawPng}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={clsx('select-none', className)}
    />
  );
}
