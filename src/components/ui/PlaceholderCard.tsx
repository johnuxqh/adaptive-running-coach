import type { ReactNode } from 'react';
import { SectionCard, ScreenTitle } from './designSystem';

interface PlaceholderCardProps {
  title: string;
  children: ReactNode;
}

export function PlaceholderCard({ title, children }: PlaceholderCardProps) {
  return (
    <SectionCard>
      <ScreenTitle title={title}>{children}</ScreenTitle>
    </SectionCard>
  );
}
