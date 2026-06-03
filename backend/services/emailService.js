// Email Service
class EmailService {
  async initialize() {
    console.log("📧 Email Service: Console mode");
    return true;
  }

  async sendWelcomeEmail(to, name) {
    console.log(`📧 Welcome email to ${name} <${to}>`);
    return { success: true, messageId: `email-${Date.now()}` };
  }

  async healthCheck() {
    return { status: "healthy", mode: "console" };
  }
}

export default new EmailService();
