import sgMail from '@sendgrid/mail';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('SendGrid not connected');
  }
  return {apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email};
}

export async function getUncachableSendGridClient() {
  const {apiKey, email} = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
  };
}

export interface FileAttachment {
  content: string;
  filename: string;
  type: string;
  disposition: 'attachment';
}

export async function sendIssueNotification(ticket: {
  category: string;
  priority: string;
  description: string;
  email: string;
}, attachment?: FileAttachment) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    
    const msg: any = {
      to: 'info@carehubapp.com',
      from: fromEmail,
      subject: `[Carehub Issue] ${ticket.priority.toUpperCase()} - ${ticket.category}`,
      text: `
New Issue Submitted

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
      msg.attachments = [attachment];
    }

    await client.send(msg);
    console.log('Issue notification email sent to info@carehubapp.com');
    return true;
  } catch (error) {
    console.error('Failed to send issue notification email:', error);
    return false;
  }
}
