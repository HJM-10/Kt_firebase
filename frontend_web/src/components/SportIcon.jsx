import React from 'react';
import { Dumbbell, Trophy, Activity, Target, Flame, Swords, Shield, Star } from 'lucide-react';

const iconMap = {
  'Dumbbell': Dumbbell,
  'Trophy': Trophy,
  'Activity': Activity,
  'Target': Target,
  'Flame': Flame,
  'Swords': Swords,
  'Shield': Shield,
  'Star': Star
};

const SportIcon = ({ iconName, size = 24, ...props }) => {
  const IconComponent = iconMap[iconName] || Trophy; // Default to Trophy if not found
  return <IconComponent size={size} {...props} />;
};

export const AVAILABLE_ICONS = Object.keys(iconMap);
export default SportIcon;
