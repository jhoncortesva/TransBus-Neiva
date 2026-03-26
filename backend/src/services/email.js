const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  family: 4,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error('❌ Email config error:', error.message);
  } else {
    console.log('✅ Email service ready');
  }
});

const sendWelcomeEmail = async ({ to, fullName, username, password }) => {
  const name = fullName || username;

  await transporter.sendMail({
    from: `"Coomotor" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Bienvenido a Coomotor — Tus datos de acceso',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f4f7ff; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #1565C0; margin: 0;">Coomotor</h1>
          <p style="color: #5C6BC0; margin: 4px 0 0;">Tu mejor compañía de transporte</p>
        </div>

        <div style="background: #ffffff; border-radius: 8px; padding: 24px;">
          <p style="color: #212121; font-size: 15px;">Hola <strong>${name}</strong>,</p>
          <p style="color: #424242; font-size: 14px;">Tu cuenta ha sido creada exitosamente. Aquí están tus datos de acceso:</p>

          <div style="background: #EEF2FF; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #9E9E9E; text-transform: uppercase; letter-spacing: 0.5px;">Usuario</p>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #1A237E;">${username}</p>
          </div>

          <div style="background: #EEF2FF; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #9E9E9E; text-transform: uppercase; letter-spacing: 0.5px;">Contraseña</p>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #1A237E;">${password}</p>
          </div>

          <p style="color: #757575; font-size: 13px; margin-top: 20px;">
            Por seguridad, te recomendamos guardar estos datos en un lugar seguro.
          </p>
        </div>

        <p style="text-align: center; color: #BDBDBD; font-size: 12px; margin-top: 24px;">
          © 2024 Coomotor — Todos los derechos reservados
        </p>
      </div>
    `,
  });
};

module.exports = { sendWelcomeEmail };
