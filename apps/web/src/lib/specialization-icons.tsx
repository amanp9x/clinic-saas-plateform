import {
  Activity,
  Baby,
  Bone,
  Brain,
  Ear,
  Eye,
  Flower2,
  HeartHandshake,
  HeartPulse,
  Smile,
  Sparkles,
  Stethoscope,
  type LucideProps,
} from 'lucide-react';

/** Renders the lucide icon for a specialization's stored iconName, falling back to a default. */
export function SpecializationIcon({
  iconName,
  ...props
}: LucideProps & { iconName: string | null }) {
  switch (iconName) {
    case 'HeartPulse':
      return <HeartPulse {...props} />;
    case 'Sparkles':
      return <Sparkles {...props} />;
    case 'Baby':
      return <Baby {...props} />;
    case 'Bone':
      return <Bone {...props} />;
    case 'Flower2':
      return <Flower2 {...props} />;
    case 'Smile':
      return <Smile {...props} />;
    case 'Ear':
      return <Ear {...props} />;
    case 'Brain':
      return <Brain {...props} />;
    case 'HeartHandshake':
      return <HeartHandshake {...props} />;
    case 'Eye':
      return <Eye {...props} />;
    case 'Activity':
      return <Activity {...props} />;
    case 'Stethoscope':
    default:
      return <Stethoscope {...props} />;
  }
}
