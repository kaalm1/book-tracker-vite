import * as nodemailer from 'nodemailer';
import * as functions from 'firebase-functions';
import { SearchResult } from '../types/search';

const getTransporter = () => nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: functions.config().gmail.user,
    pass: functions.config().gmail.pass,
  },
});

export async function sendEmailToUser(
  email: string,
  name: string,
  bookTitle: string,
  results: SearchResult[]
): Promise<void> {
  const transporter = getTransporter();
  const html = `
    <html>
    <body>
      <h2>📚 Book Found: ${bookTitle}</h2>
      <p>Hello ${name},</p>
      <p>We found ${results.length} listing${results.length !== 1 ? 's' : ''} for "${bookTitle}":</p>
      ${results.map(result => `
        <div>
          <strong>${result.title}</strong><br/>
          Price: ${result.price}<br/>
          Source: ${result.source}${result.seller ? ` • ${result.seller}` : ''}<br/>
          ${result.condition ? `Condition: ${result.condition}<br/>` : ''}
          <a href="${result.link}" target="_blank">View Listing</a>
        </div><br/>
      `).join('')}
      <p>Happy reading! 📖</p>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"Book Tracker 📚" <${functions.config().gmail.user}>`,
    to: email,
    subject: `📚 ${results.length} listing${results.length !== 1 ? 's' : ''} found: ${bookTitle}`,
    html
  });
}
