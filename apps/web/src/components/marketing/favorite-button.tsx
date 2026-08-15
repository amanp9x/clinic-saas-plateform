'use client';

import { Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import {
  listFavorites,
  removeClinicFavorite,
  removeDoctorFavorite,
  saveClinicFavorite,
  saveDoctorFavorite,
} from '@/lib/favorites-api';

const FAVORITES_QUERY_KEY = ['favorites'] as const;

export function FavoriteButton({ type, id }: { type: 'doctor' | 'clinic'; id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const { data } = useQuery({
    queryKey: FAVORITES_QUERY_KEY,
    queryFn: listFavorites,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const isFavorited =
    type === 'doctor'
      ? (data?.doctors.some((d) => d.id === id) ?? false)
      : (data?.clinics.some((c) => c.id === id) ?? false);

  const mutation = useMutation({
    mutationFn: () => {
      if (type === 'doctor') {
        return isFavorited ? removeDoctorFavorite(id) : saveDoctorFavorite(id);
      }
      return isFavorited ? removeClinicFavorite(id) : saveClinicFavorite(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FAVORITES_QUERY_KEY });
    },
  });

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    mutation.mutate();
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      className="size-8 rounded-full shadow"
      aria-label={isFavorited ? `Remove from favorites` : `Save to favorites`}
      aria-pressed={isFavorited}
      disabled={mutation.isPending}
      onClick={handleClick}
    >
      <Heart className={cn('size-4', isFavorited && 'fill-current text-red-500')} />
    </Button>
  );
}
