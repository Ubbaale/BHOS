import sgMail from '@sendgrid/mail';

function getSendGridClient() {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@carehubapp.com';

  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY environment variable is not set');
  }

  if (!apiKey.startsWith('SG.')) {
    throw new Error('Invalid SendGrid API key format - must start with SG.');
  }

  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: fromEmail
  };
}

export interface FileAttachment {
  content: string;
  filename: string;
  type: string;
  disposition: 'attachment';
}

export async function sendIssueNotification(ticket: {
  ticketId: string;
  category: string;
  priority: string;
  description: string;
  email: string;
}, attachment?: FileAttachment) {
  try {
    const { client, fromEmail } = getSendGridClient();
    
    const adminMsg: any = {
      to: 'info@carehubapp.com',
      from: fromEmail,
      subject: `[Carehub Issue] ${ticket.ticketId} - ${ticket.priority.toUpperCase()} - ${ticket.category}`,
      text: `
New Issue Submitted

Ticket Number: ${ticket.ticketId}
Category: ${ticket.category}
Priority: ${ticket.priority}
Contact Email: ${ticket.email}

Description:
${ticket.description}
      `.trim(),
      html: `
<h2>New Issue Submitted</h2>
<table style="border-collapse: collapse; width: 100%; max-width: 600px;">
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Ticket Number</td>
    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #2563eb;">${ticket.ticketId}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Category</td>
    <td style="padding: 8px; border: 1px solid #ddd;">${ticket.category}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Priority</td>
    <td style="padding: 8px; border: 1px solid #ddd;">${ticket.priority}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Contact Email</td>
    <td style="padding: 8px; border: 1px solid #ddd;"><a href="mailto:${ticket.email}">${ticket.email}</a></td>
  </tr>
</table>
<h3>Description</h3>
<p style="background: #f5f5f5; padding: 16px; border-radius: 4px;">${ticket.description.replace(/\n/g, '<br>')}</p>
${attachment ? '<p style="color: #666; font-size: 14px;">Attachment included in this email.</p>' : ''}
      `.trim()
    };

    if (attachment) {
      adminMsg.attachments = [attachment];
    }

    await client.send(adminMsg);
    console.log('Issue notification email sent to info@carehubapp.com');

    const confirmationMsg = {
      to: ticket.email,
      from: fromEmail,
      subject: `Carehub Issue Received - Ticket ${ticket.ticketId}`,
      text: `
Thank you for contacting Carehub.

Your issue has been received and assigned ticket number: ${ticket.ticketId}

Issue Details:
Category: ${ticket.category}
Priority: ${ticket.priority}

Description:
${ticket.description}

Our team will review your issue and get back to you as soon as possible.

If you have any questions, please reply to this email or call us at 774-581-9700.

Best regards,
The Carehub Team
      `.trim(),
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #2563eb;">Thank you for contacting Carehub</h2>
  <p>Your issue has been received and assigned ticket number:</p>
  <p style="font-size: 24px; font-weight: bold; color: #2563eb; background: #f0f7ff; padding: 16px; border-radius: 8px; text-align: center;">${ticket.ticketId}</p>
  
  <h3>Issue Details</h3>
  <table style="border-collapse: collapse; width: 100%;">
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Category</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${ticket.category}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Priority</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${ticket.priority}</td>
    </tr>
  </table>
  
  <h3>Description</h3>
  <p style="background: #f5f5f5; padding: 16px; border-radius: 4px;">${ticket.description.replace(/\n/g, '<br>')}</p>
  
  <p>Our team will review your issue and get back to you as soon as possible.</p>
  <p>If you have any questions, please reply to this email or call us at <strong>774-581-9700</strong>.</p>
  
  <p style="margin-top: 24px;">Best regards,<br><strong>The Carehub Team</strong></p>
</div>
      `.trim()
    };

    await client.send(confirmationMsg);
    console.log('Confirmation email sent to', ticket.email);

    return true;
  } catch (error: any) {
    console.error('Failed to send issue notification email:', error);
    if (error?.response?.body) {
      console.error('SendGrid error details:', JSON.stringify(error.response.body, null, 2));
    }
    return false;
  }
}
