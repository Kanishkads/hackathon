
export interface SamplePrompt {
  id: string;
  title: string;
  category: 'Critical Secrets' | 'PII & Customer Data' | 'Code & Config' | 'Clean Prompt';
  description: string;
  badge: string;
  text: string;
}

export const SAMPLE_PROMPTS: SamplePrompt[] = [
  {
    id: 'aws-db-incident',
    title: 'Cloud Incident & DB Credentials',
    category: 'Critical Secrets',
    badge: 'Critical Risks',
    description: 'Contains AWS Access Key, database password, and engineer contact email.',
    text: `URGENT: Our production cluster in us-east-1 is throwing connection timeouts.
Please review this config script before deployment:

AWS_REGION = "us-east-1"
AWS_ACCESS_KEY_ID = "[REDACTED_AWS_ACCESS_KEY]"
database_password = "[REDACTED_DATABASE_PASSWORD]"
primary_engineer = "devops-lead@company-internal.net"

What could be causing the connection failure to the RDS cluster?`
  },
  {
    id: 'customer-support-ticket',
    title: 'Customer Escalation & PII',
    category: 'PII & Customer Data',
    badge: 'PII Leak',
    description: 'Contains customer phone numbers, personal email, and account info.',
    text: `Customer escalation ticket #4891:
User Jonathan Vance reported billing dispute on plan Enterprise-Tier.
Contact phone: +1 (555) 389-2049
Alternate phone: 415-555-0199
Registered email: jonathan.vance@enterprise-client.org

Please draft an apology email and compute the refund breakdown for March 2026.`
  },
  {
    id: 'api-tokens-leak',
    title: 'OpenAI, GitHub & Slack Tokens',
    category: 'Code & Config',
    badge: 'Multi-Key Leak',
    description: 'Contains redacted examples of OpenAI, GitHub, and Slack tokens.',
    text: `I'm writing a Python integration script to sync issues with our repository:

import os
OPENAI_API_KEY = "[REDACTED_OPENAI_KEY]"
GITHUB_TOKEN = "[REDACTED_GITHUB_TOKEN]"
SLACK_TOKEN = "[REDACTED_SLACK_TOKEN]"

How do I authenticate with GitHub GraphQL API and post an AI summary back to the Slack channel?`
  },
  {
    id: 'clean-architecture-prompt',
    title: 'Safe Architecture Inquiry',
    category: 'Clean Prompt',
    badge: 'Zero Risk',
    description: 'Clean technical prompt without any sensitive credentials or personal data.',
    text: `Could you explain the architectural differences between an event-driven microservices architecture using Apache Kafka versus a message-queue pattern using RabbitMQ? Please highlight latency, backpressure, and fault tolerance trade-offs.`
  }
];

