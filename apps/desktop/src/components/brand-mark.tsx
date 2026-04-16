import type { ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type BrandMarkProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>;

export function BrandMark({ className, alt = 'HysCode logo', ...props }: BrandMarkProps) {
  return (
    <img
      src="/hyscode-logo.png"
      alt={alt}
      className={cn('select-none object-contain', className)}
      draggable={false}
      {...props}
    />
  );
}