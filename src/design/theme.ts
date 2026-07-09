import { animation } from './animation';
import { colors } from './colors';
import { icons } from './icons';
import { radius } from './radius';
import { shadows } from './shadows';
import { spacing } from './spacing';
import { fontFamily, typography } from './typography';

export const theme = { colors, spacing, typography, fontFamily, radius, shadows, animation, icons, layout: { maxWidth: 430 } } as const;
