# SECURITY.md
## Required Actions:
1. Change all ${VARIABLE} placeholders with actual secrets
2. Generate strong JWT secrets: openssl rand -base64 32
3. Enable MongoDB Atlas network access rules
4. Set up AWS IAM roles with least privilege
5. Configure SSL/TLS certificates
6. Set up secret rotation schedule
7. Enable audit logging
8. Configure DDoS protection
9. Set up WAF rules
10. Enable intrusion detection