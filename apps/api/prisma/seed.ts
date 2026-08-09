import {
  PrismaClient,
  Gender,
  Weekday,
  UserRole,
  AppointmentStatus,
  LabReportStatus,
  MedicalRecordType,
  AddressLabel,
  NotificationType,
  DoctorSessionStatus,
  QueueStatus,
  TokenStatus,
  ConsultationStatus,
  PrescriptionStatus,
  FoodTiming,
  LeaveType,
  type Doctor,
  type Clinic,
} from '@prisma/client';
import { slugify } from '../src/utils/slugify.js';
import { hashPassword } from '../src/utils/password.js';
import {
  DEMO_PATIENT_EMAIL,
  DEMO_PATIENT_PASSWORD,
  DEMO_DOCTOR_EMAIL,
  DEMO_DOCTOR_PASSWORD,
} from './seed-constants.js';

const prisma = new PrismaClient();

const SPECIALIZATIONS = [
  {
    name: 'General Physician',
    iconName: 'Stethoscope',
    description: 'Everyday illnesses, checkups, and referrals.',
  },
  { name: 'Cardiologist', iconName: 'HeartPulse', description: 'Heart and cardiovascular system.' },
  { name: 'Dermatologist', iconName: 'Sparkles', description: 'Skin, hair, and nail conditions.' },
  { name: 'Pediatrician', iconName: 'Baby', description: 'Infant, child, and adolescent health.' },
  { name: 'Orthopedic', iconName: 'Bone', description: 'Bones, joints, and muscles.' },
  { name: 'Gynecologist', iconName: 'Flower2', description: "Women's reproductive health." },
  { name: 'Dentist', iconName: 'Smile', description: 'Teeth, gums, and oral health.' },
  { name: 'ENT Specialist', iconName: 'Ear', description: 'Ear, nose, and throat.' },
  { name: 'Neurologist', iconName: 'Brain', description: 'Brain, spine, and nervous system.' },
  {
    name: 'Psychiatrist',
    iconName: 'HeartHandshake',
    description: 'Mental and emotional wellbeing.',
  },
  { name: 'Ophthalmologist', iconName: 'Eye', description: 'Eye care and vision.' },
  {
    name: 'General Surgeon',
    iconName: 'Activity',
    description: 'Surgical care across specialities.',
  },
] as const;

const CLINICS = [
  {
    name: 'Sunrise Family Clinic',
    city: 'Mumbai',
    state: 'Maharashtra',
    addressLine1: '14 Marine Drive',
    phone: '+912233440011',
    email: 'contact@sunrisefamilyclinic.example',
    description: 'A friendly neighbourhood clinic offering primary and family care.',
  },
  {
    name: 'CityCare Multispeciality Clinic',
    city: 'Bengaluru',
    state: 'Karnataka',
    addressLine1: '221 MG Road',
    phone: '+918022445566',
    email: 'contact@citycareclinic.example',
    description: 'Multispeciality outpatient clinic with same-day consultations.',
  },
  {
    name: 'Green Valley Clinic',
    city: 'Pune',
    state: 'Maharashtra',
    addressLine1: '9 FC Road',
    phone: '+912025667788',
    email: 'contact@greenvalleyclinic.example',
    description: 'Community clinic focused on preventive and family health.',
  },
  {
    name: 'MedFirst Clinic',
    city: 'New Delhi',
    state: 'Delhi',
    addressLine1: '55 Connaught Place',
    phone: '+911143332211',
    email: 'contact@medfirstclinic.example',
    description: 'Modern clinic with extended evening hours.',
  },
  {
    name: 'Wellness Point Clinic',
    city: 'Chennai',
    state: 'Tamil Nadu',
    addressLine1: '77 Anna Salai',
    phone: '+914428889900',
    email: 'contact@wellnesspointclinic.example',
    description: 'Multi-doctor clinic serving the local community for over a decade.',
  },
] as const;

const HOSPITALS = [
  {
    name: 'Horizon Multispeciality Hospital',
    city: 'Mumbai',
    state: 'Maharashtra',
    addressLine1: '1 Horizon Tower, Bandra',
    phone: '+912266778899',
    email: 'info@horizonhospital.example',
    bedCount: 220,
    description: 'A 220-bed multispeciality hospital with 24x7 emergency care.',
  },
  {
    name: 'Lakeside General Hospital',
    city: 'Bengaluru',
    state: 'Karnataka',
    addressLine1: '48 Lakeside Avenue',
    phone: '+918033445577',
    email: 'info@lakesidehospital.example',
    bedCount: 150,
    description: 'General hospital with dedicated maternity and paediatric wings.',
  },
  {
    name: 'Metro Care Hospital',
    city: 'New Delhi',
    state: 'Delhi',
    addressLine1: '30 Ring Road',
    phone: '+911145556677',
    email: 'info@metrocarehospital.example',
    bedCount: 300,
    description: 'A leading tertiary care hospital with advanced diagnostics.',
  },
] as const;

interface SeedDoctor {
  fullName: string;
  email: string;
  gender: Gender;
  specialization: (typeof SPECIALIZATIONS)[number]['name'];
  qualifications: string;
  yearsExperience: number;
  consultationFee: number;
  languages: string[];
  onlineConsultation: boolean;
  ratingAverage: number;
  ratingCount: number;
  bio: string;
  clinicIndexes: number[];
}

const DOCTORS: SeedDoctor[] = [
  {
    fullName: 'Dr. Aditi Sharma',
    email: 'aditi.sharma@doctors.example',
    gender: Gender.FEMALE,
    specialization: 'Cardiologist',
    qualifications: 'MBBS, MD (Cardiology)',
    yearsExperience: 14,
    consultationFee: 900,
    languages: ['English', 'Hindi'],
    onlineConsultation: true,
    ratingAverage: 4.8,
    ratingCount: 132,
    bio: 'Dr. Sharma specialises in preventive cardiology and heart-failure management, with over a decade treating complex cardiac cases.',
    clinicIndexes: [0],
  },
  {
    fullName: 'Dr. Rohan Mehta',
    email: 'rohan.mehta@doctors.example',
    gender: Gender.MALE,
    specialization: 'General Physician',
    qualifications: 'MBBS, MD (Internal Medicine)',
    yearsExperience: 9,
    consultationFee: 500,
    languages: ['English', 'Hindi', 'Marathi'],
    onlineConsultation: true,
    ratingAverage: 4.6,
    ratingCount: 210,
    bio: 'A family medicine physician known for thorough consultations and patient-first care.',
    clinicIndexes: [0, 2],
  },
  {
    fullName: 'Dr. Kavya Reddy',
    email: 'kavya.reddy@doctors.example',
    gender: Gender.FEMALE,
    specialization: 'Dermatologist',
    qualifications: 'MBBS, MD (Dermatology)',
    yearsExperience: 7,
    consultationFee: 700,
    languages: ['English', 'Telugu', 'Kannada'],
    onlineConsultation: true,
    ratingAverage: 4.7,
    ratingCount: 98,
    bio: 'Specialist in acne, pigmentation, and cosmetic dermatology.',
    clinicIndexes: [1],
  },
  {
    fullName: 'Dr. Arjun Nair',
    email: 'arjun.nair@doctors.example',
    gender: Gender.MALE,
    specialization: 'Pediatrician',
    qualifications: 'MBBS, MD (Paediatrics)',
    yearsExperience: 11,
    consultationFee: 600,
    languages: ['English', 'Malayalam', 'Hindi'],
    onlineConsultation: false,
    ratingAverage: 4.9,
    ratingCount: 176,
    bio: 'Trusted paediatrician known for gentle, thorough care of infants and children.',
    clinicIndexes: [1, 4],
  },
  {
    fullName: 'Dr. Neha Verma',
    email: 'neha.verma@doctors.example',
    gender: Gender.FEMALE,
    specialization: 'Gynecologist',
    qualifications: 'MBBS, MS (Obstetrics & Gynaecology)',
    yearsExperience: 16,
    consultationFee: 1000,
    languages: ['English', 'Hindi'],
    onlineConsultation: true,
    ratingAverage: 4.8,
    ratingCount: 244,
    bio: "Senior gynaecologist with expertise in high-risk pregnancies and women's wellness.",
    clinicIndexes: [3],
  },
  {
    fullName: 'Dr. Vikram Singh',
    email: 'vikram.singh@doctors.example',
    gender: Gender.MALE,
    specialization: 'Orthopedic',
    qualifications: 'MBBS, MS (Orthopaedics)',
    yearsExperience: 13,
    consultationFee: 850,
    languages: ['English', 'Hindi', 'Punjabi'],
    onlineConsultation: false,
    ratingAverage: 4.5,
    ratingCount: 87,
    bio: 'Focused on sports injuries, joint replacement, and non-surgical pain management.',
    clinicIndexes: [3],
  },
  {
    fullName: 'Dr. Priya Iyer',
    email: 'priya.iyer@doctors.example',
    gender: Gender.FEMALE,
    specialization: 'Dentist',
    qualifications: 'BDS, MDS (Orthodontics)',
    yearsExperience: 8,
    consultationFee: 400,
    languages: ['English', 'Tamil'],
    onlineConsultation: false,
    ratingAverage: 4.6,
    ratingCount: 154,
    bio: 'Orthodontics specialist offering braces, aligners, and general dentistry.',
    clinicIndexes: [4],
  },
  {
    fullName: 'Dr. Sanjay Kulkarni',
    email: 'sanjay.kulkarni@doctors.example',
    gender: Gender.MALE,
    specialization: 'ENT Specialist',
    qualifications: 'MBBS, MS (ENT)',
    yearsExperience: 12,
    consultationFee: 650,
    languages: ['English', 'Hindi', 'Marathi'],
    onlineConsultation: true,
    ratingAverage: 4.4,
    ratingCount: 65,
    bio: 'Treats sinus, hearing, and throat conditions with a conservative-first approach.',
    clinicIndexes: [2],
  },
  {
    fullName: 'Dr. Meera Pillai',
    email: 'meera.pillai@doctors.example',
    gender: Gender.FEMALE,
    specialization: 'Neurologist',
    qualifications: 'MBBS, DM (Neurology)',
    yearsExperience: 15,
    consultationFee: 1100,
    languages: ['English', 'Malayalam'],
    onlineConsultation: true,
    ratingAverage: 4.7,
    ratingCount: 71,
    bio: 'Specialises in migraine management, epilepsy, and stroke rehabilitation.',
    clinicIndexes: [1],
  },
  {
    fullName: 'Dr. Karan Malhotra',
    email: 'karan.malhotra@doctors.example',
    gender: Gender.MALE,
    specialization: 'Psychiatrist',
    qualifications: 'MBBS, MD (Psychiatry)',
    yearsExperience: 10,
    consultationFee: 800,
    languages: ['English', 'Hindi'],
    onlineConsultation: true,
    ratingAverage: 4.9,
    ratingCount: 118,
    bio: 'Compassionate care for anxiety, depression, and stress-related conditions.',
    clinicIndexes: [3],
  },
  {
    fullName: 'Dr. Ananya Das',
    email: 'ananya.das@doctors.example',
    gender: Gender.FEMALE,
    specialization: 'Ophthalmologist',
    qualifications: 'MBBS, MS (Ophthalmology)',
    yearsExperience: 6,
    consultationFee: 550,
    languages: ['English', 'Bengali', 'Hindi'],
    onlineConsultation: false,
    ratingAverage: 4.5,
    ratingCount: 43,
    bio: 'Provides comprehensive eye exams, cataract evaluation, and vision correction.',
    clinicIndexes: [4],
  },
  {
    fullName: 'Dr. Rajesh Gupta',
    email: 'rajesh.gupta@doctors.example',
    gender: Gender.MALE,
    specialization: 'General Surgeon',
    qualifications: 'MBBS, MS (General Surgery)',
    yearsExperience: 18,
    consultationFee: 950,
    languages: ['English', 'Hindi'],
    onlineConsultation: false,
    ratingAverage: 4.6,
    ratingCount: 92,
    bio: 'Experienced surgeon specialising in minimally invasive laparoscopic procedures.',
    clinicIndexes: [0, 3],
  },
];

const REVIEW_TEMPLATES = [
  {
    authorName: 'Ritika P.',
    rating: 5,
    comment: 'Extremely patient and explained everything clearly. Highly recommend.',
  },
  {
    authorName: 'Amit K.',
    rating: 4,
    comment: 'Good experience overall, slight wait but worth it.',
  },
  {
    authorName: 'Sneha T.',
    rating: 5,
    comment: 'Best doctor I have consulted in years. Very thorough.',
  },
  { authorName: 'Vivek J.', rating: 5, comment: 'Professional, punctual, and genuinely caring.' },
  {
    authorName: 'Pooja M.',
    rating: 4,
    comment: 'Helped resolve my issue quickly. Clinic staff were friendly too.',
  },
];

const TESTIMONIALS = [
  {
    authorName: 'Rahul Bansal',
    authorDetail: 'Patient, Mumbai',
    rating: 5,
    message:
      'Booking and finding the right doctor took minutes. The whole experience felt effortless.',
  },
  {
    authorName: 'Sunita Rao',
    authorDetail: 'Patient, Bengaluru',
    rating: 5,
    message:
      "I love that I could see the doctor's experience and reviews before choosing. Made my decision so much easier.",
  },
  {
    authorName: 'Farhan Ali',
    authorDetail: 'Patient, Delhi',
    rating: 4,
    message:
      'Clean, fast, and easy to use. Exactly what I needed while searching for a specialist nearby.',
  },
  {
    authorName: 'Deepika Nambiar',
    authorDetail: 'Patient, Chennai',
    rating: 5,
    message:
      "Found a paediatrician for my daughter within our neighbourhood — couldn't have been simpler.",
  },
  {
    authorName: 'Manoj Tiwari',
    authorDetail: 'Patient, Pune',
    rating: 5,
    message:
      'The doctor profiles are detailed and honest. Exactly the transparency I was looking for.',
  },
  {
    authorName: 'Ishita Chawla',
    authorDetail: 'Patient, Mumbai',
    rating: 4,
    message:
      'Great platform for comparing doctors by fees, ratings, and availability all in one place.',
  },
];

const ARTICLES = [
  {
    title: '5 Everyday Habits That Support Heart Health',
    excerpt:
      'Small, consistent changes — from walking more to managing stress — can meaningfully lower cardiovascular risk over time.',
    category: 'Heart Health',
    authorName: 'Dr. Aditi Sharma',
  },
  {
    title: 'When Should You See a Dermatologist About Acne?',
    excerpt:
      'Not all breakouts need a prescription, but persistent or scarring acne is worth a specialist visit. Here is how to tell the difference.',
    category: 'Skin Care',
    authorName: 'Dr. Kavya Reddy',
  },
  {
    title: 'A Parent’s Guide to Childhood Vaccination Schedules',
    excerpt:
      "Staying on top of vaccination timelines protects your child and the wider community. Here's what to expect at each stage.",
    category: 'Child Health',
    authorName: 'Dr. Arjun Nair',
  },
  {
    title: 'Understanding High-Risk Pregnancy: What It Really Means',
    excerpt:
      'The term sounds alarming, but most high-risk pregnancies are managed successfully with the right monitoring and care.',
    category: "Women's Health",
    authorName: 'Dr. Neha Verma',
  },
  {
    title: 'Managing Migraines: Beyond Painkillers',
    excerpt:
      'Lifestyle triggers, preventive medication, and early intervention can dramatically reduce migraine frequency and severity.',
    category: 'Neurology',
    authorName: 'Dr. Meera Pillai',
  },
  {
    title: 'Mental Health Check-ins: Why Regular Visits Matter',
    excerpt:
      'Just like physical health, mental wellbeing benefits from proactive, regular attention rather than waiting for a crisis.',
    category: 'Mental Health',
    authorName: 'Dr. Karan Malhotra',
  },
];

function daysFromNow(days: number, hour = 10, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/**
 * Seeds one fully-populated demo patient account (appointments across every status,
 * prescriptions, lab reports, vaccinations, vitals, medical history, notifications) so the
 * Patient Portal has real data to display without needing a booking engine to create it.
 * Credentials: DEMO_PATIENT_EMAIL / DEMO_PATIENT_PASSWORD — documented in the README.
 */
async function seedDemoPatient(doctorRecords: Doctor[], clinicRecords: Clinic[]): Promise<void> {
  const byName = (name: string) => doctorRecords.find((d) => d.displayName === name)!;
  const clinicByName = (name: string) => clinicRecords.find((c) => c.name === name)!;

  const cardiologist = byName('Dr. Aditi Sharma');
  const physician = byName('Dr. Rohan Mehta');
  const dermatologist = byName('Dr. Kavya Reddy');
  const dentist = byName('Dr. Priya Iyer');
  const orthopedic = byName('Dr. Vikram Singh');

  const sunriseClinic = clinicByName('Sunrise Family Clinic');
  const cityCareClinic = clinicByName('CityCare Multispeciality Clinic');
  const wellnessClinic = clinicByName('Wellness Point Clinic');

  const passwordHash = await hashPassword(DEMO_PATIENT_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: DEMO_PATIENT_EMAIL },
    update: {},
    create: {
      email: DEMO_PATIENT_EMAIL,
      phone: '+919820012345',
      passwordHash,
      role: UserRole.PATIENT,
      isEmailVerified: true,
      isMobileVerified: true,
      isActive: true,
    },
  });

  const patient = await prisma.patient.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      fullName: 'Ananya Kapoor',
      dateOfBirth: new Date('1994-03-18'),
      gender: Gender.FEMALE,
      bloodGroup: 'O+',
      allergies: ['Penicillin', 'Peanuts'],
      medicalConditions: ['Mild asthma'],
      addressLine1: '12 Palm Grove Society',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400050',
      emergencyName: 'Rohit Kapoor',
      emergencyPhone: '+919820098765',
    },
  });

  const existingAddresses = await prisma.patientAddress.count({ where: { patientId: patient.id } });
  if (existingAddresses === 0) {
    await prisma.patientAddress.createMany({
      data: [
        {
          patientId: patient.id,
          label: AddressLabel.HOME,
          addressLine1: '12 Palm Grove Society',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400050',
          isDefault: true,
        },
        {
          patientId: patient.id,
          label: AddressLabel.WORK,
          addressLine1: '4th Floor, Prism Towers, BKC',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400051',
          isDefault: false,
        },
      ],
    });
  }

  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  const existingAppointments = await prisma.appointment.count({ where: { patientId: patient.id } });
  if (existingAppointments === 0) {
    const upcoming = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: cardiologist.id,
        clinicId: sunriseClinic.id,
        scheduledAt: daysFromNow(5, 11, 30),
        status: AppointmentStatus.CONFIRMED,
        reasonForVisit: 'Routine cardiac checkup',
        consultationFee: cardiologist.consultationFee,
      },
    });

    const today = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: physician.id,
        clinicId: sunriseClinic.id,
        scheduledAt: daysFromNow(0, 16, 0),
        status: AppointmentStatus.CONFIRMED,
        tokenNumber: '24',
        reasonForVisit: 'Persistent cough and mild fever',
        consultationFee: physician.consultationFee,
      },
    });

    const completed1 = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: dermatologist.id,
        clinicId: cityCareClinic.id,
        scheduledAt: daysFromNow(-20, 10, 0),
        status: AppointmentStatus.COMPLETED,
        completedAt: daysFromNow(-20, 10, 25),
        reasonForVisit: 'Skin allergy follow-up',
        consultationFee: dermatologist.consultationFee,
      },
    });

    const completed2 = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: dentist.id,
        clinicId: wellnessClinic.id,
        scheduledAt: daysFromNow(-45, 9, 30),
        status: AppointmentStatus.COMPLETED,
        completedAt: daysFromNow(-45, 10, 0),
        reasonForVisit: 'Routine dental cleaning',
        consultationFee: dentist.consultationFee,
      },
    });

    await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: orthopedic.id,
        clinicId: wellnessClinic.id,
        scheduledAt: daysFromNow(-10, 15, 0),
        status: AppointmentStatus.CANCELLED,
        cancelReason: 'Schedule conflict — rebooking separately',
        cancelledAt: daysFromNow(-11, 9, 0),
        reasonForVisit: 'Knee pain evaluation',
      },
    });

    console.log('Seeding prescriptions, lab reports, vaccinations, vitals, medical history...');

    await prisma.prescription.create({
      data: {
        patientId: patient.id,
        doctorId: dermatologist.id,
        appointmentId: completed1.id,
        issuedAt: daysFromNow(-20, 10, 25),
        medications: [
          {
            name: 'Cetirizine',
            dosage: '10mg',
            frequency: 'Once daily',
            duration: '7 days',
            instructions: 'Take at night',
          },
          {
            name: 'Hydrocortisone cream',
            dosage: '1%',
            frequency: 'Twice daily',
            duration: '5 days',
            instructions: 'Apply thinly to affected area',
          },
        ],
        notes: 'Avoid known allergens. Follow up if symptoms persist beyond a week.',
      },
    });

    await prisma.prescription.create({
      data: {
        patientId: patient.id,
        doctorId: dentist.id,
        appointmentId: completed2.id,
        issuedAt: daysFromNow(-45, 10, 0),
        medications: [
          {
            name: 'Chlorhexidine mouthwash',
            dosage: '0.2%',
            frequency: 'Twice daily',
            duration: '10 days',
            instructions: 'Rinse for 30 seconds after brushing',
          },
        ],
        notes: 'Next cleaning recommended in 6 months.',
      },
    });

    await prisma.labReport.create({
      data: {
        patientId: patient.id,
        appointmentId: completed1.id,
        testName: 'Complete Blood Count (CBC)',
        labName: 'CityCare Diagnostics',
        status: LabReportStatus.READY,
        reportDate: daysFromNow(-19, 12, 0),
        notes: 'All parameters within normal range.',
      },
    });

    await prisma.labReport.create({
      data: {
        patientId: patient.id,
        appointmentId: upcoming.id,
        testName: 'Lipid Profile',
        labName: 'Sunrise Diagnostics',
        status: LabReportStatus.PENDING,
        notes: 'Fasting sample required — scheduled alongside upcoming cardiology visit.',
      },
    });

    await prisma.vaccination.createMany({
      data: [
        {
          patientId: patient.id,
          vaccineName: 'Influenza (Flu)',
          doseNumber: 1,
          administeredDate: daysFromNow(-95),
          nextDueDate: daysFromNow(270),
          administeredBy: 'Sunrise Family Clinic',
        },
        {
          patientId: patient.id,
          vaccineName: 'Tetanus-Diphtheria (Td)',
          doseNumber: 1,
          administeredDate: daysFromNow(-400),
          nextDueDate: daysFromNow(3250),
          administeredBy: 'CityCare Multispeciality Clinic',
        },
      ],
    });

    await prisma.vitalRecord.createMany({
      data: [
        {
          patientId: patient.id,
          recordedAt: daysFromNow(-20, 10, 5),
          heightCm: 165,
          weightKg: 61,
          bloodPressureSystolic: 118,
          bloodPressureDiastolic: 76,
          heartRateBpm: 72,
          temperatureCelsius: 36.8,
        },
        {
          patientId: patient.id,
          recordedAt: daysFromNow(-45, 9, 35),
          heightCm: 165,
          weightKg: 62,
          bloodPressureSystolic: 120,
          bloodPressureDiastolic: 78,
          heartRateBpm: 75,
          temperatureCelsius: 36.9,
        },
      ],
    });

    await prisma.medicalRecord.createMany({
      data: [
        {
          patientId: patient.id,
          recordType: MedicalRecordType.DIAGNOSIS,
          title: 'Mild persistent asthma',
          description: 'Diagnosed following recurring wheeze episodes; managed with inhaler as needed.',
          recordDate: daysFromNow(-400),
          doctorName: 'Dr. Rohan Mehta',
        },
        {
          patientId: patient.id,
          recordType: MedicalRecordType.CONSULTATION_NOTE,
          title: 'Dermatology follow-up',
          description: 'Contact dermatitis, likely triggered by a new laundry detergent. Prescribed topical treatment.',
          recordDate: daysFromNow(-20),
          doctorName: 'Dr. Kavya Reddy',
        },
      ],
    });

    console.log('Seeding notifications...');
    await prisma.notification.createMany({
      data: [
        {
          userId: user.id,
          type: NotificationType.APPOINTMENT_UPDATE,
          title: 'Appointment confirmed',
          message: `Your appointment with ${cardiologist.displayName} on ${daysFromNow(5).toLocaleDateString('en-IN')} is confirmed.`,
          relatedEntityType: 'Appointment',
          relatedEntityId: upcoming.id,
        },
        {
          userId: user.id,
          type: NotificationType.APPOINTMENT_UPDATE,
          title: "Today's appointment reminder",
          message: `You have an appointment with ${physician.displayName} today at 4:00 PM.`,
          relatedEntityType: 'Appointment',
          relatedEntityId: today.id,
        },
        {
          userId: user.id,
          type: NotificationType.PRESCRIPTION_READY,
          title: 'New prescription available',
          message: `${dermatologist.displayName} has issued a new prescription for you.`,
          isRead: true,
        },
        {
          userId: user.id,
          type: NotificationType.REPORT_READY,
          title: 'Lab report ready',
          message: 'Your Complete Blood Count (CBC) report is ready to view.',
          isRead: true,
        },
        {
          userId: user.id,
          type: NotificationType.QUEUE_UPDATE,
          title: 'Queue tracking available soon',
          message: "Live queue tracking will activate once your doctor's clinic session begins.",
          isRead: false,
        },
      ],
    });
  }
}

function timeOf(hour: number, minute: number): Date {
  return new Date(Date.UTC(1970, 0, 1, hour, minute, 0));
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const QUEUE_DEMO_PATIENTS = [
  { fullName: 'Rahul Verma', email: 'rahul.verma@patients.example', gender: Gender.MALE, dateOfBirth: new Date('1988-04-12') },
  { fullName: 'Sneha Joshi', email: 'sneha.joshi@patients.example', gender: Gender.FEMALE, dateOfBirth: new Date('1995-09-02') },
  { fullName: 'Amit Desai', email: 'amit.desai@patients.example', gender: Gender.MALE, dateOfBirth: new Date('1979-01-25') },
  { fullName: 'Priyanka Nair', email: 'priyanka.nair@patients.example', gender: Gender.FEMALE, dateOfBirth: new Date('2001-11-08') },
  { fullName: 'Karan Malhotra', email: 'karan.malhotra@patients.example', gender: Gender.MALE, dateOfBirth: new Date('1966-06-30') },
] as const;

/**
 * Seeds everything the Doctor Portal needs to render real data on first login for the demo
 * doctor (Dr. Aditi Sharma / DEMO_DOCTOR_EMAIL): weekly availability, a leave date, a signature,
 * a review response, and a fully-populated "today" queue session (waiting/called/completed
 * tokens with real appointments, consultations, vitals, and a finalized prescription) plus a
 * spread of historical completed appointments for earnings aggregation.
 */
async function seedDoctorPortal(doctorRecords: Doctor[], clinicRecords: Clinic[]): Promise<void> {
  const doctor = doctorRecords.find((d) => d.slug === 'dr-aditi-sharma');
  const clinic = clinicRecords.find((c) => c.name === 'Sunrise Family Clinic');
  if (!doctor || !clinic) return;

  const clinicDoctor = await prisma.clinicDoctor.findUnique({
    where: { clinicId_doctorId: { clinicId: clinic.id, doctorId: doctor.id } },
  });
  if (!clinicDoctor) return;

  console.log('Seeding doctor availability, leave, and signature...');
  const existingAvailability = await prisma.doctorAvailability.count({
    where: { clinicDoctorId: clinicDoctor.id },
  });
  if (existingAvailability === 0) {
    const weekdays = [Weekday.MON, Weekday.TUE, Weekday.WED, Weekday.THU, Weekday.FRI];
    for (const weekday of weekdays) {
      await prisma.doctorAvailability.createMany({
        data: [
          {
            clinicDoctorId: clinicDoctor.id,
            weekday,
            startTime: timeOf(9, 0),
            endTime: timeOf(13, 0),
            consultationDurationMinutes: 15,
          },
          {
            clinicDoctorId: clinicDoctor.id,
            weekday,
            startTime: timeOf(16, 0),
            endTime: timeOf(20, 0),
            consultationDurationMinutes: 15,
          },
        ],
      });
    }
  }

  const existingLeave = await prisma.doctorLeave.count({ where: { doctorId: doctor.id } });
  if (existingLeave === 0) {
    await prisma.doctorLeave.create({
      data: {
        doctorId: doctor.id,
        clinicId: clinic.id,
        startDate: daysFromNow(30),
        endDate: daysFromNow(31),
        reason: 'Personal leave',
        type: LeaveType.LEAVE,
      },
    });
  }

  await prisma.doctorSignature.upsert({
    where: { doctorId: doctor.id },
    update: {},
    create: { doctorId: doctor.id, signatureText: doctor.displayName },
  });

  const unrespondedReview = await prisma.doctorReview.findFirst({
    where: { doctorId: doctor.id, response: null },
  });
  if (unrespondedReview) {
    await prisma.doctorReview.update({
      where: { id: unrespondedReview.id },
      data: {
        response: 'Thank you so much for the kind words — glad the visit went well!',
        respondedAt: new Date(),
      },
    });
  }

  const existingSession = await prisma.doctorSession.findUnique({
    where: {
      doctorId_clinicId_sessionDate: {
        doctorId: doctor.id,
        clinicId: clinic.id,
        sessionDate: startOfToday(),
      },
    },
  });
  if (existingSession) return;

  console.log("Seeding doctor's queue demo patients and today's session...");
  const queuePatients = await Promise.all(
    QUEUE_DEMO_PATIENTS.map(async (p) => {
      const user = await prisma.user.upsert({
        where: { email: p.email },
        update: {},
        create: { email: p.email, role: UserRole.PATIENT, isEmailVerified: true, isActive: true },
      });
      return prisma.patient.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, fullName: p.fullName, dateOfBirth: p.dateOfBirth, gender: p.gender },
      });
    }),
  );
  const [p1, p2, p3, p4, p5] = queuePatients as [
    (typeof queuePatients)[0],
    (typeof queuePatients)[0],
    (typeof queuePatients)[0],
    (typeof queuePatients)[0],
    (typeof queuePatients)[0],
  ];

  const appt1 = await prisma.appointment.create({
    data: {
      patientId: p1.id,
      doctorId: doctor.id,
      clinicId: clinic.id,
      scheduledAt: daysFromNow(0, 9, 0),
      status: AppointmentStatus.COMPLETED,
      completedAt: daysFromNow(0, 9, 13),
      tokenNumber: '1',
      reasonForVisit: 'Chest discomfort on exertion for 2 weeks',
      consultationFee: doctor.consultationFee,
    },
  });
  const appt2 = await prisma.appointment.create({
    data: {
      patientId: p2.id,
      doctorId: doctor.id,
      clinicId: clinic.id,
      scheduledAt: daysFromNow(0, 9, 15),
      status: AppointmentStatus.COMPLETED,
      completedAt: daysFromNow(0, 9, 27),
      tokenNumber: '2',
      reasonForVisit: 'Blood pressure follow-up',
      consultationFee: doctor.consultationFee,
    },
  });
  const appt3 = await prisma.appointment.create({
    data: {
      patientId: p3.id,
      doctorId: doctor.id,
      clinicId: clinic.id,
      scheduledAt: daysFromNow(0, 9, 30),
      status: AppointmentStatus.CHECKED_IN,
      tokenNumber: '3',
      reasonForVisit: 'Palpitations',
      consultationFee: doctor.consultationFee,
    },
  });
  const appt4 = await prisma.appointment.create({
    data: {
      patientId: p4.id,
      doctorId: doctor.id,
      clinicId: clinic.id,
      scheduledAt: daysFromNow(0, 9, 45),
      status: AppointmentStatus.CONFIRMED,
      tokenNumber: '4',
      reasonForVisit: 'Annual cardiac screening',
      consultationFee: doctor.consultationFee,
    },
  });
  const appt5 = await prisma.appointment.create({
    data: {
      patientId: p5.id,
      doctorId: doctor.id,
      clinicId: clinic.id,
      scheduledAt: daysFromNow(0, 10, 0),
      status: AppointmentStatus.CONFIRMED,
      tokenNumber: '5',
      reasonForVisit: 'Post-angioplasty review',
      consultationFee: doctor.consultationFee,
    },
  });

  const session = await prisma.doctorSession.create({
    data: {
      doctorId: doctor.id,
      clinicId: clinic.id,
      sessionDate: startOfToday(),
      status: DoctorSessionStatus.AVAILABLE,
      queueStatus: QueueStatus.ACTIVE,
      startedAt: daysFromNow(0, 9, 0),
      averageConsultationMinutes: 13,
    },
  });

  const token1 = await prisma.queueToken.create({
    data: {
      doctorSessionId: session.id,
      appointmentId: appt1.id,
      patientId: p1.id,
      tokenNumber: 1,
      status: TokenStatus.COMPLETED,
      calledAt: daysFromNow(0, 9, 0),
      startedAt: daysFromNow(0, 9, 1),
      completedAt: daysFromNow(0, 9, 13),
    },
  });
  const token2 = await prisma.queueToken.create({
    data: {
      doctorSessionId: session.id,
      appointmentId: appt2.id,
      patientId: p2.id,
      tokenNumber: 2,
      status: TokenStatus.COMPLETED,
      calledAt: daysFromNow(0, 9, 15),
      startedAt: daysFromNow(0, 9, 16),
      completedAt: daysFromNow(0, 9, 27),
    },
  });
  const token3 = await prisma.queueToken.create({
    data: {
      doctorSessionId: session.id,
      appointmentId: appt3.id,
      patientId: p3.id,
      tokenNumber: 3,
      status: TokenStatus.CALLED,
      calledAt: daysFromNow(0, 9, 30),
      calledCount: 1,
    },
  });
  await prisma.queueToken.create({
    data: { doctorSessionId: session.id, appointmentId: appt4.id, patientId: p4.id, tokenNumber: 4 },
  });
  await prisma.queueToken.create({
    data: { doctorSessionId: session.id, appointmentId: appt5.id, patientId: p5.id, tokenNumber: 5 },
  });
  await prisma.doctorSession.update({ where: { id: session.id }, data: { currentTokenId: token3.id } });

  const consultation1 = await prisma.consultation.create({
    data: {
      appointmentId: appt1.id,
      doctorId: doctor.id,
      patientId: p1.id,
      clinicId: clinic.id,
      tokenId: token1.id,
      status: ConsultationStatus.COMPLETED,
      chiefComplaint: 'Chest discomfort on exertion for 2 weeks',
      symptoms: ['Chest tightness', 'Shortness of breath on exertion'],
      heightCm: 172,
      weightKg: 78,
      temperatureC: 36.8,
      bloodPressureSystolic: 128,
      bloodPressureDiastolic: 82,
      pulseRate: 76,
      respiratoryRate: 16,
      spo2: 98,
      diagnosis: 'Stable angina, well controlled',
      doctorNotes: 'ECG unremarkable. Continue current medication, reassess in 4 weeks.',
      treatmentPlan: 'Continue Atorvastatin, add low-dose Aspirin.',
      followUpDate: daysFromNow(28),
      startedAt: daysFromNow(0, 9, 1),
      completedAt: daysFromNow(0, 9, 13),
    },
  });
  await prisma.consultation.create({
    data: {
      appointmentId: appt2.id,
      doctorId: doctor.id,
      patientId: p2.id,
      clinicId: clinic.id,
      tokenId: token2.id,
      status: ConsultationStatus.COMPLETED,
      chiefComplaint: 'Routine blood pressure follow-up',
      symptoms: [],
      heightCm: 160,
      weightKg: 65,
      temperatureC: 36.6,
      bloodPressureSystolic: 132,
      bloodPressureDiastolic: 85,
      pulseRate: 80,
      respiratoryRate: 15,
      spo2: 99,
      diagnosis: 'Hypertension, moderately controlled',
      doctorNotes: 'BP trending better; keep monitoring at home.',
      treatmentPlan: 'Continue Amlodipine 5mg.',
      followUpDate: daysFromNow(30),
      startedAt: daysFromNow(0, 9, 16),
      completedAt: daysFromNow(0, 9, 27),
    },
  });

  await prisma.vitalRecord.create({
    data: {
      patientId: p1.id,
      recordedAt: daysFromNow(0, 9, 13),
      heightCm: 172,
      weightKg: 78,
      bloodPressureSystolic: 128,
      bloodPressureDiastolic: 82,
      heartRateBpm: 76,
      temperatureCelsius: 36.8,
    },
  });
  await prisma.medicalRecord.create({
    data: {
      patientId: p1.id,
      doctorId: doctor.id,
      recordType: MedicalRecordType.CONSULTATION_NOTE,
      title: 'Cardiology consultation',
      description: 'Stable angina, well controlled. Continue current medication.',
      recordDate: daysFromNow(0, 9, 13),
      doctorName: doctor.displayName,
    },
  });
  await prisma.vitalRecord.create({
    data: {
      patientId: p2.id,
      recordedAt: daysFromNow(0, 9, 27),
      heightCm: 160,
      weightKg: 65,
      bloodPressureSystolic: 132,
      bloodPressureDiastolic: 85,
      heartRateBpm: 80,
      temperatureCelsius: 36.6,
    },
  });
  await prisma.medicalRecord.create({
    data: {
      patientId: p2.id,
      doctorId: doctor.id,
      recordType: MedicalRecordType.CONSULTATION_NOTE,
      title: 'Cardiology follow-up',
      description: 'Hypertension, moderately controlled.',
      recordDate: daysFromNow(0, 9, 27),
      doctorName: doctor.displayName,
    },
  });

  const prescription = await prisma.prescription.create({
    data: {
      patientId: p1.id,
      doctorId: doctor.id,
      appointmentId: appt1.id,
      consultationId: consultation1.id,
      issuedAt: daysFromNow(0, 9, 13),
      medications: [],
      status: PrescriptionStatus.FINALIZED,
      diagnosis: 'Stable angina',
      advice: 'Low-salt diet, moderate exercise, avoid strenuous activity until follow-up.',
      followUpDate: daysFromNow(28),
      labTestRecommendation: ['Lipid Profile', 'ECG'],
      signedAt: daysFromNow(0, 9, 13),
    },
  });
  await prisma.prescriptionItem.createMany({
    data: [
      {
        prescriptionId: prescription.id,
        sortOrder: 0,
        medicineName: 'Atorvastatin',
        dosage: '10mg',
        frequency: 'Once daily',
        duration: '30 days',
        route: 'Oral',
        instructions: 'Take at night',
        beforeAfterFood: FoodTiming.AFTER_FOOD,
        quantity: '30 tablets',
      },
      {
        prescriptionId: prescription.id,
        sortOrder: 1,
        medicineName: 'Aspirin',
        dosage: '75mg',
        frequency: 'Once daily',
        duration: '30 days',
        route: 'Oral',
        instructions: 'Take after breakfast',
        beforeAfterFood: FoodTiming.AFTER_FOOD,
        quantity: '30 tablets',
      },
    ],
  });

  console.log("Seeding doctor's historical appointments for earnings...");
  await prisma.appointment.create({
    data: {
      patientId: p3.id,
      doctorId: doctor.id,
      clinicId: clinic.id,
      scheduledAt: daysFromNow(-2, 11, 0),
      status: AppointmentStatus.COMPLETED,
      completedAt: daysFromNow(-2, 11, 20),
      reasonForVisit: 'Routine checkup',
      consultationFee: doctor.consultationFee,
    },
  });
  await prisma.appointment.create({
    data: {
      patientId: p4.id,
      doctorId: doctor.id,
      clinicId: clinic.id,
      scheduledAt: daysFromNow(-10, 12, 0),
      status: AppointmentStatus.COMPLETED,
      completedAt: daysFromNow(-10, 12, 15),
      reasonForVisit: 'Follow-up',
      consultationFee: doctor.consultationFee,
    },
  });
  await prisma.appointment.create({
    data: {
      patientId: p5.id,
      doctorId: doctor.id,
      clinicId: clinic.id,
      scheduledAt: daysFromNow(-20, 9, 0),
      status: AppointmentStatus.COMPLETED,
      completedAt: daysFromNow(-20, 9, 20),
      reasonForVisit: 'Consultation',
      consultationFee: doctor.consultationFee,
    },
  });
  await prisma.appointment.create({
    data: {
      patientId: p3.id,
      doctorId: doctor.id,
      clinicId: clinic.id,
      scheduledAt: daysFromNow(-3, 10, 0),
      status: AppointmentStatus.NO_SHOW,
      reasonForVisit: 'Skin check',
    },
  });
  await prisma.appointment.create({
    data: {
      patientId: p2.id,
      doctorId: doctor.id,
      clinicId: clinic.id,
      scheduledAt: daysFromNow(3, 15, 0),
      status: AppointmentStatus.CONFIRMED,
      reasonForVisit: 'Post-treatment review',
      consultationFee: doctor.consultationFee,
    },
  });
}

async function main() {
  console.log('Seeding specializations...');
  const specializationRecords = await Promise.all(
    SPECIALIZATIONS.map((s) => {
      const data = {
        name: s.name,
        slug: slugify(s.name),
        iconName: s.iconName,
        description: s.description,
      };
      return prisma.specialization.upsert({
        where: { slug: data.slug },
        update: data,
        create: data,
      });
    }),
  );
  const specializationByName = new Map(specializationRecords.map((s) => [s.name, s]));

  console.log('Seeding clinics...');
  const clinicRecords = await Promise.all(
    CLINICS.map((c) =>
      prisma.clinic.upsert({
        where: { slug: slugify(c.name) },
        update: {},
        create: {
          name: c.name,
          slug: slugify(c.name),
          city: c.city,
          state: c.state,
          addressLine1: c.addressLine1,
          phone: c.phone,
          email: c.email,
          description: c.description,
        },
      }),
    ),
  );

  console.log('Seeding hospitals...');
  await Promise.all(
    HOSPITALS.map((h) =>
      prisma.hospital.upsert({
        where: { slug: slugify(h.name) },
        update: {},
        create: {
          name: h.name,
          slug: slugify(h.name),
          city: h.city,
          state: h.state,
          addressLine1: h.addressLine1,
          phone: h.phone,
          email: h.email,
          bedCount: h.bedCount,
          description: h.description,
        },
      }),
    ),
  );

  console.log('Seeding doctors...');
  const availableDaySets: Weekday[][] = [
    [Weekday.MON, Weekday.TUE, Weekday.WED, Weekday.THU, Weekday.FRI],
    [Weekday.MON, Weekday.WED, Weekday.FRI, Weekday.SAT],
    [Weekday.TUE, Weekday.THU, Weekday.SAT],
    [Weekday.MON, Weekday.TUE, Weekday.WED, Weekday.THU, Weekday.FRI, Weekday.SAT],
  ];

  const doctorRecords: Awaited<ReturnType<typeof prisma.doctor.upsert>>[] = [];
  const demoDoctorPasswordHash = await hashPassword(DEMO_DOCTOR_PASSWORD);

  for (let i = 0; i < DOCTORS.length; i++) {
    const d = DOCTORS[i]!;
    const specialization = specializationByName.get(d.specialization);
    const isDemoDoctor = d.email === DEMO_DOCTOR_EMAIL;

    const user = await prisma.user.upsert({
      where: { email: d.email },
      update: isDemoDoctor ? { passwordHash: demoDoctorPasswordHash } : {},
      create: {
        email: d.email,
        passwordHash: isDemoDoctor ? demoDoctorPasswordHash : undefined,
        role: UserRole.DOCTOR,
        isEmailVerified: true,
        isActive: true,
      },
    });

    const doctor = await prisma.doctor.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        slug: slugify(d.fullName),
        displayName: d.fullName,
        specializationId: specialization?.id,
        qualifications: d.qualifications,
        bio: d.bio,
        gender: d.gender,
        languages: d.languages,
        yearsExperience: d.yearsExperience,
        consultationFee: d.consultationFee,
        onlineConsultation: d.onlineConsultation,
        ratingAverage: d.ratingAverage,
        ratingCount: d.ratingCount,
      },
    });

    for (const clinicIndex of d.clinicIndexes) {
      const clinic = clinicRecords[clinicIndex]!;
      await prisma.clinicDoctor.upsert({
        where: { clinicId_doctorId: { clinicId: clinic.id, doctorId: doctor.id } },
        update: {},
        create: {
          clinicId: clinic.id,
          doctorId: doctor.id,
          timings: 'Mon–Sat: 10:00 AM – 1:00 PM, 5:00 PM – 8:00 PM',
          availableDays: availableDaySets[i % availableDaySets.length],
        },
      });
    }

    const existingReviews = await prisma.doctorReview.count({ where: { doctorId: doctor.id } });
    if (existingReviews === 0) {
      const reviewCount = 2 + (i % 3);
      for (let r = 0; r < reviewCount; r++) {
        const template = REVIEW_TEMPLATES[(i + r) % REVIEW_TEMPLATES.length]!;
        await prisma.doctorReview.create({
          data: {
            doctorId: doctor.id,
            authorName: template.authorName,
            rating: template.rating,
            comment: template.comment,
          },
        });
      }
    }

    doctorRecords.push(doctor);
  }

  console.log('Seeding demo patient...');
  await seedDemoPatient(doctorRecords, clinicRecords);

  console.log('Seeding doctor portal demo data...');
  await seedDoctorPortal(doctorRecords, clinicRecords);

  console.log('Seeding testimonials...');
  const existingTestimonials = await prisma.testimonial.count();
  if (existingTestimonials === 0) {
    await prisma.testimonial.createMany({ data: TESTIMONIALS });
  }

  console.log('Seeding articles...');
  await Promise.all(
    ARTICLES.map((a) =>
      prisma.article.upsert({
        where: { slug: slugify(a.title) },
        update: {},
        create: {
          title: a.title,
          slug: slugify(a.title),
          excerpt: a.excerpt,
          category: a.category,
          authorName: a.authorName,
        },
      }),
    ),
  );

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
