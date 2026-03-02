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

// Ride notification types
export interface RideNotificationData {
  rideId: number;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  bookerEmail?: string;
  pickupAddress: string;
  dropoffAddress: string;
  appointmentTime: Date;
  driverName?: string;
  driverPhone?: string;
  estimatedFare?: string;
  status: string;
}

// Send notification to customer when driver is assigned
export async function sendDriverAssignedEmail(data: RideNotificationData) {
  const recipientEmail = data.bookerEmail || data.patientEmail;
  if (!recipientEmail) {
    console.log('No email address available for customer notification');
    return false;
  }

  try {
    const { client, fromEmail } = getSendGridClient();
    
    const appointmentDate = new Date(data.appointmentTime);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', { 
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
    });
    const formattedTime = appointmentDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', minute: '2-digit', hour12: true 
    });

    const msg = {
      to: recipientEmail,
      from: fromEmail,
      subject: `Your Carehub Ride is Confirmed - Driver Assigned`,
      text: `
Great news! A driver has been assigned to your ride.

Ride Details:
Patient: ${data.patientName}
Pickup: ${data.pickupAddress}
Drop-off: ${data.dropoffAddress}
Date: ${formattedDate}
Time: ${formattedTime}

Driver Information:
Name: ${data.driverName || 'Assigned driver'}
Phone: ${data.driverPhone || 'Will be provided'}

Your driver will contact you before pickup. If you need to make changes, please call us at 774-581-9700.

Thank you for choosing Carehub!
      `.trim(),
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #16a34a;">Your Driver Has Been Assigned</h2>
  <p>Great news! A driver has been assigned to your ride.</p>
  
  <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <h3 style="margin-top: 0; color: #15803d;">Driver Information</h3>
    <p style="margin: 4px 0;"><strong>Name:</strong> ${data.driverName || 'Assigned driver'}</p>
    <p style="margin: 4px 0;"><strong>Phone:</strong> ${data.driverPhone || 'Will be provided'}</p>
  </div>
  
  <h3>Ride Details</h3>
  <table style="border-collapse: collapse; width: 100%;">
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Patient</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${data.patientName}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Date</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${formattedDate}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Time</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${formattedTime}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Pickup</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${data.pickupAddress}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Drop-off</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${data.dropoffAddress}</td>
    </tr>
  </table>
  
  <p style="margin-top: 16px;">Your driver will contact you before pickup. If you need to make changes, please call us at <strong>774-581-9700</strong>.</p>
  
  <p style="margin-top: 24px;">Thank you for choosing Carehub!</p>
</div>
      `.trim()
    };

    await client.send(msg);
    console.log('Driver assigned notification sent to', recipientEmail);
    return true;
  } catch (error: any) {
    console.error('Failed to send driver assigned email:', error);
    return false;
  }
}

// Send notification to customer when driver is on the way
export async function sendDriverOnWayEmail(data: RideNotificationData) {
  const recipientEmail = data.bookerEmail || data.patientEmail;
  if (!recipientEmail) return false;

  try {
    const { client, fromEmail } = getSendGridClient();

    const msg = {
      to: recipientEmail,
      from: fromEmail,
      subject: `Your Carehub Driver is On The Way`,
      text: `
Your driver ${data.driverName || ''} is on the way to pick up ${data.patientName}.

Pickup Location: ${data.pickupAddress}

Please be ready at the pickup location. Your driver will call when they arrive.

Questions? Call us at 774-581-9700.
      `.trim(),
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #2563eb;">Your Driver is On The Way</h2>
  <p>Your driver <strong>${data.driverName || ''}</strong> is on the way to pick up <strong>${data.patientName}</strong>.</p>
  
  <div style="background: #eff6ff; border: 1px solid #93c5fd; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <p style="margin: 0;"><strong>Pickup Location:</strong> ${data.pickupAddress}</p>
  </div>
  
  <p>Please be ready at the pickup location. Your driver will call when they arrive.</p>
  <p>Questions? Call us at <strong>774-581-9700</strong>.</p>
</div>
      `.trim()
    };

    await client.send(msg);
    console.log('Driver on way notification sent to', recipientEmail);
    return true;
  } catch (error: any) {
    console.error('Failed to send driver on way email:', error);
    return false;
  }
}

// Send notification to customer when ride is completed
export async function sendRideCompletedEmail(data: RideNotificationData & { totalFare?: string }) {
  const recipientEmail = data.bookerEmail || data.patientEmail;
  if (!recipientEmail) return false;

  try {
    const { client, fromEmail } = getSendGridClient();

    const msg = {
      to: recipientEmail,
      from: fromEmail,
      subject: `Your Carehub Ride is Complete`,
      text: `
Thank you for riding with Carehub!

Ride Summary:
Patient: ${data.patientName}
From: ${data.pickupAddress}
To: ${data.dropoffAddress}
Driver: ${data.driverName || 'Your driver'}
${data.totalFare ? `Total Fare: ${data.totalFare}` : ''}

We hope you had a great experience. If you have any feedback, please reply to this email.

Thank you for choosing Carehub!
      `.trim(),
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #16a34a;">Ride Complete</h2>
  <p>Thank you for riding with Carehub!</p>
  
  <h3>Ride Summary</h3>
  <table style="border-collapse: collapse; width: 100%;">
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Patient</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${data.patientName}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">From</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${data.pickupAddress}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">To</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${data.dropoffAddress}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Driver</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${data.driverName || 'Your driver'}</td>
    </tr>
    ${data.totalFare ? `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Total Fare</td>
      <td style="padding: 8px; border: 1px solid #ddd; font-size: 18px; color: #16a34a;">${data.totalFare}</td>
    </tr>
    ` : ''}
  </table>
  
  <p style="margin-top: 16px;">We hope you had a great experience. If you have any feedback, please reply to this email.</p>
  
  <p style="margin-top: 24px;">Thank you for choosing Carehub!</p>
</div>
      `.trim()
    };

    await client.send(msg);
    console.log('Ride completed notification sent to', recipientEmail);
    return true;
  } catch (error: any) {
    console.error('Failed to send ride completed email:', error);
    return false;
  }
}

// Send notification to driver about new ride assignment
export async function sendDriverNewRideEmail(driverEmail: string, data: RideNotificationData) {
  if (!driverEmail) return false;

  try {
    const { client, fromEmail } = getSendGridClient();
    
    const appointmentDate = new Date(data.appointmentTime);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', { 
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
    });
    const formattedTime = appointmentDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', minute: '2-digit', hour12: true 
    });

    const msg = {
      to: driverEmail,
      from: fromEmail,
      subject: `New Ride Assignment - ${formattedDate}`,
      text: `
You have been assigned a new ride!

Ride Details:
Patient: ${data.patientName}
Patient Phone: ${data.patientPhone}
Date: ${formattedDate}
Time: ${formattedTime}

Pickup: ${data.pickupAddress}
Drop-off: ${data.dropoffAddress}

${data.estimatedFare ? `Estimated Fare: ${data.estimatedFare}` : ''}

Please contact the patient before pickup. Open the Carehub app for navigation and status updates.

Questions? Call dispatch at 774-581-9700.
      `.trim(),
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #2563eb;">New Ride Assignment</h2>
  <p>You have been assigned a new ride!</p>
  
  <div style="background: #eff6ff; border: 1px solid #93c5fd; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <h3 style="margin-top: 0; color: #1d4ed8;">Appointment</h3>
    <p style="font-size: 18px; margin: 4px 0;"><strong>${formattedDate}</strong></p>
    <p style="font-size: 18px; margin: 4px 0;"><strong>${formattedTime}</strong></p>
  </div>
  
  <h3>Patient Information</h3>
  <table style="border-collapse: collapse; width: 100%;">
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Name</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${data.patientName}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Phone</td>
      <td style="padding: 8px; border: 1px solid #ddd;"><a href="tel:${data.patientPhone}">${data.patientPhone}</a></td>
    </tr>
  </table>
  
  <h3>Locations</h3>
  <table style="border-collapse: collapse; width: 100%;">
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Pickup</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${data.pickupAddress}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Drop-off</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${data.dropoffAddress}</td>
    </tr>
  </table>
  
  ${data.estimatedFare ? `<p style="font-size: 18px; margin-top: 16px;"><strong>Estimated Fare:</strong> ${data.estimatedFare}</p>` : ''}
  
  <p style="margin-top: 16px;">Please contact the patient before pickup. Open the Carehub app for navigation and status updates.</p>
  <p>Questions? Call dispatch at <strong>774-581-9700</strong>.</p>
</div>
      `.trim()
    };

    await client.send(msg);
    console.log('New ride assignment email sent to driver:', driverEmail);
    return true;
  } catch (error: any) {
    console.error('Failed to send driver new ride email:', error);
    return false;
  }
}

// Test email function
export async function sendTestEmail(toEmail: string) {
  try {
    const { client, fromEmail } = getSendGridClient();

    const msg = {
      to: toEmail,
      from: fromEmail,
      subject: `Carehub Email Test - ${new Date().toLocaleString()}`,
      text: `This is a test email from Carehub. If you received this, email notifications are working correctly!`,
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #16a34a;">Email Test Successful</h2>
  <p>This is a test email from Carehub.</p>
  <p>If you received this, email notifications are working correctly!</p>
  <p style="color: #666; font-size: 14px;">Sent at: ${new Date().toLocaleString()}</p>
</div>
      `.trim()
    };

    await client.send(msg);
    console.log('Test email sent to', toEmail);
    return { success: true, message: `Test email sent to ${toEmail}` };
  } catch (error: any) {
    console.error('Failed to send test email:', error);
    return { success: false, message: error.message || 'Failed to send test email' };
  }
}

export async function sendRideBookedForPatientEmail(data: {
  patientName: string;
  patientEmail: string;
  bookerName: string;
  bookerRelation: string;
  pickupAddress: string;
  dropoffAddress: string;
  appointmentTime: Date;
  estimatedFare?: string;
  rideId: number;
}) {
  try {
    const { client, fromEmail } = getSendGridClient();

    const appointmentDate = new Date(data.appointmentTime);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
    const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true
    });

    const relationLabel: Record<string, string> = {
      spouse: 'Your spouse',
      child: 'Your child',
      parent: 'Your parent',
      caregiver: 'Your caregiver',
      other: data.bookerName
    };
    const who = relationLabel[data.bookerRelation] || data.bookerName;

    const msg = {
      to: data.patientEmail,
      from: fromEmail,
      subject: `A Medical Ride Has Been Booked For You - CareHub`,
      text: `
Hi ${data.patientName},

${who} (${data.bookerName}) has booked a medical ride for you through CareHub.

Ride Details:
Pickup: ${data.pickupAddress}
Drop-off: ${data.dropoffAddress}
Date: ${formattedDate}
Time: ${formattedTime}
${data.estimatedFare ? `Estimated Fare: $${data.estimatedFare}` : ''}

A driver will be assigned to your ride and will contact you before pickup. You'll receive another notification once a driver accepts your ride.

If you have any questions or need to cancel, please contact us at 774-581-9700 or reply to this email.

Thank you,
The CareHub Team
      `.trim(),
      html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #10b981, #0d9488); padding: 24px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">A Ride Has Been Booked For You</h1>
  </div>
  
  <div style="padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; color: #374151;">Hi <strong>${data.patientName}</strong>,</p>
    
    <p style="font-size: 16px; color: #374151;">
      <strong>${who}</strong> (${data.bookerName}) has booked a medical ride for you through CareHub.
    </p>
    
    <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #15803d; font-size: 16px;">Ride Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; width: 100px;">Pickup</td>
          <td style="padding: 8px 0; color: #374151; font-weight: bold;">${data.pickupAddress}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Drop-off</td>
          <td style="padding: 8px 0; color: #374151; font-weight: bold;">${data.dropoffAddress}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Date</td>
          <td style="padding: 8px 0; color: #374151; font-weight: bold;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Time</td>
          <td style="padding: 8px 0; color: #374151; font-weight: bold;">${formattedTime}</td>
        </tr>
        ${data.estimatedFare ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Est. Fare</td>
          <td style="padding: 8px 0; color: #374151; font-weight: bold;">$${data.estimatedFare}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">
      A driver will be assigned to your ride and will contact you before pickup. 
      You'll receive another notification once a driver accepts your ride.
    </p>
    
    <p style="color: #6b7280; font-size: 14px;">
      If you have questions or need to cancel, call us at <strong>774-581-9700</strong>.
    </p>
    
    <p style="margin-top: 24px; color: #374151;">Thank you,<br><strong>The CareHub Team</strong></p>
  </div>
</div>
      `.trim()
    };

    await client.send(msg);
    console.log('Ride booked notification sent to patient:', data.patientEmail);
    return true;
  } catch (error: any) {
    console.error('Failed to send ride booked notification to patient:', error);
    if (error?.response?.body) {
      console.error('SendGrid error details:', JSON.stringify(error.response.body, null, 2));
    }
    return false;
  }
}
