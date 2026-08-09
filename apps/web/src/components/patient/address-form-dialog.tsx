'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { addressSchema, type AddressInput, type PatientAddressDto } from '@clinic/shared';
import { useCreateAddress, useUpdateAddress } from '@/hooks/patient/use-patient-profile';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormFieldError } from '@/components/auth/form-field-error';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function AddressFormDialog({
  address,
  trigger,
}: {
  address?: PatientAddressDto;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();
  const isEditing = Boolean(address);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: address
      ? {
          label: address.label,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2 ?? '',
          city: address.city,
          state: address.state ?? '',
          postalCode: address.postalCode ?? '',
          country: address.country,
          isDefault: address.isDefault,
        }
      : { label: 'HOME', country: 'IN', isDefault: false },
  });

  const isPending = createAddress.isPending || updateAddress.isPending;

  const onSubmit = handleSubmit((data) => {
    const mutation = isEditing
      ? updateAddress.mutateAsync({ id: address!.id, ...data })
      : createAddress.mutateAsync(data);

    mutation
      .then(() => {
        toast.success(isEditing ? 'Address updated' : 'Address added');
        setOpen(false);
        reset();
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : 'Could not save address'));
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit address' : 'Add address'}</DialogTitle>
          <DialogDescription>Used for home visits and delivery of reports.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Controller
              control={control}
              name="label"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="label" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOME">Home</SelectItem>
                    <SelectItem value="WORK">Work</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine1">Address line 1</Label>
            <Input id="addressLine1" {...register('addressLine1')} />
            <FormFieldError message={errors.addressLine1?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine2">Address line 2 (optional)</Label>
            <Input id="addressLine2" {...register('addressLine2')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register('city')} />
              <FormFieldError message={errors.city?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" {...register('state')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" {...register('postalCode')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" {...register('country')} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="isDefault"
              render={({ field }) => (
                <Checkbox id="isDefault" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="isDefault" className="font-normal">
              Set as default address
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save address'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
