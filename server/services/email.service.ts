import nodemailer, { Transporter } from 'nodemailer';
import sgMail from '@sendgrid/mail';
import { DailyStatistics } from './statistics.service';

export type EmailProvider = 'smtp' | 'sendgrid';

export interface SMTPEmailConfig {
  provider: 'smtp';
  host: string;
  port: number;
  secure: boolean; // true for 465, false for other ports
  auth: {
    user: string;
    pass: string;
  };
  from: string; // Sender email address
  to: string; // Recipient email address(es) - comma separated
}

export interface SendGridEmailConfig {
  provider: 'sendgrid';
  apiKey: string;
  from: string; // Sender email address
  to: string; // Recipient email address(es) - comma separated
}

export type EmailConfig = SMTPEmailConfig | SendGridEmailConfig;

export class EmailService {
  private provider: EmailProvider;
  private transporter?: Transporter; // For SMTP
  private from: string;
  private to: string[];

  constructor(config: EmailConfig) {
    this.provider = config.provider;
    this.from = config.from;
    this.to = config.to.split(',').map(email => email.trim());

    if (config.provider === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth,
      });
    } else if (config.provider === 'sendgrid') {
      sgMail.setApiKey(config.apiKey);
    }
  }

  /**
   * Send daily statistics email
   */
  async sendDailyStatisticsReport(stats: DailyStatistics): Promise<void> {
    const subject = `Daily Statistics Report - ${stats.date}`;
    
    const html = this.generateStatisticsEmailHTML(stats);
    const text = this.generateStatisticsEmailText(stats);

    try {
      if (this.provider === 'smtp' && this.transporter) {
        await this.transporter.sendMail({
          from: this.from,
          to: this.to.join(','),
          subject,
          text,
          html,
        });
      } else if (this.provider === 'sendgrid') {
        await sgMail.send({
          from: this.from,
          to: this.to,
          subject,
          text,
          html,
        });
      } else {
        throw new Error('Email provider not properly configured');
      }
      console.log(`✅ Daily statistics email sent successfully for ${stats.date}`);
    } catch (error) {
      console.error('❌ Failed to send daily statistics email:', error);
      throw error;
    }
  }

  /**
   * Generate HTML email content
   */
  private generateStatisticsEmailHTML(stats: DailyStatistics): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #4CAF50;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 5px 5px 0 0;
    }
    .content {
      background-color: #f9f9f9;
      padding: 20px;
      border-radius: 0 0 5px 5px;
    }
    .stat-box {
      background-color: white;
      padding: 15px;
      margin: 10px 0;
      border-radius: 5px;
      border-left: 4px solid #4CAF50;
    }
    .stat-label {
      font-size: 14px;
      color: #666;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 32px;
      font-weight: bold;
      color: #333;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Daily Statistics Report</h1>
    <p>${stats.date}</p>
  </div>
  <div class="content">
    <div class="stat-box">
      <div class="stat-label">New Users</div>
      <div class="stat-value">${stats.newUsers}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Users Logged In</div>
      <div class="stat-value">${stats.loggedInUsers}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">New Listings (Ads)</div>
      <div class="stat-value">${stats.newListings}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Total Active Listings</div>
      <div class="stat-value">${stats.activeListings}</div>
    </div>
  </div>
  <div class="footer">
    <p>This is an automated daily report from JS Classified Server</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text email content
   */
  private generateStatisticsEmailText(stats: DailyStatistics): string {
    return `
Daily Statistics Report - ${stats.date}

New Users: ${stats.newUsers}
Users Logged In: ${stats.loggedInUsers}
New Listings (Ads): ${stats.newListings}
Total Active Listings: ${stats.activeListings}

This is an automated daily report from JS Classified Server
    `.trim();
  }

  /**
   * Test email connection
   */
  async verifyConnection(): Promise<boolean> {
    try {
      if (this.provider === 'smtp' && this.transporter) {
        await this.transporter.verify();
        console.log('✅ SMTP email service connection verified');
        return true;
      } else if (this.provider === 'sendgrid') {
        // SendGrid API key validation - try to get API key info
        // Note: SendGrid doesn't have a simple verify method, so we'll just log
        console.log('✅ SendGrid email service configured');
        return true;
      } else {
        console.error('❌ Email provider not properly configured');
        return false;
      }
    } catch (error) {
      console.error('❌ Email service connection failed:', error);
      return false;
    }
  }
}

