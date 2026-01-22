import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

// Verify transporter configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Email transporter error:', error);
    } else {
        console.log('✅ Email server is ready to send messages');
    }
});

/**
 * Send OTP verification email
 */
export const sendOTPEmail = async (
    email: string,
    otp: string,
    name: string
): Promise<void> => {
    const mailOptions = {
        from: `"HalaConnect" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Xác thực tài khoản HalaConnect',
        html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 50px auto;
              background-color: #ffffff;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%);
              color: #ffffff;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .content {
              padding: 40px 30px;
              text-align: center;
            }
            .otp-box {
              background-color: #f9fafb;
              border: 2px dashed #7C3AED;
              border-radius: 8px;
              padding: 20px;
              margin: 30px 0;
              font-size: 36px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #5B21B6;
            }
            .message {
              color: #4b5563;
              font-size: 16px;
              line-height: 1.6;
              margin: 20px 0;
            }
            .footer {
              background-color: #f9fafb;
              padding: 20px;
              text-align: center;
              color: #6b7280;
              font-size: 14px;
            }
            .warning {
              color: #ef4444;
              font-size: 14px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 HalaConnect</h1>
            </div>
            <div class="content">
              <h2>Xin chào ${name}!</h2>
              <p class="message">
                Cảm ơn bạn đã đăng ký tài khoản HalaConnect. Để hoàn tất quá trình đăng ký, 
                vui lòng nhập mã OTP bên dưới:
              </p>
              <div class="otp-box">${otp}</div>
              <p class="message">
                Mã OTP này có hiệu lực trong <strong>10 phút</strong>.
              </p>
              <p class="warning">
                ⚠️ Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.
              </p>
            </div>
            <div class="footer">
              <p>© 2026 HalaConnect. All rights reserved.</p>
              <p>Kết nối với bạn bè và chia sẻ những khoảnh khắc ý nghĩa trong cuộc sống của bạn.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ OTP email sent to ${email}`);
    } catch (error) {
        console.error('❌ Error sending OTP email:', error);
        throw new Error('Failed to send OTP email');
    }
};

/**
 * Generate 4-digit OTP
 */
export const generateOTP = (): string => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};
