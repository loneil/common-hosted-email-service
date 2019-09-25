const config = require('config');
const log = require('npmlog');
const nodemailer = require('nodemailer');

const utils = require('./utils');

let etherealTransporter = undefined;
const smtpTransporter = nodemailer.createTransport({
  host: config.get('server.smtpHost'),
  port: 25,
  tls: {
    rejectUnauthorized: false // do not fail on invalid certs
  }
});

const email = {
  /** Transforms a message object into a nodemailer envelope
   *  @param {object} message An email message object
   *  @returns {object} NodeMailer email envelope object
   */
  createEnvelope: message => {
    const envelope = utils.filterUndefinedAndEmpty(message);
    // Reassign the body field into the type specified by bodyType
    delete Object.assign(envelope, {
      [message.bodyType]: envelope['body']
    })['body'];
    // Remove the bodyType property
    delete envelope['bodyType'];
    return envelope;
  },

  /** Sends an email message using the transporter
   *  @param {object} transporter A nodemailer transport object
   *  @param {object} message An email message object
   *  @returns {object} A nodemailer result object
   */
  sendMail: async (transporter, message) => {
    try {
      const envelope = email.createEnvelope(message);

      // Send mail with defined transport object
      const info = await transporter.sendMail(envelope);

      log.debug('sendMail', info);
      return info;
    } catch (error) {
      log.error('sendMail', error.message);
      throw error;
    }
  },

  /** Creates an email and sends it to the Ethereal fake SMTP server for viewing
   *  @param {object} message An email message object
   *  @returns {string} The url of the generated Ethereal email
   */
  sendMailEthereal: async message => {
    if (!etherealTransporter) {
      // Generate test SMTP service account from ethereal.email
      // Only needed if you don't have a real mail account for testing
      const testAccount = await nodemailer.createTestAccount();
      log.debug(utils.prettyStringify(testAccount));

      // Create reusable transporter object using the default SMTP transport
      // eslint-disable-next-line require-atomic-updates
      etherealTransporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    }

    // Send mail with defined transport object
    const info = await email.sendMail(etherealTransporter, message);

    // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
    log.info('Message sent', info.messageId);

    // Preview only available when sending through an Ethereal account
    const testMessageUrl = nodemailer.getTestMessageUrl(info);
    log.info('Preview URL', testMessageUrl);
    return testMessageUrl;
  },

  /** Creates an email and sends it to the SMTP server
   *  @param {object} message An email message object
   *  @returns {object} A nodemailer result object
   */
  sendMailSmtp: async message => {
    // Send mail with defined transport object
    return await email.sendMail(smtpTransporter, message);
  }
};

module.exports = email;
