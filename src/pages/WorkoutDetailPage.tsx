import { useParams } from 'react-router-dom';
import { PlaceholderCard } from '../components/ui/PlaceholderCard';

export function WorkoutDetailPage() {
  const { id } = useParams();
  return <PlaceholderCard title="Workout detail">Workout placeholder for ID: {id ?? 'unknown'}.</PlaceholderCard>;
}
