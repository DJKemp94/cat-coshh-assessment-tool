import clsx from 'clsx';
import labcatLogo from '@/assets/logo/labcat-logo.png';
import catSitting from '@/assets/logo/cat-sitting.png';
import pawPng from '@/assets/logo/paw.png';

interface LogoProps {
  size?: number;
  className?: string;
}

export function CatLogo({ size = 28, className }: LogoProps) {
  return (
    <img
      src={labcatLogo}
      width={size}
      height={size}
      alt="LabCAT logo"
      draggable={false}
      className={clsx('select-none object-contain', className)}
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
