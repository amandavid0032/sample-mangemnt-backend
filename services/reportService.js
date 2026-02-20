const PDFDocument = require('pdfkit');

/**
 * Generate PDF report for a sample
 * @param {Object} sample - Sample document with populated fields
 * @returns {PDFDocument} - PDF document stream
 */
const generateSampleReport = (sample) => {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `Water Quality Report - ${sample.sampleId}`,
      Author: 'Sample Management System',
      Subject: 'Water Quality Analysis Report'
    }
  });

  const pageWidth = doc.page.width - 100;

  // Colors
  const primaryColor = '#2E7D32';
  const grayColor = '#6b7280';
  const darkColor = '#1f2937';

  // Header
  doc.fillColor(primaryColor)
     .fontSize(24)
     .font('Helvetica-Bold')
     .text('Water Quality Report', { align: 'center' });

  doc.moveDown(0.5);
  doc.fillColor(grayColor)
     .fontSize(12)
     .font('Helvetica')
     .text(`Report ID: ${sample.sampleId}`, { align: 'center' });

  doc.moveDown(0.3);
  doc.fontSize(10)
     .text(`Generated on: ${new Date().toLocaleDateString('en-IN', {
       day: '2-digit',
       month: 'long',
       year: 'numeric',
       hour: '2-digit',
       minute: '2-digit'
     })}`, { align: 'center' });

  // Divider line
  doc.moveDown(1);
  doc.strokeColor(primaryColor)
     .lineWidth(2)
     .moveTo(50, doc.y)
     .lineTo(doc.page.width - 50, doc.y)
     .stroke();

  doc.moveDown(1);

  // Overall Status Badge
  const statusColors = {
    'ACCEPTABLE': '#22c55e',
    'PERMISSIBLE': '#f59e0b',
    'NOT_ACCEPTABLE': '#ef4444'
  };
  const statusColor = statusColors[sample.overallStatus] || grayColor;
  const statusText = sample.overallStatus ? sample.overallStatus.replace('_', ' ') : 'N/A';

  doc.fillColor(darkColor)
     .fontSize(14)
     .font('Helvetica-Bold')
     .text('Overall Water Quality: ', { continued: true });
  doc.fillColor(statusColor)
     .text(statusText);

  doc.moveDown(1.5);

  // Sample Information Section
  doc.fillColor(primaryColor)
     .fontSize(14)
     .font('Helvetica-Bold')
     .text('Sample Information');

  doc.moveDown(0.5);
  doc.strokeColor('#e5e7eb')
     .lineWidth(1)
     .moveTo(50, doc.y)
     .lineTo(doc.page.width - 50, doc.y)
     .stroke();
  doc.moveDown(0.5);

  // Info grid
  const infoItems = [
    { label: 'Sample ID', value: sample.sampleId },
    { label: 'Title', value: sample.title || 'N/A' },
    { label: 'Address', value: sample.address || 'N/A' },
    { label: 'Collection Date', value: sample.collectedAt ? new Date(sample.collectedAt).toLocaleDateString('en-IN') : 'N/A' },
    { label: 'Collected By', value: sample.collectedBy?.name || 'N/A' },
    { label: 'Standard Version', value: sample.standardVersion || 'IS10500-2012' }
  ];

  if (sample.testInfo?.labTestedAt) {
    infoItems.push({ label: 'Lab Tested Date', value: new Date(sample.testInfo.labTestedAt).toLocaleDateString('en-IN') });
  }
  if (sample.testInfo?.publishedAt) {
    infoItems.push({ label: 'Published Date', value: new Date(sample.testInfo.publishedAt).toLocaleDateString('en-IN') });
  }

  doc.font('Helvetica').fontSize(11);
  infoItems.forEach(item => {
    doc.fillColor(grayColor).text(`${item.label}: `, { continued: true });
    doc.fillColor(darkColor).text(item.value);
    doc.moveDown(0.3);
  });

  // Coordinates
  if (sample.location?.coordinates) {
    doc.fillColor(grayColor).text('Coordinates: ', { continued: true });
    doc.fillColor(darkColor).text(`${sample.location.coordinates[1]}, ${sample.location.coordinates[0]} (Lat, Lng)`);
  }

  doc.moveDown(1.5);

  // Parameters Section
  doc.fillColor(primaryColor)
     .fontSize(14)
     .font('Helvetica-Bold')
     .text('Parameter Analysis Results');

  doc.moveDown(0.5);
  doc.strokeColor('#e5e7eb')
     .lineWidth(1)
     .moveTo(50, doc.y)
     .lineTo(doc.page.width - 50, doc.y)
     .stroke();
  doc.moveDown(0.5);

  if (sample.parameters && sample.parameters.length > 0) {
    // Table header
    const tableTop = doc.y;
    const colWidths = {
      param: 140,
      value: 70,
      unit: 50,
      acceptable: 90,
      permissible: 90,
      status: 70
    };

    // Header row background
    doc.fillColor('#f3f4f6')
       .rect(50, tableTop, pageWidth, 25)
       .fill();

    doc.fillColor(darkColor)
       .fontSize(9)
       .font('Helvetica-Bold');

    let xPos = 55;
    doc.text('Parameter', xPos, tableTop + 8, { width: colWidths.param });
    xPos += colWidths.param;
    doc.text('Value', xPos, tableTop + 8, { width: colWidths.value });
    xPos += colWidths.value;
    doc.text('Unit', xPos, tableTop + 8, { width: colWidths.unit });
    xPos += colWidths.unit;
    doc.text('Acceptable', xPos, tableTop + 8, { width: colWidths.acceptable });
    xPos += colWidths.acceptable;
    doc.text('Permissible', xPos, tableTop + 8, { width: colWidths.permissible });
    xPos += colWidths.permissible;
    doc.text('Status', xPos, tableTop + 8, { width: colWidths.status });

    let yPos = tableTop + 30;
    doc.font('Helvetica').fontSize(8);

    sample.parameters.forEach((param, index) => {
      // Check if we need a new page
      if (yPos > doc.page.height - 100) {
        doc.addPage();
        yPos = 50;
      }

      // Alternate row background
      if (index % 2 === 0) {
        doc.fillColor('#f9fafb')
           .rect(50, yPos - 5, pageWidth, 22)
           .fill();
      }

      xPos = 55;
      doc.fillColor(darkColor);

      // Parameter name
      doc.text(param.name || param.code || 'N/A', xPos, yPos, { width: colWidths.param - 5 });
      xPos += colWidths.param;

      // Value
      doc.font('Helvetica-Bold')
         .text(String(param.value ?? 'N/A'), xPos, yPos, { width: colWidths.value });
      xPos += colWidths.value;
      doc.font('Helvetica');

      // Unit
      doc.text(param.unit || '-', xPos, yPos, { width: colWidths.unit });
      xPos += colWidths.unit;

      // Acceptable limit
      let acceptableText = '-';
      if (param.type === 'RANGE' && param.acceptableLimit) {
        acceptableText = `${param.acceptableLimit.min ?? '-'} - ${param.acceptableLimit.max ?? '-'}`;
      } else if (param.acceptableLimit?.max !== null && param.acceptableLimit?.max !== undefined) {
        acceptableText = `Max: ${param.acceptableLimit.max}`;
      }
      doc.text(acceptableText, xPos, yPos, { width: colWidths.acceptable });
      xPos += colWidths.acceptable;

      // Permissible limit
      let permissibleText = '-';
      if (param.permissibleLimit?.max !== null && param.permissibleLimit?.max !== undefined) {
        permissibleText = `Max: ${param.permissibleLimit.max}`;
      }
      doc.text(permissibleText, xPos, yPos, { width: colWidths.permissible });
      xPos += colWidths.permissible;

      // Status with color
      const paramStatusColor = statusColors[param.status] || grayColor;
      doc.fillColor(paramStatusColor)
         .font('Helvetica-Bold')
         .text(param.status ? param.status.replace('_', ' ') : 'N/A', xPos, yPos, { width: colWidths.status });
      doc.font('Helvetica');

      yPos += 22;
    });

    doc.y = yPos + 10;
  } else {
    doc.fillColor(grayColor)
       .fontSize(11)
       .text('No parameters recorded for this sample.');
  }

  // Footer
  const addFooter = () => {
    const bottomY = doc.page.height - 50;
    doc.strokeColor('#e5e7eb')
       .lineWidth(1)
       .moveTo(50, bottomY - 20)
       .lineTo(doc.page.width - 50, bottomY - 20)
       .stroke();

    doc.fillColor(grayColor)
       .fontSize(8)
       .text(
         'This report is generated by Sample Management System. For official use only.',
         50,
         bottomY - 10,
         { align: 'center', width: pageWidth }
       );
  };

  // Add footer to all pages
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    addFooter();
  }

  return doc;
};

module.exports = {
  generateSampleReport
};
