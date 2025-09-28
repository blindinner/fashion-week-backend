import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import * as fontkit from 'fontkit';
import fs from 'fs';
import path from 'path';

export async function generateTicketPDF({
    designer = 'Benji',
    date = 'March 15, 2025',
    time = '7:00 PM',
    section = 'VIP',
    row = 'A',
    seat = '12',
    venue = 'Grand Fashion Hall',
    reservationId = '1234567890',
} = {}) {
    // Load logo image
    const logoPath = path.join(process.cwd(), 'backend', 'fwta-logo.png');
    const logoBytes = fs.readFileSync(logoPath);

    // Generate QR code
    const qrData = `Reservation ID: ${reservationId}`;
    const qrImageDataUrl = await QRCode.toDataURL(qrData);
    const qrImageBytes = Buffer.from(qrImageDataUrl.split(',')[1], 'base64');

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const page = pdfDoc.addPage([400, 800]);
    const playfairFontBytes = fs.readFileSync(path.join(process.cwd(), 'backend', 'fonts', 'PlayfairDisplay-Regular.ttf'));
    const playfairFont = await pdfDoc.embedFont(playfairFontBytes);
    const black = rgb(0, 0, 0);
    const gray = rgb(0.5, 0.5, 0.5);

    // Logo
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoNativeWidth = 1300;
    const logoNativeHeight = 386;
    const pageWidth = 400;
    const maxLogoWidth = 300;
    const logoWidth = Math.min(maxLogoWidth, logoNativeWidth);
    const logoHeight = logoNativeHeight * (logoWidth / logoNativeWidth);
    const logoX = (pageWidth - logoWidth) / 2;
    let y = 700;
    page.drawImage(logoImage, { x: logoX, y: y, width: logoWidth, height: logoHeight });
    y -= (logoHeight - 20); // Overlap by 20px for minimal gap

    // Divider
    page.drawLine({ start: { x: 30, y: y }, end: { x: 370, y: y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
    y -= 30;

    // Designer
    page.drawText('DESIGNER', { x: 30, y: y, size: 12, font: playfairFont, color: gray });
    y -= 20;
    page.drawText(designer, { x: 30, y: y, size: 16, font: playfairFont, color: black });
    y -= 10;
    page.drawLine({ start: { x: 30, y: y }, end: { x: 370, y: y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
    y -= 30;

    // Date
    page.drawText('DATE', { x: 30, y: y, size: 12, font: playfairFont, color: gray });
    y -= 20;
    page.drawText(date, { x: 30, y: y, size: 16, font: playfairFont, color: black });
    y -= 10;
    page.drawLine({ start: { x: 30, y: y }, end: { x: 370, y: y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
    y -= 30;

    // Time
    page.drawText('TIME', { x: 30, y: y, size: 12, font: playfairFont, color: gray });
    y -= 20;
    page.drawText(time, { x: 30, y: y, size: 16, font: playfairFont, color: black });
    y -= 10;
    page.drawLine({ start: { x: 30, y: y }, end: { x: 370, y: y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
    y -= 30;

    // Venue
    page.drawText('VENUE', { x: 30, y: y, size: 12, font: playfairFont, color: gray });
    y -= 20;
    page.drawText(venue, { x: 30, y: y, size: 16, font: playfairFont, color: black });
    y -= 10;
    page.drawLine({ start: { x: 30, y: y }, end: { x: 370, y: y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
    y -= 30;

    // Seating Information
    page.drawText('SEATING INFORMATION', { x: 30, y: y, size: 12, font: playfairFont, color: gray });
    y -= 10;
    page.drawLine({ start: { x: 30, y: y }, end: { x: 370, y: y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
    y -= 20;
    page.drawText('SECTION', { x: 30, y: y, size: 10, font: playfairFont, color: gray });
    page.drawText('ROW', { x: 170, y: y, size: 10, font: playfairFont, color: gray });
    page.drawText('SEAT', { x: 300, y: y, size: 10, font: playfairFont, color: gray });
    y -= 20;
    page.drawText(section, { x: 30, y: y, size: 16, font: playfairFont, color: black });
    page.drawText(row, { x: 170, y: y, size: 16, font: playfairFont, color: black });
    page.drawText(seat, { x: 300, y: y, size: 16, font: playfairFont, color: black });
    y -= 60;

    // QR Code
    const qrImage = await pdfDoc.embedPng(qrImageBytes);
    page.drawImage(qrImage, { x: 120, y: y - 160, width: 160, height: 160 });

    // Return PDF buffer
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
} 