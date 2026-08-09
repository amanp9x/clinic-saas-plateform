import PDFDocument from 'pdfkit';

interface PrescriptionPdfItem {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string | null;
  instructions: string | null;
  beforeAfterFood: string | null;
  quantity: string | null;
}

export interface PrescriptionPdfInput {
  doctorName: string;
  doctorQualifications: string | null;
  clinicName: string | null;
  clinicAddress: string | null;
  patientName: string;
  patientAge: number | null;
  patientGender: string | null;
  issuedAt: Date;
  diagnosis: string | null;
  advice: string | null;
  followUpDate: Date | null;
  labTestRecommendation: string[];
  items: PrescriptionPdfItem[];
  signatureText: string | null;
}

/** Renders a structured prescription to a single-page PDF. Kept intentionally simple (no
 * embedded signature image — see DoctorSignature/signatureHash for the "architecture, not real
 * e-signing" story) since this is a document-generation concern, not a design system. */
export function generatePrescriptionPdf(input: PrescriptionPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (input.clinicName) {
      doc.fontSize(18).font('Helvetica-Bold').text(input.clinicName);
    }
    if (input.clinicAddress) {
      doc.fontSize(10).font('Helvetica').fillColor('#555555').text(input.clinicAddress);
    }
    doc.moveDown(0.5);

    doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold').text(input.doctorName);
    if (input.doctorQualifications) {
      doc.fontSize(10).font('Helvetica').fillColor('#555555').text(input.doctorQualifications);
    }
    doc.fillColor('#000000');
    doc.moveDown();

    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#dddddd').stroke();
    doc.moveDown(0.5);

    const patientLine = [
      input.patientName,
      input.patientAge != null ? `${input.patientAge} yrs` : null,
      input.patientGender,
    ]
      .filter(Boolean)
      .join(', ');
    doc.fontSize(11).font('Helvetica-Bold').text('Patient: ', { continued: true }).font('Helvetica').text(patientLine);
    doc
      .font('Helvetica-Bold')
      .text('Date: ', { continued: true })
      .font('Helvetica')
      .text(input.issuedAt.toLocaleDateString('en-IN'));
    doc.moveDown();

    if (input.diagnosis) {
      doc.font('Helvetica-Bold').text('Diagnosis');
      doc.font('Helvetica').text(input.diagnosis);
      doc.moveDown(0.5);
    }

    doc.font('Helvetica-Bold').fontSize(13).text('℞ Prescription');
    doc.moveDown(0.3);
    input.items.forEach((item, index) => {
      doc.fontSize(11).font('Helvetica-Bold').text(`${index + 1}. ${item.medicineName} — ${item.dosage}`);
      const details = [item.frequency, item.duration, item.route, item.beforeAfterFood, item.quantity]
        .filter(Boolean)
        .join('  ·  ');
      if (details) {
        doc.fontSize(10).font('Helvetica').fillColor('#333333').text(details);
      }
      if (item.instructions) {
        doc.fontSize(10).font('Helvetica-Oblique').fillColor('#555555').text(item.instructions);
      }
      doc.fillColor('#000000');
      doc.moveDown(0.4);
    });

    if (input.labTestRecommendation.length) {
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica-Bold').text('Recommended tests');
      doc.font('Helvetica').text(input.labTestRecommendation.join(', '));
    }

    if (input.advice) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Advice');
      doc.font('Helvetica').text(input.advice);
    }

    if (input.followUpDate) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Follow-up');
      doc.font('Helvetica').text(input.followUpDate.toLocaleDateString('en-IN'));
    }

    doc.moveDown(3);
    if (input.signatureText) {
      doc.fontSize(11).font('Helvetica-Oblique').text(input.signatureText, { align: 'right' });
      doc.fontSize(8).font('Helvetica').fillColor('#777777').text('Digitally signed via clinic portal', { align: 'right' });
    }

    doc.end();
  });
}
