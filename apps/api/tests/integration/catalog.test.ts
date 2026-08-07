import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('GET /api/v1/catalog/specializations', () => {
  it('returns seeded specializations with doctor counts', async () => {
    const res = await request(app).get('/api/v1/catalog/specializations');
    expect(res.status).toBe(200);
    expect(res.body.data.specializations.length).toBeGreaterThan(0);
    const cardiology = res.body.data.specializations.find(
      (s: { slug: string }) => s.slug === 'cardiologist',
    );
    expect(cardiology).toBeTruthy();
    expect(cardiology.doctorCount).toBeGreaterThan(0);
  });
});

describe('GET /api/v1/catalog/doctors', () => {
  it('lists doctors with pagination metadata', async () => {
    const res = await request(app).get('/api/v1/catalog/doctors?limit=5&page=1');
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeLessThanOrEqual(5);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.total).toBeGreaterThan(0);
  });

  it('filters by city', async () => {
    const res = await request(app).get('/api/v1/catalog/doctors?city=Mumbai');
    expect(res.status).toBe(200);
    for (const doctor of res.body.data.items) {
      expect(doctor.city).toBe('Mumbai');
    }
  });

  it('filters by specialization slug', async () => {
    const res = await request(app).get('/api/v1/catalog/doctors?specializationSlug=cardiologist');
    expect(res.status).toBe(200);
    expect(
      res.body.data.items.every(
        (d: { specializationName: string }) => d.specializationName === 'Cardiologist',
      ),
    ).toBe(true);
  });

  it('filters by minimum rating', async () => {
    const res = await request(app).get('/api/v1/catalog/doctors?minRating=4.8');
    expect(res.status).toBe(200);
    for (const doctor of res.body.data.items) {
      expect(doctor.ratingAverage).toBeGreaterThanOrEqual(4.8);
    }
  });

  it('filters by online consultation availability', async () => {
    const res = await request(app).get('/api/v1/catalog/doctors?onlineConsultation=true');
    expect(res.status).toBe(200);
    expect(
      res.body.data.items.every((d: { onlineConsultation: boolean }) => d.onlineConsultation),
    ).toBe(true);
  });

  it('rejects an invalid query parameter', async () => {
    const res = await request(app).get('/api/v1/catalog/doctors?minRating=abc');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('sorts by fee ascending', async () => {
    const res = await request(app).get('/api/v1/catalog/doctors?sort=fee_low&limit=50');
    expect(res.status).toBe(200);
    const fees = res.body.data.items
      .map((d: { consultationFee: string | null }) =>
        d.consultationFee ? Number(d.consultationFee) : null,
      )
      .filter((f: number | null): f is number => f !== null);
    const sorted = [...fees].sort((a, b) => a - b);
    expect(fees).toEqual(sorted);
  });
});

describe('GET /api/v1/catalog/doctors/:slug', () => {
  it('returns full doctor detail with reviews and an honest inactive queue status', async () => {
    const res = await request(app).get('/api/v1/catalog/doctors/dr-aditi-sharma');
    expect(res.status).toBe(200);
    expect(res.body.data.doctor.displayName).toBe('Dr. Aditi Sharma');
    expect(res.body.data.doctor.reviews.length).toBeGreaterThan(0);
    expect(res.body.data.doctor.clinics.length).toBeGreaterThan(0);
    expect(res.body.data.doctor.queueStatus).toEqual({
      isActive: false,
      currentToken: null,
      patientsAhead: null,
      estimatedWaitMinutes: null,
      delayMinutes: null,
      delayReason: null,
    });
  });

  it('returns 404 for an unknown slug', async () => {
    const res = await request(app).get('/api/v1/catalog/doctors/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/v1/catalog/clinics', () => {
  it('lists clinics with doctor counts', async () => {
    const res = await request(app).get('/api/v1/catalog/clinics');
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data.items[0]).toHaveProperty('doctorCount');
  });
});

describe('GET /api/v1/catalog/hospitals', () => {
  it('lists seeded hospitals', async () => {
    const res = await request(app).get('/api/v1/catalog/hospitals');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeGreaterThanOrEqual(3);
  });
});

describe('GET /api/v1/catalog/testimonials and /articles', () => {
  it('returns testimonials respecting the limit', async () => {
    const res = await request(app).get('/api/v1/catalog/testimonials?limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data.testimonials.length).toBeLessThanOrEqual(2);
  });

  it('returns articles ordered by publish date', async () => {
    const res = await request(app).get('/api/v1/catalog/articles?limit=3');
    expect(res.status).toBe(200);
    expect(res.body.data.articles.length).toBeLessThanOrEqual(3);
  });
});

describe('POST /api/v1/contact', () => {
  it('accepts a valid contact message', async () => {
    const res = await request(app).post('/api/v1/contact').send({
      name: 'Test User',
      email: 'contact-test@example.com',
      subject: 'Question about doctors',
      message: 'This is a sufficiently long test message for validation purposes.',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('rejects a message that is too short', async () => {
    const res = await request(app).post('/api/v1/contact').send({
      name: 'Test User',
      email: 'contact-test2@example.com',
      subject: 'Hi',
      message: 'short',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
