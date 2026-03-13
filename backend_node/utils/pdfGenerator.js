const PDFDocument = require('pdfkit');
const moment = require('moment-timezone');

/**
 * Generate a PDF attendance report.
 * @param {Array} logs - Array of attendance log objects (populated with employee)
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {string|null} employeeName - null for all-employee report
 * @returns {Buffer} - PDF as a buffer
 */
function generatePDF(logs, startDate, endDate, employeeName = null) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    const title = employeeName
      ? `Attendance Report — ${employeeName}`
      : 'Attendance Report — All Employees';
    doc.fontSize(18).font('Helvetica-Bold').text(title, { align: 'left' });
    doc.fontSize(12).font('Helvetica').text(`Period: ${startDate} to ${endDate} (IST)`);
    doc.moveDown();

    if (logs.length === 0) {
      doc.text('No attendance records found for the selected period.');
    } else {
      // Table header
      const col = { name: 60, id: 200, status: 290, date: 370, time: 470 };
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('Employee', col.name, doc.y);
      doc.text('ID', col.id, doc.y - doc.currentLineHeight());
      doc.text('Status', col.status, doc.y - doc.currentLineHeight());
      doc.text('Date', col.date, doc.y - doc.currentLineHeight());
      doc.text('Time', col.time, doc.y - doc.currentLineHeight());
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.3);

      // Table rows
      doc.fontSize(10).font('Helvetica');
      for (const log of logs) {
        const ts = moment(log.timestamp).tz('Asia/Kolkata');
        const y = doc.y;
        doc.text(log.employee?.name || '—', col.name, y, { width: 130 });
        doc.text(log.employee?.employee_id || '—', col.id, y, { width: 80 });
        doc.text(log.status, col.status, y, { width: 75 });
        doc.text(ts.format('YYYY-MM-DD'), col.date, y, { width: 90 });
        doc.text(ts.format('HH:mm:ss'), col.time, y, { width: 70 });
        doc.moveDown(0.5);

        // New page if needed
        if (doc.y > 700) doc.addPage();
      }

      doc.moveDown();
      doc.fontSize(10).font('Helvetica-Oblique')
        .text(`Total records: ${logs.length}`, { align: 'right' });
    }

    doc.end();
  });
}

module.exports = { generatePDF };
