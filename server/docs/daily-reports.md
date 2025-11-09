# Daily Statistics Reports

This server supports automated daily email reports with statistics about your classified platform.

## Features

The daily report includes:
- **New Users**: Number of users registered in the past 24 hours
- **Users Logged In**: Number of users who logged in during the past 24 hours
- **New Listings (Ads)**: Number of new listings created in the past 24 hours
- **Total Active Listings**: Current count of all active listings

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

#### Option 1: SendGrid (Twilio SendGrid - Direct API) 🆓 FREE

SendGrid (Twilio SendGrid) is recommended for GCP deployments. Uses direct API (not GCP Marketplace), works perfectly with Cloud Run, and has no port restrictions.

**Free Tier:** 12,000 emails/month (perfect for daily reports - only need ~30/month!)

```bash
# Enable email service
EMAIL_ENABLED=true
EMAIL_PROVIDER=sendgrid

# SendGrid Configuration
SENDGRID_API_KEY=your-sendgrid-api-key    # Get from SendGrid dashboard
EMAIL_FROM=noreply@yourdomain.com         # Verified sender email in SendGrid
EMAIL_TO=admin@example.com                # Recipient email(s) - comma-separated

# Enable daily cron job
CRON_DAILY_REPORT_ENABLED=true
CRON_DAILY_REPORT_TIME=0 9 * * *          # 9 AM daily (optional)
```

**Getting SendGrid API Key (Free - No Credit Card Required):**
1. Sign up at [SendGrid](https://sendgrid.com) - **Free tier: 12,000 emails/month forever**
2. Go to Settings → API Keys
3. Create a new API key with "Mail Send" permissions
4. Copy the API key (you won't see it again!)
5. Verify your sender email in Settings → Sender Authentication

**Note:** For daily reports (1 email/day = 30/month), the free tier is more than enough! See [free-email-services.md](./free-email-services.md) for more free options.

#### Option 2: SMTP (Gmail, Outlook, etc.)

```bash
# Enable email service
EMAIL_ENABLED=true
EMAIL_PROVIDER=smtp

# SMTP Configuration
EMAIL_HOST=smtp.gmail.com          # Your SMTP server host
EMAIL_PORT=587                     # SMTP port (587 for TLS, 465 for SSL)
EMAIL_SECURE=false                 # true for port 465 (SSL), false for port 587 (TLS)
EMAIL_USER=your-email@gmail.com    # SMTP username
EMAIL_PASSWORD=your-app-password   # SMTP password or app-specific password
EMAIL_FROM=your-email@gmail.com   # Sender email address
EMAIL_TO=admin@example.com         # Recipient email(s) - comma-separated for multiple

# Enable daily cron job
CRON_DAILY_REPORT_ENABLED=true
CRON_DAILY_REPORT_TIME=0 9 * * *   # 9 AM daily (optional)
```

### GCP Deployment Notes

**Important:** GCP blocks outbound traffic on standard email ports (25, 465, 587) to prevent abuse. For Cloud Run deployments:

✅ **Recommended:** Use SendGrid API (no port restrictions)
- Available in GCP Marketplace
- Free tier: 12,000 emails/month
- Better deliverability
- No port configuration needed

⚠️ **Alternative:** Use SMTP with non-standard ports (if your provider supports it)
- Some providers offer alternative ports like 2525
- Check with your email provider

### Gmail Setup (SMTP)

If using Gmail with SMTP, you'll need to:

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
   - Use this password as `EMAIL_PASSWORD`

**Note:** Gmail SMTP may not work directly from Cloud Run due to port restrictions. Consider using SendGrid instead.

### Other Email Providers (SMTP)

#### Outlook/Hotmail
```bash
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_SECURE=false
```

#### SendGrid (via SMTP - not recommended, use API instead)
If you must use SMTP (not recommended for GCP):
```bash
EMAIL_PROVIDER=smtp
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
```

**Better:** Use SendGrid API (see Option 1 above) - no port restrictions!

#### Custom SMTP
Use your provider's SMTP settings. Common ports:
- **587**: TLS (EMAIL_SECURE=false)
- **465**: SSL (EMAIL_SECURE=true)

## Cron Schedule Format

The cron schedule uses standard cron syntax:

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, where 0 and 7 are Sunday)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### Examples

- `0 9 * * *` - Every day at 9:00 AM
- `0 0 * * *` - Every day at midnight
- `0 9 * * 1` - Every Monday at 9:00 AM
- `0 9 1 * *` - First day of every month at 9:00 AM
- `*/30 * * * *` - Every 30 minutes (for testing)

## Testing

To test the email service manually, you can create a simple test script or use the server's health check endpoint.

The cron job will automatically:
1. Run at the scheduled time
2. Gather statistics from the database
3. Send an email with the report

## Disabling

To disable daily reports, set:
```bash
CRON_DAILY_REPORT_ENABLED=false
```

Or remove the environment variable entirely. The server will continue to run normally without sending reports.

## Troubleshooting

### Email not sending
1. Check that `EMAIL_ENABLED=true`
2. Verify all email environment variables are set correctly
3. Check SMTP credentials (username/password)
4. For Gmail, ensure you're using an App Password, not your regular password
5. Check server logs for error messages

### Cron job not running
1. Verify `CRON_DAILY_REPORT_ENABLED=true`
2. Check the cron schedule format is correct
3. Ensure the server is running at the scheduled time
4. Check server logs for cron job initialization messages

### Statistics seem incorrect
- The report shows statistics for **yesterday** (the previous 24 hours)
- Make sure your database has the correct timezone settings
- Verify that `createdAt` and `lastLogin` fields are being updated correctly

