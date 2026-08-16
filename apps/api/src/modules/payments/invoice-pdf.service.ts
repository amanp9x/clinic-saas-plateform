import PDFDocument from 'pdfkit';

export interface InvoicePdfInput {
  invoiceNumber: string;
  issuedAt: Date;
  clinicName: string;
  clinicAddress: string | null;
  doctorName: string;
  patientName: string;
  bookingReference: string;
  appointmentDate: Date;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  status: string;
  method: string | null;
}

function formatMoney(amount: number, currency: string): string {
  const symbol = currency === 'INR' ? '₹' : `${currency} `;
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Mirrors prescription-pdf.service.ts's structure/conventions — same library, same single-page
 * document-generation approach, no shared design-system dependency between the two. */
export function generateInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).font('Helvetica-Bold').text(input.clinicName);
    if (input.clinicAddress) {
      doc.fontSize(10).font('Helvetica').fillColor('#555555').text(input.clinicAddress);
    }
    doc.fillColor('#000000');
    doc.moveDown();

    doc.fontSize(16).font('Helvetica-Bold').text('Invoice / Receipt', { align: 'right' });
    doc.fontSize(10).font('Helvetica').fillColor('#555555').text(input.invoiceNumber, { align: 'right' });
    doc.text(input.issuedAt.toLocaleDateString('en-IN'), { align: 'right' });
    doc.fillColor('#000000');
    doc.moveDown();

    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#dddddd').stroke();
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica-Bold').text('Patient: ', { continued: true }).font('Helvetica').text(input.patientName);
    doc.font('Helvetica-Bold').text('Doctor: ', { continued: true }).font('Helvetica').text(input.doctorName);
    doc
      .font('Helvetica-Bold')
      .text('Appointment: ', { continued: true })
      .font('Helvetica')
      .text(`${input.bookingReference} — ${input.appointmentDate.toLocaleString('en-IN')}`);
    doc.moveDown();

    const rows: [string, string][] = [
      ['Subtotal', formatMoney(input.subtotal, input.currency)],
      ['Discount', `- ${formatMoney(input.discount, input.currency)}`],
      ['Tax', formatMoney(input.tax, input.currency)],
    ];
    doc.font('Helvetica-Bold').fontSize(11).text('Charges');
    doc.moveDown(0.3);
    for (const [label, value] of rows) {
      doc.font('Helvetica').fontSize(10).text(label, { continued: true, width: 200 });
      doc.text(value, { align: 'right' });
    }
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#dddddd').stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(12).text('Total', { continued: true, width: 200 });
    doc.text(formatMoney(input.total, input.currency), { align: 'right' });
    doc.moveDown();

    doc.fontSize(10).font('Helvetica-Bold').text('Payment status: ', { continued: true }).font('Helvetica').text(input.status);
    if (input.method) {
      doc.font('Helvetica-Bold').text('Payment method: ', { continued: true }).font('Helvetica').text(input.method);
    }

    doc.moveDown(2);
    doc.fontSize(8).font('Helvetica').fillColor('#777777').text('This is a system-generated receipt.', { align: 'center' });

    doc.end();
  });
}
