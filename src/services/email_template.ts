function generateEmailOtpTemplate(otpCode: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Your RideXpress Verification Code</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
        
        body {
          font-family: 'Poppins', Arial, sans-serif;
          background-color: #f8f9fa;
          margin: 0;
          padding: 0;
          color: #333;
          line-height: 1.6;
        }
        .container {
          max-width: 600px;
          margin: 30px auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }
        .header {
          background: linear-gradient(135deg, #FF8C42 0%, #E66B00 100%);
          padding: 30px 20px;
          text-align: center;
          color: white;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        .logo {
          max-width: 180px;
          margin-bottom: 15px;
        }
        .content {
          padding: 30px;
          text-align: center;
        }
        .otp-container {
          margin: 25px 0;
          padding: 20px;
          background-color: #f8f9ff;
          border-radius: 8px;
          display: inline-block;
        }
        .otp-code {
          font-size: 32px;
          font-weight: 700;
          color: #E66B00;
          letter-spacing: 8px;
          padding: 10px 20px;
          background: white;
          border-radius: 6px;
          margin: 10px 0;
          display: inline-block;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        .divider {
          height: 1px;
          background-color: #e9ecef;
          margin: 25px 0;
        }
        .footer {
          text-align: center;
          padding: 20px;
          font-size: 13px;
          color: #6c757d;
          background-color: #f8f9fa;
        }
        .button {
          display: inline-block;
          padding: 12px 30px;
          margin: 20px 0;
          background: #FF8C42;
          color: white !important;
          text-decoration: none;
          border-radius: 50px;
          font-weight: 500;
          transition: all 0.3s ease;
        }
        .button:hover {
          background: #E66B00;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(255, 140, 66, 0.3);
        }
        .note {
          font-size: 14px;
          color: #6c757d;
          margin-top: 20px;
          line-height: 1.5;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>RideXpress</h1>
          <p>Your ride, your way</p>
        </div>
        
        <div class="content">
          <h2>Verify Your Email</h2>
          <p>Hello there! Please use the following verification code to complete your action:</p>
          
          <div class="otp-container">
            <p style="margin: 0 0 10px 0; color: #6c757d;">Your verification code:</p>
            <div class="otp-code">${otpCode}</div>
            <p style="margin: 10px 0 0 0; font-size: 13px; color: #6c757d;">Expires in 5 minutes</p>
          </div>
          
          <p class="note">
            For your security, please do not share this code with anyone. 
            If you didn't request this code, you can safely ignore this email.
          </p>
          
          <div class="divider"></div>
          
          <p>Need help? Contact our <a href="mailto:support@ridexpress.com" style="color: #FF8C42; text-decoration: none; font-weight: 500;">support team</a></p>
        </div>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} RideXpress. All rights reserved.</p>
          <p>
            <a href="https://ridexpress.com" style="color: #FF8C42; text-decoration: none; margin: 0 10px; font-weight: 500;">Website</a>
            <a href="https://ridexpress.com/privacy" style="color: #FF8C42; text-decoration: none; margin: 0 10px; font-weight: 500;">Privacy Policy</a>
            <a href="https://ridexpress.com/terms" style="color: #FF8C42; text-decoration: none; margin: 0 10px; font-weight: 500;">Terms of Service</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export default generateEmailOtpTemplate;

export function generateEmailTemplate(companyName: string, recipientName: string, message: string) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>RideXpress - Important Message</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: 'Poppins', Arial, sans-serif;
            }

            body {
                background-color: #f8f9fa;
                padding: 20px;
                color: #333;
                line-height: 1.6;
            }

            .container {
                max-width: 600px;
                margin: 30px auto;
                background: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            }

            .header {
                background: linear-gradient(135deg, #FF8C42 0%, #E66B00 100%);
                padding: 30px 20px;
                text-align: center;
                color: white;
            }

            .header h1 {
                margin: 10px 0 0 0;
                font-size: 24px;
                font-weight: 600;
                letter-spacing: 0.5px;
            }

            .header p {
                margin: 5px 0 0 0;
                opacity: 0.9;
                font-weight: 300;
            }

            .content {
                padding: 30px;
                text-align: left;
            }

            .greeting {
                font-size: 18px;
                color: #333;
                margin-bottom: 20px;
            }

            .message-box {
                background: #f8f9ff;
                border-left: 4px solid #FF8C42;
                border-radius: 6px;
                padding: 20px;
                margin: 25px 0;
                line-height: 1.7;
                color: #333;
            }

            .signature {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e9ecef;
            }

            .company-name {
                font-weight: 600;
                color: #E66B00;
                margin-top: 5px;
            }

            .footer {
                text-align: center;
                padding: 20px;
                font-size: 13px;
                color: #6c757d;
                background-color: #f8f9fa;
            }

            .footer p {
                margin-bottom: 10px;
            }

            .footer a {
                color: #FF8C42;
                text-decoration: none;
                font-weight: 500;
                margin: 0 10px;
            }

            .footer a:hover {
                text-decoration: underline;
            }

            @media (max-width: 640px) {
                body {
                    padding: 10px;
                }

                .container {
                    margin: 15px auto;
                    border-radius: 10px;
                }

                .header {
                    padding: 20px 15px;
                }

                .content {
                    padding: 20px;
                }

                .message-box {
                    padding: 15px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>RideXpress</h1>
                <p>Your ride, your way</p>
            </div>

            <div class="content">
                <div class="greeting">
                    Dear ${recipientName},
                </div>

                <div class="message-box">
                    ${message}
                </div>

                <div class="signature">
                    <p>Best regards,</p>
                    <p class="company-name">${companyName}</p>
                </div>
            </div>

            <div class="footer">
                <p>If you did not request this message, please ignore this email.</p>
                <p>
                    <a href="https://ridexpress.com">Website</a>
                    <a href="https://ridexpress.com/privacy">Privacy Policy</a>
                    <a href="https://ridexpress.com/terms">Terms of Service</a>
                </p>
                <p class="copyright">&copy; ${new Date().getFullYear()} RideXpress. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `
}