import { PrismaClient, Gender, Weekday, UserRole } from '@prisma/client';
import { slugify } from '../src/utils/slugify.js';

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

  for (let i = 0; i < DOCTORS.length; i++) {
    const d = DOCTORS[i]!;
    const specialization = specializationByName.get(d.specialization);

    const user = await prisma.user.upsert({
      where: { email: d.email },
      update: {},
      create: {
        email: d.email,
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
  }

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
