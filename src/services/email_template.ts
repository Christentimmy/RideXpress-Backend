
function generateEmailOtpTemplate(otpCode: string) {

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Your OTP Code</title>
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
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding: 10px 0;
          }
          .header img {
            max-width: 150px;
          }
          .content {
            text-align: center;
            padding: 20px;
          }
          .otp-code {
            font-size: 24px;
            font-weight: bold;
            color: orange;
            letter-spacing: 5px;
          }
          img {
            color: orange;
          }
          .footer {
            text-align: center;
            padding: 10px;
            font-size: 12px;
            color: #777777;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://res.cloudinary.com/dlpetmfks/image/upload/v1741406161/ECHODATE_g9p6yn.png" alt="Company Logo" width="150" height="100">
          </div>
          <div class="content">
            <h2>Your One-Time Password (OTP)</h2>
            <p>Use the code below to complete your action. This code is valid for 5 minutes.</p>
            <p class="otp-code">${otpCode}</p>
          </div>
          <div class="footer">
            <p>If you did not request this code, please ignore this email.</p>
            <p>&copy; 2025 SIM. All rights reserved.</p>
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
    <title>Email Template</title>
    <style>
        /* Reset default styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: Arial, sans-serif;
        }

        body {
            background-color: #f4f4f4;
            padding: 20px;
        }

        /* Main container */
        .container {
            max-width: 600px;
            margin: 50px auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }

        /* Header section */
        .header {
            text-align: center;
            padding: 20px 0;
            background: #ffffff;
        }

        .header img {
            max-width: 150px;
            height: auto;
        }

        .header h1 {
            color: orange;
            font-size: 24px;
            margin-top: 10px;
            font-weight: bold;
        }

        /* Content section */
        .content {
            padding: 20px;
            text-align: center;
        }

        .greeting {
            font-size: 18px;
            color: #333333;
            margin-bottom: 20px;
            text-align: left;
        }

        .message-box {
            background: #f9f9f9;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 20px;
            line-height: 1.6;
            color: #333333;
            text-align: left;
        }

        .signature {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            color: #333333;
            text-align: left;
        }

        .company-name {
            font-weight: bold;
            color: orange;
            margin-top: 5px;
        }

        /* Footer section */
        .footer {
            text-align: center;
            padding: 10px;
            font-size: 12px;
            color: #777777;
            background: #ffffff;
        }

        .footer p {
            margin-bottom: 5px;
        }

        .copyright {
            color: #777777;
        }

        /* Responsive design */
        @media (max-width: 640px) {
            body {
                padding: 10px;
            }

            .container {
                margin: 20px auto;
                border-radius: 6px;
            }

            .header {
                padding: 15px 0;
            }

            .content {
                padding: 15px;
            }

            .message-box {
                padding: 15px;
            }

            .header h1 {
                font-size: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://res.cloudinary.com/dlpetmfks/image/upload/v1741406161/ECHODATE_g9p6yn.png" alt="Company Logo" width="150" height="100">
            <h1>Important Message</h1>
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
            <p class="copyright">&copy; 2025 SIM. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
  `
}