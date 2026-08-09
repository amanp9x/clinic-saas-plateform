import { redirect } from 'next/navigation';

export default function DoctorAppointmentsIndexPage() {
  redirect('/doctor/appointments/today');
}
