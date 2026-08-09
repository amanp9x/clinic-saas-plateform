'use client';

import { toast } from 'sonner';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import type { PatientProfileDto } from '@clinic/shared';
import { useDeleteAddress } from '@/hooks/patient/use-patient-profile';
import { ApiError } from '@/lib/api-client';
import { AddressFormDialog } from './address-form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const LABELS: Record<string, string> = { HOME: 'Home', WORK: 'Work', OTHER: 'Other' };

export function AddressList({ profile }: { profile: PatientProfileDto }) {
  const deleteAddress = useDeleteAddress();

  return (
    <div className="space-y-3">
      {profile.addresses.length === 0 ? (
        <p className="text-muted-foreground text-sm">No addresses added yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {profile.addresses.map((address) => (
            <li key={address.id} className="flex items-start justify-between gap-3 p-4">
              <div className="flex items-start gap-3">
                <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{LABELS[address.label] ?? address.label}</span>
                    {address.isDefault && <Badge variant="secondary">Default</Badge>}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {[address.addressLine1, address.addressLine2, address.city, address.state, address.postalCode]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <AddressFormDialog
                  address={address}
                  trigger={
                    <Button type="button" size="icon-sm" variant="ghost">
                      <Pencil className="size-3.5" />
                      <span className="sr-only">Edit address</span>
                    </Button>
                  }
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={deleteAddress.isPending}
                  onClick={() =>
                    deleteAddress.mutate(address.id, {
                      onSuccess: () => toast.success('Address removed'),
                      onError: (err) =>
                        toast.error(err instanceof ApiError ? err.message : 'Could not remove address'),
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                  <span className="sr-only">Delete address</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddressFormDialog
        trigger={
          <Button type="button" size="sm" variant="outline">
            <Plus className="size-3.5" />
            Add address
          </Button>
        }
      />
    </div>
  );
}
