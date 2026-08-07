'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { contactMessageSchema, type ContactMessageInput } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError } from '@/components/auth/form-field-error';
import { apiFetch, ApiError } from '@/lib/api-client';

export function ContactForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactMessageInput>({ resolver: zodResolver(contactMessageSchema) });

  const submit = useMutation({
    mutationFn: (input: ContactMessageInput) =>
      apiFetch<null>('/api/v1/contact', { method: 'POST', body: input }),
  });

  const onSubmit = handleSubmit((data) => {
    submit.mutate(data, {
      onSuccess: () => {
        toast.success("Message sent — we'll get back to you soon.");
        reset();
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : 'Could not send your message');
      },
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" autoComplete="name" {...register('name')} />
          <FormFieldError message={errors.name?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          <FormFieldError message={errors.email?.message} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" type="tel" placeholder="+919876543210" {...register('phone')} />
        <FormFieldError message={errors.phone?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" {...register('subject')} />
        <FormFieldError message={errors.subject?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          rows={5}
          className="shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
          {...register('message')}
        />
        <FormFieldError message={errors.message?.message} />
      </div>

      <Button type="submit" disabled={submit.isPending}>
        {submit.isPending ? 'Sending…' : 'Send message'}
      </Button>
    </form>
  );
}
