import { prisma } from '../../config/database.js';

/**
 * Doctor.ratingAverage / Doctor.ratingCount (and the mirrored Clinic columns) are a denormalized
 * cache over PUBLISHED reviews only — kept fast for catalog sort/filter (a plain indexed column)
 * while the actual number is always freshly recomputed via DB aggregation (never incremented ad
 * hoc in application code, which would drift). Call this after any write that changes the set of
 * PUBLISHED rows for the doctor: create, status transition, edit-that-changes-rating, delete.
 *
 * MUST be a single atomic UPDATE-with-subquery, not a separate "read aggregate, then write" pair
 * of statements — two round trips create a lost-update race under concurrent writers: writer A
 * reads count=1 (before writer B's insert commits), writer B reads+writes count=2 correctly, then
 * writer A's stale write of count=1 lands last and overwrites B's correct value. A single SQL
 * statement's subquery is evaluated fresh at that statement's own execution time, so whichever
 * UPDATE physically commits last is guaranteed — by the transitive ordering argument below — to
 * see every row that was committed before it, including from concurrent siblings:
 * every OTHER concurrent recompute call's UPDATE that finishes before this one implies that
 * request's own INSERT (a prerequisite to it calling recompute at all) already committed too — so
 * the chronologically-last recompute UPDATE always has a fully up-to-date view. See
 * tests/integration/reviews-concurrency.test.ts for the test that verifies this.
 */
export async function recomputeDoctorRating(doctorId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "doctors" AS d
    SET "ratingAverage" = sub.avg_rating, "ratingCount" = sub.review_count
    FROM (
      SELECT AVG(rating)::float AS avg_rating, COUNT(*)::int AS review_count
      FROM "doctor_reviews"
      WHERE "doctorId" = ${doctorId} AND status = 'PUBLISHED'
    ) sub
    WHERE d.id = ${doctorId}
  `;
}

export async function recomputeClinicRating(clinicId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "clinics" AS c
    SET "ratingAverage" = sub.avg_rating, "ratingCount" = sub.review_count
    FROM (
      SELECT AVG(rating)::float AS avg_rating, COUNT(*)::int AS review_count
      FROM "clinic_reviews"
      WHERE "clinicId" = ${clinicId} AND status = 'PUBLISHED'
    ) sub
    WHERE c.id = ${clinicId}
  `;
}
